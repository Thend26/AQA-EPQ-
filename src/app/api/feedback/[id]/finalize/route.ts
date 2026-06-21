import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import { generatedFeedbackSchema } from "@/lib/deepseek/schema";
import {
  FeedbackConflictError,
  finalizeFeedback,
  loadFeedback,
  RepositoryStorageUnavailableError,
} from "@/lib/repositories/feedbacks";

const finalizeRequestSchema = z
  .object({
    draft: generatedFeedbackSchema,
    expectedRevision: z.number().int().min(0),
  })
  .strict();
const feedbackIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = feedbackIdSchema.safeParse((await context.params).id);
  if (!id.success) {
    return apiError("Invalid feedback id", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }
  const parsed = finalizeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid finalization request");
  }

  const feedback = await loadFeedback(auth.db, auth.user.id, id.data);
  if (feedback.error) {
    return apiError("Feedback is temporarily unavailable", 503);
  }
  if (feedback.notFound || !feedback.data) {
    return apiError("Feedback not found", 404);
  }
  if (feedback.data.status !== "draft") {
    return apiError("Feedback is already final", 409);
  }
  if (feedback.data.revision !== parsed.data.expectedRevision) {
    return apiError("Feedback changed; refresh before finalizing", 409);
  }
  if (feedback.data.draft.mode !== parsed.data.draft.mode) {
    return apiError("Feedback language mode cannot be changed", 400);
  }

  const result = await finalizeFeedback(
    auth.user.id,
    id.data,
    parsed.data.expectedRevision,
    parsed.data.draft,
  );
  if (result.error instanceof FeedbackConflictError) {
    return apiError("Feedback changed; refresh before finalizing", 409);
  }
  if (result.error instanceof RepositoryStorageUnavailableError) {
    return apiError("Feedback storage is temporarily unavailable", 503);
  }
  if (result.error) {
    return apiError("Feedback could not be finalized", 503);
  }
  if (result.issues.length > 0) {
    return NextResponse.json(
      { error: "Feedback quality checks failed", issues: result.issues },
      { status: 422 },
    );
  }
  if (!result.finalized) {
    return apiError("Feedback not found", 404);
  }

  return NextResponse.json({
    feedbackId: id.data,
    status: "final",
    revision: result.revision,
  });
}

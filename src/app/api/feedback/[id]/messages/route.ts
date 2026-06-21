import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import {
  DeepSeekError,
  generateWithDeepSeek,
} from "@/lib/deepseek/client";
import { buildRevisionPrompt } from "@/lib/domain/prompt";
import { checkFeedbackQuality } from "@/lib/domain/quality";
import { generatedFeedbackSchema } from "@/lib/deepseek/schema";
import {
  createFeedbackDraft,
  FeedbackConflictError,
  loadFeedback,
  RepositoryStorageUnavailableError,
} from "@/lib/repositories/feedbacks";
import { loadGenerationContext } from "@/lib/repositories/generation-context";

const revisionRequestSchema = z
  .object({
    instruction: z.string().trim().min(1).max(2_000),
    expectedRevision: z.number().int().min(0),
    draft: generatedFeedbackSchema,
  })
  .strict();
const feedbackIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

function providerErrorResponse(error: DeepSeekError) {
  if (error.code === "rate_limit") {
    return apiError("AI generation rate limit reached", 429);
  }
  if (error.code === "configuration" || error.code === "timeout") {
    return apiError("AI generation is temporarily unavailable", 503);
  }
  return apiError("AI generation failed", 502);
}

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
  const parsed = revisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid revision request");
  }

  const feedback = await loadFeedback(auth.db, auth.user.id, id.data);
  if (feedback.error) {
    return apiError("Feedback is temporarily unavailable", 503);
  }
  if (feedback.notFound || !feedback.data) {
    return apiError("Feedback not found", 404);
  }
  if (feedback.data.status !== "draft") {
    return apiError("Final feedback cannot be revised", 409);
  }
  if (feedback.data.revision !== parsed.data.expectedRevision) {
    return apiError("Feedback changed; refresh before revising", 409);
  }
  if (feedback.data.draft.mode !== parsed.data.draft.mode) {
    return apiError("Feedback language mode cannot be changed", 400);
  }

  const generationContext = await loadGenerationContext(
    auth.db,
    auth.user.id,
    feedback.data.dailyRecordId,
  );
  if (generationContext.error) {
    return apiError("Feedback context is temporarily unavailable", 503);
  }
  if (generationContext.notFound || !generationContext.data) {
    return apiError("Feedback context not found", 404);
  }

  const allowedRecordIds = new Set(feedback.data.contextRecordIds);
  const records = generationContext.data.records.filter((record) =>
    allowedRecordIds.has(record.id),
  );
  const prompt = buildRevisionPrompt({
    languageMode: feedback.data.draft.mode,
    student: generationContext.data.student,
    records,
    priorFeedbacks: generationContext.data.priorFeedbacks,
    instruction: parsed.data.instruction,
    originalDraft: parsed.data.draft,
    conversationHistory: feedback.data.messages,
  });

  try {
    const draft = await generateWithDeepSeek(prompt);
    if (draft.mode !== feedback.data.draft.mode) {
      return apiError("AI generation returned an invalid response", 502);
    }

    const revised = await createFeedbackDraft(auth.user.id, {
      dailyRecordId: feedback.data.dailyRecordId,
      draft,
      contextRecordIds: feedback.data.contextRecordIds,
      sourceFeedbackId: feedback.data.id,
      expectedRevision: parsed.data.expectedRevision,
      userMessage: parsed.data.instruction,
      assistantMessage: JSON.stringify(draft).slice(0, 12_000),
    });
    if (revised.error instanceof FeedbackConflictError) {
      return apiError("Feedback changed; refresh before revising", 409);
    }
    if (revised.error instanceof RepositoryStorageUnavailableError) {
      return apiError("Feedback storage is temporarily unavailable", 503);
    }
    if (revised.error) {
      return apiError("Revised feedback could not be saved", 503);
    }
    if (revised.notFound || !revised.data) {
      return apiError("Daily record not found", 404);
    }

    return NextResponse.json({
      feedback: revised.data,
      draft,
      issues: checkFeedbackQuality(draft),
    });
  } catch (error) {
    if (error instanceof DeepSeekError) {
      return providerErrorResponse(error);
    }
    return apiError("AI generation failed", 502);
  }
}

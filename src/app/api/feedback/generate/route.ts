import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import {
  DeepSeekError,
  generateWithDeepSeek,
} from "@/lib/deepseek/client";
import { buildFeedbackPrompt } from "@/lib/domain/prompt";
import { checkFeedbackQuality } from "@/lib/domain/quality";
import { languageModeSchema } from "@/lib/domain/types";
import { loadGenerationContext } from "@/lib/repositories/generation-context";

const generationRequestSchema = z
  .object({
    dailyRecordId: z.string().uuid(),
    languageMode: languageModeSchema,
    instruction: z.string().max(2_000).default(""),
  })
  .strict();

function providerErrorResponse(error: DeepSeekError) {
  if (error.code === "rate_limit") {
    return apiError("AI generation rate limit reached", 429);
  }
  if (error.code === "configuration" || error.code === "timeout") {
    return apiError("AI generation is temporarily unavailable", 503);
  }
  return apiError("AI generation failed", 502);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const parsed = generationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid generation request");
  }

  const context = await loadGenerationContext(
    auth.db,
    auth.user.id,
    parsed.data.dailyRecordId,
  );
  if (context.error) {
    return apiError("Generation context is temporarily unavailable", 503);
  }
  if (context.notFound || !context.data) {
    return apiError("Daily record not found", 404);
  }

  const prompt = buildFeedbackPrompt({
    languageMode: parsed.data.languageMode,
    student: context.data.student,
    records: context.data.records,
    priorFeedbacks: context.data.priorFeedbacks,
    instruction: parsed.data.instruction,
  });

  try {
    const draft = await generateWithDeepSeek(prompt);
    if (draft.mode !== parsed.data.languageMode) {
      return apiError("AI generation returned an invalid response", 502);
    }

    return NextResponse.json({
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

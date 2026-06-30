import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import {
  DeepSeekError,
  generateStructuredWithDeepSeek,
} from "@/lib/deepseek/client";
import { buildDocumentRecordDraftPrompt } from "@/lib/documents/record-draft-prompt";
import { documentRecordDraftResponseSchema } from "@/lib/documents/record-draft-schema";
import { listExtractedDocumentsForCampDay } from "@/lib/repositories/ao-analyses";
import { getDeepSeekRuntimeConfig } from "@/lib/settings/deepseek-config";

const requestSchema = z
  .object({
    studentId: z.string().uuid(),
    recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    campDay: z.number().int().min(1).max(60),
  })
  .strict();

function providerErrorResponse(error: DeepSeekError) {
  if (error.code === "rate_limit") return apiError("AI generation rate limit reached", 429);
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid document record draft request");
  }

  const documents = await listExtractedDocumentsForCampDay(
    auth.db,
    auth.user.id,
    parsed.data.studentId,
    parsed.data.campDay,
  );
  if (documents.error) return apiError("Documents are temporarily unavailable", 503);
  if (!documents.data?.length) return apiError("请先等待至少一个文档解析完成", 409);

  const deepseekConfig = await getDeepSeekRuntimeConfig(auth.db, auth.user.id);
  if (!deepseekConfig) return apiError("请先在设置中配置 DeepSeek", 409);

  const prompt = buildDocumentRecordDraftPrompt({
    recordDate: parsed.data.recordDate,
    campDay: parsed.data.campDay,
    documents: documents.data.map((document) => ({
      filename: document.originalFilename,
      extractedText: document.extractedText,
    })),
  });

  try {
    const draft = await generateStructuredWithDeepSeek(
      prompt,
      deepseekConfig,
      documentRecordDraftResponseSchema,
    );
    return NextResponse.json({ data: draft });
  } catch (error) {
    if (error instanceof DeepSeekError) return providerErrorResponse(error);
    return apiError("AI generation failed", 502);
  }
}

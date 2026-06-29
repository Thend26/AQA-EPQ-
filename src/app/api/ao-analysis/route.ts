import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import {
  DeepSeekError,
  generateStructuredWithDeepSeek,
} from "@/lib/deepseek/client";
import {
  aoAnalysisResponseSchema,
} from "@/lib/documents/ao-schema";
import { buildAoAnalysisPrompt } from "@/lib/documents/ao-prompt";
import { getDailyRecord } from "@/lib/repositories/daily-records";
import {
  createAoAnalysis,
  hashAoAnalysisInput,
  listExtractedDocumentsForCampDay,
} from "@/lib/repositories/ao-analyses";
import { getDeepSeekRuntimeConfig } from "@/lib/settings/deepseek-config";

const aoAnalysisRequestSchema = z
  .object({
    studentId: z.string().uuid(),
    recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

  const parsed = aoAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid AO analysis request");
  }

  const dailyRecord = await getDailyRecord(
    auth.db,
    auth.user.id,
    parsed.data.studentId,
    parsed.data.recordDate,
  );
  if (dailyRecord.error) {
    return apiError("Daily record is temporarily unavailable", 503);
  }
  if (dailyRecord.notFound || !dailyRecord.data) {
    return apiError("Daily record not found", 404);
  }

  const documents = await listExtractedDocumentsForCampDay(
    auth.db,
    auth.user.id,
    parsed.data.studentId,
    dailyRecord.data.campDay,
  );
  if (documents.error) {
    return apiError("Documents are temporarily unavailable", 503);
  }
  if (!documents.data?.length) {
    return apiError("请先等待至少一个文档解析完成", 409);
  }

  const deepseekConfig = await getDeepSeekRuntimeConfig(auth.db, auth.user.id);
  if (!deepseekConfig) {
    return apiError("请先在设置中配置 DeepSeek", 409);
  }

  const prompt = buildAoAnalysisPrompt({
    studentName: "该学生",
    campDay: dailyRecord.data.campDay,
    recordDate: dailyRecord.data.recordDate,
    dailyRecord: {
      achievements: dailyRecord.data.achievements,
      evidence: dailyRecord.data.evidence,
      challenges: dailyRecord.data.challenges,
      nextPlan: dailyRecord.data.nextPlan,
      processNotes: dailyRecord.data.processNotes,
    },
    documents: documents.data.map((document) => ({
      filename: document.originalFilename,
      extractedText: document.extractedText,
    })),
  });

  try {
    const analysis = await generateStructuredWithDeepSeek(
      prompt,
      deepseekConfig,
      aoAnalysisResponseSchema,
    );
    const inputHash = hashAoAnalysisInput(`${prompt.system}\n${prompt.user}`);
    const stored = await createAoAnalysis(auth.db, auth.user.id, {
      studentId: parsed.data.studentId,
      documentId: documents.data[0]?.id ?? null,
      campDay: dailyRecord.data.campDay,
      modelId: deepseekConfig.model,
      inputHash,
      inputSummary: prompt.user.slice(0, 4_000),
      analysis,
    });
    if (stored.error || !stored.data) {
      return apiError("AO analysis could not be saved", 503);
    }

    return NextResponse.json({ data: stored.data });
  } catch (error) {
    if (error instanceof DeepSeekError) {
      return providerErrorResponse(error);
    }
    return apiError("AI generation failed", 502);
  }
}

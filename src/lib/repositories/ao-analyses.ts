import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AoAnalysisResponse } from "@/lib/documents/ao-schema";

type RepositoryError = { message: string; code?: string };

type RepositoryResult<T> = {
  data: T | null;
  error: RepositoryError | null;
};

export type ExtractedAnalysisDocument = {
  id: string;
  originalFilename: string;
  extractedText: string;
};

type ExtractedAnalysisDocumentRow = {
  id: string;
  original_filename: string;
  extracted_text: string | null;
};

export type CreateAoAnalysisInput = {
  studentId: string;
  documentId: string | null;
  campDay: number;
  modelId: string;
  inputHash: string;
  inputSummary: string;
  analysis: AoAnalysisResponse;
};

export function hashAoAnalysisInput(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function listExtractedDocumentsForCampDay(
  db: SupabaseClient,
  ownerId: string,
  studentId: string,
  campDay: number,
): Promise<RepositoryResult<ExtractedAnalysisDocument[]>> {
  const result = await db
    .from("student_documents")
    .select("id, original_filename, extracted_text")
    .eq("owner_id", ownerId)
    .eq("student_id", studentId)
    .eq("camp_day", campDay)
    .eq("status", "extracted")
    .not("extracted_text", "is", null)
    .order("created_at", { ascending: true });

  const rows = result.data as ExtractedAnalysisDocumentRow[] | null;
  return {
    data:
      rows?.map((row) => ({
        id: row.id,
        originalFilename: row.original_filename,
        extractedText: row.extracted_text ?? "",
      })) ?? null,
    error: result.error,
  };
}

export async function createAoAnalysis(
  db: SupabaseClient,
  ownerId: string,
  input: CreateAoAnalysisInput,
): Promise<RepositoryResult<AoAnalysisResponse & { id: string }>> {
  const result = await db
    .from("document_ao_analyses")
    .insert({
      owner_id: ownerId,
      student_id: input.studentId,
      document_id: input.documentId,
      camp_day: input.campDay,
      model_id: input.modelId,
      input_hash: input.inputHash,
      input_summary: input.inputSummary,
      ao1_note: input.analysis.ao1.suggestedNote,
      ao2_note: input.analysis.ao2.suggestedNote,
      ao3_note: input.analysis.ao3.suggestedNote,
      ao4_note: input.analysis.ao4.suggestedNote,
    })
    .select("id")
    .single();

  return {
    data: result.data
      ? { id: (result.data as { id: string }).id, ...input.analysis }
      : null,
    error: result.error,
  };
}

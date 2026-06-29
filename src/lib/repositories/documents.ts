import type { SupabaseClient } from "@supabase/supabase-js";

import type { DocumentStatus, StudentDocument } from "@/lib/documents/schema";

export type StudentDocumentRow = {
  id: string;
  owner_id: string;
  student_id: string;
  camp_day: number;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  status: DocumentStatus;
  extracted_text: string | null;
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
};

type RepositoryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export type CreateStudentDocumentInput = {
  id: string;
  studentId: string;
  campDay: number;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
};

export function documentFromRow(row: StudentDocumentRow): StudentDocument {
  return {
    id: row.id,
    ownerId: row.owner_id,
    studentId: row.student_id,
    campDay: row.camp_day,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    status: row.status,
    extractedText: row.extracted_text,
    extractionError: row.extraction_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStudentDocuments(
  db: SupabaseClient,
  ownerId: string,
  studentId: string,
): Promise<RepositoryResult<StudentDocument[]>> {
  const result = await db
    .from("student_documents")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  return {
    data: (result.data as StudentDocumentRow[] | null)?.map(documentFromRow) ?? null,
    error: result.error,
  };
}

export async function createStudentDocument(
  db: SupabaseClient,
  ownerId: string,
  input: CreateStudentDocumentInput,
): Promise<RepositoryResult<StudentDocument>> {
  const result = await db
    .from("student_documents")
    .insert({
      id: input.id,
      owner_id: ownerId,
      student_id: input.studentId,
      camp_day: input.campDay,
      original_filename: input.originalFilename,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      sha256: input.sha256,
      status: "uploaded",
    })
    .select("*")
    .single();

  return {
    data: result.data ? documentFromRow(result.data as StudentDocumentRow) : null,
    error: result.error,
  };
}

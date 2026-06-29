import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import {
  createStudentDocument,
  documentFromRow,
  listStudentDocuments,
} from "@/lib/repositories/documents";

const row = {
  id: "doc-1",
  owner_id: "owner-1",
  student_id: "student-1",
  camp_day: 3,
  original_filename: "proposal.pdf",
  storage_path: "owner-1/student-1/doc-1/proposal.pdf",
  mime_type: "application/pdf",
  byte_size: 1234,
  sha256: "abc",
  status: "uploaded" as const,
  extracted_text: null,
  extraction_error: null,
  created_at: "2026-06-29T10:00:00.000Z",
  updated_at: "2026-06-29T10:00:00.000Z",
};

describe("document repository", () => {
  test("maps database rows to typed documents", () => {
    expect(documentFromRow(row)).toEqual({
      id: "doc-1",
      ownerId: "owner-1",
      studentId: "student-1",
      campDay: 3,
      originalFilename: "proposal.pdf",
      storagePath: "owner-1/student-1/doc-1/proposal.pdf",
      mimeType: "application/pdf",
      byteSize: 1234,
      sha256: "abc",
      status: "uploaded",
      extractedText: null,
      extractionError: null,
      createdAt: "2026-06-29T10:00:00.000Z",
      updatedAt: "2026-06-29T10:00:00.000Z",
    });
  });

  test("lists documents by owner and student", async () => {
    const order = vi.fn().mockResolvedValue({ data: [row], error: null });
    const secondEq = vi.fn(() => ({ order }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const select = vi.fn(() => ({ eq: firstEq }));
    const db = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;

    const result = await listStudentDocuments(db, "owner-1", "student-1");

    expect(firstEq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(secondEq).toHaveBeenCalledWith("student_id", "student-1");
    expect(result.data).toHaveLength(1);
  });

  test("creates owner-scoped document metadata", async () => {
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const db = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;

    await createStudentDocument(db, "owner-1", {
      id: "doc-1",
      studentId: "student-1",
      campDay: 3,
      originalFilename: "proposal.pdf",
      storagePath: "owner-1/student-1/doc-1/proposal.pdf",
      mimeType: "application/pdf",
      byteSize: 1234,
      sha256: "abc",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "doc-1",
        owner_id: "owner-1",
        student_id: "student-1",
        camp_day: 3,
      }),
    );
  });
});

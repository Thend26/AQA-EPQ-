import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/202606230003_student_documents.sql"),
  "utf8",
);

describe("student documents migration", () => {
  test("creates private document storage and metadata tables", () => {
    expect(sql).toMatch(/insert into storage\.buckets[\s\S]+student-documents/i);
    expect(sql).toMatch(/public\.student_documents/i);
    expect(sql).toMatch(/public\.document_jobs/i);
    expect(sql).toMatch(/public\.document_ao_analyses/i);
    expect(sql).toMatch(/extracted_text/i);
    expect(sql).toMatch(/sha256/i);
  });

  test("uses owner-scoped RLS and student foreign keys", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/auth\.uid\(\) = owner_id/i);
    expect(sql).toMatch(/references public\.students \(id, owner_id\)/i);
    expect(sql).toMatch(/on storage\.objects/i);
    expect(sql).toMatch(/bucket_id = 'student-documents'/i);
  });

  test("adds deletion RPC for document metadata cleanup", () => {
    expect(sql).toMatch(/create or replace function public\.mark_student_document_deleted/i);
    expect(sql).toMatch(/p_owner_id uuid/i);
    expect(sql).toMatch(/status = 'deleted'/i);
    expect(sql).toMatch(/to service_role/i);
  });
});

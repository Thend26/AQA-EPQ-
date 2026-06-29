import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202606230004_document_worker_rpcs.sql",
  "utf8",
);

describe("document worker RPC migration", () => {
  it("adds RPCs for claiming and finishing extraction jobs", () => {
    expect(migration).toContain("create or replace function public.claim_document_job");
    expect(migration).toContain("create or replace function public.finish_document_job_success");
    expect(migration).toContain("create or replace function public.finish_document_job_failure");
  });

  it("claims jobs with row locks and marks the document as processing", () => {
    expect(migration).toMatch(/for update skip locked/i);
    expect(migration).toMatch(/set status = 'processing'/i);
    expect(migration).toContain("locked_at = pg_catalog.now()");
    expect(migration).toContain("attempts = job.attempts + 1");
  });

  it("limits worker RPC execution to the service role", () => {
    expect(migration).toMatch(/revoke all on function public\.claim_document_job\(text\) from public;/i);
    expect(migration).toMatch(/grant execute on function public\.claim_document_job\(text\) to service_role;/i);
    expect(migration).toMatch(/grant execute on function public\.finish_document_job_success\(uuid, uuid, uuid, text\) to service_role;/i);
    expect(migration).toMatch(/grant execute on function public\.finish_document_job_failure\(uuid, uuid, uuid, text\) to service_role;/i);
  });
});

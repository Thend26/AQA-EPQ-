import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202606230005_ao_analysis_metadata.sql",
  "utf8",
);

describe("AO analysis metadata migration", () => {
  it("adds model and input audit fields to stored AO analyses", () => {
    expect(migration).toContain("add column if not exists model_id");
    expect(migration).toContain("add column if not exists input_hash");
    expect(migration).toContain("add column if not exists input_summary");
    expect(migration).toMatch(/document_ao_analyses_input_hash_idx/i);
  });
});

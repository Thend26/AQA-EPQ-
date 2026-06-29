import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/202606230002_user_settings.sql"),
  "utf8",
);

describe("user settings migration", () => {
  test("creates owner-scoped settings with RLS", () => {
    expect(sql).toMatch(/create table public\.user_settings/i);
    expect(sql).toMatch(/owner_id uuid primary key references auth\.users/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/auth\.uid\(\) = owner_id/i);
  });

  test("creates default rows for existing and new users", () => {
    expect(sql).toMatch(/insert into public\.user_settings \(owner_id\)[\s\S]+from auth\.users/i);
    expect(sql).toMatch(/create or replace function public\.create_default_user_settings/i);
    expect(sql).toMatch(/after insert on auth\.users/i);
  });
});

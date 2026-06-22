import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "vitest";

const migration = path.join(
  process.cwd(),
  "supabase/migrations/202606220001_auth_profiles.sql",
);

test("creates and backfills profiles for Supabase Auth users", () => {
  const sql = readFileSync(migration, "utf8");

  expect(sql).toMatch(
    /create or replace function public\.handle_new_user_profile/i,
  );
  expect(sql).toMatch(/security definer/i);
  expect(sql).toMatch(/set search_path = pg_catalog, public/i);
  expect(sql).toMatch(/after insert on auth\.users/i);
  expect(sql).toMatch(/insert into public\.profiles/i);
  expect(sql).toMatch(/on conflict \(id\) do nothing/i);
  expect(sql).toMatch(
    /insert into public\.profiles[\s\S]+select[\s\S]+from auth\.users/i,
  );
  expect(sql).toMatch(
    /revoke all on function public\.handle_new_user_profile\(\) from public/i,
  );
});

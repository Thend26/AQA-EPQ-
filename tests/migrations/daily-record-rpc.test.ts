import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/202606210003_daily_record_revisions.sql",
  ),
  "utf8",
);

describe("daily record optimistic write migration", () => {
  test("adds revision and a service-role-only atomic save RPC", () => {
    expect(sql).toMatch(
      /alter table public\.daily_records[\s\S]+add column revision (?:bigint|integer) not null default 0/i,
    );
    expect(sql).toMatch(
      /create or replace function public\.save_daily_record/i,
    );
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = pg_catalog/i);
    expect(sql).toMatch(/p_expected_revision bigint/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(
      /grant execute on function public\.save_daily_record[\s\S]+to service_role/i,
    );
    expect(sql).toMatch(
      /revoke all on function public\.save_daily_record[\s\S]+from authenticated/i,
    );
  });

  test("treats a raced first insert and a stale update as conflicts", () => {
    const body = sql.match(
      /create or replace function public\.save_daily_record[\s\S]+?\$\$;/i,
    )?.[0];
    expect(body).toMatch(
      /if p_expected_revision is null[\s\S]+if exists[\s\S]+return/i,
    );
    expect(body).toMatch(
      /revision = daily_record\.revision \+ 1[\s\S]+daily_record\.revision = p_expected_revision/i,
    );
  });
});

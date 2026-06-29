import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/202606230001_camp_day_enforcement.sql",
  ),
  "utf8",
);

describe("camp day enforcement migration", () => {
  test("replaces the daily record RPC so camp day is computed from the student start date", () => {
    expect(sql).toMatch(/drop function if exists public\.save_daily_record\(/i);
    expect(sql).not.toMatch(/p_camp_day\s+integer/i);
    expect(sql).toMatch(/for share/i);
    expect(sql).toMatch(/v_camp_start_date/i);
    expect(sql).toMatch(/p_record_date\s*-\s*v_camp_start_date\s*\+\s*1/i);
    expect(sql).toMatch(/errcode\s*=\s*'PDR01'/i);
    expect(sql).toMatch(/errcode\s*=\s*'PDR02'/i);
    expect(sql).toMatch(/camp_day\s*=\s*v_camp_day/i);
  });

  test("blocks camp start date changes when records would become inconsistent", () => {
    expect(sql).toMatch(
      /create or replace function public\.prevent_camp_start_date_conflicts/i,
    );
    expect(sql).toMatch(/before update of camp_start_date on public\.students/i);
    expect(sql).toMatch(/from public\.daily_records/i);
    expect(sql).toMatch(/errcode\s*=\s*'PSC01'/i);
    expect(sql).toMatch(
      /Camp start date conflicts with existing records or documents/i,
    );
  });
});

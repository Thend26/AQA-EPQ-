import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/202606210001_feedback_versions.sql",
  ),
  "utf8",
);
const permissionsSql = readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/202606210002_feedback_write_permissions.sql",
  ),
  "utf8",
);

describe("feedback atomic RPC migration", () => {
  test("adds optimistic revision and secured atomic RPCs", () => {
    expect(sql).toMatch(
      /add column revision (?:bigint|integer) not null default 0/i,
    );
    expect(sql).toMatch(/create or replace function public\.create_feedback_draft/i);
    expect(sql).toMatch(/create or replace function public\.finalize_feedback/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = pg_catalog/i);
    expect(sql).toMatch(/revoke all on function public\.create_feedback_draft[\s\S]+from public/i);
    expect(sql).not.toMatch(/grant execute[\s\S]+to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.create_feedback_draft[\s\S]+from authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.create_feedback_draft[\s\S]+to service_role/i);
    expect(sql).toMatch(/revoke all on function public\.finalize_feedback[\s\S]+from public/i);
    expect(sql).toMatch(/grant execute on function public\.finalize_feedback[\s\S]+to service_role/i);
    expect(sql).toMatch(/revoke all on function public\.finalize_feedback[\s\S]+from authenticated/i);
    expect(sql).toMatch(/p_owner_id uuid/i);
    expect(sql).not.toMatch(/auth\.uid\(\)/i);
  });

  test("creates feedback, context, and messages inside the same function body", () => {
    const createBody = sql.match(
      /create or replace function public\.create_feedback_draft[\s\S]+?\$\$;/i,
    )?.[0];
    expect(createBody).toContain("insert into public.feedbacks");
    expect(createBody).toContain("insert into public.feedback_context_records");
    expect(createBody).toContain("insert into public.feedback_messages");
    expect(createBody).toContain("p_expected_revision");
  });

  test("atomically consumes the source revision so two revisions cannot both win", () => {
    const createBody = sql.match(
      /create or replace function public\.create_feedback_draft[\s\S]+?\$\$;/i,
    )?.[0];
    expect(createBody).toMatch(
      /update public\.feedbacks[\s\S]+revision = [\s\S]*revision \+ 1[\s\S]+p_expected_revision/i,
    );
  });
});

test("authenticated can select feedbacks but cannot write them directly", () => {
  expect(permissionsSql).toMatch(
    /grant select on table public\.feedbacks to authenticated/i,
  );
  expect(permissionsSql).toMatch(
    /revoke insert, update, delete on table public\.feedbacks from authenticated/i,
  );
  expect(permissionsSql).toMatch(
    /revoke insert, update, delete on table public\.feedback_context_records from authenticated/i,
  );
  expect(permissionsSql).toMatch(
    /revoke insert, update, delete on table public\.feedback_messages from authenticated/i,
  );
});

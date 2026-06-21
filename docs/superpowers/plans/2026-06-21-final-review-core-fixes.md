# Final Review Core Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close final-review issues 1–5 with grounded finalization, bilingual evidence consistency, optimistic daily-record writes, explicit autosave retry, and readable feedback history.

**Architecture:** Keep generated feedback and feedback storage unchanged. At finalization, reload the feedback’s authoritative context records, build canonical evidence entries from allowed daily-record fields, map each localized `evidenceUsed` item to canonical entry IDs with normalized substring/token-overlap matching, and reject unsupported or cross-language-inconsistent evidence before the atomic finalize RPC. Add a service-role daily-record save RPC with `expectedRevision`, expose retry from the autosave hook, and pass complete historical feedback drafts into a read-only selector.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase/Postgres RPCs, Vitest, Testing Library.

---

### Task 1: Grounded and bilingual-consistent finalization

**Files:**
- Create: `src/lib/domain/grounding.ts`
- Modify: `src/app/api/feedback/[id]/finalize/route.ts`
- Modify: `src/lib/domain/prompt.ts`
- Test: `tests/domain/grounding.test.ts`
- Test: `tests/api/feedback-finalize.test.ts`
- Test: `tests/domain/prompt.test.ts`

- [ ] Write failing domain tests for normalized substring matches, token-overlap matches, unsupported evidence, and stable canonical IDs.
- [ ] Run the focused tests and confirm they fail because grounding helpers do not exist.
- [ ] Implement canonical corpus construction from `achievements`, `evidence`, `processNotes`, `ao1Note`–`ao4Note`, and `nextPlan`.
- [ ] Write failing finalize-route tests proving context daily records are owner-scoped, unsupported evidence returns 422, and bilingual evidence must map to the same sorted canonical ID set.
- [ ] Run the focused tests and confirm the route does not yet load or validate the corpus.
- [ ] Add the owner-scoped context-record loader and route-level grounding checks before `finalizeFeedback`.
- [ ] Update prompt tests and wording so `evidenceUsed` must select facts traceable to supplied record IDs and field keys.
- [ ] Run all grounding, prompt, and finalize tests.

### Task 2: Optimistic daily-record writes

**Files:**
- Create: `supabase/migrations/202606210003_daily_record_revisions.sql`
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/repositories/daily-records.ts`
- Modify: `src/app/api/daily-records/route.ts`
- Modify: `src/components/records/daily-record-form.tsx`
- Test: `tests/migrations/daily-record-rpc.test.ts`
- Test: `tests/repositories/daily-records.test.ts`
- Test: `tests/api/daily-records.test.ts`
- Test: `tests/components/daily-record-form.test.tsx`

- [ ] Write failing migration tests for a nonnegative revision column and a service-role-only `save_daily_record` security-definer RPC.
- [ ] Write failing repository/API tests for `expectedRevision`, initial-insert races, typed conflicts, and HTTP 409.
- [ ] Add the migration and service-role repository RPC call; map empty RPC results to a typed conflict.
- [ ] Extend stored records with revision and make the browser save send the latest acknowledged revision.
- [ ] Add a component test proving a 409 keeps local input and displays refresh guidance.
- [ ] Run focused migration, repository, API, and component tests.

### Task 3: Explicit autosave retry

**Files:**
- Modify: `src/components/records/use-queued-autosave.ts`
- Modify: `src/components/records/daily-record-form.tsx`
- Test: `tests/components/daily-record-form.test.tsx`

- [ ] Write a failing test where an unchanged snapshot fails, the user clicks `立即重试`, and the second request succeeds.
- [ ] Change the hook result to `{ status, retry }`; make `retry()` enqueue the latest valid snapshot immediately.
- [ ] Render the retry button only for failures and verify success clears the local draft.
- [ ] Run the daily-record component tests.

### Task 4: Read-only feedback history detail

**Files:**
- Modify: `src/lib/repositories/workspace-feedbacks.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/app/(protected)/workspace/page.tsx`
- Test: `tests/repositories/workspace-feedbacks.test.ts`
- Test: `tests/components/workspace-shell.test.tsx`

- [ ] Write failing repository tests proving every history item includes the complete localized draft.
- [ ] Write a failing UI test selecting a version and reading content, evidence, and next step without changing the active editor.
- [ ] Return full history drafts from the loader and add a local read-only history selector/detail panel.
- [ ] Run focused repository and workspace component tests.

### Task 5: Full verification

**Files:**
- Inspect all modified files and the existing user-owned dirty files without reverting them.

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check` and inspect `git status --short`.
- [ ] Do not commit or revert any changes.

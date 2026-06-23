# Workspace Documents and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the professional blue/orange interface, correct camp-day calculation, account-synced appearance and DeepSeek settings, private student document storage, asynchronous extraction/OCR, and reviewable AO1–AO4 suggestions.

**Architecture:** Next.js remains the authenticated web application and API. Supabase stores account settings, private files, document metadata, jobs, and AO analyses. A Dockerized Node worker in `worker/` claims parsing jobs, uses LibreOffice/Tesseract/PDF and OOXML extractors, and writes bounded extracted text back to Supabase. DeepSeek calls stay in Next.js and use each user's AES-256-GCM encrypted API key.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase Auth/Postgres/Storage, Zod, Vitest, Playwright, Node worker, LibreOffice headless, Tesseract OCR, `pdfjs-dist`, `mammoth`, `xlsx`, `fflate`, `file-type`.

---

## File structure

New focused modules:

- `src/lib/camp/date.ts`: pure camp-day/date conversion.
- `src/lib/settings/*`: setting schemas, theme tokens, contrast, encryption, repository.
- `src/components/settings/settings-panel.tsx`: appearance and DeepSeek settings UI.
- `src/lib/documents/*`: validation, schemas, storage paths, repositories, AO prompt.
- `src/components/documents/*`: upload, list/status, extracted-text view, AO review.
- `src/app/api/settings/*`: account settings and key lifecycle.
- `src/app/api/documents/*`: upload session, completion, list, retry, download, delete.
- `src/app/api/ao-analysis/*`: start and read AO analyses.
- `worker/src/*`: independently deployable job claimant and document extractor.

Existing `workspace-shell.tsx` should compose these components rather than absorb their logic.

### Task 1: Correct camp date and day calculation

**Files:**
- Create: `src/lib/camp/date.ts`
- Test: `tests/camp/date.test.ts`
- Modify: `src/app/(protected)/workspace/page.tsx`
- Modify: `src/components/records/daily-record-form.tsx`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/lib/domain/types.ts`
- Test: `tests/components/daily-record-form.test.tsx`
- Test: `tests/components/workspace-shell.test.tsx`

- [ ] **Step 1: Write failing pure date tests**

Test this public contract:

```ts
expect(campDayForDate("2026-07-16", "2026-07-16")).toBe(1);
expect(campDayForDate("2026-07-16", "2026-08-01")).toBe(17);
expect(campDayForDate("2026-12-31", "2027-01-01")).toBe(2);
expect(campDayForDate("2026-07-16", "2026-07-15")).toBeNull();
expect(dateForCampDay("2026-07-16", 3)).toBe("2026-07-18");
expect(defaultWorkspaceDate("2026-07-20", "2026-07-16")).toBe("2026-07-20");
expect(defaultWorkspaceDate("2026-07-10", "2026-07-16")).toBe("2026-07-16");
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/camp/date.test.ts`

Expected: FAIL because `@/lib/camp/date` does not exist.

- [ ] **Step 3: Implement UTC calendar arithmetic**

Export `campDayForDate`, `dateForCampDay`, and `defaultWorkspaceDate`. Parse strict `YYYY-MM-DD` into `Date.UTC`, divide millisecond differences by `86_400_000`, and return `null` before camp start.

- [ ] **Step 4: Write failing form/workspace tests**

Assert the daily form displays `营地第 3 天` as read-only, has no editable `campDay` input, disables record controls before camp start, and workspace defaults to the selected student's start date when today is earlier.

- [ ] **Step 5: Implement UI date integration**

Pass `campStartDate` into `DailyRecordForm`; calculate the day internally; omit `campDay` from editable draft storage; show a locked pre-camp panel. Resolve default workspace date only after the selected student is known.

- [ ] **Step 6: Verify GREEN**

Run: `npm test -- tests/camp/date.test.ts tests/components/daily-record-form.test.tsx tests/components/workspace-shell.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/camp src/app/'(protected)'/workspace/page.tsx src/components/records/daily-record-form.tsx src/components/workspace/workspace-shell.tsx src/lib/domain tests/camp tests/components
git commit -m "fix: derive records from camp start date"
```

### Task 2: Enforce camp dates on the server and protect start-date edits

**Files:**
- Create: `supabase/migrations/202606230001_camp_day_enforcement.sql`
- Modify: `src/lib/repositories/daily-records.ts`
- Modify: `src/lib/repositories/students.ts`
- Modify: `src/app/api/daily-records/route.ts`
- Modify: `src/app/api/students/[id]/route.ts`
- Test: `tests/migrations/camp-day-enforcement.test.ts`
- Test: `tests/api/daily-records.test.ts`
- Test: `tests/api/students.test.ts`

- [ ] **Step 1: Write failing API and migration tests**

Assert that a forged `campDay` is ignored/rejected, a pre-start save returns `422`, and a start-date update with conflicting records returns `409` with `{error:"Camp start date conflicts with existing records or documents"}`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/migrations/camp-day-enforcement.test.ts tests/api/daily-records.test.ts tests/api/students.test.ts`

- [ ] **Step 3: Add database enforcement**

Update `save_daily_record` to select `students.camp_start_date`, compute `record_date - camp_start_date + 1`, reject negative/zero results, and store the computed day. Add `check_camp_start_date_change(owner, student, new_date)` that counts conflicting daily records and documents.

- [ ] **Step 4: Map repository errors**

Add `DailyRecordBeforeCampError` and `StudentCampDateConflictError`; map them to `422` and `409`. The repository sends no client-derived camp day to the RPC.

- [ ] **Step 5: Verify GREEN and commit**

Run the focused tests, then:

```bash
git add supabase/migrations/202606230001_camp_day_enforcement.sql src/lib/repositories src/app/api tests/migrations tests/api
git commit -m "fix: enforce camp dates in persistence"
```

### Task 3: Add account settings, theme tokens, and polished login UI

**Files:**
- Create: `supabase/migrations/202606230002_user_settings.sql`
- Create: `src/lib/settings/schema.ts`
- Create: `src/lib/settings/theme.ts`
- Create: `src/lib/settings/contrast.ts`
- Create: `src/lib/repositories/settings.ts`
- Create: `src/components/settings/theme-provider.tsx`
- Create: `src/components/settings/settings-panel.tsx`
- Create: `src/app/api/settings/route.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `tests/settings/theme.test.ts`
- Test: `tests/api/settings.test.ts`
- Test: `tests/components/settings-panel.test.tsx`
- Test: `tests/components/login-page.test.tsx`

- [ ] **Step 1: Write failing theme/contrast tests**

Cover four presets, custom CSS variables, font scale/weight, valid `#RRGGBB`, and rejection when white-on-accent or primary-on-background contrast is below 4.5.

- [ ] **Step 2: Verify RED and implement schemas**

Run focused tests; implement `userSettingsSchema`, `themeVariables(settings)`, relative luminance, and `contrastRatio`.

- [ ] **Step 3: Add settings migration/repository/API**

Create one row per owner with defaults `professional`, `medium`, `medium`, `chat`, `deepseek-chat`. Add owner-only RLS. `GET` returns safe settings; `PATCH` accepts appearance/model fields but no ciphertext fields.

- [ ] **Step 4: Write RED UI tests**

Assert settings opens from the header, presets apply, invalid custom colors show an alert, font controls update preview, and the login page has a desktop split layout plus compact mobile layout.

- [ ] **Step 5: Implement the selected A visual direction**

Use CSS custom properties (`--theme-primary`, `--theme-primary-soft`, `--theme-accent`, `--theme-surface`, `--theme-text`, `--font-scale`, `--font-weight`). Replace emerald-specific workspace classes with semantic theme classes. Render a deep-blue brand panel beside the auth card and orange primary submit button.

- [ ] **Step 6: Verify and commit**

Run focused tests and `npm run lint`, then commit:

```bash
git add supabase/migrations/202606230002_user_settings.sql src/lib/settings src/lib/repositories/settings.ts src/components/settings src/app/api/settings src/app/layout.tsx src/app/login src/components/auth src/app/globals.css src/components/workspace tests
git commit -m "feat: add synchronized appearance settings"
```

### Task 4: Encrypt personal DeepSeek keys and make all AI calls user-scoped

**Files:**
- Create: `src/lib/settings/encryption.ts`
- Create: `src/lib/settings/deepseek-config.ts`
- Create: `src/app/api/settings/deepseek-key/route.ts`
- Create: `src/app/api/settings/deepseek-test/route.ts`
- Modify: `src/lib/deepseek/client.ts`
- Modify: `src/app/api/feedback/generate/route.ts`
- Modify: `src/app/api/feedback/[id]/messages/route.ts`
- Modify: `src/components/settings/settings-panel.tsx`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/settings/encryption.test.ts`
- Test: `tests/api/deepseek-settings.test.ts`
- Test: `tests/deepseek/client.test.ts`
- Test: `tests/api/feedback-generate.test.ts`

- [ ] **Step 1: Write RED encryption tests**

Use a fixed 32-byte test key. Assert ciphertext round-trips, random IVs produce different ciphertext, tampering fails, and API responses expose only `configured`, `last4`, and `updatedAt`.

- [ ] **Step 2: Implement AES-256-GCM**

`encryptSecret(secret, base64Key)` returns base64 ciphertext/iv/tag. `decryptSecret` authenticates before returning. Validate `SETTINGS_ENCRYPTION_KEY` decodes to exactly 32 bytes.

- [ ] **Step 3: Write RED key/test API tests**

Assert authentication, replacement, deletion, no secret echo, Chat/Reason fixed mappings, and V4 Pro/custom IDs require successful provider validation.

- [ ] **Step 4: Refactor DeepSeek client**

Change to:

```ts
generateWithDeepSeek(prompts, {
  apiKey: string,
  model: string,
  timeoutMs?: number,
})
```

Add `testDeepSeekConnection(config)` using a minimal completion. Remove runtime fallback to `DEEPSEEK_API_KEY`.

- [ ] **Step 5: Load per-user configuration in feedback routes**

Read/decrypt the authenticated owner's key and model. Return `409` with “请先在设置中配置 DeepSeek” when missing.

- [ ] **Step 6: Verify and commit**

Run focused tests, ensure `rg -n "DEEPSEEK_API_KEY" src` only finds no shared runtime usage, then commit.

### Task 5: Create private document schema, storage policies, and validation

**Files:**
- Create: `supabase/migrations/202606230003_student_documents.sql`
- Create: `src/lib/documents/schema.ts`
- Create: `src/lib/documents/file-validation.ts`
- Create: `src/lib/documents/storage-path.ts`
- Create: `src/lib/repositories/documents.ts`
- Test: `tests/documents/file-validation.test.ts`
- Test: `tests/documents/storage-path.test.ts`
- Test: `tests/migrations/student-documents.test.ts`
- Test: `tests/repositories/documents.test.ts`

- [ ] **Step 1: Write RED validation tests**

Cover all approved extensions, 25 MB boundary, mismatched MIME/extension, unsafe names, OOXML ZIP signatures, PDF/JPEG/PNG/OLE signatures, and duplicate hash handling.

- [ ] **Step 2: Implement bounded validation**

Export `MAX_DOCUMENT_BYTES = 25 * 1024 * 1024`, `validateDocumentMetadata`, `validateMagicBytes`, and `sanitizeFilename`.

- [ ] **Step 3: Add migration**

Create private bucket, `student_documents`, `document_jobs`, `document_ao_analyses`, indexes, owner-only RLS, status checks, and foreign keys. Add a transactional RPC that marks a document deleted and queues storage cleanup.

- [ ] **Step 4: Implement repository mappings**

Keep database snake_case private to repository code. Expose typed `StudentDocument`, `DocumentJob`, and `AoAnalysis`.

- [ ] **Step 5: Verify and commit**

Run focused tests and commit the migration, modules, and tests.

### Task 6: Implement direct upload, document list, retry, download, and deletion

**Files:**
- Create: `src/app/api/documents/upload-session/route.ts`
- Create: `src/app/api/documents/complete/route.ts`
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/download/route.ts`
- Create: `src/app/api/documents/[id]/retry/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`
- Create: `src/components/documents/document-uploader.tsx`
- Create: `src/components/documents/document-list.tsx`
- Create: `src/components/documents/document-panel.tsx`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `tests/api/documents.test.ts`
- Test: `tests/components/document-uploader.test.tsx`
- Test: `tests/components/document-list.test.tsx`

- [ ] **Step 1: Write RED API tests**

Assert owner/student checks, camp-day-to-date conversion, signed upload path, completion hash verification, owner-scoped listing, 60-second download URLs, retry only from failed state, and confirmed delete.

- [ ] **Step 2: Implement upload API**

Create metadata first, generate a signed upload token for the exact path, upload browser-to-storage, then complete by reading object metadata and queueing one parse job.

- [ ] **Step 3: Write RED component tests**

Cover file/day selection, calculated date preview, progress, all statuses, extracted-text disclosure, retry, download, and typed deletion confirmation.

- [ ] **Step 4: Implement document UI**

Mount under the daily record. Poll only while jobs are queued/running; stop on terminal status. Keep all actions keyboard accessible and responsive at 320 px.

- [ ] **Step 5: Verify and commit**

Run focused tests and commit.

### Task 7: Build and test the parsing/OCR worker

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/Dockerfile`
- Create: `worker/src/config.ts`
- Create: `worker/src/claim-job.ts`
- Create: `worker/src/extract.ts`
- Create: `worker/src/extractors/text.ts`
- Create: `worker/src/extractors/pdf.ts`
- Create: `worker/src/extractors/ooxml.ts`
- Create: `worker/src/extractors/legacy-office.ts`
- Create: `worker/src/extractors/image.ts`
- Create: `worker/src/index.ts`
- Create: `worker/tests/extract.test.ts`
- Create: `worker/fixtures/sample.txt`
- Create: `worker/fixtures/sample.docx`
- Create: `worker/fixtures/sample.xlsx`
- Create: `worker/fixtures/sample.pptx`
- Create: `worker/fixtures/text.pdf`
- Create: `worker/fixtures/scanned.pdf`
- Create: `worker/fixtures/sample.png`
- Create: `worker/fixtures/corrupt.bin`
- Modify: `README.md`

- [ ] **Step 1: Add worker fixtures and RED tests**

Include tiny anonymized TXT, DOCX, XLSX, PPTX, text PDF, scanned PDF, PNG, and corrupt files. Assert normalized text, OCR routing, a 200,000-character cap, page/sheet count, truncation flag, and stable error codes.

- [ ] **Step 2: Implement extractors**

Use `mammoth` for DOCX, `xlsx` for spreadsheets, `fflate` plus XML text extraction for PPTX, `pdfjs-dist` for text PDF, `pdftoppm` plus Tesseract for scanned pages, Tesseract for images, and headless LibreOffice conversion for legacy Office.

- [ ] **Step 3: Implement safe job claiming**

Atomically claim one available parse job with an RPC, create a short-lived signed download URL, write `parsing`, extract in a temporary directory, update document text/hash/count/status, and finalize the job. Always delete temporary files.

- [ ] **Step 4: Container verification**

Run:

```bash
docker build -t epq-document-worker ./worker
docker run --rm epq-document-worker npm test
```

Expected: all worker tests pass.

- [ ] **Step 5: Commit**

Commit worker code, fixtures, Dockerfile, and deployment documentation.

### Task 8: Generate structured AO1–AO4 suggestions

**Files:**
- Create: `src/lib/documents/ao-schema.ts`
- Create: `src/lib/documents/ao-prompt.ts`
- Create: `src/lib/repositories/ao-analyses.ts`
- Create: `src/app/api/ao-analysis/route.ts`
- Create: `src/components/documents/ao-analysis-review.tsx`
- Modify: `src/components/documents/document-panel.tsx`
- Modify: `src/components/records/daily-record-form.tsx`
- Test: `tests/documents/ao-prompt.test.ts`
- Test: `tests/api/ao-analysis.test.ts`
- Test: `tests/components/ao-analysis-review.test.tsx`

- [ ] **Step 1: Write RED prompt/schema tests**

Assert strict four-AO output, evidence arrays, confidence enum, caution text, source labels, bounded selected-day input, and exclusion of other dates.

- [ ] **Step 2: Implement prompt and response schema**

Prompt explicitly states that document content is not proof of observed behavior and requires low confidence where evidence is insufficient.

- [ ] **Step 3: Write RED API tests**

Require ready documents, same owner/student/date, configured personal key, and a current daily-record snapshot. Store model ID and input hash; reuse a matching successful analysis.

- [ ] **Step 4: Implement review UI**

Display editable notes, evidence, confidence, caution, and four checkboxes. On apply, preserve non-empty notes and request per-item overwrite confirmation. Feed accepted values through `DailyRecordForm.replaceValues`.

- [ ] **Step 5: Verify and commit**

Run focused tests and commit.

### Task 9: Full responsive, security, migration, and deployment verification

**Files:**
- Modify: `tests/e2e/login.spec.ts`
- Modify: `tests/e2e/authenticated-feedback.spec.ts`
- Create: `tests/e2e/documents-settings.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/config/deployment.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Add E2E coverage**

Cover 320 px login, blue/orange workspace, settings persistence, key masking, camp start lock, direct upload, parse status, AO review/apply, and unchanged feedback generation.

- [ ] **Step 2: Run complete local verification**

```bash
npm test
npm run lint
npm run typecheck
npm run build
E2E_USE_SYSTEM_CHROME=1 npm run test:e2e
docker build -t epq-document-worker ./worker
docker run --rm epq-document-worker npm test
git diff --check
```

- [ ] **Step 3: Apply production configuration**

Apply migrations in order. Create the private bucket/policies. Set `SETTINGS_ENCRYPTION_KEY` in Vercel. Remove shared `DEEPSEEK_API_KEY`. Deploy the worker with Supabase URL/service role and polling interval. Verify no secret appears in client bundles.

- [ ] **Step 4: Production smoke test**

Use a fresh verified account: save personal key, test model, create a student with future and current start dates, upload one PDF and one image, wait for parsing, generate AO suggestions, selectively apply them, save the record, and generate final feedback.

- [ ] **Step 5: Final commit and push**

```bash
git add README.md tests playwright.config.ts
git commit -m "test: verify document analysis and settings flow"
git push origin codex/complete-epq-site:main
```

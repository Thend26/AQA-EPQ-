# Workspace Experience Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tutor workspace smoother, safer, and more automated through reliable login transition, idle sign-out, visual settings, document-driven record drafting, and refined UI.

**Architecture:** Keep the current Next.js/Supabase/DeepSeek structure. Add focused client utilities for transition/idle behavior, add a document record-draft schema and prompt, expose a new authenticated API route, and wire it into the existing document panel and daily-record form.

**Tech Stack:** Next.js App Router, React client components, Supabase auth/storage/database, DeepSeek structured generation, Zod, Vitest, Testing Library, Tailwind CSS.

---

### Task 1: Login transition and hero cleanup

**Files:**
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/app/login/page.tsx`
- Test: `tests/components/login-form.test.tsx`
- Test: `tests/components/login-page.test.tsx`

- [ ] Write tests for transition text and `router.replace("/workspace")`.
- [ ] Implement a full-form transition state after successful sign-in.
- [ ] Remove the two lower-left feature cards from the login hero.

### Task 2: Workspace idle sign-out and student limit

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `tests/components/workspace-shell.test.tsx`

- [ ] Write tests for 30-student limit and idle warning/sign-out behavior.
- [ ] Add activity listeners and a warning overlay before auto sign-out.
- [ ] Increase the student cap from 10 to 30.

### Task 3: Settings visual theme and API status

**Files:**
- Modify: `src/lib/settings/schema.ts`
- Modify: `src/lib/settings/theme.ts`
- Modify: `src/components/settings/settings-panel.tsx`
- Test: `tests/settings/theme.test.ts`
- Test: `tests/components/settings-panel.test.tsx`

- [ ] Write tests for new theme presets, color inputs, and API configured status.
- [ ] Add more presets and make custom colors use visual color pickers.
- [ ] Load and display DeepSeek key status with configured/unconfigured messaging.

### Task 4: Document-to-record AI draft

**Files:**
- Create: `src/lib/documents/record-draft-schema.ts`
- Create: `src/lib/documents/record-draft-prompt.ts`
- Create: `src/app/api/document-record-draft/route.ts`
- Modify: `src/components/documents/document-panel.tsx`
- Modify: `src/components/records/daily-record-form.tsx`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Test: `tests/documents/record-draft-prompt.test.ts`
- Test: `tests/api/document-record-draft.test.ts`
- Test: `tests/components/document-panel.test.tsx`
- Test: `tests/components/daily-record-form.test.tsx`

- [ ] Write failing tests for generating and applying a full daily-record draft.
- [ ] Implement Zod schema and DeepSeek prompt.
- [ ] Add authenticated API route using extracted documents and DeepSeek runtime config.
- [ ] Wire returned patch into the form without overwriting `processNotes`.

### Task 5: Apple-like UI polish and animation

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/documents/document-panel.tsx`
- Modify: `src/components/settings/settings-panel.tsx`

- [ ] Add reusable soft-card, glass, and motion classes.
- [ ] Apply calmer card layout, softer shadows, and transition states.
- [ ] Ensure controls remain accessible and responsive.

### Task 6: Verification and deployment

**Files:**
- All modified files

- [ ] Run focused tests as each task lands.
- [ ] Run full `vitest run`, `tsc --noEmit`, `eslint .`, and `next build`.
- [ ] Commit, push to `main`, and confirm Vercel production deployment.

# Workspace Experience Automation Design

## Goal

Improve the EPQ Camp Companion production workflow so tutors can move from login to workspace reliably, see clearer loading/session states, configure DeepSeek visually, and use extracted student documents to draft all daily-record fields except tutor-only process observation.

## Scope

- Add an explicit post-login transition state before entering `/workspace`.
- Auto-sign-out inactive workspace sessions after a long idle period, with a visible warning/countdown.
- Replace custom hex-only color entry with visual color pickers and richer theme presets.
- Show a clear DeepSeek API status card in settings, including configured/unconfigured state and saved key suffix when available.
- Generate a reviewable daily-record draft from extracted documents, filling achievements, evidence, challenges, next plan, behavior tags, and AO1–AO4 notes while leaving `processNotes` untouched.
- Refresh the workspace visual style toward a calmer Apple-like card interface with softer motion and more theme colors.
- Increase the student cap from 10 to 30.
- Remove the two feature-note cards from the lower-left login hero.

## Architecture

The work extends existing boundaries rather than replacing them. Login behavior stays inside `LoginForm`; workspace session behavior stays inside `WorkspaceShell`; settings stays inside `SettingsPanel`; document-driven AI drafting is added as a new API route and a small prompt/schema pair under `src/lib/documents`.

Daily-record auto-fill uses the existing extracted-document repository query. It does not persist directly; it returns a draft patch to the browser, applies it to the local autosaving daily-record form, and then the existing autosave path persists the reviewed values.

## Testing

Component tests cover login transition UI, settings color/API status, document draft generation button behavior, raised student limit, and idle logout warning. API tests cover the new document-to-record draft route and configuration/error paths. Existing full verification remains Vitest, TypeScript, ESLint, and Next build.

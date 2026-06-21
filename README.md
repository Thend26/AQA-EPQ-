# EPQ Feedback Assistant

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

The repository includes static migration tests for RPC ownership, grants, and
atomic SQL shape. A real Supabase integration environment is not configured in
this workspace, so applying migrations and exercising the RPCs against
Postgres remains a deployment verification step.

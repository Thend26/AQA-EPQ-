# Registration, Responsive Layout, and Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email-confirmed public registration, guarantee a profile for every Supabase Auth user, eliminate narrow-screen control overlap, and show consistent accessible loading animation for all important asynchronous actions.

**Architecture:** Extend the existing client-side auth form with explicit login/register modes while keeping Supabase calls in the login page adapter. Reuse the existing callback route for verification, but sign out the temporary verification session before returning to a verified-login state. Add one focused UI loading primitive, apply it to existing async components, and adjust responsive utility classes without changing the desktop workspace architecture.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres, Tailwind CSS 4, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `src/components/ui/loading-spinner.tsx`: accessible decorative loading primitive.
- Modify `src/components/auth/login-form.tsx`: login/register modes, local registration validation, success and pending states.
- Modify `src/app/login/page.tsx`: Supabase sign-in/sign-up adapters and verified/error query messaging.
- Modify `src/app/auth/callback/route.ts`: sign out the verification session when returning to the login page.
- Create `supabase/migrations/202606220001_auth_profiles.sql`: automatic profile creation and backfill.
- Modify `src/components/students/student-form.tsx`: loading spinner and busy semantics.
- Modify `src/components/students/student-list.tsx`: loading spinner and wrapping action layout.
- Modify `src/components/feedback/feedback-assistant.tsx`: loading spinner and stable async button layout.
- Modify `src/components/records/daily-record-form.tsx`: visible autosave spinner.
- Modify `src/components/workspace/workspace-shell.tsx`: logout/navigation pending state and narrow-screen layout.
- Modify `src/app/globals.css`: spinner animation and reduced-motion handling.
- Modify auth, component, migration, and E2E tests listed below.
- Modify `README.md`: registration, email confirmation, callback URL, migration, and deployment instructions.

### Task 1: Loading primitive

**Files:**
- Create: `src/components/ui/loading-spinner.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/components/loading-spinner.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

test("renders a decorative spinner with the requested size", () => {
  render(<LoadingSpinner size="sm" />);
  const spinner = screen.getByTestId("loading-spinner");
  expect(spinner).toHaveAttribute("aria-hidden", "true");
  expect(spinner).toHaveClass("loading-spinner", "loading-spinner-sm");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- tests/components/loading-spinner.test.tsx
```

Expected: FAIL because `LoadingSpinner` does not exist.

- [ ] **Step 3: Implement the primitive**

Create a component with `size?: "sm" | "md"` and optional `className`. Render a span with `data-testid="loading-spinner"`, `aria-hidden="true"`, and the size class.

Add CSS:

```css
@keyframes loading-spin {
  to { transform: rotate(360deg); }
}

.loading-spinner {
  display: inline-block;
  flex: none;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 9999px;
  animation: loading-spin 0.7s linear infinite;
}

.loading-spinner-sm { width: 0.875rem; height: 0.875rem; }
.loading-spinner-md { width: 1.125rem; height: 1.125rem; }

@media (prefers-reduced-motion: reduce) {
  .loading-spinner { animation: none; }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- tests/components/loading-spinner.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/loading-spinner.tsx src/app/globals.css tests/components/loading-spinner.test.tsx
git commit -m "feat: add accessible loading spinner"
```

### Task 2: Registration form behavior

**Files:**
- Modify: `src/components/auth/login-form.tsx`
- Modify: `tests/components/login-form.test.tsx`

- [ ] **Step 1: Replace the old no-registration assertion with failing registration tests**

Cover these behaviors:

```tsx
test("switches between login and registration while preserving email", async () => {
  const user = userEvent.setup();
  render(<LoginForm signIn={signIn} signUp={signUp} />);
  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.click(screen.getByRole("button", { name: "注册账号" }));
  expect(screen.getByLabelText("邮箱")).toHaveValue("mentor@example.com");
  expect(screen.getByLabelText("确认密码")).toBeInTheDocument();
});

test("rejects a short or mismatched registration password locally", async () => {
  // submit once with fewer than 8 characters, then with mismatched confirmation
  // expect a Chinese validation alert and expect(signUp).not.toHaveBeenCalled()
});

test("shows email verification guidance after registration", async () => {
  // signUp resolves { error: null }, submit valid data
  // expect role=status to contain "打开验证邮件"
  // expect router.push not to be called
});

test("shows a spinner and busy state while registration is pending", async () => {
  // hold the signUp promise
  // expect the submit button to be disabled, aria-busy=true,
  // and contain data-testid=loading-spinner
});
```

Keep the existing login success, safe error, and exception tests.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/components/login-form.test.tsx
```

Expected: FAIL because `signUp`, registration mode, confirmation input, and spinner do not exist.

- [ ] **Step 3: Implement the auth form**

Change props to:

```ts
type AuthResult = { error: string | null };

type LoginFormProps = {
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
};
```

Add `mode: "login" | "register"`, `success`, and existing `pending/error` state. In registration mode:

- validate password length >= 8;
- validate password equals `confirmPassword`;
- call `signUp`;
- show the neutral verification guidance;
- never navigate to `/workspace`.

Use `LoadingSpinner` in the pending submit button and add `aria-busy={pending}`. Disable mode buttons while pending.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- tests/components/login-form.test.tsx
```

Expected: all login and registration component tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/login-form.tsx tests/components/login-form.test.tsx
git commit -m "feat: add email registration form"
```

### Task 3: Supabase sign-up adapter and verified login messaging

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `tests/components/login-page.test.tsx`
- Modify: `tests/e2e/login.spec.ts`
- Modify: `tests/e2e/fake-supabase.mjs`

- [ ] **Step 1: Write failing page-adapter tests**

Add a `signUp` mock and test:

```tsx
test("registers with the production callback URL", async () => {
  // switch to registration, fill valid matching passwords, submit
  expect(signUp).toHaveBeenCalledWith({
    email: "mentor@example.com",
    password: "secret-password",
    options: {
      emailRedirectTo:
        "http://localhost:3000/auth/callback?next=%2Flogin%3Fverified%3D1",
    },
  });
});

test("maps registration provider errors to a fixed Chinese message", async () => {
  // provider returns an error containing sensitive details
  // expect fixed Chinese registration message only
});

test("shows verification success from the query string", () => {
  // mock useSearchParams verified=1
  // expect "邮箱验证成功，请登录"
});
```

Update E2E expectation from “no registration” to visible registration mode, and assert the login card does not overflow.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- tests/components/login-page.test.tsx
npm run test:e2e:smoke -- --project=desktop
```

Expected: FAIL because the page has no sign-up adapter or verified query message.

- [ ] **Step 3: Implement the page adapter**

Use `useSearchParams()` for `verified` and `error`. Add:

```ts
async function signUp(email: string, password: string) {
  const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?verified=1")}`;
  try {
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    return { error: error ? "暂时无法提交注册，请稍后重试" : null };
  } catch {
    return { error: "注册暂时不可用，请稍后重试" };
  }
}
```

Pass both adapters to `LoginForm`, update card copy to support new accounts, and render safe callback status messages.

Extend the fake Supabase server to accept the sign-up endpoint used by the browser client.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- tests/components/login-page.test.tsx tests/components/login-form.test.tsx
npm run test:e2e:smoke -- --project=desktop
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx tests/components/login-page.test.tsx tests/e2e/login.spec.ts tests/e2e/fake-supabase.mjs
git commit -m "feat: connect email registration to Supabase"
```

### Task 4: Verification callback returns to explicit login

**Files:**
- Modify: `src/app/auth/callback/route.ts`
- Modify: `tests/auth/callback.test.ts`

- [ ] **Step 1: Write failing callback tests**

Add `signOut` to the mocked client and cover:

```ts
test("signs out a verification session before returning to verified login", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  const response = await GET(
    new Request(
      `${origin}/auth/callback?code=valid-code&next=%2Flogin%3Fverified%3D1`,
    ),
  );
  expect(signOut).toHaveBeenCalledOnce();
  expect(response.headers.get("location")).toBe(
    `${origin}/login?verified=1`,
  );
});

test("does not sign out normal workspace callbacks", async () => {
  // successful workspace callback
  expect(signOut).not.toHaveBeenCalled();
});
```

Also test that sign-out failure redirects to `/login?error=auth_callback`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/auth/callback.test.ts
```

Expected: FAIL because the callback never signs out.

- [ ] **Step 3: Implement conditional verification sign-out**

After a successful code exchange:

```ts
if (next.startsWith("/login?verified=1")) {
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", url.origin),
    );
  }
}
```

Preserve the existing safe-next-path behavior for ordinary authentication callbacks.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- tests/auth/callback.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/callback/route.ts tests/auth/callback.test.ts
git commit -m "fix: require login after email verification"
```

### Task 5: Automatic profile creation migration

**Files:**
- Create: `supabase/migrations/202606220001_auth_profiles.sql`
- Create: `tests/migrations/auth-profile-trigger.test.ts`
- Modify: `tests/config/deployment.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing SQL contract test**

Read the migration and assert it contains:

```ts
expect(sql).toMatch(/create or replace function public\.handle_new_user_profile/i);
expect(sql).toMatch(/security definer/i);
expect(sql).toMatch(/set search_path = pg_catalog, public/i);
expect(sql).toMatch(/after insert on auth\.users/i);
expect(sql).toMatch(/insert into public\.profiles/i);
expect(sql).toMatch(/on conflict \(id\) do nothing/i);
expect(sql).toMatch(/insert into public\.profiles[\s\S]+select[\s\S]+from auth\.users/i);
expect(sql).toMatch(/revoke all on function public\.handle_new_user_profile\(\) from public/i);
```

Update deployment docs test to expect `202606220001_auth_profiles.sql`, email confirmation, and `/auth/callback`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- tests/migrations/auth-profile-trigger.test.ts tests/config/deployment.test.ts
```

Expected: FAIL because the migration and documentation do not exist.

- [ ] **Step 3: Implement migration and documentation**

The migration must:

```sql
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, display_name)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 80)
from auth.users
on conflict (id) do nothing;
```

Document applying migrations in order and configuring production Site URL and redirect URL.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- tests/migrations/auth-profile-trigger.test.ts tests/config/deployment.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202606220001_auth_profiles.sql tests/migrations/auth-profile-trigger.test.ts tests/config/deployment.test.ts README.md
git commit -m "feat: create profiles for registered users"
```

### Task 6: Apply loading states to student and AI operations

**Files:**
- Modify: `src/components/students/student-form.tsx`
- Modify: `src/components/students/student-list.tsx`
- Modify: `src/components/feedback/feedback-assistant.tsx`
- Modify: `src/components/records/daily-record-form.tsx`
- Modify: `tests/components/student-form.test.tsx`
- Modify: `tests/components/student-list.test.tsx`
- Modify: `tests/components/feedback-assistant.test.tsx`
- Modify: `tests/components/daily-record-form.test.tsx`

- [ ] **Step 1: Write failing pending-state assertions**

For each asynchronous component, hold its promise and assert:

- the active button/status contains `data-testid="loading-spinner"`;
- the button has `aria-busy="true"` where applicable;
- buttons are disabled during the request;
- the spinner disappears after resolution or failure.

For autosave, assert “正在保存” contains the spinner only while status is pending.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- tests/components/student-form.test.tsx tests/components/student-list.test.tsx tests/components/feedback-assistant.test.tsx tests/components/daily-record-form.test.tsx
```

Expected: FAIL because existing pending states contain text only.

- [ ] **Step 3: Implement consistent loading content**

Import `LoadingSpinner` and render stable flex content:

```tsx
<span className="inline-flex items-center justify-center gap-2">
  {pending ? <LoadingSpinner size="sm" /> : null}
  <span>{pending ? "保存中…" : "新增学生"}</span>
</span>
```

Use `aria-busy={pending}` and minimum button height. Change the student action wrapper to `flex flex-wrap gap-2`. Keep existing accessible names so current tests and assistive technology continue to identify actions.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/students src/components/feedback src/components/records tests/components
git commit -m "feat: show loading states for workspace actions"
```

### Task 7: Responsive workspace and navigation loading

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `tests/components/workspace-shell.test.tsx`
- Modify: `tests/e2e/authenticated-feedback.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write failing workspace tests**

Add component assertions for:

- header uses wrapping layout and logout error occupies its own row;
- date controls use a fluid grid without `minmax(8.5rem,1fr)`;
- selecting a student/date sets navigation pending and shows a spinner/status;
- logout button shows spinner and `aria-busy` while the request is pending.

Add a 320px Playwright project or explicit viewport test and assert:

```ts
const overlap = await page.evaluate(() => {
  const controls = [...document.querySelectorAll("[data-responsive-control]")];
  return controls.some((a, index) =>
    controls.slice(index + 1).some((b) => {
      const x = a.getBoundingClientRect();
      const y = b.getBoundingClientRect();
      return x.left < y.right && x.right > y.left &&
        x.top < y.bottom && x.bottom > y.top;
    }),
  );
});
expect(overlap).toBe(false);
expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- tests/components/workspace-shell.test.tsx
npm run test:e2e -- tests/e2e/authenticated-feedback.spec.ts --project=mobile
```

Expected: component class and loading assertions FAIL before implementation.

- [ ] **Step 3: Implement responsive and navigation changes**

Add `navigationPending` and `logoutPending`. Set pending before `go()` for student/date navigation and while logout is running.

Change:

- header to a wrapping grid/flex layout with full-width error row;
- date control to a fluid `grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]`;
- all touch controls to `min-h-11`;
- AI action buttons to stable one-column layout at narrow widths;
- navigation status to an accessible `role="status"` overlay or inline banner with spinner;
- avoid using clipped overflow as the only overlap fix.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same commands from Step 2.

Expected: PASS at mobile and existing desktop behavior remains intact.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/workspace-shell.tsx tests/components/workspace-shell.test.tsx tests/e2e/authenticated-feedback.spec.ts playwright.config.ts
git commit -m "fix: prevent mobile workspace control overlap"
```

### Task 8: Full verification, migration, and production deployment

**Files:**
- No production source changes unless verification identifies a regression.

- [ ] **Step 1: Run the complete local verification suite**

```bash
npm test
npm run lint
npm run typecheck
npm run build
E2E_USE_SYSTEM_CHROME=1 npm run test:e2e:smoke
```

Expected: all tests pass, lint and typecheck exit 0, Next.js production build exits 0, desktop/mobile smoke tests pass.

- [ ] **Step 2: Apply the Supabase migration**

Open the current Supabase SQL Editor, execute `supabase/migrations/202606220001_auth_profiles.sql`, and verify the trigger and profile backfill complete without errors.

- [ ] **Step 3: Verify Auth URL configuration**

Set:

- Site URL: the actual Vercel production origin;
- Redirect URL: `<production-origin>/auth/callback`;
- retain localhost callback for development;
- confirm email confirmation remains enabled.

- [ ] **Step 4: Push the verified branch**

```bash
git push origin codex/complete-epq-site:main
```

Expected: GitHub `main` updates and Vercel starts an automatic production deployment.

- [ ] **Step 5: Verify production**

Check:

- `/login` renders login/register modes;
- a new non-test email can submit registration;
- verification email returns to “邮箱验证成功，请登录”;
- verified credentials log in;
- the new account has a profile and can create a student;
- 320px/375px screens have no horizontal overflow or overlapping controls;
- login, save, AI, and logout operations show spinners.

- [ ] **Step 6: Clean temporary deployment files**

Remove temporary local env-upload files from `/private/tmp` after deployment verification. Do not touch the user’s unrelated untracked résumé and interview-preparation files.

- [ ] **Step 7: Final repository check**

```bash
git status --short
git log -5 --oneline
```

Expected: only the user’s unrelated untracked personal HTML/PDF files remain; implementation commits are present and pushed.

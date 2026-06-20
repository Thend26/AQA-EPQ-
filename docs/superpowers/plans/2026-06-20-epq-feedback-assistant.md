# EPQ Feedback Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a deployable personal EPQ camp workspace that stores student progress in Supabase and uses DeepSeek to generate continuous Chinese, English, or bilingual feedback.

**Architecture:** A Next.js 16 App Router application uses Supabase SSR for authentication and owner-scoped persistence. Domain logic for validation, historical context, and prompts remains in pure TypeScript modules; authenticated route handlers call those modules and DeepSeek. React client components provide the three-column workspace, autosaved daily records, AI revision chat, and responsive states.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase Auth/Postgres/RLS, `@supabase/ssr`, Zod, DeepSeek Chat Completions API, Vitest, Testing Library, Playwright, Vercel.

---

## File Map

- `package.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`: runtime and test configuration.
- `src/app/`: App Router pages, protected workspace, and authenticated API routes.
- `src/components/`: focused login, student, daily-record, feedback, and shell components.
- `src/lib/domain/`: pure EPQ types, validation, context selection, quality checks, and prompt construction.
- `src/lib/supabase/`: browser/server clients and auth proxy support.
- `src/lib/repositories/`: owner-scoped Supabase reads and writes.
- `src/lib/deepseek/`: server-only client and response parsing.
- `supabase/migrations/`: schema, constraints, triggers, and RLS policies.
- `tests/`: Vitest unit/component tests and Playwright end-to-end tests.
- `.env.example`, `README.md`: configuration and deployment instructions.

### Task 1: Scaffold the application and test harness

**Files:**
- Create: `package.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke/home.test.tsx`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Scaffold Next.js and install dependencies**

Run:

```bash
npx create-next-app@latest epq-feedback-assistant --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cp -R epq-feedback-assistant/. .
npm install @supabase/ssr @supabase/supabase-js zod
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Expected: `npm install` succeeds and `src/app/page.tsx` exists.

- [ ] **Step 2: Add the failing smoke test**

```tsx
// tests/smoke/home.test.tsx
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

test("shows the EPQ product name", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "EPQ Camp Companion" })).toBeInTheDocument();
});
```

```ts
// tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Run the smoke test and verify RED**

Run: `npm test -- tests/smoke/home.test.tsx`

Expected: FAIL because the generated page does not contain `EPQ Camp Companion`.

- [ ] **Step 4: Implement the minimal branded page**

```tsx
// src/app/page.tsx
export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-stone-100">
      <h1 className="text-3xl font-semibold text-emerald-950">EPQ Camp Companion</h1>
    </main>
  );
}
```

- [ ] **Step 5: Verify scaffold quality**

Run:

```bash
npm test -- tests/smoke/home.test.tsx
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src tests vitest.config.ts .gitignore .env.example
git commit -m "chore: scaffold EPQ feedback assistant"
```

### Task 2: Define the database schema and owner isolation

**Files:**
- Create: `supabase/migrations/202606200001_initial_schema.sql`
- Create: `src/lib/domain/types.ts`
- Create: `tests/domain/types.test.ts`

- [ ] **Step 1: Write the failing domain-shape test**

```ts
// tests/domain/types.test.ts
import { dailyRecordSchema } from "@/lib/domain/types";

test("rejects a daily record without achievements", () => {
  const result = dailyRecordSchema.safeParse({
    studentId: "31b33e22-58a6-4fa4-a12b-678fb6a0e724",
    recordDate: "2026-07-18",
    campDay: 3,
    achievements: "",
    evidence: "4 sources",
    challenges: "",
    nextPlan: "Compare evidence",
    processNotes: "",
    behaviorTags: [],
    ao1Note: "",
    ao2Note: "",
    ao3Note: "",
    ao4Note: "",
  });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/domain/types.test.ts`

Expected: FAIL because `@/lib/domain/types` does not exist.

- [ ] **Step 3: Implement shared domain schemas**

```ts
// src/lib/domain/types.ts
import { z } from "zod";

export const languageModeSchema = z.enum(["zh", "en", "bilingual"]);
export type LanguageMode = z.infer<typeof languageModeSchema>;

export const studentSchema = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(80),
  grade: z.enum(["10", "11"]),
  projectTitle: z.string().trim().min(1).max(300),
  campStartDate: z.string().date(),
  backgroundNotes: z.string().max(2000).default(""),
  currentFocus: z.string().max(1000).default(""),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const dailyRecordSchema = z.object({
  studentId: z.string().uuid(),
  recordDate: z.string().date(),
  campDay: z.number().int().min(1).max(100),
  achievements: z.string().trim().min(1).max(4000),
  evidence: z.string().max(4000).default(""),
  challenges: z.string().max(4000).default(""),
  nextPlan: z.string().trim().min(1).max(4000),
  processNotes: z.string().max(4000).default(""),
  behaviorTags: z.array(z.string().max(60)).max(12),
  ao1Note: z.string().max(2000).default(""),
  ao2Note: z.string().max(2000).default(""),
  ao3Note: z.string().max(2000).default(""),
  ao4Note: z.string().max(2000).default(""),
});
export type DailyRecordInput = z.infer<typeof dailyRecordSchema>;
```

- [ ] **Step 4: Create schema, constraints, triggers, and RLS**

```sql
-- supabase/migrations/202606200001_initial_schema.sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  grade text not null check (grade in ('10','11')),
  project_title text not null,
  camp_start_date date not null,
  background_notes text not null default '',
  current_focus text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  camp_day integer not null check (camp_day > 0),
  achievements text not null,
  evidence text not null default '',
  challenges text not null default '',
  next_plan text not null,
  process_notes text not null default '',
  behavior_tags text[] not null default '{}',
  ao1_note text not null default '',
  ao2_note text not null default '',
  ao3_note text not null default '',
  ao4_note text not null default '',
  status text not null default 'draft' check (status in ('draft','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, record_date)
);

create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  daily_record_id uuid not null references public.daily_records(id) on delete cascade,
  language_mode text not null check (language_mode in ('zh','en','bilingual')),
  content_zh text,
  content_en text,
  context_record_ids uuid[] not null default '{}',
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  feedback_id uuid not null references public.feedbacks(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.student_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  summary_text text not null,
  through_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id)
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.daily_records enable row level security;
alter table public.feedbacks enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.student_summaries enable row level security;

create policy "profiles own rows" on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array['students','daily_records','feedbacks','feedback_messages','student_summaries']
  loop
    execute format(
      'create policy "%1$s own rows" on public.%1$I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      table_name
    );
  end loop;
end $$;
```

- [ ] **Step 5: Verify domain tests**

Run: `npm test -- tests/domain/types.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase src/lib/domain tests/domain
git commit -m "feat: define EPQ data model and owner isolation"
```

### Task 3: Add Supabase SSR authentication and protected routing

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/proxy.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/components/auth/login-form.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/(protected)/layout.tsx`
- Create: `tests/components/login-form.test.tsx`

- [ ] **Step 1: Write a failing login-form test**

```tsx
// tests/components/login-form.test.tsx
import { render, screen } from "@testing-library/react";
import { LoginForm } from "@/components/auth/login-form";

test("renders email and password fields without public registration", () => {
  render(<LoginForm signIn={async () => ({ error: null })} />);
  expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
  expect(screen.getByLabelText("密码")).toBeInTheDocument();
  expect(screen.queryByText("注册")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/components/login-form.test.tsx`

Expected: FAIL because `LoginForm` does not exist.

- [ ] **Step 3: Implement Supabase client factories**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

```ts
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}
```

- [ ] **Step 4: Implement the login form**

```tsx
// src/components/auth/login-form.tsx
"use client";

import { FormEvent, useState } from "react";

type Props = {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
};

export function LoginForm({ signIn }: Props) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    const result = await signIn(String(data.get("email")), String(data.get("password")));
    setPending(false);
    setError(result.error ?? "");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">邮箱<input name="email" type="email" required /></label>
      <label className="block">密码<input name="password" type="password" required /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={pending}>{pending ? "登录中…" : "登录"}</button>
    </form>
  );
}
```

- [ ] **Step 5: Add protected layout and callback**

```tsx
// src/app/(protected)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return children;
}
```

```ts
// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) await (await createClient()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL("/workspace", url.origin));
}
```

- [ ] **Step 6: Verify authentication UI**

Run:

```bash
npm test -- tests/components/login-form.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase src/proxy.ts src/app/login src/app/auth src/app/'(protected)' tests/components
git commit -m "feat: add private Supabase authentication"
```

### Task 4: Implement owner-scoped student management

**Files:**
- Create: `src/lib/repositories/students.ts`
- Create: `src/app/api/students/route.ts`
- Create: `src/app/api/students/[id]/route.ts`
- Create: `src/components/students/student-list.tsx`
- Create: `src/components/students/student-form.tsx`
- Create: `tests/repositories/students.test.ts`
- Create: `tests/components/student-form.test.tsx`

- [ ] **Step 1: Write a failing ownership test**

```ts
// tests/repositories/students.test.ts
import { studentInsert } from "@/lib/repositories/students";

test("uses authenticated owner id instead of client input", () => {
  expect(studentInsert("owner-123", {
    displayName: "林同学",
    grade: "10",
    projectTitle: "Attention and short video",
    campStartDate: "2026-07-16",
    backgroundNotes: "",
    currentFocus: "",
  })).toMatchObject({ owner_id: "owner-123", display_name: "林同学" });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/repositories/students.test.ts`

Expected: FAIL because repository helpers do not exist.

- [ ] **Step 3: Implement mapping and repository methods**

```ts
// src/lib/repositories/students.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudentInput } from "@/lib/domain/types";

export function studentInsert(ownerId: string, input: StudentInput) {
  return {
    owner_id: ownerId,
    display_name: input.displayName,
    grade: input.grade,
    project_title: input.projectTitle,
    camp_start_date: input.campStartDate,
    background_notes: input.backgroundNotes,
    current_focus: input.currentFocus,
  };
}

export async function listStudents(db: SupabaseClient, ownerId: string) {
  return db.from("students").select("*").eq("owner_id", ownerId).order("display_name");
}

export async function createStudent(db: SupabaseClient, ownerId: string, input: StudentInput) {
  return db.from("students").insert(studentInsert(ownerId, input)).select("*").single();
}
```

- [ ] **Step 4: Implement API validation**

```ts
// src/app/api/students/route.ts
import { NextResponse } from "next/server";
import { studentSchema } from "@/lib/domain/types";
import { createStudent, listStudents } from "@/lib/repositories/students";
import { createClient } from "@/lib/supabase/server";

async function authenticated() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  return { db, user };
}

export async function GET() {
  const { db, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await listStudents(db, user.id);
  return NextResponse.json(error ? { error: error.message } : { data }, { status: error ? 500 : 200 });
}

export async function POST(request: Request) {
  const { db, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = studentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await createStudent(db, user.id, parsed.data);
  return NextResponse.json(error ? { error: error.message } : { data }, { status: error ? 500 : 201 });
}
```

- [ ] **Step 5: Build and test the student form**

```tsx
// tests/components/student-form.test.tsx
import { render, screen } from "@testing-library/react";
import { StudentForm } from "@/components/students/student-form";

test("collects the required student profile fields", () => {
  render(<StudentForm onSave={async () => {}} />);
  expect(screen.getByLabelText("学生称呼")).toBeRequired();
  expect(screen.getByLabelText("EPQ 研究题目")).toBeRequired();
  expect(screen.getByLabelText("营地开始日期")).toBeRequired();
});
```

Implement `StudentForm` with controlled fields matching `studentSchema`, plus edit and delete confirmation in `student-list.tsx`.

- [ ] **Step 6: Verify student management**

Run:

```bash
npm test -- tests/repositories/students.test.ts tests/components/student-form.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/repositories/students.ts src/app/api/students src/components/students tests
git commit -m "feat: add private student management"
```

### Task 5: Implement daily records and resilient autosave

**Files:**
- Create: `src/lib/repositories/daily-records.ts`
- Create: `src/lib/domain/drafts.ts`
- Create: `src/app/api/daily-records/route.ts`
- Create: `src/components/records/daily-record-form.tsx`
- Create: `src/components/records/ao-observations.tsx`
- Create: `tests/domain/drafts.test.ts`
- Create: `tests/components/daily-record-form.test.tsx`

- [ ] **Step 1: Write failing draft-key and validation tests**

```ts
// tests/domain/drafts.test.ts
import { draftKey } from "@/lib/domain/drafts";

test("scopes browser drafts by owner student and date", () => {
  expect(draftKey("owner", "student", "2026-07-18"))
    .toBe("epq-draft:owner:student:2026-07-18");
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/domain/drafts.test.ts`

Expected: FAIL because `draftKey` does not exist.

- [ ] **Step 3: Implement deterministic local draft keys**

```ts
// src/lib/domain/drafts.ts
export function draftKey(ownerId: string, studentId: string, date: string) {
  return `epq-draft:${ownerId}:${studentId}:${date}`;
}
```

- [ ] **Step 4: Implement owner-scoped upsert**

```ts
// src/lib/repositories/daily-records.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyRecordInput } from "@/lib/domain/types";

export async function upsertDailyRecord(
  db: SupabaseClient,
  ownerId: string,
  input: DailyRecordInput,
) {
  return db.from("daily_records").upsert({
    owner_id: ownerId,
    student_id: input.studentId,
    record_date: input.recordDate,
    camp_day: input.campDay,
    achievements: input.achievements,
    evidence: input.evidence,
    challenges: input.challenges,
    next_plan: input.nextPlan,
    process_notes: input.processNotes,
    behavior_tags: input.behaviorTags,
    ao1_note: input.ao1Note,
    ao2_note: input.ao2Note,
    ao3_note: input.ao3Note,
    ao4_note: input.ao4Note,
  }, { onConflict: "student_id,record_date" }).select("*").single();
}
```

- [ ] **Step 5: Implement debounced autosave behavior**

`DailyRecordForm` must:

- restore the scoped `localStorage` draft on mount;
- write local draft immediately after edits;
- debounce API saves by 800 ms;
- show `正在保存`, `已保存`, or `保存失败，稍后重试`;
- never clear local draft until the server confirms success;
- expose all specification fields and AO1–AO4 notes.

- [ ] **Step 6: Test the failure-preservation behavior**

```tsx
// tests/components/daily-record-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DailyRecordForm } from "@/components/records/daily-record-form";

test("keeps typed achievements when autosave fails", async () => {
  const user = userEvent.setup();
  render(<DailyRecordForm ownerId="o" studentId="s" date="2026-07-18"
    save={async () => { throw new Error("offline"); }} />);
  await user.type(screen.getByLabelText("今日完成成果"), "筛选了四篇文献");
  expect(screen.getByDisplayValue("筛选了四篇文献")).toBeInTheDocument();
});
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm test -- tests/domain/drafts.test.ts tests/components/daily-record-form.test.tsx
npm run typecheck
git add src/lib/repositories/daily-records.ts src/lib/domain/drafts.ts src/app/api/daily-records src/components/records tests
git commit -m "feat: add resilient daily EPQ records"
```

Expected: tests pass and commit succeeds.

### Task 6: Build historical context and feedback quality rules

**Files:**
- Create: `src/lib/domain/context.ts`
- Create: `src/lib/domain/quality.ts`
- Create: `tests/domain/context.test.ts`
- Create: `tests/domain/quality.test.ts`

- [ ] **Step 1: Write failing history-selection tests**

```ts
// tests/domain/context.test.ts
import { selectRecentContext } from "@/lib/domain/context";

test("uses the five records immediately before and including the target date", () => {
  const records = Array.from({ length: 7 }, (_, index) => ({
    id: String(index + 1),
    recordDate: `2026-07-${String(index + 10).padStart(2, "0")}`,
    nextPlan: `plan-${index + 1}`,
  }));
  expect(selectRecentContext(records, "2026-07-16").map((record) => record.id))
    .toEqual(["3", "4", "5", "6", "7"]);
});
```

- [ ] **Step 2: Write failing quality tests**

```ts
// tests/domain/quality.test.ts
import { checkFeedbackQuality } from "@/lib/domain/quality";

test("rejects short Chinese feedback without a next step", () => {
  expect(checkFeedbackQuality({
    mode: "zh",
    contentZh: "今天完成了文献阅读。",
    contentEn: null,
  })).toEqual(expect.arrayContaining(["中文反馈不足50字", "缺少明确的下一步建议"]));
});
```

- [ ] **Step 3: Verify RED**

Run: `npm test -- tests/domain/context.test.ts tests/domain/quality.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement context selection**

```ts
// src/lib/domain/context.ts
export type ContextRecord = { id: string; recordDate: string; nextPlan: string };

export function selectRecentContext<T extends ContextRecord>(
  records: T[],
  targetDate: string,
  limit = 5,
) {
  return records
    .filter((record) => record.recordDate <= targetDate)
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate))
    .slice(-limit);
}
```

- [ ] **Step 5: Implement language-aware quality checks**

```ts
// src/lib/domain/quality.ts
import type { LanguageMode } from "@/lib/domain/types";

type Input = { mode: LanguageMode; contentZh: string | null; contentEn: string | null };

export function checkFeedbackQuality(input: Input) {
  const issues: string[] = [];
  if ((input.mode === "zh" || input.mode === "bilingual") && (input.contentZh?.trim().length ?? 0) < 50)
    issues.push("中文反馈不足50字");
  if (input.mode === "en" || input.mode === "bilingual") {
    const words = input.contentEn?.trim().split(/\s+/).filter(Boolean).length ?? 0;
    if (words < 50) issues.push("英文反馈不足50词");
  }
  const combined = `${input.contentZh ?? ""} ${input.contentEn ?? ""}`;
  if (!/(下一步|建议|明天|接下来|next|recommend|tomorrow)/i.test(combined))
    issues.push("缺少明确的下一步建议");
  return issues;
}
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- tests/domain/context.test.ts tests/domain/quality.test.ts
git add src/lib/domain/context.ts src/lib/domain/quality.ts tests/domain
git commit -m "feat: add continuous context and feedback quality rules"
```

Expected: PASS.

### Task 7: Integrate DeepSeek with grounded structured output

**Files:**
- Create: `src/lib/deepseek/client.ts`
- Create: `src/lib/deepseek/schema.ts`
- Create: `src/lib/domain/prompt.ts`
- Create: `src/app/api/feedback/generate/route.ts`
- Create: `tests/domain/prompt.test.ts`
- Create: `tests/deepseek/schema.test.ts`

- [ ] **Step 1: Write failing prompt-grounding test**

```ts
// tests/domain/prompt.test.ts
import { buildFeedbackPrompt } from "@/lib/domain/prompt";

test("requires evidence, historical comparison, and cautious AQA language", () => {
  const prompt = buildFeedbackPrompt({
    languageMode: "zh",
    student: { displayName: "林同学", grade: "10", projectTitle: "短视频与注意力" },
    records: [{ recordDate: "2026-07-18", achievements: "筛选4篇文献", evidence: "900字笔记", nextPlan: "做证据比较表" }],
    priorFeedbacks: [],
    instruction: "",
  });
  expect(prompt).toContain("不得编造");
  expect(prompt).toContain("AO1");
  expect(prompt).toContain("筛选4篇文献");
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/domain/prompt.test.ts`

Expected: FAIL because the prompt builder is missing.

- [ ] **Step 3: Implement the prompt and response schema**

```ts
// src/lib/deepseek/schema.ts
import { z } from "zod";

export const generatedFeedbackSchema = z.object({
  contentZh: z.string().nullable(),
  contentEn: z.string().nullable(),
  evidenceUsed: z.array(z.string()),
  nextStep: z.string(),
});
```

```ts
// src/lib/domain/prompt.ts
export function buildFeedbackPrompt(input: {
  languageMode: "zh" | "en" | "bilingual";
  student: { displayName: string; grade: string; projectTitle: string };
  records: Array<{ recordDate: string; achievements: string; evidence: string; nextPlan: string }>;
  priorFeedbacks: string[];
  instruction: string;
}) {
  return [
    "你是 AQA EPQ 营地的专业助教反馈助手。",
    "只使用提供的事实，不得编造成果、分数、排名或因果结论。",
    "结合 AO1 Manage、AO2 Use resources、AO3 Develop and realise、AO4 Review，但不得伪装成正式评分。",
    `目标语言：${input.languageMode}`,
    `学生：${JSON.stringify(input.student)}`,
    `最近记录：${JSON.stringify(input.records)}`,
    `历史反馈：${JSON.stringify(input.priorFeedbacks)}`,
    `用户修改要求：${input.instruction || "无"}`,
    "输出 JSON：contentZh、contentEn、evidenceUsed、nextStep。",
  ].join("\n");
}
```

- [ ] **Step 4: Implement the server-only DeepSeek client**

```ts
// src/lib/deepseek/client.ts
import "server-only";
import { generatedFeedbackSchema } from "./schema";

export async function generateWithDeepSeek(prompt: string) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek request failed: ${response.status}`);
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  return generatedFeedbackSchema.parse(JSON.parse(content));
}
```

- [ ] **Step 5: Implement authenticated generation route**

The route must:

- authenticate with `getUser()`;
- load the requested daily record and student using both target ID and `owner_id`;
- load the latest five records and prior final feedbacks;
- build the prompt on the server;
- call DeepSeek;
- run `checkFeedbackQuality`;
- return draft plus quality issues without replacing an existing draft on failure.

- [ ] **Step 6: Verify schema and prompt tests**

Run:

```bash
npm test -- tests/domain/prompt.test.ts tests/deepseek/schema.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/deepseek src/lib/domain/prompt.ts src/app/api/feedback tests
git commit -m "feat: generate grounded EPQ feedback with DeepSeek"
```

### Task 8: Add feedback revision chat, versioning, and finalization

**Files:**
- Create: `src/lib/repositories/feedbacks.ts`
- Create: `src/app/api/feedback/[id]/messages/route.ts`
- Create: `src/app/api/feedback/[id]/finalize/route.ts`
- Create: `src/components/feedback/feedback-assistant.tsx`
- Create: `src/components/feedback/language-switcher.tsx`
- Create: `tests/components/feedback-assistant.test.tsx`
- Create: `tests/repositories/feedbacks.test.ts`

- [ ] **Step 1: Write a failing finalization test**

```ts
// tests/repositories/feedbacks.test.ts
import { nextFeedbackVersion } from "@/lib/repositories/feedbacks";

test("increments feedback versions per daily record", () => {
  expect(nextFeedbackVersion([{ version: 1 }, { version: 2 }])).toBe(3);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/repositories/feedbacks.test.ts`

Expected: FAIL because `nextFeedbackVersion` is missing.

- [ ] **Step 3: Implement feedback version helper and repository**

```ts
// src/lib/repositories/feedbacks.ts
export function nextFeedbackVersion(items: Array<{ version: number }>) {
  return Math.max(0, ...items.map((item) => item.version)) + 1;
}
```

Repository methods must create a draft, append user/assistant messages with authenticated `owner_id`, and mark a feedback final only when `checkFeedbackQuality` returns no issues.

- [ ] **Step 4: Implement the assistant component**

The component displays:

- context summary (`前5天记录 + 历史反馈`);
- current Chinese and/or English draft;
- language mode selector;
- user message input;
- `生成反馈`, `发送修改要求`, and `确认归档`;
- visible quality issues;
- pending and failure states that retain the current draft.

- [ ] **Step 5: Test draft preservation**

```tsx
// tests/components/feedback-assistant.test.tsx
import { render, screen } from "@testing-library/react";
import { FeedbackAssistant } from "@/components/feedback/feedback-assistant";

test("keeps the current draft when a revision request fails", async () => {
  render(<FeedbackAssistant initialDraft={{ contentZh: "现有反馈内容", contentEn: null }}
    revise={async () => { throw new Error("network"); }} />);
  expect(screen.getByDisplayValue("现有反馈内容")).toBeInTheDocument();
});
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- tests/repositories/feedbacks.test.ts tests/components/feedback-assistant.test.tsx
npm run typecheck
git add src/lib/repositories/feedbacks.ts src/app/api/feedback src/components/feedback tests
git commit -m "feat: add feedback revision and finalization"
```

Expected: PASS.

### Task 9: Assemble the responsive three-column workspace

**Files:**
- Create: `src/app/(protected)/workspace/page.tsx`
- Create: `src/components/workspace/workspace-shell.tsx`
- Create: `src/components/workspace/aqa-overview.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/components/workspace-shell.test.tsx`

- [ ] **Step 1: Write failing workspace landmark test**

```tsx
// tests/components/workspace-shell.test.tsx
import { render, screen } from "@testing-library/react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

test("renders students records and AI assistant as separate regions", () => {
  render(<WorkspaceShell students={[]} selectedStudent={null} />);
  expect(screen.getByRole("navigation", { name: "学生档案" })).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "AI 反馈助手" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/components/workspace-shell.test.tsx`

Expected: FAIL because workspace components are missing.

- [ ] **Step 3: Implement the confirmed layout**

`WorkspaceShell` uses:

```tsx
<div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 xl:grid-cols-[14rem_minmax(30rem,1fr)_23rem]">
  <nav aria-label="学生档案">{/* StudentList */}</nav>
  <main>{/* selected student, AQA overview, DailyRecordForm */}</main>
  <aside aria-label="AI 反馈助手">{/* FeedbackAssistant */}</aside>
</div>
```

Apply the confirmed dark green header, warm stone background, green progress accents, orange primary action, clear save/error badges, and mobile vertical ordering.

- [ ] **Step 4: Verify responsive component tests**

Run:

```bash
npm test -- tests/components/workspace-shell.test.tsx
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app src/components/workspace src/app/globals.css tests/components/workspace-shell.test.tsx
git commit -m "feat: assemble responsive EPQ workspace"
```

### Task 10: Add end-to-end coverage, deployment documentation, and final verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/daily-feedback.spec.ts`
- Modify: `.env.example`
- Create: `README.md`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Configure Playwright**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: true },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
```

- [ ] **Step 2: Add authenticated happy-path E2E test**

```ts
// tests/e2e/daily-feedback.spec.ts
import { test, expect } from "@playwright/test";

test("records a day, generates feedback, and retains history", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("密码").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/workspace/);
  await page.getByLabel("今日完成成果").fill("筛选并评价了四篇文献");
  await page.getByLabel("明日计划").fill("制作证据比较表");
  await page.getByRole("button", { name: "生成反馈" }).click();
  await expect(page.getByText(/下一步|建议/)).toBeVisible();
});
```

- [ ] **Step 3: Document environment and deployment**

```dotenv
# .env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
NEXT_PUBLIC_SITE_URL=http://localhost:3000
E2E_EMAIL=
E2E_PASSWORD=
```

`README.md` must contain exact steps for:

1. Node.js 20.9+ and `npm install`;
2. creating a Supabase project;
3. applying `supabase/migrations/202606200001_initial_schema.sql`;
4. creating the private user;
5. setting local and Vercel environment variables;
6. running unit, type, lint, build, and E2E checks;
7. deploying to Vercel and setting the Supabase site/callback URL;
8. confirming that no real student information is used in test data.

- [ ] **Step 4: Run the complete verification suite**

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected: all commands exit 0; desktop and mobile E2E projects pass.

- [ ] **Step 5: Manually verify the production-risk checklist**

Confirm:

- unauthenticated `/workspace` redirects to `/login`;
- API responses never expose `DEEPSEEK_API_KEY`;
- owner ID is derived from the authenticated session;
- AI failure does not erase the daily form or current feedback;
- Chinese feedback under 50 characters and English feedback under 50 words cannot finalize;
- mobile viewport has no horizontal overflow;
- only anonymized sample student data appears in seed and tests.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e .env.example README.md supabase/seed.sql
git commit -m "test: verify and document EPQ feedback assistant"
```

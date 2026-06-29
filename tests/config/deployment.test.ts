import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("deployment artifacts", () => {
  it("documents every required environment variable", () => {
    const env = read(".env.example");

    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SETTINGS_ENCRYPTION_KEY",
      "DEEPSEEK_TIMEOUT_MS",
      "NEXT_PUBLIC_SITE_URL",
      "E2E_EMAIL",
      "E2E_PASSWORD",
      "E2E_DEEPSEEK_API_KEY",
    ]) {
      expect(env).toContain(`${name}=`);
    }
  });

  it("documents database, local verification, and Vercel deployment", () => {
    const readme = read("README.md");

    expect(readme).toContain("Node.js 20.9");
    expect(readme).toContain("202606200001_initial_schema.sql");
    expect(readme).toContain("202606210003_daily_record_revisions.sql");
    expect(readme).toContain("202606220001_auth_profiles.sql");
    expect(readme).toContain("202606230001_camp_day_enforcement.sql");
    expect(readme).toContain("202606230002_user_settings.sql");
    expect(readme).toContain("npm run test:e2e:smoke");
    expect(readme).toContain("Vercel");
    expect(readme).toContain("Row Level Security");
    expect(readme).toContain("匿名");
    expect(readme).toContain("邮箱确认");
    expect(readme).toContain("/auth/callback");
  });

  it("includes Playwright configuration and anonymized seed guidance", () => {
    expect(read("playwright.config.ts")).toContain("Desktop Chrome");
    expect(read("playwright.config.ts")).toContain("iPhone 13");
    expect(read("supabase/seed.sql")).toContain("林同学");
    expect(read("supabase/seed.sql")).not.toMatch(
      /(?:手机号|身份证|真实姓名|家庭住址)/,
    );
  });
});

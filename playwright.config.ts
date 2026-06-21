import { defineConfig, devices } from "@playwright/test";

const hasRealSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "e2e-publishable-key";
const useSystemChrome = process.env.E2E_USE_SYSTEM_CHROME === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: [
    ...(!hasRealSupabase
      ? [
          {
            command: "node tests/e2e/fake-supabase.mjs",
            url: "http://127.0.0.1:54321/health",
            reuseExistingServer: true,
          },
        ]
      : []),
    {
      command:
        "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000/login",
      reuseExistingServer: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      },
    },
  ],
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
      },
    },
  ],
});

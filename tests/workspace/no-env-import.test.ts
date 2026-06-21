import { expect, test, vi } from "vitest";

test("workspace modules import without Supabase environment variables", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

  await expect(
    import("@/components/workspace/workspace-shell"),
  ).resolves.toBeDefined();
  await expect(import("@/app/(protected)/workspace/page")).resolves.toBeDefined();

  vi.unstubAllEnvs();
});

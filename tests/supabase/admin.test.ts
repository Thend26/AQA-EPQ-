import { beforeEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret";
});

test("creates a non-persistent server-only service role client", async () => {
  createClient.mockReturnValue({ marker: "admin" });
  const { createAdminClient } = await import("@/lib/supabase/admin");

  expect(createAdminClient()).toEqual({ marker: "admin" });
  expect(createClient).toHaveBeenCalledWith(
    "https://project.supabase.co",
    "service-secret",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
});

test("fails safely when service role configuration is missing", async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { createAdminClient } = await import("@/lib/supabase/admin");

  expect(() => createAdminClient()).toThrow(
    "Supabase admin client is not configured",
  );
  expect(createClient).not.toHaveBeenCalled();
});

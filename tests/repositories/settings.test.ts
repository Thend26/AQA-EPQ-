import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import { getUserSettings } from "@/lib/repositories/settings";

describe("settings repository", () => {
  test("falls back to defaults when the user_settings table is not migrated yet", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.user_settings" does not exist',
      },
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const db = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;

    const result = await getUserSettings(db, "owner-1");

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      themePreset: "professional",
      fontScale: "medium",
      fontWeight: "medium",
      deepseekModel: "chat",
    });
  });
});

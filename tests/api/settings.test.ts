import { beforeEach, describe, expect, test, vi } from "vitest";

const { getUser, getUserSettings, updateUserSettings } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/repositories/settings", () => ({
  getUserSettings,
  updateUserSettings,
}));

import { GET, PATCH } from "@/app/api/settings/route";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: "owner-123" } },
    error: null,
  });
});

describe("settings API", () => {
  test("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    expect((await GET()).status).toBe(401);
  });

  test("loads safe account settings", async () => {
    getUserSettings.mockResolvedValue({
      data: {
        themePreset: "professional",
        fontScale: "medium",
        fontWeight: "medium",
        deepseekModel: "chat",
      },
      error: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        themePreset: "professional",
        fontScale: "medium",
        fontWeight: "medium",
        deepseekModel: "chat",
      },
    });
  });

  test("patches appearance and model fields only", async () => {
    updateUserSettings.mockResolvedValue({
      data: {
        themePreset: "ocean",
        fontScale: "large",
        fontWeight: "bold",
        deepseekModel: "reason",
      },
      error: null,
    });

    const response = await PATCH(
      new Request("https://app.example/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          themePreset: "ocean",
          fontScale: "large",
          fontWeight: "bold",
          deepseekModel: "reason",
          encryptedApiKey: "must-not-pass",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserSettings).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      {
        themePreset: "ocean",
        fontScale: "large",
        fontWeight: "bold",
        deepseekModel: "reason",
      },
    );
  });

  test("rejects invalid custom colors at the API boundary", async () => {
    const response = await PATCH(
      new Request("https://app.example/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          themePreset: "custom",
          customPrimary: "blue",
          customAccent: "#f97316",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(updateUserSettings).not.toHaveBeenCalled();
  });
});

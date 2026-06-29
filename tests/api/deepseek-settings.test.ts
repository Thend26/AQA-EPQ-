import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  requireUser,
  saveDeepSeekKey,
  deleteDeepSeekKey,
  getDeepSeekKeyStatus,
  getDeepSeekRuntimeConfig,
  testDeepSeekConnection,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  saveDeepSeekKey: vi.fn(),
  deleteDeepSeekKey: vi.fn(),
  getDeepSeekKeyStatus: vi.fn(),
  getDeepSeekRuntimeConfig: vi.fn(),
  testDeepSeekConnection: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/settings/deepseek-config", () => ({
  saveDeepSeekKey,
  deleteDeepSeekKey,
  getDeepSeekKeyStatus,
  getDeepSeekRuntimeConfig,
}));
vi.mock("@/lib/deepseek/client", () => ({
  testDeepSeekConnection,
}));

import {
  DELETE,
  GET,
  PUT,
} from "@/app/api/settings/deepseek-key/route";
import { POST as TEST } from "@/app/api/settings/deepseek-test/route";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({
    ok: true,
    db: { marker: "db" },
    user: { id: "owner-123" },
  });
});

describe("DeepSeek key settings API", () => {
  test("returns only key status metadata", async () => {
    getDeepSeekKeyStatus.mockResolvedValue({
      configured: true,
      last4: "abcd",
      updatedAt: "2026-06-29T10:00:00.000Z",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        configured: true,
        last4: "abcd",
        updatedAt: "2026-06-29T10:00:00.000Z",
      },
    });
  });

  test("saves and deletes a personal API key without echoing it", async () => {
    saveDeepSeekKey.mockResolvedValue({
      configured: true,
      last4: "wxyz",
      updatedAt: "2026-06-29T10:00:00.000Z",
    });

    const saved = await PUT(
      new Request("https://app.example/api/settings/deepseek-key", {
        method: "PUT",
        body: JSON.stringify({ apiKey: "sk-secret-wxyz" }),
      }),
    );

    expect(saved.status).toBe(200);
    expect(saveDeepSeekKey).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      "sk-secret-wxyz",
    );
    expect(JSON.stringify(await saved.json())).not.toContain("sk-secret-wxyz");

    deleteDeepSeekKey.mockResolvedValue({ configured: false });
    const deleted = await DELETE();
    expect(deleted.status).toBe(200);
    expect(deleteDeepSeekKey).toHaveBeenCalledWith(expect.anything(), "owner-123");
  });

  test("tests the decrypted personal configuration", async () => {
    getDeepSeekRuntimeConfig.mockResolvedValue({
      apiKey: "personal-key",
      model: "deepseek-chat",
    });
    testDeepSeekConnection.mockResolvedValue(undefined);

    const response = await TEST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

import { describe, expect, test, vi } from "vitest";

const { createClient, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));

import Home from "@/app/page";

describe("home redirect", () => {
  test.each([
    [{ id: "owner-123" }, "/workspace"],
    [null, "/login"],
  ])("redirects according to authentication", async (user, target) => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    });

    await expect(Home()).rejects.toThrow(`redirect:${target}`);
    expect(redirect).toHaveBeenCalledWith(target);
  });
});

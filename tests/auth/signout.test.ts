import { expect, test, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { POST } from "@/app/auth/signout/route";

test("returns 503 JSON when Supabase signout fails", async () => {
  createClient.mockResolvedValue({
    auth: {
      signOut: vi.fn().mockResolvedValue({
        error: { message: "sensitive provider detail" },
      }),
    },
  });

  const response = await POST(new Request("https://app.example/auth/signout"));

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Sign out is temporarily unavailable",
  });
});

test("redirects to login only after successful signout", async () => {
  createClient.mockResolvedValue({
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  });

  const response = await POST(new Request("https://app.example/auth/signout"));

  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("https://app.example/login");
});

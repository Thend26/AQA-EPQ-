import { beforeEach, expect, test, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
}));

import { GET, safeNextPath } from "@/app/auth/callback/route";

const origin = "https://app.example";

beforeEach(() => {
  exchangeCodeForSession.mockReset();
});

test.each([
  [null, "/workspace"],
  ["", "/workspace"],
  ["workspace", "/workspace"],
  ["https://attacker.example/phish", "/workspace"],
  ["//attacker.example/phish", "/workspace"],
  ["/\\attacker.example/phish", "/workspace"],
  ["/%09/attacker.example", "/workspace"],
  ["/%25252F%25252Fattacker.example", "/workspace"],
  ["/workspace\n//attacker.example", "/workspace"],
  ["/\\attacker", "/workspace"],
  ["/workspace/student/123", "/workspace/student/123"],
])("normalizes callback next=%s to %s", (next, expected) => {
  expect(safeNextPath(next, origin)).toBe(expected);
});

test("redirects a successful callback to a safe next path", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });

  const response = await GET(
    new Request(
      `${origin}/auth/callback?code=valid-code&next=%2Fworkspace%2Fstudent%2F123`,
    ),
  );

  expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
  expect(response.headers.get("location")).toBe(
    `${origin}/workspace/student/123`,
  );
});

test("redirects a callback without a code to the login error page", async () => {
  const response = await GET(
    new Request(`${origin}/auth/callback?next=%2Fworkspace%2Fstudent%2F123`),
  );

  expect(exchangeCodeForSession).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe(
    `${origin}/login?error=auth_callback`,
  );
});

test("redirects a failed code exchange to the login error page", async () => {
  exchangeCodeForSession.mockResolvedValue({
    error: { message: "invalid or expired code" },
  });

  const response = await GET(
    new Request(
      `${origin}/auth/callback?code=bad-code&next=%2Fworkspace%2Fstudent%2F123`,
    ),
  );

  expect(response.headers.get("location")).toBe(
    `${origin}/login?error=auth_callback`,
  );
});

import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const getUser = vi.fn();
const refreshedCookies = [
  {
    name: "sb-access-token",
    value: "refreshed-token",
    options: { httpOnly: true, path: "/", sameSite: "lax" as const },
  },
];
let setAll: (cookies: typeof refreshedCookies) => void;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalPublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (cookies: typeof refreshedCookies) => void;
      };
    },
  ) => {
    setAll = options.cookies.setAll;
    return {
      auth: { getUser },
    };
  },
}));

import { updateSession } from "@/lib/supabase/proxy";

beforeEach(() => {
  getUser.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
});

afterEach(() => {
  if (originalSupabaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  }

  if (originalPublishableKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      originalPublishableKey;
  }
});

test("redirects an unauthenticated workspace request to login using getUser", async () => {
  getUser.mockImplementation(async () => {
    setAll(refreshedCookies);
    return { data: { user: null } };
  });

  const response = await updateSession(
    new NextRequest("https://app.example/workspace/student/123"),
  );

  expect(getUser).toHaveBeenCalledOnce();
  expect(response.headers.get("location")).toBe("https://app.example/login");
  expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed-token");
});

test("redirects an authenticated login request to the workspace", async () => {
  getUser.mockImplementation(async () => {
    setAll(refreshedCookies);
    return { data: { user: { id: "owner-1" } } };
  });

  const response = await updateSession(
    new NextRequest("https://app.example/login"),
  );

  expect(getUser).toHaveBeenCalledOnce();
  expect(response.headers.get("location")).toBe("https://app.example/workspace");
  expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed-token");
});

test("allows an authenticated workspace request", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });

  const response = await updateSession(
    new NextRequest("https://app.example/workspace"),
  );

  expect(response.headers.get("location")).toBeNull();
});

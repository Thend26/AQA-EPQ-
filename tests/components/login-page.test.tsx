import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}));

import LoginPage from "@/app/login/page";

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  signInWithPassword.mockReset();
});

async function submitLogin() {
  const user = userEvent.setup();
  render(<LoginPage />);

  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "secret-password");
  await user.click(screen.getByRole("button", { name: "登录" }));
}

test("maps a Supabase authentication error to a fixed Chinese message", async () => {
  signInWithPassword.mockResolvedValue({
    error: { message: "Invalid login credentials" },
  });

  await submitLogin();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "邮箱或密码错误，请重试",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent(
    "Invalid login credentials",
  );
});

test("maps a network exception to a fixed unavailable message", async () => {
  signInWithPassword.mockRejectedValue(
    new Error("fetch failed: internal network detail"),
  );

  await submitLogin();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "登录暂时不可用，请稍后重试",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("fetch failed");
});

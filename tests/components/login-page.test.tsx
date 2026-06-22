import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const signInWithPassword = vi.fn();
const signUp = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword, signUp },
  }),
}));

import LoginPage from "@/app/login/page";

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  signInWithPassword.mockReset();
  signUp.mockReset();
  searchParams = new URLSearchParams();
});

async function submitLogin() {
  const user = userEvent.setup();
  render(<LoginPage />);

  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "secret-password");
  await user.click(screen.getByRole("button", { name: "登录" }));
}

async function submitRegistration() {
  const user = userEvent.setup();
  render(<LoginPage />);

  await user.click(screen.getByRole("button", { name: "注册账号" }));
  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "secret-password");
  await user.type(screen.getByLabelText("确认密码"), "secret-password");
  await user.click(screen.getByRole("button", { name: "创建账号" }));
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

test("registers with the current site callback URL", async () => {
  signUp.mockResolvedValue({ error: null });

  await submitRegistration();

  expect(signUp).toHaveBeenCalledWith({
    email: "mentor@example.com",
    password: "secret-password",
    options: {
      emailRedirectTo:
        "http://localhost:3000/auth/callback?next=%2Flogin%3Fverified%3D1",
    },
  });
  expect(await screen.findByRole("status")).toHaveTextContent("打开验证邮件");
});

test("maps a registration provider error to a fixed Chinese message", async () => {
  signUp.mockResolvedValue({
    error: { message: "User already registered with private provider detail" },
  });

  await submitRegistration();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "暂时无法提交注册，请稍后重试",
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("private provider");
});

test("shows verification success from the query string", () => {
  searchParams = new URLSearchParams("verified=1");

  render(<LoginPage />);

  expect(screen.getByRole("status")).toHaveTextContent("邮箱验证成功，请登录");
});

test("shows a safe callback error from the query string", () => {
  searchParams = new URLSearchParams("error=auth_callback");

  render(<LoginPage />);

  expect(screen.getByRole("alert")).toHaveTextContent(
    "邮箱验证链接无效或已过期，请重新注册",
  );
});

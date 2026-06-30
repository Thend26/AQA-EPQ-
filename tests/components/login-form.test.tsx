import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  refresh.mockReset();
});

const signUpSuccess = async () => ({ error: null });

test("renders login and registration choices", () => {
  render(
    <LoginForm
      signIn={async () => ({ error: null })}
      signUp={signUpSuccess}
    />,
  );

  expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
  expect(screen.getByLabelText("密码")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "登录账号" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "注册账号" })).toBeInTheDocument();
});

test("shows a failed login error and preserves the entered email", async () => {
  const user = userEvent.setup();

  render(
    <LoginForm
      signIn={async () => ({ error: "邮箱或密码错误" })}
      signUp={signUpSuccess}
    />,
  );

  const email = screen.getByLabelText("邮箱");
  await user.type(email, "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "wrong-password");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("邮箱或密码错误");
  expect(email).toHaveValue("mentor@example.com");
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test("shows a transition screen and replaces history after successful login", async () => {
  const user = userEvent.setup();

  render(
    <LoginForm
      signIn={async () => ({ error: null })}
      signUp={signUpSuccess}
    />,
  );

  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "correct-password");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "正在进入工作台",
  );
  expect(replace).toHaveBeenCalledWith("/workspace");
  expect(refresh).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
});

test("recovers from an unexpected sign-in exception and preserves input", async () => {
  const user = userEvent.setup();

  render(
    <LoginForm
      signIn={async () => {
        throw new Error("network details must not be exposed");
      }}
      signUp={signUpSuccess}
    />,
  );

  const email = screen.getByLabelText("邮箱");
  await user.type(email, "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "secret-password");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "登录暂时不可用，请稍后重试",
  );
  expect(email).toHaveValue("mentor@example.com");
  expect(screen.getByRole("button", { name: "登录" })).toBeEnabled();
  expect(push).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

test("switches to registration while preserving the entered email", async () => {
  const user = userEvent.setup();
  render(
    <LoginForm
      signIn={async () => ({ error: null })}
      signUp={signUpSuccess}
    />,
  );

  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.click(screen.getByRole("button", { name: "注册账号" }));

  expect(screen.getByLabelText("邮箱")).toHaveValue("mentor@example.com");
  expect(screen.getByLabelText("确认密码")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "创建账号" })).toBeInTheDocument();
});

test("rejects short and mismatched registration passwords locally", async () => {
  const user = userEvent.setup();
  const signUp = vi.fn().mockResolvedValue({ error: null });
  render(
    <LoginForm
      signIn={async () => ({ error: null })}
      signUp={signUp}
    />,
  );

  await user.click(screen.getByRole("button", { name: "注册账号" }));
  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "short");
  await user.type(screen.getByLabelText("确认密码"), "short");
  await user.click(screen.getByRole("button", { name: "创建账号" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "密码至少需要 8 个字符",
  );
  expect(signUp).not.toHaveBeenCalled();

  await user.clear(screen.getByLabelText("密码"));
  await user.clear(screen.getByLabelText("确认密码"));
  await user.type(screen.getByLabelText("密码"), "password-one");
  await user.type(screen.getByLabelText("确认密码"), "password-two");
  await user.click(screen.getByRole("button", { name: "创建账号" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "两次输入的密码不一致",
  );
  expect(signUp).not.toHaveBeenCalled();
});

test("shows email verification guidance after registration", async () => {
  const user = userEvent.setup();
  const signUp = vi.fn().mockResolvedValue({ error: null });
  render(
    <LoginForm
      signIn={async () => ({ error: null })}
      signUp={signUp}
    />,
  );

  await user.click(screen.getByRole("button", { name: "注册账号" }));
  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "secret-password");
  await user.type(screen.getByLabelText("确认密码"), "secret-password");
  await user.click(screen.getByRole("button", { name: "创建账号" }));

  expect(await screen.findByRole("status")).toHaveTextContent("打开验证邮件");
  expect(signUp).toHaveBeenCalledWith(
    "mentor@example.com",
    "secret-password",
  );
  expect(push).not.toHaveBeenCalled();
});

test("shows a spinner and busy state while registration is pending", async () => {
  const user = userEvent.setup();
  let resolveSignUp: ((value: { error: null }) => void) | undefined;
  const signUp = vi.fn(
    () =>
      new Promise<{ error: null }>((resolve) => {
        resolveSignUp = resolve;
      }),
  );
  render(
    <LoginForm
      signIn={async () => ({ error: null })}
      signUp={signUp}
    />,
  );

  await user.click(screen.getByRole("button", { name: "注册账号" }));
  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "secret-password");
  await user.type(screen.getByLabelText("确认密码"), "secret-password");
  await user.click(screen.getByRole("button", { name: "创建账号" }));

  const button = screen.getByRole("button", { name: "注册中…" });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "登录账号" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "注册账号" })).toBeDisabled();

  resolveSignUp?.({ error: null });
});

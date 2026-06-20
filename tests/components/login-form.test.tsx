import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
});

test("renders email and password fields without public registration", () => {
  render(<LoginForm signIn={async () => ({ error: null })} />);

  expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
  expect(screen.getByLabelText("密码")).toBeInTheDocument();
  expect(screen.queryByText("注册")).not.toBeInTheDocument();
});

test("shows a failed login error and preserves the entered email", async () => {
  const user = userEvent.setup();

  render(
    <LoginForm
      signIn={async () => ({ error: "邮箱或密码错误" })}
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

test("navigates to the workspace and refreshes after successful login", async () => {
  const user = userEvent.setup();

  render(<LoginForm signIn={async () => ({ error: null })} />);

  await user.type(screen.getByLabelText("邮箱"), "mentor@example.com");
  await user.type(screen.getByLabelText("密码"), "correct-password");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(push).toHaveBeenCalledWith("/workspace");
  expect(refresh).toHaveBeenCalledOnce();
});

test("recovers from an unexpected sign-in exception and preserves input", async () => {
  const user = userEvent.setup();

  render(
    <LoginForm
      signIn={async () => {
        throw new Error("network details must not be exposed");
      }}
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

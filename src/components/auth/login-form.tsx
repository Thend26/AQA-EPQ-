"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

type AuthResult = {
  error: string | null;
};

type LoginFormProps = {
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
};

export function LoginForm({ signIn, signUp }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  function selectMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));

    setError("");
    setSuccess("");

    if (mode === "register") {
      const confirmation = String(formData.get("confirmPassword"));
      if (password.length < 8) {
        setError("密码至少需要 8 个字符");
        return;
      }
      if (password !== confirmation) {
        setError("两次输入的密码不一致");
        return;
      }
    }

    setPending(true);
    try {
      const result =
        mode === "login"
          ? await signIn(email, password)
          : await signUp(email, password);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (mode === "register") {
        setSuccess(
          "注册申请已提交，请打开验证邮件完成验证，然后返回本页登录。",
        );
        return;
      }

      router.push("/workspace");
      router.refresh();
    } catch {
      setError(
        mode === "login"
          ? "登录暂时不可用，请稍后重试"
          : "注册暂时不可用，请稍后重试",
      );
    } finally {
      setPending(false);
    }
  }

  const submitLabel =
    mode === "login"
      ? pending
        ? "登录中…"
        : "登录"
      : pending
        ? "注册中…"
        : "创建账号";

  return (
    <div className="space-y-5">
      <div
        aria-label="选择认证方式"
        className="grid grid-cols-2 rounded-xl bg-stone-100 p-1"
        role="group"
      >
        <button
          aria-pressed={mode === "login"}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "login"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-stone-600"
          }`}
          disabled={pending}
          onClick={() => selectMode("login")}
          type="button"
        >
          登录账号
        </button>
        <button
          aria-pressed={mode === "register"}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "register"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-stone-600"
          }`}
          disabled={pending}
          onClick={() => selectMode("register")}
          type="button"
        >
          注册账号
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          邮箱
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block">
          密码
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "register" ? 8 : undefined}
            required
          />
        </label>
        {mode === "register" ? (
          <label className="block">
            确认密码
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-800"
            role="status"
          >
            {success}
          </p>
        ) : null}
        <button
          aria-busy={pending}
          className="min-h-11 w-full rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white hover:bg-orange-600"
          disabled={pending}
          type="submit"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {pending ? <LoadingSpinner size="sm" /> : null}
            <span>{submitLabel}</span>
          </span>
        </button>
      </form>
    </div>
  );
}

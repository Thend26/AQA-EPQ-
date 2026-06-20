"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type SignInResult = {
  error: string | null;
};

type LoginFormProps = {
  signIn: (email: string, password: string) => Promise<SignInResult>;
};

export function LoginForm({ signIn }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    setError("");

    try {
      const result = await signIn(
        String(formData.get("email")),
        String(formData.get("password")),
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push("/workspace");
      router.refresh();
    } catch {
      setError("登录暂时不可用，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
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
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={pending} type="submit">
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}

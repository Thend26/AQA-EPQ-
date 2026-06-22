"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/client";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";
  const callbackError = searchParams.get("error") === "auth_callback";

  async function signIn(email: string, password: string) {
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email,
        password,
      });

      return {
        error: error ? "邮箱或密码错误，请重试" : null,
      };
    } catch {
      return { error: "登录暂时不可用，请稍后重试" };
    }
  }

  async function signUp(email: string, password: string) {
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?verified=1")}`;

    try {
      const { error } = await createClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });

      return {
        error: error ? "暂时无法提交注册，请稍后重试" : null,
      };
    } catch {
      return { error: "注册暂时不可用，请稍后重试" };
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 px-4 py-8 sm:px-6">
      <section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-emerald-950">登录</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          登录已有导师账号，或使用邮箱创建新的 EPQ Camp Companion
          工作空间。
        </p>
        {verified ? (
          <p
            className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
            role="status"
          >
            邮箱验证成功，请登录。
          </p>
        ) : null}
        {callbackError ? (
          <p
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            邮箱验证链接无效或已过期，请重新注册。
          </p>
        ) : null}
        <div className="mt-6">
          <LoginForm signIn={signIn} signUp={signUp} />
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

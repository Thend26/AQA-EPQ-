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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_35%),#f8fafc] px-4 py-8 sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-950/10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex min-h-72 flex-col justify-between bg-[#123c69] p-8 text-white sm:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-200">
              唯寻 EPQ 营地助教工作台
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight">
              EPQ Camp Companion
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-blue-100">
              把每天的学生成果、过程证据和 AO 观察沉淀成连续反馈，让营地工作更稳、更清楚。
            </p>
          </div>
          <div aria-hidden="true" className="mt-8 h-24 rounded-[2rem] bg-white/10 blur-2xl" />
        </div>
        <div className="flex items-center p-6 sm:p-10">
          <div className="w-full">
            <h2 className="text-2xl font-semibold text-slate-950">登录</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              登录已有导师账号，或使用邮箱创建新的 EPQ Camp Companion
              工作空间。
            </p>
        {verified ? (
          <p
            className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800"
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
          </div>
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

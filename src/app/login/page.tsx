"use client";

import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
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

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 px-6">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-emerald-950">登录</h1>
        <p className="mt-2 text-sm text-stone-600">
          使用已配置的导师账号进入 EPQ Camp Companion。
        </p>
        <div className="mt-6">
          <LoginForm signIn={signIn} />
        </div>
      </section>
    </main>
  );
}

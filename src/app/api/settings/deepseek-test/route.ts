import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/auth";
import { apiError } from "@/lib/api/responses";
import { DeepSeekError, testDeepSeekConnection } from "@/lib/deepseek/client";
import { getDeepSeekRuntimeConfig } from "@/lib/settings/deepseek-config";

export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const config = await getDeepSeekRuntimeConfig(auth.db, auth.user.id);
  if (!config) {
    return apiError("请先在设置中配置 DeepSeek", 409);
  }

  try {
    await testDeepSeekConnection(config);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DeepSeekError && error.code === "rate_limit") {
      return apiError("AI generation rate limit reached", 429);
    }
    return apiError("DeepSeek 连接测试失败", 502);
  }
}

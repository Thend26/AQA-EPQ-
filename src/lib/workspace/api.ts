import { z } from "zod";

export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

const errorSchema = z.object({ error: z.string().min(1) }).passthrough();

export async function requestWorkspaceJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
) {
  const response = await fetcher(url, init);
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = errorSchema.safeParse(raw);
    throw new WorkspaceApiError(
      parsedError.success ? parsedError.data.error : "请求失败，请稍后重试",
      response.status,
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new WorkspaceApiError("服务器返回了无效数据", 502);
  }
  return parsed.data;
}

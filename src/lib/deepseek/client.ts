import "server-only";

import { z } from "zod";

import {
  generatedFeedbackSchema,
  type GeneratedFeedback,
} from "@/lib/deepseek/schema";
import type { FeedbackPrompts } from "@/lib/domain/prompt";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MAX_RESPONSE_BODY_BYTES = 1_048_576;

const deepSeekEnvSchema = z.object({
  DEEPSEEK_API_KEY: z.string().trim().min(1),
  DEEPSEEK_MODEL: z.string().trim().min(1).default("deepseek-chat"),
  DEEPSEEK_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(120_000)
    .default(30_000),
});

const chatCompletionSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string().min(1),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

export type DeepSeekErrorCode =
  | "configuration"
  | "rate_limit"
  | "upstream"
  | "invalid_response"
  | "timeout";

export class DeepSeekError extends Error {
  constructor(
    public readonly code: DeepSeekErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export class DeepSeekInvalidResponseError extends DeepSeekError {
  constructor() {
    super(
      "invalid_response",
      "AI provider returned an invalid response",
    );
    this.name = "DeepSeekInvalidResponseError";
  }
}

function loadConfig() {
  const parsed = deepSeekEnvSchema.safeParse({
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || undefined,
    DEEPSEEK_TIMEOUT_MS: process.env.DEEPSEEK_TIMEOUT_MS || undefined,
  });
  if (!parsed.success) {
    throw new DeepSeekError(
      "configuration",
      "AI generation is not configured",
    );
  }
  return parsed.data;
}

function invalidResponse(): DeepSeekInvalidResponseError {
  return new DeepSeekInvalidResponseError();
}

export async function readLimitedBody(
  response: Response,
  maxBytes = MAX_RESPONSE_BODY_BYTES,
) {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw invalidResponse();
    }
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw invalidResponse();
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw invalidResponse();
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function generateWithDeepSeek(
  prompts: FeedbackPrompts,
): Promise<GeneratedFeedback> {
  const config = loadConfig();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.DEEPSEEK_TIMEOUT_MS,
  );

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: prompts.user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new DeepSeekError(
          "rate_limit",
          "AI provider rate limit reached",
        );
      }
      throw new DeepSeekError("upstream", "AI provider request failed");
    }

    const contentType = response.headers.get("content-type")?.toLowerCase();
    if (!contentType?.includes("application/json")) {
      throw invalidResponse();
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(await readLimitedBody(response));
    } catch {
      throw invalidResponse();
    }

    const parsedEnvelope = chatCompletionSchema.safeParse(envelope);
    if (!parsedEnvelope.success) {
      throw invalidResponse();
    }

    const generatedText = parsedEnvelope.data.choices[0].message.content;

    let generated: unknown;
    try {
      generated = JSON.parse(generatedText);
    } catch {
      throw invalidResponse();
    }

    const parsedFeedback = generatedFeedbackSchema.safeParse(generated);
    if (!parsedFeedback.success) {
      throw invalidResponse();
    }
    return parsedFeedback.data;
  } catch (error) {
    if (error instanceof DeepSeekError) throw error;
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new DeepSeekError("timeout", "AI provider request timed out");
    }
    throw new DeepSeekError("upstream", "AI provider request failed");
  } finally {
    clearTimeout(timeout);
  }
}

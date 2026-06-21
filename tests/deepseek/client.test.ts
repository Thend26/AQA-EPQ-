import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DeepSeekError,
  DeepSeekInvalidResponseError,
  generateWithDeepSeek,
  readLimitedBody,
} from "@/lib/deepseek/client";

const originalEnv = { ...process.env };
const validOutput = {
  mode: "zh",
  zh: {
    content: "研".repeat(50),
    evidenceUsed: ["筛选并标注了四篇来源"],
    nextStep: "完成来源比较表",
  },
};
const prompts = {
  system: "stable system rules",
  user: "bounded user context",
};

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.DEEPSEEK_API_KEY = "secret-test-key";
  delete process.env.DEEPSEEK_MODEL;
  delete process.env.DEEPSEEK_TIMEOUT_MS;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.useRealTimers();
});

describe("generateWithDeepSeek", () => {
  test("calls chat completions with server credentials and validates JSON output", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(validOutput),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(generateWithDeepSeek(prompts)).resolves.toEqual(
      validOutput,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer secret-test-key",
          "Content-Type": "application/json",
        },
        body: expect.any(String),
        signal: expect.any(AbortSignal),
      }),
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user },
      ],
      response_format: { type: "json_object" },
    });
  });

  test.each([
    [429, "rate_limit"],
    [500, "upstream"],
    [400, "upstream"],
  ] as const)("classifies HTTP %s without exposing provider content", async (status, code) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("provider secret details", { status }),
    );

    const error = await generateWithDeepSeek(prompts).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(DeepSeekError);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toContain("provider secret details");
    expect(String(error)).not.toContain("secret-test-key");
  });

  test.each([
    [
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    ],
    [
      new Response("{", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ],
    [
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ],
    [
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "not-json" } }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ],
    [
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mode: "zh",
                  zh: validOutput.zh,
                  extra: true,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ],
  ])("rejects malformed provider responses", async (response) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    await expect(generateWithDeepSeek(prompts)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  test("aborts requests at the configured timeout", async () => {
    vi.useFakeTimers();
    process.env.DEEPSEEK_TIMEOUT_MS = "25";
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const request = expect(
      generateWithDeepSeek(prompts),
    ).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(25);

    await request;
  });

  test("rejects missing server configuration safely", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(generateWithDeepSeek(prompts)).rejects.toMatchObject({
      code: "configuration",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("readLimitedBody", () => {
  test("rejects an oversized finite Content-Length before reading", async () => {
    const response = new Response("small", {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "1048577",
      },
    });
    const getReader = vi.spyOn(response.body!, "getReader");

    await expect(readLimitedBody(response)).rejects.toBeInstanceOf(
      DeepSeekInvalidResponseError,
    );
    expect(getReader).not.toHaveBeenCalled();
  });

  test("cancels a stream when accumulated chunks exceed the byte limit", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(600_000));
        controller.enqueue(new Uint8Array(600_000));
      },
      cancel,
    });

    await expect(
      readLimitedBody(
        new Response(stream, {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).rejects.toBeInstanceOf(DeepSeekInvalidResponseError);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("decodes a legal small streamed response across chunk boundaries", async () => {
    const encoded = new TextEncoder().encode('{"message":"研究"}');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, encoded.length - 2));
        controller.enqueue(encoded.slice(encoded.length - 2));
        controller.close();
      },
    });

    await expect(
      readLimitedBody(
        new Response(stream, {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).resolves.toBe('{"message":"研究"}');
  });
});

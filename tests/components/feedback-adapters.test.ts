import { expect, test, vi } from "vitest";

import {
  createFeedbackAdapters,
  WorkspaceApiError,
} from "@/components/workspace/feedback-adapters";

const draft = {
  mode: "zh" as const,
  zh: {
    content: "今天完成了四篇资料的筛选和批注，并记录了作者、日期与主要观点。学生识别了来源之间的差异，并开始比较证据质量。接下来需要完成来源比较表。",
    evidenceUsed: ["四篇带批注的文献"],
    nextStep: "完成来源比较表",
  },
};

test("generate, revise, and finalize send route-shaped payloads without owner data", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feedback: { id: "feedback-1", revision: 2 },
          draft,
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feedback: { id: "feedback-2", revision: 3 },
          draft,
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ revision: 4 }), { status: 200 }),
    );
  const adapters = createFeedbackAdapters({
    dailyRecordId: "record-1",
    fetcher,
  });

  await adapters.generate("zh");
  await adapters.revise("更简洁", draft, 2);
  await adapters.finalize(draft, 3);

  const calls = fetcher.mock.calls.map(([url, init]) => ({
    url,
    body: JSON.parse(String(init?.body)),
  }));
  expect(calls).toEqual([
    {
      url: "/api/feedback/generate",
      body: {
        dailyRecordId: "record-1",
        languageMode: "zh",
        instruction: "",
      },
    },
    {
      url: "/api/feedback/feedback-1/messages",
      body: { instruction: "更简洁", draft, expectedRevision: 2 },
    },
    {
      url: "/api/feedback/feedback-2/finalize",
      body: { draft, expectedRevision: 3 },
    },
  ]);
  expect(JSON.stringify(calls)).not.toContain("owner");
});

test("preserves the HTTP status so FeedbackAssistant can handle 409", async () => {
  const adapters = createFeedbackAdapters({
    dailyRecordId: "record-1",
    feedbackId: "feedback-1",
    fetcher: vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "stale" }), { status: 409 }),
    ),
  });

  await expect(adapters.revise("修改", draft, 1)).rejects.toMatchObject({
    status: 409,
  } satisfies Partial<WorkspaceApiError>);
});

test.each(["zh", "en", "bilingual"] as const)(
  "generate sends the current %s mode",
  async (languageMode) => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          feedback: { id: "feedback-1", revision: 0 },
          draft,
        }),
        { status: 200 },
      ),
    );
    const adapters = createFeedbackAdapters({
      dailyRecordId: "record-1",
      fetcher,
    });

    await adapters.generate(languageMode);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/feedback/generate",
      expect.objectContaining({
        body: JSON.stringify({
          dailyRecordId: "record-1",
          languageMode,
          instruction: "",
        }),
      }),
    );
  },
);

test("rejects malformed success payloads with a WorkspaceApiError", async () => {
  const adapters = createFeedbackAdapters({
    dailyRecordId: "record-1",
    fetcher: vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          feedback: { id: "", revision: -1 },
          draft: { mode: "zh", zh: { content: 3 } },
        }),
        { status: 200 },
      ),
    ),
  });

  await expect(adapters.generate("zh")).rejects.toBeInstanceOf(
    WorkspaceApiError,
  );
});

test("rejects malformed finalize success payloads", async () => {
  const adapters = createFeedbackAdapters({
    dailyRecordId: "record-1",
    feedbackId: "feedback-1",
    fetcher: vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ revision: "4" }), { status: 200 }),
      ),
  });

  await expect(adapters.finalize(draft, 3)).rejects.toBeInstanceOf(
    WorkspaceApiError,
  );
});

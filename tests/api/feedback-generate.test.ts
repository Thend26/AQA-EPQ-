import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireUser,
  loadGenerationContext,
  generateWithDeepSeek,
  FakeDeepSeekError,
} = vi.hoisted(() => {
  class FakeDeepSeekError extends Error {
    constructor(
      public readonly code:
        | "configuration"
        | "rate_limit"
        | "upstream"
        | "invalid_response"
        | "timeout",
      message = "safe error",
    ) {
      super(message);
    }
  }
  return {
    requireUser: vi.fn(),
    loadGenerationContext: vi.fn(),
    generateWithDeepSeek: vi.fn(),
    FakeDeepSeekError,
  };
});

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/repositories/generation-context", () => ({
  loadGenerationContext,
}));
vi.mock("@/lib/deepseek/client", () => ({
  DeepSeekError: FakeDeepSeekError,
  generateWithDeepSeek,
}));

import { POST } from "@/app/api/feedback/generate/route";

const dailyRecordId = "123e4567-e89b-42d3-a456-426614174001";
const context = {
  targetRecordId: dailyRecordId,
  student: {
    id: "123e4567-e89b-42d3-a456-426614174000",
    displayName: "林同学",
    grade: "10",
    projectTitle: "短视频与注意力",
    backgroundNotes: "",
    currentFocus: "来源比较",
  },
  records: [
    {
      id: dailyRecordId,
      recordDate: "2026-07-18",
      campDay: 3,
      achievements: "筛选4篇文献",
      evidence: "900字笔记",
      challenges: "来源冲突",
      nextPlan: "完成比较表",
      processNotes: "",
      behaviorTags: [],
      ao1Note: "",
      ao2Note: "记录出处",
      ao3Note: "",
      ao4Note: "识别冲突",
    },
  ],
  priorFeedbacks: [],
};

function request(body: unknown) {
  return new Request("https://app.example/api/feedback/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({
    ok: true,
    db: { marker: "db" },
    user: { id: "owner-123" },
  });
  loadGenerationContext.mockResolvedValue({
    data: context,
    error: null,
    notFound: false,
  });
  generateWithDeepSeek.mockResolvedValue({
    mode: "zh",
    zh: {
      content: "短",
      evidenceUsed: ["筛选4篇文献"],
      nextStep: "完成来源比较表",
    },
  });
});

describe("feedback generation API", () => {
  test("returns the shared authentication response", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      request({
        dailyRecordId,
        languageMode: "zh",
        instruction: "",
      }),
    );

    expect(response.status).toBe(401);
    expect(loadGenerationContext).not.toHaveBeenCalled();
  });

  test.each([
    "{",
    JSON.stringify({ dailyRecordId: "bad", languageMode: "zh" }),
    JSON.stringify({
      dailyRecordId,
      languageMode: "fr",
      instruction: "",
    }),
    JSON.stringify({
      dailyRecordId,
      languageMode: "zh",
      instruction: "x".repeat(2_001),
    }),
    JSON.stringify({
      dailyRecordId,
      languageMode: "zh",
      instruction: "",
      ownerId: "attacker",
    }),
  ])("rejects malformed or unsafe input", async (body) => {
    const response = await POST(
      new Request("https://app.example/api/feedback/generate", {
        method: "POST",
        body,
      }),
    );

    expect(response.status).toBe(400);
    expect(loadGenerationContext).not.toHaveBeenCalled();
  });

  test("loads generation context with the authenticated owner and hides unowned records", async () => {
    loadGenerationContext.mockResolvedValue({
      data: null,
      error: null,
      notFound: true,
    });

    const response = await POST(
      request({
        dailyRecordId,
        languageMode: "zh",
        instruction: "",
      }),
    );

    expect(response.status).toBe(404);
    expect(loadGenerationContext).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      dailyRecordId,
    );
    expect(generateWithDeepSeek).not.toHaveBeenCalled();
  });

  test("returns a generated draft with deterministic quality issues", async () => {
    const response = await POST(
      request({
        dailyRecordId,
        languageMode: "zh",
        instruction: "强调来源比较",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(generateWithDeepSeek).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("不得编造"),
        user: expect.stringContaining("筛选4篇文献"),
      }),
    );
    expect(body.draft.mode).toBe("zh");
    expect(body.issues).toContain("中文：反馈不足50汉字");
  });

  test("returns quality issues instead of 502 for empty evidence and next step", async () => {
    generateWithDeepSeek.mockResolvedValue({
      mode: "zh",
      zh: {
        content: "",
        evidenceUsed: [],
        nextStep: "",
      },
    });

    const response = await POST(
      request({
        dailyRecordId,
        languageMode: "zh",
        instruction: "",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.issues).toEqual(
      expect.arrayContaining([
        "中文：反馈不足50汉字",
        "中文：缺少具体成果或证据",
        "中文：缺少明确的下一步建议",
      ]),
    );
  });

  test("rejects an otherwise valid AI payload for the wrong requested mode", async () => {
    generateWithDeepSeek.mockResolvedValue({
      mode: "en",
      en: {
        content: "word ".repeat(50),
        evidenceUsed: ["Four sources"],
        nextStep: "Compare three sources",
      },
    });

    const response = await POST(
      request({
        dailyRecordId,
        languageMode: "zh",
        instruction: "",
      }),
    );

    expect(response.status).toBe(502);
  });

  test.each([
    ["rate_limit", 429],
    ["configuration", 503],
    ["timeout", 503],
    ["upstream", 502],
    ["invalid_response", 502],
  ] as const)("maps %s provider failures to %s", async (code, status) => {
    generateWithDeepSeek.mockRejectedValue(
      new FakeDeepSeekError(code, "provider details"),
    );

    const response = await POST(
      request({
        dailyRecordId,
        languageMode: "zh",
        instruction: "",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(JSON.stringify(body)).not.toContain("provider details");
  });

  test("returns 503 for context repository failures", async () => {
    loadGenerationContext.mockResolvedValue({
      data: null,
      error: { message: "database details" },
      notFound: false,
    });

    const response = await POST(
      request({
        dailyRecordId,
        languageMode: "zh",
        instruction: "",
      }),
    );

    expect(response.status).toBe(503);
    expect(generateWithDeepSeek).not.toHaveBeenCalled();
  });
});

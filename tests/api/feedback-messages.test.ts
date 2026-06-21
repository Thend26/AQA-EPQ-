import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireUser,
  loadFeedback,
  loadGenerationContext,
  generateWithDeepSeek,
  createFeedbackDraft,
  FakeConflict,
  FakeStorageError,
} = vi.hoisted(() => {
  class FakeConflict extends Error {}
  class FakeStorageError extends Error {}
  return {
    requireUser: vi.fn(),
    loadFeedback: vi.fn(),
    loadGenerationContext: vi.fn(),
    generateWithDeepSeek: vi.fn(),
    createFeedbackDraft: vi.fn(),
    FakeConflict,
    FakeStorageError,
  };
});

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/repositories/feedbacks", () => ({
  loadFeedback,
  createFeedbackDraft,
  FeedbackConflictError: FakeConflict,
  RepositoryStorageUnavailableError: FakeStorageError,
}));
vi.mock("@/lib/repositories/generation-context", () => ({
  loadGenerationContext,
}));
vi.mock("@/lib/deepseek/client", () => ({
  DeepSeekError: class extends Error {},
  generateWithDeepSeek,
}));

import { POST } from "@/app/api/feedback/[id]/messages/route";

const feedbackId = "123e4567-e89b-42d3-a456-426614174010";
const dailyRecordId = "123e4567-e89b-42d3-a456-426614174001";
const currentDraft = {
  mode: "zh" as const,
  zh: {
    content: "助教刚刚编辑过的当前反馈",
    evidenceUsed: ["四篇文献"],
    nextStep: "完成比较表",
  },
};

function request(body: unknown) {
  return new Request(`https://app.example/api/feedback/${feedbackId}/messages`, {
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
  loadFeedback.mockResolvedValue({
    data: {
      id: feedbackId,
      dailyRecordId,
      status: "draft",
      revision: 4,
      contextRecordIds: [dailyRecordId],
      messages: [
        { role: "user", content: "先强调证据" },
        { role: "assistant", content: "已强调证据" },
      ],
      draft: {
        mode: "zh",
        zh: {
          content: "原反馈",
          evidenceUsed: ["四篇文献"],
          nextStep: "完成比较表",
        },
      },
    },
    error: null,
    notFound: false,
  });
  loadGenerationContext.mockResolvedValue({
    data: {
      targetRecordId: dailyRecordId,
      student: {
        id: "student-1",
        displayName: "林同学",
        grade: "10",
        projectTitle: "研究题目",
        backgroundNotes: "",
        currentFocus: "",
      },
      records: [
        {
          id: dailyRecordId,
          recordDate: "2026-07-18",
          campDay: 1,
          achievements: "筛选四篇文献",
          evidence: "四篇带批注文献",
          challenges: "",
          nextPlan: "比较来源",
          processNotes: "",
          behaviorTags: [],
          ao1Note: "",
          ao2Note: "",
          ao3Note: "",
          ao4Note: "",
        },
      ],
      priorFeedbacks: [
        {
          createdAt: "2026-07-17T10:00:00.000Z",
          mode: "zh",
          contentZh: "上一日已要求比较来源",
          contentEn: null,
        },
      ],
    },
    error: null,
    notFound: false,
  });
  generateWithDeepSeek.mockResolvedValue({
    mode: "zh",
    zh: {
      content: "修订反馈",
      evidenceUsed: ["四篇文献"],
      nextStep: "完成比较表",
    },
  });
  createFeedbackDraft.mockResolvedValue({
    data: {
      id: "123e4567-e89b-42d3-a456-426614174011",
      version: 2,
      revision: 0,
    },
    error: null,
    notFound: false,
  });
});

describe("feedback revision API", () => {
  test("requires expectedRevision and rejects owner fields", async () => {
    for (const body of [
      { instruction: "修改" },
      {
        instruction: "修改",
        expectedRevision: 4,
        draft: currentDraft,
        ownerId: "attacker",
      },
    ]) {
      const response = await POST(request(body), {
        params: Promise.resolve({ id: feedbackId }),
      });
      expect(response.status).toBe(400);
    }
    expect(loadFeedback).not.toHaveBeenCalled();
  });

  test("includes strict prior final feedback and atomically inherits context and messages", async () => {
    const response = await POST(
      request({
        instruction: "语气更简洁",
        expectedRevision: 4,
        draft: currentDraft,
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(generateWithDeepSeek).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining("上一日已要求比较来源"),
      }),
    );
    expect(generateWithDeepSeek).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining("先强调证据"),
      }),
    );
    expect(generateWithDeepSeek).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining("助教刚刚编辑过的当前反馈"),
      }),
    );
    expect(createFeedbackDraft).toHaveBeenCalledWith(
      "owner-123",
      expect.objectContaining({
        sourceFeedbackId: feedbackId,
        expectedRevision: 4,
        contextRecordIds: [dailyRecordId],
        userMessage: "语气更简洁",
        assistantMessage: expect.stringContaining("修订反馈"),
        draft: expect.objectContaining({ mode: "zh" }),
      }),
    );
    expect(body.feedback.revision).toBe(0);
  });

  test("maps a stale atomic revision to 409", async () => {
    createFeedbackDraft.mockResolvedValue({
      data: null,
      error: new FakeConflict("stale"),
      notFound: false,
    });

    const response = await POST(
      request({
        instruction: "语气更简洁",
        expectedRevision: 4,
        draft: currentDraft,
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );

    expect(response.status).toBe(409);
  });

  test("maps admin storage failures to 503 instead of AI failure", async () => {
    createFeedbackDraft.mockResolvedValue({
      data: null,
      error: new FakeStorageError("hidden"),
      notFound: false,
    });

    const response = await POST(
      request({
        instruction: "语气更简洁",
        expectedRevision: 4,
        draft: currentDraft,
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Feedback storage is temporarily unavailable",
    });
  });
});

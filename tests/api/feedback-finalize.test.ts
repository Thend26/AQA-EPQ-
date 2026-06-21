import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  requireUser,
  loadFeedback,
  finalizeFeedback,
  FakeConflict,
  FakeStorageError,
} = vi.hoisted(() => {
  class FakeConflict extends Error {}
  class FakeStorageError extends Error {}
  return {
    requireUser: vi.fn(),
    loadFeedback: vi.fn(),
    finalizeFeedback: vi.fn(),
    FakeConflict,
    FakeStorageError,
  };
});

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/repositories/feedbacks", () => ({
  loadFeedback,
  finalizeFeedback,
  FeedbackConflictError: FakeConflict,
  RepositoryStorageUnavailableError: FakeStorageError,
}));

import { POST } from "@/app/api/feedback/[id]/finalize/route";

const feedbackId = "123e4567-e89b-42d3-a456-426614174010";
const validDraft = {
  mode: "zh" as const,
  zh: {
    content: "今天完成了四篇资料的筛选和批注，并记录了每篇资料的作者、发布日期与主要观点。现有证据表明，学生能够识别不同来源的重点，也注意到部分结论存在冲突。下一阶段应继续比较研究方法和证据质量，并在日志中说明取舍理由。",
    evidenceUsed: ["四篇带批注的文献"],
    nextStep: "明天完成四篇资料的来源比较表并写出两项取舍理由",
  },
};

function request(body: unknown) {
  return new Request(`https://app.example/api/feedback/${feedbackId}/finalize`, {
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
      status: "draft",
      revision: 6,
      draft: validDraft,
    },
    error: null,
    notFound: false,
  });
  finalizeFeedback.mockResolvedValue({
    finalized: true,
    revision: 7,
    issues: [],
    error: null,
  });
});

describe("feedback finalization API", () => {
  test("requires expectedRevision and rejects owner fields", async () => {
    for (const body of [
      { draft: validDraft },
      { draft: validDraft, expectedRevision: 6, ownerId: "attacker" },
    ]) {
      const response = await POST(request(body), {
        params: Promise.resolve({ id: feedbackId }),
      });
      expect(response.status).toBe(400);
    }
    expect(loadFeedback).not.toHaveBeenCalled();
  });

  test("quality-checks the submitted edit before atomic finalize", async () => {
    finalizeFeedback.mockResolvedValue({
      finalized: false,
      issues: ["中文：反馈不足50汉字"],
      error: null,
    });

    const response = await POST(
      request({ draft: validDraft, expectedRevision: 6 }),
      { params: Promise.resolve({ id: feedbackId }) },
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(finalizeFeedback).toHaveBeenCalledWith(
      "owner-123",
      feedbackId,
      6,
      validDraft,
    );
    expect(body.issues).toEqual(["中文：反馈不足50汉字"]);
  });

  test("maps stale finalize to 409", async () => {
    finalizeFeedback.mockResolvedValue({
      finalized: false,
      issues: [],
      error: new FakeConflict("stale"),
    });

    const response = await POST(
      request({ draft: validDraft, expectedRevision: 6 }),
      { params: Promise.resolve({ id: feedbackId }) },
    );

    expect(response.status).toBe(409);
  });

  test("maps admin storage failures to a stable 503 JSON response", async () => {
    finalizeFeedback.mockResolvedValue({
      finalized: false,
      issues: [],
      error: new FakeStorageError("service key details"),
    });

    const response = await POST(
      request({ draft: validDraft, expectedRevision: 6 }),
      { params: Promise.resolve({ id: feedbackId }) },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Feedback storage is temporarily unavailable",
    });
  });
});

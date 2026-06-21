import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  requireUser,
  loadFeedback,
  loadFeedbackGroundingRecords,
  finalizeFeedback,
  FakeConflict,
  FakeStorageError,
} = vi.hoisted(() => {
  class FakeConflict extends Error {}
  class FakeStorageError extends Error {}
  return {
    requireUser: vi.fn(),
    loadFeedback: vi.fn(),
    loadFeedbackGroundingRecords: vi.fn(),
    finalizeFeedback: vi.fn(),
    FakeConflict,
    FakeStorageError,
  };
});

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/repositories/feedbacks", () => ({
  loadFeedback,
  loadFeedbackGroundingRecords,
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
    evidenceUsed: ["筛选并批注了四篇资料"],
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
      contextRecordIds: ["record-1"],
    },
    error: null,
    notFound: false,
  });
  loadFeedbackGroundingRecords.mockResolvedValue({
    data: [
      {
        id: "record-1",
        achievements: "筛选并批注了四篇资料",
        evidence: "完成900字研究日志",
        nextPlan: "制作来源比较表",
        processNotes: "主动说明取舍理由",
        ao1Note: "按计划推进",
        ao2Note: "记录作者与发布日期",
        ao3Note: "",
        ao4Note: "识别来源冲突",
      },
    ],
    error: null,
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

  test("rejects fabricated evidence metadata before atomic finalize", async () => {
    const response = await POST(
      request({
        draft: {
          ...validDraft,
          zh: {
            ...validDraft.zh,
            evidenceUsed: ["完成了十次专家访谈"],
          },
        },
        expectedRevision: 6,
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: ["中文：引用证据无法追溯到上下文记录"],
    });
    expect(finalizeFeedback).not.toHaveBeenCalled();
    expect(loadFeedbackGroundingRecords).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      ["record-1"],
    );
  });

  test("requires bilingual evidence to map to the same canonical entries", async () => {
    const bilingual = {
      mode: "bilingual" as const,
      zh: {
        ...validDraft.zh,
        evidenceUsed: ["筛选并批注了四篇资料"],
      },
      en: {
        content: Array.from(
          { length: 50 },
          (_, index) => `word${index + 1}`,
        ).join(" "),
        evidenceUsed: ["完成900字研究日志"],
        nextStep: "Complete the source comparison table",
      },
    };
    loadFeedback.mockResolvedValueOnce({
      data: {
        id: feedbackId,
        status: "draft",
        revision: 6,
        draft: bilingual,
        contextRecordIds: ["record-1"],
      },
      error: null,
      notFound: false,
    });

    const response = await POST(
      request({ draft: bilingual, expectedRevision: 6 }),
      { params: Promise.resolve({ id: feedbackId }) },
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      issues: ["中英双语：引用证据来源不一致"],
    });
    expect(finalizeFeedback).not.toHaveBeenCalled();
  });
});

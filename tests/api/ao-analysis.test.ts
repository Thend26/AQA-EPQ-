import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireUser,
  getDailyRecord,
  listExtractedDocumentsForCampDay,
  getDeepSeekRuntimeConfig,
  generateStructuredWithDeepSeek,
  createAoAnalysis,
  hashAoAnalysisInput,
  FakeDeepSeekError,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getDailyRecord: vi.fn(),
  listExtractedDocumentsForCampDay: vi.fn(),
  getDeepSeekRuntimeConfig: vi.fn(),
  generateStructuredWithDeepSeek: vi.fn(),
  createAoAnalysis: vi.fn(),
  hashAoAnalysisInput: vi.fn(() => "a".repeat(64)),
  FakeDeepSeekError: class FakeDeepSeekError extends Error {
    readonly code = "upstream";
  },
}));

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/repositories/daily-records", () => ({ getDailyRecord }));
vi.mock("@/lib/repositories/ao-analyses", () => ({
  listExtractedDocumentsForCampDay,
  createAoAnalysis,
  hashAoAnalysisInput,
}));
vi.mock("@/lib/settings/deepseek-config", () => ({ getDeepSeekRuntimeConfig }));
vi.mock("@/lib/deepseek/client", () => ({
  DeepSeekError: FakeDeepSeekError,
  generateStructuredWithDeepSeek,
}));

import { POST } from "@/app/api/ao-analysis/route";

const studentId = "123e4567-e89b-42d3-a456-426614174000";
const recordDate = "2026-07-18";
const dailyRecord = {
  id: "323e4567-e89b-42d3-a456-426614174000",
  studentId,
  recordDate,
  campDay: 3,
  achievements: "完成研究问题初稿",
  evidence: "文档有子问题列表",
  challenges: "资料筛选标准不稳定",
  nextPlan: "完善来源比较表",
  processNotes: "能根据提醒修改问题范围",
  behaviorTags: [],
  ao1Note: "",
  ao2Note: "",
  ao3Note: "",
  ao4Note: "",
};

const generated = {
  ao1: {
    suggestedNote: "学生能把研究问题拆分为较小任务。",
    evidenceQuotes: ["子问题列表"],
    confidence: "medium",
    caution: "文档能体现规划痕迹，但仍需结合现场行为。",
  },
  ao2: {
    suggestedNote: "学生开始记录来源信息。",
    evidenceQuotes: ["来源比较表"],
    confidence: "medium",
    caution: "",
  },
  ao3: {
    suggestedNote: "学生形成了初版研究问题。",
    evidenceQuotes: ["研究问题初稿"],
    confidence: "medium",
    caution: "",
  },
  ao4: {
    suggestedNote: "反思证据暂时较少。",
    evidenceQuotes: [],
    confidence: "low",
    caution: "需要后续观察。",
  },
};

function request(body: unknown) {
  return new Request("https://app.example/api/ao-analysis", {
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
  getDailyRecord.mockResolvedValue({
    data: dailyRecord,
    error: null,
    notFound: false,
  });
  listExtractedDocumentsForCampDay.mockResolvedValue({
    data: [
      {
        id: "223e4567-e89b-42d3-a456-426614174000",
        originalFilename: "day3.pdf",
        extractedText: "Day 3 selected evidence",
      },
    ],
    error: null,
  });
  getDeepSeekRuntimeConfig.mockResolvedValue({
    apiKey: "personal-key",
    model: "deepseek-chat",
  });
  generateStructuredWithDeepSeek.mockResolvedValue(generated);
  createAoAnalysis.mockResolvedValue({
    data: { id: "423e4567-e89b-42d3-a456-426614174000", ...generated },
    error: null,
  });
});

describe("AO analysis API", () => {
  test("requires a configured personal DeepSeek key", async () => {
    getDeepSeekRuntimeConfig.mockResolvedValue(null);

    const response = await POST(request({ studentId, recordDate }));

    expect(response.status).toBe(409);
    expect(generateStructuredWithDeepSeek).not.toHaveBeenCalled();
  });

  test("requires a current daily record and at least one extracted document", async () => {
    listExtractedDocumentsForCampDay.mockResolvedValue({ data: [], error: null });

    const response = await POST(request({ studentId, recordDate }));

    expect(response.status).toBe(409);
    expect(generateStructuredWithDeepSeek).not.toHaveBeenCalled();
  });

  test("generates and stores AO suggestions for the selected day only", async () => {
    const response = await POST(request({ studentId, recordDate }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDailyRecord).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      studentId,
      recordDate,
    );
    expect(listExtractedDocumentsForCampDay).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      studentId,
      3,
    );
    expect(generateStructuredWithDeepSeek).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("文档内容不是助教亲眼观察到的行为"),
        user: expect.stringContaining("Day 3 selected evidence"),
      }),
      expect.objectContaining({
        apiKey: "personal-key",
        model: "deepseek-chat",
      }),
      expect.anything(),
    );
    expect(createAoAnalysis).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      expect.objectContaining({
        studentId,
        documentId: "223e4567-e89b-42d3-a456-426614174000",
        campDay: 3,
        modelId: "deepseek-chat",
      }),
    );
    expect(body.data.ao1.suggestedNote).toContain("研究问题");
  });
});

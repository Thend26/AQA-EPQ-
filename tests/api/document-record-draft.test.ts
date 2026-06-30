import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireUser,
  listExtractedDocumentsForCampDay,
  getDeepSeekRuntimeConfig,
  generateStructuredWithDeepSeek,
  FakeDeepSeekError,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listExtractedDocumentsForCampDay: vi.fn(),
  getDeepSeekRuntimeConfig: vi.fn(),
  generateStructuredWithDeepSeek: vi.fn(),
  FakeDeepSeekError: class FakeDeepSeekError extends Error {
    readonly code = "upstream";
  },
}));

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/repositories/ao-analyses", () => ({
  listExtractedDocumentsForCampDay,
}));
vi.mock("@/lib/settings/deepseek-config", () => ({ getDeepSeekRuntimeConfig }));
vi.mock("@/lib/deepseek/client", () => ({
  DeepSeekError: FakeDeepSeekError,
  generateStructuredWithDeepSeek,
}));

import { POST } from "@/app/api/document-record-draft/route";

const studentId = "123e4567-e89b-42d3-a456-426614174000";

function request(body: unknown) {
  return new Request("https://app.example/api/document-record-draft", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const generated = {
  achievements: "完成研究问题初稿",
  evidence: "文档中列出研究问题和资料表",
  challenges: "变量范围仍需收窄",
  nextPlan: "明天完成来源可靠性比较",
  behaviorTags: ["按时完成"],
  ao1Note: "AO1 备注",
  ao2Note: "AO2 备注",
  ao3Note: "AO3 备注",
  ao4Note: "AO4 备注",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({
    ok: true,
    db: { marker: "db" },
    user: { id: "owner-123" },
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
});

describe("document record draft API", () => {
  test("requires a configured personal DeepSeek key", async () => {
    getDeepSeekRuntimeConfig.mockResolvedValue(null);

    const response = await POST(
      request({ studentId, recordDate: "2026-07-18", campDay: 3 }),
    );

    expect(response.status).toBe(409);
    expect(generateStructuredWithDeepSeek).not.toHaveBeenCalled();
  });

  test("generates a reviewable daily record draft from extracted documents", async () => {
    const response = await POST(
      request({ studentId, recordDate: "2026-07-18", campDay: 3 }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listExtractedDocumentsForCampDay).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      studentId,
      3,
    );
    expect(generateStructuredWithDeepSeek).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("不要生成助教过程观察"),
        user: expect.stringContaining("Day 3 selected evidence"),
      }),
      expect.objectContaining({ model: "deepseek-chat" }),
      expect.anything(),
    );
    expect(body.data).toMatchObject({
      achievements: "完成研究问题初稿",
    });
    expect(body.data).not.toHaveProperty("processNotes");
  });
});

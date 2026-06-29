import { describe, expect, it } from "vitest";

import { aoAnalysisResponseSchema } from "@/lib/documents/ao-schema";
import { buildAoAnalysisPrompt } from "@/lib/documents/ao-prompt";

describe("AO analysis schema", () => {
  it("requires AO1-AO4 with evidence, confidence and caution", () => {
    const parsed = aoAnalysisResponseSchema.safeParse({
      ao1: {
        suggestedNote: "学生今天能把研究问题拆成可管理的小步骤。",
        evidenceQuotes: ["列出三个子问题"],
        confidence: "medium",
        caution: "仅能说明文档中出现规划痕迹。",
      },
      ao2: {
        suggestedNote: "学生开始比较不同资料来源。",
        evidenceQuotes: ["source table"],
        confidence: "high",
        caution: "",
      },
      ao3: {
        suggestedNote: "学生形成了初版产出。",
        evidenceQuotes: ["first draft"],
        confidence: "medium",
        caution: "",
      },
      ao4: {
        suggestedNote: "学生有初步反思，但证据较少。",
        evidenceQuotes: [],
        confidence: "low",
        caution: "需要助教进一步观察。",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects missing AO entries and invalid confidence values", () => {
    const parsed = aoAnalysisResponseSchema.safeParse({
      ao1: {
        suggestedNote: "ok",
        evidenceQuotes: [],
        confidence: "certain",
        caution: "",
      },
    });

    expect(parsed.success).toBe(false);
  });
});

describe("buildAoAnalysisPrompt", () => {
  it("includes only selected-day records and documents", () => {
    const prompt = buildAoAnalysisPrompt({
      studentName: "林同学",
      campDay: 3,
      recordDate: "2026-07-18",
      dailyRecord: {
        achievements: "当天完成研究问题初稿",
        evidence: "当天证据",
        challenges: "当天困难",
        nextPlan: "当天计划",
        processNotes: "当天观察",
      },
      documents: [
        {
          filename: "day3.pdf",
          extractedText: "Day 3 selected evidence",
        },
      ],
    });

    expect(prompt.system).toContain("AQA EPQ");
    expect(prompt.system).toContain("文档内容不是助教亲眼观察到的行为");
    expect(prompt.user).toContain("林同学");
    expect(prompt.user).toContain("营地第 3 天");
    expect(prompt.user).toContain("Day 3 selected evidence");
    expect(prompt.user).not.toContain("Day 2");
    expect(prompt.user.length).toBeLessThan(50_000);
  });
});

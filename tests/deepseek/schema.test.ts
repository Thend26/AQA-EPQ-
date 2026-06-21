import { describe, expect, test } from "vitest";

import { generatedFeedbackSchema } from "@/lib/deepseek/schema";

const zh = {
  content: "基于今天记录的具体反馈。",
  evidenceUsed: ["筛选并标注了四篇来源"],
  nextStep: "完成来源比较表",
};

const en = {
  content: "Grounded feedback based on today's record.",
  evidenceUsed: ["Four annotated sources"],
  nextStep: "Complete the source comparison table",
};

describe("generatedFeedbackSchema", () => {
  test.each([
    { mode: "zh", zh },
    { mode: "en", en },
    { mode: "bilingual", zh, en },
  ])("accepts the exact $mode payload", (payload) => {
    expect(generatedFeedbackSchema.parse(payload)).toEqual(payload);
  });

  test("accepts structurally valid output with missing evidence and next step", () => {
    const payload = {
      mode: "zh" as const,
      zh: {
        content: "",
        evidenceUsed: [],
        nextStep: "",
      },
    };

    expect(generatedFeedbackSchema.parse(payload)).toEqual(payload);
  });

  test.each([
    { mode: "zh", zh, en },
    { mode: "en", en, zh },
    { mode: "bilingual", zh },
    { mode: "bilingual", en },
    {
      mode: "zh",
      zh,
      evidenceUsed: ["shared metadata is forbidden"],
    },
    { mode: "zh", zh, extra: true },
    { mode: "zh", zh: { ...zh, extra: true } },
  ])("rejects extra or mode-incompatible fields", (payload) => {
    expect(generatedFeedbackSchema.safeParse(payload).success).toBe(false);
  });
});

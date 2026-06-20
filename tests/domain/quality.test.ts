import { describe, expect, it } from "vitest";

import {
  checkFeedbackQuality,
  countChineseCharacters,
  countEnglishWords,
  type FeedbackQualityInput,
  type LocalizedFeedbackPayload,
} from "@/lib/domain/quality";

const validZh = {
  content: "研".repeat(50),
  evidenceUsed: ["筛选并标注了四篇来源"],
  nextStep: "完成来源比较表",
} satisfies LocalizedFeedbackPayload;

const validEn = {
  content: Array.from({ length: 50 }, (_, index) => `word${index + 1}`).join(
    " ",
  ),
  evidenceUsed: ["Four annotated sources"],
  nextStep: "Compare three sources",
} satisfies LocalizedFeedbackPayload;

describe("language-aware length checks", () => {
  it("counts only Unicode Han script characters at the 49/50 boundary", () => {
    expect(countChineseCharacters(`${"研".repeat(49)} ABC 123，！？`)).toBe(49);
    expect(countChineseCharacters(`${"研".repeat(50)} ABC 123，！？`)).toBe(50);

    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, content: `${"研".repeat(49)} English 123!!!` },
      }),
    ).toContain("中文：反馈不足50汉字");
    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, content: `${"研".repeat(50)} English 123!!!` },
      }),
    ).not.toContain("中文：反馈不足50汉字");
  });

  it("counts English tokens only when they contain a Unicode Latin letter", () => {
    const fortyNine = Array.from(
      { length: 49 },
      (_, index) => (index === 0 ? "student’s" : `word${index}`),
    ).join(", ");
    const fifty = `${fortyNine}; café`;
    const fiftyHanTokens = Array.from({ length: 50 }, () => "研").join(" ");

    expect(countEnglishWords(`${fortyNine} 123 45.6 2026-07-18`)).toBe(49);
    expect(countEnglishWords(`${fifty} 123 45.6`)).toBe(50);
    expect(countEnglishWords(fiftyHanTokens)).toBe(0);
    expect(countEnglishWords("café")).toBe(1);

    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, content: `${fortyNine} 1 2 3` },
      }),
    ).toContain("英文：反馈不足50词");
    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, content: fifty },
      }),
    ).not.toContain("英文：反馈不足50词");
    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, content: fiftyHanTokens },
      }),
    ).toContain("英文：反馈不足50词");
  });

  it("checks each language independently in bilingual mode", () => {
    const input = {
      mode: "bilingual",
      zh: { ...validZh, content: "研".repeat(49) },
      en: validEn,
    } satisfies FeedbackQualityInput;

    expect(checkFeedbackQuality(input)).toContain("中文：反馈不足50汉字");
    expect(checkFeedbackQuality(input)).not.toContain("英文：反馈不足50词");
  });
});

describe("per-language grounding and next steps", () => {
  it("requires at least one nonblank evidence item for each requested language", () => {
    const issues = checkFeedbackQuality({
      mode: "bilingual",
      zh: { ...validZh, evidenceUsed: [" ", "\n"] },
      en: validEn,
    });

    expect(issues).toContain("中文：缺少具体成果或证据");
    expect(issues).not.toContain("英文：缺少具体成果或证据");
  });

  it("requires a trimmed Chinese next step with at least four Han characters", () => {
    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, nextStep: "   " },
      }),
    ).toContain("中文：缺少明确的下一步建议");
    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, nextStep: "查资料" },
      }),
    ).toContain("中文：下一步建议不够具体");
    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, nextStep: "比较资料" },
      }),
    ).not.toContain("中文：下一步建议不够具体");
  });

  it("requires an English next step with at least three letter-containing words", () => {
    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, nextStep: "compare 123" },
      }),
    ).toContain("英文：下一步建议不够具体");
    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, nextStep: "compare three sources" },
      }),
    ).not.toContain("英文：下一步建议不够具体");
  });

  it("accepts fully independent bilingual metadata", () => {
    expect(
      checkFeedbackQuality({
        mode: "bilingual",
        zh: validZh,
        en: validEn,
      }),
    ).toEqual([]);
  });
});

describe("deterministic unsupported-claim rules", () => {
  it.each([
    ["你的项目将获得90%的分数。", "中文：包含无依据的分数声明"],
    ["这份项目会获得满分。", "中文：包含无依据的分数声明"],
    ["预计最终达到A*等级。", "中文：包含无依据的等级预测"],
    ["最终会是第一名。", "中文：包含无依据的排名声明"],
    ["我保证你会取得最高等级。", "中文：包含无依据的绝对保证"],
    ["你一定会通过。", "中文：包含无依据的绝对保证"],
  ])("flags Chinese claim: %s", (claim, expectedIssue) => {
    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, content: `${validZh.content}${claim}` },
      }),
    ).toContain(expectedIssue);
  });

  it.each([
    ["This project will score 90%.", "英文：包含无依据的分数声明"],
    ["This project will receive full marks.", "英文：包含无依据的分数声明"],
    ["The predicted grade is A*.", "英文：包含无依据的等级预测"],
    ["This project will be number one.", "英文：包含无依据的排名声明"],
    ["This project will finish in first place.", "英文：包含无依据的排名声明"],
    ["Success is guaranteed.", "英文：包含无依据的绝对保证"],
    ["You will definitely pass.", "英文：包含无依据的绝对保证"],
  ])("flags English claim: %s", (claim, expectedIssue) => {
    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, content: `${validEn.content} ${claim}` },
      }),
    ).toContain(expectedIssue);
  });

  it.each([
    ["项目评分为90分。", "中文：包含无依据的分数声明"],
    ["预测为A*。", "中文：包含无依据的等级预测"],
    ["成绩达到A。", "中文：包含无依据的等级预测"],
  ])("requires explicit Chinese assessment context: %s", (claim, issue) => {
    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, content: `${validZh.content}${claim}` },
      }),
    ).toContain(issue);
  });

  it.each([
    "今天投入了30分钟。",
    "已经完成90%的编码工作。",
    "总结了3个要点。",
  ])("allows ordinary Chinese quantities: %s", (statement) => {
    expect(
      checkFeedbackQuality({
        mode: "zh",
        zh: { ...validZh, content: `${validZh.content}${statement}` },
      }),
    ).toEqual([]);
  });

  it.each([
    ["The project scored 90%.", "英文：包含无依据的分数声明"],
    ["The project grade is A.", "英文：包含无依据的等级预测"],
    ["The project received 80 marks.", "英文：包含无依据的分数声明"],
    ["The predicted result is A*.", "英文：包含无依据的等级预测"],
  ])("requires explicit English assessment context: %s", (claim, issue) => {
    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, content: `${validEn.content} ${claim}` },
      }),
    ).toContain(issue);
  });

  it.each([
    "The student worked for 30 minutes.",
    "The student completed 90% of the coding.",
    "The student identified 3 key points.",
  ])("allows ordinary English quantities: %s", (statement) => {
    expect(
      checkFeedbackQuality({
        mode: "en",
        en: { ...validEn, content: `${validEn.content} ${statement}` },
      }),
    ).toEqual([]);
  });

  it("does not confuse mathematical absolute value with a guarantee", () => {
    const issues = checkFeedbackQuality({
      mode: "bilingual",
      zh: { ...validZh, content: `${validZh.content}计算了绝对值。` },
      en: { ...validEn, content: `${validEn.content} Calculated absolute value.` },
    });

    expect(issues).not.toContain("中文：包含无依据的绝对保证");
    expect(issues).not.toContain("英文：包含无依据的绝对保证");
  });

  it("does not reject ordinary quantified evidence", () => {
    const issues = checkFeedbackQuality({
      mode: "zh",
      zh: {
        ...validZh,
        content: `${validZh.content}今天筛选了4篇文献并写了900字笔记。`,
      },
    });

    expect(issues).toEqual([]);
  });
});

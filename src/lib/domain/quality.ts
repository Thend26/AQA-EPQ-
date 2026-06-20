/**
 * Language-localized generation boundary shared with the DeepSeek response schema.
 * Each generated language must carry its own content, evidence, and next step.
 */
export type LocalizedFeedbackPayload = {
  content: string;
  evidenceUsed: readonly string[];
  nextStep: string;
};

export type ChineseFeedbackQualityInput = {
  mode: "zh";
  zh: LocalizedFeedbackPayload;
  en?: never;
};

export type EnglishFeedbackQualityInput = {
  mode: "en";
  en: LocalizedFeedbackPayload;
  zh?: never;
};

export type BilingualFeedbackQualityInput = {
  mode: "bilingual";
  zh: LocalizedFeedbackPayload;
  en: LocalizedFeedbackPayload;
};

/** Generation boundary for quality checks and the subsequent DeepSeek schema. */
export type FeedbackQualityInput =
  | ChineseFeedbackQualityInput
  | EnglishFeedbackQualityInput
  | BilingualFeedbackQualityInput;

/** @deprecated Use LocalizedFeedbackPayload. */
export type FeedbackLanguagePayload = LocalizedFeedbackPayload;

type FeedbackLanguage = "中文" | "英文";
type FeedbackQualityIssueType =
  | "反馈不足50汉字"
  | "反馈不足50词"
  | "缺少具体成果或证据"
  | "缺少明确的下一步建议"
  | "下一步建议不够具体"
  | "包含无依据的分数声明"
  | "包含无依据的等级预测"
  | "包含无依据的排名声明"
  | "包含无依据的绝对保证";

export type FeedbackQualityIssue =
  `${FeedbackLanguage}：${FeedbackQualityIssueType}`;

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/gu;
const WORD_TOKEN_PATTERN =
  /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu;
const LATIN_LETTER_PATTERN = /\p{Script=Latin}/u;

const CHINESE_CLAIM_PATTERNS = {
  score: [
    /满分/u,
    /(?:得分|分数|评分|成绩)[^。！？\n]{0,12}\d+(?:\.\d+)?(?:\s*分|\s*%)?/u,
    /\d+(?:\.\d+)?\s*%\s*(?:的)?(?:得分|分数|评分|成绩)/u,
    /(?:可得|获得|取得)[^。！？\n]{0,8}\d+(?:\.\d+)?\s*分/u,
  ],
  grade: [
    /(?:预计|预测)[^。！？\n]{0,16}(?:A\*?|[A-F])(?:\s*等级)?/iu,
    /(?:成绩|评分|等级)[^。！？\n]{0,12}(?:A\*?|[A-F])(?:\s*等级)?/iu,
    /(?:将会|会|将|可达|达到|获得|取得)[^。！？\n]{0,12}(?:A\*?|[A-F])\s*等级/iu,
  ],
  ranking: [
    /第\s*(?:一|1)\s*名/u,
    /排名[^。！？\n]{0,12}(?:第一|第\s*1|首位)/u,
  ],
  guarantee: [/保证[^。！？\n]{0,8}(?:会|能|将|可以)?/u, /一定会/u],
} as const;

const ENGLISH_CLAIM_PATTERNS = {
  score: [
    /\bscor(?:e|ed|ing)\b[^.!?\n]{0,20}\b\d+(?:\.\d+)?(?:\s*%|\s*(?:marks?))?/iu,
    /\bfull\s+marks?\b/iu,
    /\b(?:receive|received|achieve|achieved|earn|earned|get|got)\b[^.!?\n]{0,20}\b\d+(?:\.\d+)?\s*marks?\b/iu,
    /\b\d+(?:\.\d+)?\s*marks?\b/iu,
  ],
  grade: [
    /\b(?:predicted?|expected?)\b[^.!?\n]{0,24}\b(?:A\*|[A-F])(?=\s|[.,;:!?]|$)/iu,
    /\bgrade\b[^.!?\n]{0,12}(?:A\*|[A-F])(?=\s|[.,;:!?]|$)/iu,
  ],
  ranking: [/\bnumber\s+one\b/iu, /\bfirst\s+place\b/iu],
  guarantee: [/\bguaranteed?\b/iu, /\bwill\s+definitely\b/iu],
} as const;

export function countChineseCharacters(content: string | null | undefined) {
  return content?.match(HAN_CHARACTER_PATTERN)?.length ?? 0;
}

export function countEnglishWords(content: string | null | undefined) {
  return (
    content
      ?.match(WORD_TOKEN_PATTERN)
      ?.filter((token) => LATIN_LETTER_PATTERN.test(token)).length ?? 0
  );
}

function hasEvidence(payload: LocalizedFeedbackPayload) {
  return payload.evidenceUsed.some((item) => item.trim().length > 0);
}

function includesAny(content: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(content));
}

function checkClaims(
  language: FeedbackLanguage,
  content: string,
  patterns:
    | typeof CHINESE_CLAIM_PATTERNS
    | typeof ENGLISH_CLAIM_PATTERNS,
): FeedbackQualityIssue[] {
  const issues: FeedbackQualityIssue[] = [];
  if (includesAny(content, patterns.score)) {
    issues.push(`${language}：包含无依据的分数声明`);
  }
  if (includesAny(content, patterns.grade)) {
    issues.push(`${language}：包含无依据的等级预测`);
  }
  if (includesAny(content, patterns.ranking)) {
    issues.push(`${language}：包含无依据的排名声明`);
  }
  if (includesAny(content, patterns.guarantee)) {
    issues.push(`${language}：包含无依据的绝对保证`);
  }
  return issues;
}

function checkChinesePayload(
  payload: FeedbackLanguagePayload,
): FeedbackQualityIssue[] {
  const issues: FeedbackQualityIssue[] = [];

  if (countChineseCharacters(payload.content) < 50) {
    issues.push("中文：反馈不足50汉字");
  }
  if (!hasEvidence(payload)) {
    issues.push("中文：缺少具体成果或证据");
  }

  const nextStep = payload.nextStep.trim();
  if (!nextStep) {
    issues.push("中文：缺少明确的下一步建议");
  } else if (countChineseCharacters(nextStep) < 4) {
    issues.push("中文：下一步建议不够具体");
  }

  issues.push(
    ...checkClaims(
      "中文",
      `${payload.content}\n${payload.nextStep}`,
      CHINESE_CLAIM_PATTERNS,
    ),
  );
  return issues;
}

function checkEnglishPayload(
  payload: FeedbackLanguagePayload,
): FeedbackQualityIssue[] {
  const issues: FeedbackQualityIssue[] = [];

  if (countEnglishWords(payload.content) < 50) {
    issues.push("英文：反馈不足50词");
  }
  if (!hasEvidence(payload)) {
    issues.push("英文：缺少具体成果或证据");
  }

  const nextStep = payload.nextStep.trim();
  if (!nextStep) {
    issues.push("英文：缺少明确的下一步建议");
  } else if (countEnglishWords(nextStep) < 3) {
    issues.push("英文：下一步建议不够具体");
  }

  issues.push(
    ...checkClaims(
      "英文",
      `${payload.content}\n${payload.nextStep}`,
      ENGLISH_CLAIM_PATTERNS,
    ),
  );
  return issues;
}

export function checkFeedbackQuality(
  input: FeedbackQualityInput,
): FeedbackQualityIssue[] {
  if (input.mode === "zh") return checkChinesePayload(input.zh);
  if (input.mode === "en") return checkEnglishPayload(input.en);

  return [...checkChinesePayload(input.zh), ...checkEnglishPayload(input.en)];
}

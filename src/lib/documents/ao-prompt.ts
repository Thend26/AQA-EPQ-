import type { FeedbackPrompts } from "@/lib/domain/prompt";

type AoPromptDailyRecord = {
  achievements: string;
  evidence: string;
  challenges: string;
  nextPlan: string;
  processNotes: string;
};

type AoPromptDocument = {
  filename: string;
  extractedText: string;
};

type BuildAoAnalysisPromptInput = {
  studentName: string;
  campDay: number;
  recordDate: string;
  dailyRecord: AoPromptDailyRecord;
  documents: AoPromptDocument[];
};

const MAX_DOCUMENT_TEXT_CHARS = 36_000;
const MAX_RECORD_FIELD_CHARS = 4_000;

function clampText(value: string, maxCharacters: number) {
  return value.trim().slice(0, maxCharacters);
}

function section(label: string, value: string) {
  const text = clampText(value, MAX_RECORD_FIELD_CHARS);
  return `${label}: ${text || "（未填写）"}`;
}

export function buildAoAnalysisPrompt(input: BuildAoAnalysisPromptInput): FeedbackPrompts {
  const documents = input.documents
    .map(
      (document, index) =>
        `文档 ${index + 1}《${document.filename}》\n${clampText(document.extractedText, MAX_DOCUMENT_TEXT_CHARS)}`,
    )
    .join("\n\n---\n\n");

  return {
    system: [
      "你是熟悉 AQA EPQ 评价目标的中文助教观察助手。",
      "请根据所选营地日的学生文档和助教当日记录，生成 AO1 Manage、AO2 Use resources、AO3 Develop and realise、AO4 Review 的观察建议。",
      "文档内容不是助教亲眼观察到的行为；如果材料只能说明文档中出现了某些内容，必须用谨慎措辞，并降低 confidence。",
      "不能编造学生表现、不能引用未提供的材料、不能混入其他日期。",
      "输出必须是 JSON object，且只包含 ao1、ao2、ao3、ao4。每项包含 suggestedNote、evidenceQuotes、confidence、caution。",
    ].join("\n"),
    user: [
      `学生：${input.studentName}`,
      `日期：${input.recordDate}`,
      `营地第 ${input.campDay} 天`,
      "",
      "当日记录：",
      section("今日完成成果", input.dailyRecord.achievements),
      section("成果证据或数量信息", input.dailyRecord.evidence),
      section("遇到的困难", input.dailyRecord.challenges),
      section("明日计划", input.dailyRecord.nextPlan),
      section("助教过程观察", input.dailyRecord.processNotes),
      "",
      "所选营地日已解析文档：",
      documents || "（没有可用文档）",
      "",
      "请生成可供助教复核、编辑后写入每日 AO 观察栏的建议。suggestedNote 用中文，50-180 字为宜。",
    ].join("\n"),
  };
}

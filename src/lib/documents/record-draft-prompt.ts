import type { FeedbackPrompts } from "@/lib/domain/prompt";

type DraftPromptDocument = {
  filename: string;
  extractedText: string;
};

type BuildDocumentRecordDraftPromptInput = {
  recordDate: string;
  campDay: number;
  documents: DraftPromptDocument[];
};

const MAX_DOCUMENT_TEXT_CHARS = 36_000;

function clampText(value: string, maxCharacters: number) {
  return value.trim().slice(0, maxCharacters);
}

export function buildDocumentRecordDraftPrompt(
  input: BuildDocumentRecordDraftPromptInput,
): FeedbackPrompts {
  const documents = input.documents
    .map(
      (document, index) =>
        `文档 ${index + 1}《${document.filename}》\n${clampText(document.extractedText, MAX_DOCUMENT_TEXT_CHARS)}`,
    )
    .join("\n\n---\n\n");

  return {
    system: [
      "你是熟悉 AQA EPQ 和 10-11 年级学生特点的中文助教记录助手。",
      "请根据学生上传并已解析的文档，为当天记录生成可复核草稿。",
      "不要生成助教过程观察 processNotes；该字段必须由助教根据现场行为手动填写。",
      "不能编造未在文档中出现的事实；如果只能从文档推断，请使用谨慎措辞。",
      "输出必须是 JSON object，只包含 achievements、evidence、challenges、nextPlan、behaviorTags、ao1Note、ao2Note、ao3Note、ao4Note。",
      "behaviorTags 只能从以下选项选择：主动提问、按时完成、需要提醒、能回应建议、合作表现突出。",
    ].join("\n"),
    user: [
      `日期：${input.recordDate}`,
      `营地第 ${input.campDay} 天`,
      "",
      "已解析文档：",
      documents || "（没有可用文档）",
      "",
      "请生成适合直接填入助教工作台的中文草稿。achievements 和 nextPlan 要具体；AO1-AO4 每项 50-180 字为宜。",
    ].join("\n"),
  };
}

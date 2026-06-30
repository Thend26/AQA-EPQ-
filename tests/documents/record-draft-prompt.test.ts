import { describe, expect, test } from "vitest";

import {
  documentRecordDraftResponseSchema,
} from "@/lib/documents/record-draft-schema";
import { buildDocumentRecordDraftPrompt } from "@/lib/documents/record-draft-prompt";

describe("document record draft schema", () => {
  test("accepts all generated daily record fields except process notes", () => {
    const parsed = documentRecordDraftResponseSchema.safeParse({
      achievements: "完成研究问题初稿",
      evidence: "文档中列出研究问题和资料表",
      challenges: "变量范围仍需收窄",
      nextPlan: "明天完成来源可靠性比较",
      behaviorTags: ["按时完成", "能回应建议"],
      ao1Note: "AO1 备注",
      ao2Note: "AO2 备注",
      ao3Note: "AO3 备注",
      ao4Note: "AO4 备注",
    });

    expect(parsed.success).toBe(true);
  });

  test("rejects attempts to generate tutor-only process notes", () => {
    const parsed = documentRecordDraftResponseSchema.safeParse({
      achievements: "完成研究问题初稿",
      evidence: "文档中列出研究问题和资料表",
      challenges: "变量范围仍需收窄",
      nextPlan: "明天完成来源可靠性比较",
      behaviorTags: [],
      processNotes: "助教现场观察",
      ao1Note: "AO1 备注",
      ao2Note: "AO2 备注",
      ao3Note: "AO3 备注",
      ao4Note: "AO4 备注",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("buildDocumentRecordDraftPrompt", () => {
  test("asks DeepSeek to fill form fields without inventing process observation", () => {
    const prompt = buildDocumentRecordDraftPrompt({
      recordDate: "2026-07-18",
      campDay: 3,
      documents: [
        {
          filename: "proposal.pdf",
          extractedText: "学生完成了研究问题和三条资料来源。",
        },
      ],
    });

    expect(prompt.system).toContain("不要生成助教过程观察");
    expect(prompt.system).toContain("JSON object");
    expect(prompt.user).toContain("营地第 3 天");
    expect(prompt.user).toContain("proposal.pdf");
    expect(prompt.user).toContain("学生完成了研究问题");
  });
});

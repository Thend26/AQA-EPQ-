import { describe, expect, test } from "vitest";

import {
  buildEvidenceCorpus,
  mapEvidenceToCanonicalIds,
} from "@/lib/domain/grounding";

const records = [
  {
    id: "record-1",
    achievements: "筛选并批注了四篇资料。",
    evidence: "完成 900 字研究日志",
    challenges: "仍需区分相关关系与因果关系",
    nextPlan: "制作来源比较表",
    processNotes: "能主动说明取舍理由",
    ao1Note: "按计划推进",
    ao2Note: "记录作者与发布日期",
    ao3Note: "",
    ao4Note: "识别出两项来源冲突",
  },
];

describe("evidence grounding corpus", () => {
  test("creates stable canonical entries only from allowed record fields", () => {
    expect(buildEvidenceCorpus(records).map(({ id }) => id)).toEqual([
      "record-1:achievements",
      "record-1:evidence",
      "record-1:challenges",
      "record-1:processNotes",
      "record-1:ao1Note",
      "record-1:ao2Note",
      "record-1:ao4Note",
      "record-1:nextPlan",
    ]);
  });

  test("accepts a student's recorded challenge as traceable evidence", () => {
    const corpus = buildEvidenceCorpus(records);

    expect(
      mapEvidenceToCanonicalIds(
        ["仍需区分相关关系与因果关系"],
        corpus,
      ),
    ).toEqual({
      ids: ["record-1:challenges"],
      unsupported: [],
    });
  });

  test("maps normalized substrings and meaningful token overlap", () => {
    const corpus = buildEvidenceCorpus(records);

    expect(
      mapEvidenceToCanonicalIds(
        ["[record-1:evidence] 完成９００字研究日志"],
        corpus,
      ),
    ).toEqual({
      ids: ["record-1:evidence"],
      unsupported: [],
    });
    expect(
      mapEvidenceToCanonicalIds(["记录作者、发布日期"], corpus),
    ).toEqual({
      ids: ["record-1:ao2Note"],
      unsupported: [],
    });
  });

  test("does not accept an id marker when the evidence text is fabricated", () => {
    const corpus = buildEvidenceCorpus(records);

    expect(
      mapEvidenceToCanonicalIds(
        ["[record-1:evidence] 完成了十次专家访谈"],
        corpus,
      ),
    ).toEqual({
      ids: [],
      unsupported: ["[record-1:evidence] 完成了十次专家访谈"],
    });
  });
});

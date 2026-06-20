import { describe, expect, it } from "vitest";

import {
  buildPlanAchievementContext,
  selectRecentContext,
  type ContextRecord,
} from "@/lib/domain/context";

function record(
  id: string,
  recordDate: string,
  overrides: Partial<ContextRecord> = {},
): ContextRecord {
  return {
    id,
    recordDate,
    achievements: `achievement-${id}`,
    evidence: `evidence-${id}`,
    nextPlan: `plan-${id}`,
    ...overrides,
  };
}

describe("selectRecentContext", () => {
  it("returns an empty array for empty input", () => {
    expect(selectRecentContext([], "2026-07-18")).toEqual([]);
  });

  it("returns all eligible records when fewer than five exist", () => {
    const records = [
      record("3", "2026-07-18"),
      record("1", "2026-07-16"),
      record("2", "2026-07-17"),
    ];

    expect(
      selectRecentContext(records, "2026-07-18").map(({ id }) => id),
    ).toEqual(["1", "2", "3"]);
  });

  it("returns the latest five eligible records in stable chronological order", () => {
    const records = [
      record("7", "2026-07-16"),
      record("2", "2026-07-11"),
      record("4", "2026-07-13"),
      record("1", "2026-07-10"),
      record("6", "2026-07-15"),
      record("3", "2026-07-12"),
      record("5", "2026-07-14"),
    ];

    expect(
      selectRecentContext(records, "2026-07-16").map(({ id }) => id),
    ).toEqual(["3", "4", "5", "6", "7"]);
  });

  it("excludes records after the target date", () => {
    const records = [
      record("before", "2026-07-17"),
      record("target", "2026-07-18"),
      record("future", "2026-07-19"),
    ];

    expect(
      selectRecentContext(records, "2026-07-18").map(({ id }) => id),
    ).toEqual(["before", "target"]);
  });

  it("uses id as a stable tie-breaker for records on the same date", () => {
    const records = [
      record("b", "2026-07-18"),
      record("a", "2026-07-18"),
      record("c", "2026-07-18"),
    ];

    expect(
      selectRecentContext(records, "2026-07-18").map(({ id }) => id),
    ).toEqual(["a", "b", "c"]);
  });

  it.each([0, -1])("returns an empty array when limit is %i", (limit) => {
    expect(
      selectRecentContext([record("1", "2026-07-18")], "2026-07-18", limit),
    ).toEqual([]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "returns an empty array when limit is non-finite: %s",
    (limit) => {
      expect(
        selectRecentContext(
          [record("1", "2026-07-17"), record("2", "2026-07-18")],
          "2026-07-18",
          limit,
        ),
      ).toEqual([]);
    },
  );

  it("floors a positive fractional limit", () => {
    const records = [
      record("1", "2026-07-16"),
      record("2", "2026-07-17"),
      record("3", "2026-07-18"),
    ];

    expect(
      selectRecentContext(records, "2026-07-18", 2.8).map(({ id }) => id),
    ).toEqual(["2", "3"]);
  });

  it("returns an empty array when a positive fractional limit floors to zero", () => {
    expect(
      selectRecentContext(
        [record("1", "2026-07-17"), record("2", "2026-07-18")],
        "2026-07-18",
        0.5,
      ),
    ).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const records = [
      record("later", "2026-07-18"),
      record("earlier", "2026-07-17"),
    ];
    const originalOrder = records.map(({ id }) => id);

    const selected = selectRecentContext(records, "2026-07-18");

    expect(records.map(({ id }) => id)).toEqual(originalOrder);
    expect(selected).not.toBe(records);
  });
});

describe("buildPlanAchievementContext", () => {
  it("returns null when the target date has no record", () => {
    expect(
      buildPlanAchievementContext(
        [record("before", "2026-07-17"), record("after", "2026-07-19")],
        "2026-07-18",
      ),
    ).toBeNull();
  });

  it("compares today's achievements with the most recent prior record", () => {
    const result = buildPlanAchievementContext(
      [
        record("older", "2026-07-15", { nextPlan: "旧计划" }),
        record("previous", "2026-07-17", { nextPlan: "完成证据比较表" }),
        record("current", "2026-07-20", {
          achievements: "完成了三类来源的证据比较表",
        }),
      ],
      "2026-07-20",
    );

    const previousRecord = {
      recordId: "previous",
      recordDate: "2026-07-17",
      nextPlan: "完成证据比较表",
    };
    expect(result).toEqual({
      targetDate: "2026-07-20",
      current: {
        recordId: "current",
        achievements: "完成了三类来源的证据比较表",
      },
      previousRecord,
      previousDay: previousRecord,
    });
  });

  it("selects the most recent prior record across a month boundary", () => {
    const result = buildPlanAchievementContext(
      [
        record("january", "2026-01-30", { nextPlan: "整理访谈编码" }),
        record("february", "2026-02-03", { achievements: "完成访谈编码" }),
      ],
      "2026-02-03",
    );

    expect(result?.previousRecord).toEqual({
      recordId: "january",
      recordDate: "2026-01-30",
      nextPlan: "整理访谈编码",
    });
  });

  it("represents the first record without inventing prior context", () => {
    const result = buildPlanAchievementContext(
      [record("first", "2026-07-18", { achievements: "确定研究问题" })],
      "2026-07-18",
    );

    expect(result?.previousRecord).toBeNull();
    expect(result?.previousDay).toBeNull();
  });
});

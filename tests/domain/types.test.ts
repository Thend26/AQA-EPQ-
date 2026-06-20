import { describe, expect, it } from "vitest";

import {
  dailyRecordSchema,
  studentSchema,
  studentUpdateSchema,
  type DailyRecordInput,
  type StudentInput,
} from "@/lib/domain/types";

const validDailyRecord = {
  studentId: "123e4567-e89b-42d3-a456-426614174000",
  recordDate: "2026-06-20",
  campDay: 1,
  achievements: "Compared evidence from three sources.",
  nextPlan: "Draft the methodology section.",
} satisfies DailyRecordInput;

describe("dailyRecordSchema", () => {
  it("rejects a daily record without achievements", () => {
    const result = dailyRecordSchema.safeParse({
      ...validDailyRecord,
      achievements: undefined,
      nextPlan: "Draft the methodology section.",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a daily record with empty achievements", () => {
    const result = dailyRecordSchema.safeParse({
      ...validDailyRecord,
      achievements: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only achievements", () => {
    const result = dailyRecordSchema.safeParse({
      ...validDailyRecord,
      achievements: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("allows defaulted fields to be omitted from input", () => {
    const result = dailyRecordSchema.parse(validDailyRecord);

    expect(result).toMatchObject({
      evidence: "",
      challenges: "",
      processNotes: "",
      behaviorTags: [],
      ao1Note: "",
      ao2Note: "",
      ao3Note: "",
      ao4Note: "",
    });
  });

  it("rejects blank behavior tags", () => {
    const result = dailyRecordSchema.safeParse({
      ...validDailyRecord,
      behaviorTags: ["focused", "   "],
    });

    expect(result.success).toBe(false);
  });

  it("trims and removes duplicate behavior tags", () => {
    const result = dailyRecordSchema.parse({
      ...validDailyRecord,
      behaviorTags: [" focused ", "focused", "independent"],
    });

    expect(result.behaviorTags).toEqual(["focused", "independent"]);
  });

  it("successfully parses a valid complete record", () => {
    const result = dailyRecordSchema.safeParse({
      ...validDailyRecord,
      evidence: "Three annotated sources.",
      challenges: "Conflicting publication dates.",
      processNotes: "Cross-checked the bibliography.",
      behaviorTags: ["focused", "independent"],
      ao1Note: "Refined the research question.",
      ao2Note: "Evaluated source provenance.",
      ao3Note: "Compared competing interpretations.",
      ao4Note: "Reflected on research limitations.",
    });

    expect(result.success).toBe(true);
  });
});

describe("studentSchema", () => {
  it("allows defaulted student fields to be omitted from input", () => {
    const input = {
      displayName: "Alex",
      grade: "10",
      projectTitle: "The ethics of gene editing",
      campStartDate: "2026-06-20",
    } satisfies StudentInput;

    expect(studentSchema.parse(input)).toMatchObject({
      backgroundNotes: "",
      currentFocus: "",
    });
  });
});

describe("studentUpdateSchema", () => {
  it("accepts a strict partial student update", () => {
    expect(studentUpdateSchema.parse({ currentFocus: "Refine sources" })).toEqual({
      currentFocus: "Refine sources",
    });
  });

  it("rejects empty updates and unknown owner fields", () => {
    expect(studentUpdateSchema.safeParse({}).success).toBe(false);
    expect(
      studentUpdateSchema.safeParse({
        currentFocus: "Refine sources",
        ownerId: "attacker",
      }).success,
    ).toBe(false);
  });
});

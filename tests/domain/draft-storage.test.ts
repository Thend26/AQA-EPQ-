import { describe, expect, test, vi } from "vitest";

import {
  readDailyRecordDraft,
  removeDailyRecordDraft,
  writeDailyRecordDraft,
} from "@/lib/domain/draft-storage";

const identity = {
  ownerId: "owner-123",
  studentId: "123e4567-e89b-42d3-a456-426614174000",
  date: "2026-07-18",
};

const values = {
  campDay: 3,
  achievements: "筛选了四篇文献",
  evidence: "",
  challenges: "",
  nextPlan: "比较研究方法",
  processNotes: "",
  behaviorTags: ["主动提问"],
  ao1Note: "",
  ao2Note: "",
  ao3Note: "",
  ao4Note: "",
};

function throwingStorage(method: "getItem" | "setItem" | "removeItem") {
  return {
    getItem: method === "getItem" ? vi.fn(() => {
      throw new Error("blocked");
    }) : vi.fn(),
    setItem: method === "setItem" ? vi.fn(() => {
      throw new Error("full");
    }) : vi.fn(),
    removeItem: method === "removeItem" ? vi.fn(() => {
      throw new Error("blocked");
    }) : vi.fn(),
  } as unknown as Storage;
}

describe("daily record draft storage", () => {
  test("catches storage get, set, and remove failures", () => {
    expect(
      readDailyRecordDraft(throwingStorage("getItem"), "draft", identity),
    ).toBeNull();
    expect(
      writeDailyRecordDraft(
        throwingStorage("setItem"),
        "draft",
        identity,
        values,
      ),
    ).toBe(false);
    expect(
      removeDailyRecordDraft(throwingStorage("removeItem"), "draft"),
    ).toBe(false);
  });

  test("ignores invalid JSON without deleting it", () => {
    const storage = {
      getItem: vi.fn(() => "{"),
      removeItem: vi.fn(),
    } as unknown as Storage;

    expect(readDailyRecordDraft(storage, "draft", identity)).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  test("ignores valid JSON with an invalid draft structure", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          ...identity,
          values: { ...values, campDay: 0 },
        }),
      ),
    } as unknown as Storage;

    expect(readDailyRecordDraft(storage, "draft", identity)).toBeNull();
  });

  test("ignores a valid draft belonging to another identity", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          ...identity,
          studentId: "223e4567-e89b-42d3-a456-426614174000",
          values,
        }),
      ),
    } as unknown as Storage;

    expect(readDailyRecordDraft(storage, "draft", identity)).toBeNull();
  });

  test("round trips a valid identity-scoped draft", () => {
    const getItem = vi.fn();
    const setItem = vi.fn();
    const storage = {
      getItem,
      setItem,
    } as unknown as Storage;

    expect(
      writeDailyRecordDraft(storage, "draft", identity, values),
    ).toBe(true);
    const serialized = setItem.mock.calls[0][1];
    getItem.mockReturnValue(serialized);

    expect(readDailyRecordDraft(storage, "draft", identity)).toEqual(values);
  });
});

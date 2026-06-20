import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import {
  dailyRecordUpsert,
  getDailyRecord,
  upsertDailyRecord,
  verifyStudentOwnership,
} from "@/lib/repositories/daily-records";

const input = {
  studentId: "123e4567-e89b-42d3-a456-426614174000",
  recordDate: "2026-07-18",
  campDay: 3,
  achievements: "筛选了四篇文献",
  evidence: "四篇带批注的文献",
  challenges: "",
  nextPlan: "比较研究方法",
  processNotes: "",
  behaviorTags: ["主动提问"],
  ao1Note: "按计划推进",
  ao2Note: "",
  ao3Note: "",
  ao4Note: "",
};

describe("owner-scoped daily record queries", () => {
  test("upsert payload refreshes updated_at", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T09:10:11.000Z"));

    expect(dailyRecordUpsert("owner-123", input)).toMatchObject({
      updated_at: "2026-07-18T09:10:11.000Z",
    });

    vi.useRealTimers();
  });

  test("verifies student ownership by both student and owner id", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: input.studentId }, error: null });
    const ownerEq = vi.fn(() => ({ maybeSingle }));
    const studentEq = vi.fn(() => ({ eq: ownerEq }));
    const select = vi.fn(() => ({ eq: studentEq }));
    const db = {
      from: vi.fn(() => ({ select })),
    } as unknown as SupabaseClient;

    const result = await verifyStudentOwnership(
      db,
      "owner-123",
      input.studentId,
    );

    expect(studentEq).toHaveBeenCalledWith("id", input.studentId);
    expect(ownerEq).toHaveBeenCalledWith("owner_id", "owner-123");
    expect(result).toEqual({ owned: true, error: null });
  });

  test("get stops before reading records when the student is not owned", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const ownerEq = vi.fn(() => ({ maybeSingle }));
    const studentEq = vi.fn(() => ({ eq: ownerEq }));
    const studentSelect = vi.fn(() => ({ eq: studentEq }));
    const recordSelect = vi.fn();
    const db = {
      from: vi.fn((table: string) =>
        table === "students"
          ? { select: studentSelect }
          : { select: recordSelect },
      ),
    } as unknown as SupabaseClient;

    const result = await getDailyRecord(
      db,
      "owner-123",
      input.studentId,
      input.recordDate,
    );

    expect(result.notFound).toBe(true);
    expect(recordSelect).not.toHaveBeenCalled();
  });

  test("confirms the student belongs to the owner before upserting", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const ownerEq = vi.fn(() => ({ maybeSingle }));
    const studentEq = vi.fn(() => ({ eq: ownerEq }));
    const select = vi.fn(() => ({ eq: studentEq }));
    const upsert = vi.fn();
    const db = {
      from: vi.fn((table: string) =>
        table === "students" ? { select } : { upsert },
      ),
    } as unknown as SupabaseClient;

    const result = await upsertDailyRecord(db, "owner-123", input);

    expect(studentEq).toHaveBeenCalledWith("id", input.studentId);
    expect(ownerEq).toHaveBeenCalledWith("owner_id", "owner-123");
    expect(result.notFound).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  test("uses only the authenticated owner and server-generated record id", async () => {
    const studentMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: input.studentId }, error: null });
    const studentOwnerEq = vi.fn(() => ({ maybeSingle: studentMaybeSingle }));
    const studentIdEq = vi.fn(() => ({ eq: studentOwnerEq }));
    const studentSelect = vi.fn(() => ({ eq: studentIdEq }));
    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    const recordSelect = vi.fn(() => ({ single }));
    const upsert = vi.fn((values: unknown, options: unknown) => {
      void values;
      void options;
      return { select: recordSelect };
    });
    const db = {
      from: vi.fn((table: string) =>
        table === "students" ? { select: studentSelect } : { upsert },
      ),
    } as unknown as SupabaseClient;

    await upsertDailyRecord(db, "owner-123", input);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: "owner-123",
        student_id: input.studentId,
        record_date: input.recordDate,
      }),
      { onConflict: "student_id,record_date" },
    );
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("id");
  });
});

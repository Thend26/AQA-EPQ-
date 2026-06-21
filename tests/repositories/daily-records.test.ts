import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import {
  DailyRecordConflictError,
  dailyRecordUpsert,
  getDailyRecord,
  upsertDailyRecord,
  verifyStudentOwnership,
} from "@/lib/repositories/daily-records";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

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

function ownedStudentDb() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: input.studentId },
    error: null,
  });
  const ownerEq = vi.fn(() => ({ maybeSingle }));
  const studentEq = vi.fn(() => ({ eq: ownerEq }));
  const select = vi.fn(() => ({ eq: studentEq }));
  return { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
}

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

  test("uses the service-role RPC with expected revision", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "323e4567-e89b-42d3-a456-426614174000",
          owner_id: "owner-123",
          student_id: input.studentId,
          record_date: input.recordDate,
          camp_day: input.campDay,
          achievements: input.achievements,
          evidence: input.evidence,
          challenges: input.challenges,
          next_plan: input.nextPlan,
          process_notes: input.processNotes,
          behavior_tags: input.behaviorTags,
          ao1_note: input.ao1Note,
          ao2_note: input.ao2Note,
          ao3_note: input.ao3Note,
          ao4_note: input.ao4Note,
          revision: 3,
        },
      ],
      error: null,
    });
    createAdminClient.mockReturnValue({ rpc });

    const result = await upsertDailyRecord(
      ownedStudentDb(),
      "owner-123",
      input,
      2,
    );

    expect(rpc).toHaveBeenCalledWith(
      "save_daily_record",
      expect.objectContaining({
        p_owner_id: "owner-123",
        p_student_id: input.studentId,
        p_record_date: input.recordDate,
        p_expected_revision: 2,
      }),
    );
    expect(result.data?.revision).toBe(3);
  });

  test("returns a typed conflict when the RPC returns no row", async () => {
    createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const result = await upsertDailyRecord(
      ownedStudentDb(),
      "owner-123",
      input,
      null,
    );

    expect(result.error).toBeInstanceOf(DailyRecordConflictError);
  });
});

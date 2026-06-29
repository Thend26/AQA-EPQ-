import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

import {
  createStudent,
  deleteStudent,
  listStudents,
  StudentCampDateConflictError,
  studentInsert,
  studentUpdate,
  updateStudent,
} from "@/lib/repositories/students";

const input = {
  displayName: "林同学",
  grade: "10" as const,
  projectTitle: "Attention and short video",
  campStartDate: "2026-07-16",
  backgroundNotes: "",
  currentFocus: "",
};

test("studentInsert uses the authenticated owner id", () => {
  expect(studentInsert("owner-123", input)).toEqual({
    owner_id: "owner-123",
    display_name: "林同学",
    grade: "10",
    project_title: "Attention and short video",
    camp_start_date: "2026-07-16",
    background_notes: "",
    current_focus: "",
  });
});

test("studentUpdate maps only fields supplied by a partial update", () => {
  expect(studentUpdate({ currentFocus: "Refine sources" })).toEqual({
    current_focus: "Refine sources",
  });
});

describe("owner-scoped student queries", () => {
  test("list filters by owner id", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const db = {
      from: vi.fn(() => ({ select })),
    } as unknown as SupabaseClient;

    await listStudents(db, "owner-123");

    expect(eq).toHaveBeenCalledWith("owner_id", "owner-123");
    expect(order).toHaveBeenCalledWith("display_name");
  });

  test("create inserts the authenticated owner id", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const db = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await createStudent(db, "owner-123", input);

    expect(insert).toHaveBeenCalledWith(studentInsert("owner-123", input));
  });

  test("update filters by both student and owner id", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "student-123" }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const remove = vi.fn(() => ({ eq: firstEq }));
    const db = {
      from: vi.fn(() => ({ update, delete: remove })),
    } as unknown as SupabaseClient;

    await updateStudent(db, "owner-123", "student-123", {
      currentFocus: "Refine sources",
    });

    expect(update).toHaveBeenCalledWith({
      current_focus: "Refine sources",
    });
    expect(firstEq).toHaveBeenCalledWith("id", "student-123");
    expect(secondEq).toHaveBeenCalledWith("owner_id", "owner-123");
  });

  test("update maps camp start date conflicts to a typed error", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PSC01", message: "conflicting records" },
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const db = {
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient;

    const result = await updateStudent(db, "owner-123", "student-123", {
      campStartDate: "2026-07-20",
    });

    expect(result.error).toBeInstanceOf(StudentCampDateConflictError);
  });

  test("delete filters by both student and owner id", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "student-123" }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const remove = vi.fn(() => ({ eq: firstEq }));
    const db = {
      from: vi.fn(() => ({ delete: remove })),
    } as unknown as SupabaseClient;

    await deleteStudent(db, "owner-123", "student-123");

    expect(firstEq).toHaveBeenCalledWith("id", "student-123");
    expect(secondEq).toHaveBeenCalledWith("owner_id", "owner-123");
  });
});

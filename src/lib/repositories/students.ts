import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Student,
  StudentInput,
  StudentUpdateInput,
} from "@/lib/domain/types";

export type StudentRow = {
  id: string;
  owner_id: string;
  display_name: string;
  grade: "10" | "11";
  project_title: string;
  camp_start_date: string;
  background_notes: string;
  current_focus: string;
};

type RepositoryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export class StudentCampDateConflictError extends Error {
  readonly code = "student_camp_date_conflict";

  constructor() {
    super("Camp start date conflicts with existing records or documents");
    this.name = "StudentCampDateConflictError";
  }
}

export function studentInsert(ownerId: string, input: StudentInput) {
  return {
    owner_id: ownerId,
    display_name: input.displayName,
    grade: input.grade,
    project_title: input.projectTitle,
    camp_start_date: input.campStartDate,
    background_notes: input.backgroundNotes ?? "",
    current_focus: input.currentFocus ?? "",
  };
}

export function studentUpdate(input: StudentUpdateInput) {
  const update: Record<string, string> = {};

  if (input.displayName !== undefined) {
    update.display_name = input.displayName;
  }
  if (input.grade !== undefined) {
    update.grade = input.grade;
  }
  if (input.projectTitle !== undefined) {
    update.project_title = input.projectTitle;
  }
  if (input.campStartDate !== undefined) {
    update.camp_start_date = input.campStartDate;
  }
  if (input.backgroundNotes !== undefined) {
    update.background_notes = input.backgroundNotes;
  }
  if (input.currentFocus !== undefined) {
    update.current_focus = input.currentFocus;
  }

  return update;
}

export function studentFromRow(row: StudentRow): Student {
  return {
    id: row.id,
    displayName: row.display_name,
    grade: row.grade,
    projectTitle: row.project_title,
    campStartDate: row.camp_start_date,
    backgroundNotes: row.background_notes,
    currentFocus: row.current_focus,
  };
}

export async function listStudents(
  db: SupabaseClient,
  ownerId: string,
): Promise<RepositoryResult<Student[]>> {
  const result = await db
    .from("students")
    .select("*")
    .eq("owner_id", ownerId)
    .order("display_name");
  const rows = result.data as StudentRow[] | null;

  return {
    data: rows?.map(studentFromRow) ?? null,
    error: result.error,
  };
}

export async function createStudent(
  db: SupabaseClient,
  ownerId: string,
  input: StudentInput,
): Promise<RepositoryResult<Student>> {
  const result = await db
    .from("students")
    .insert(studentInsert(ownerId, input))
    .select("*")
    .single();

  return {
    data: result.data ? studentFromRow(result.data as StudentRow) : null,
    error: result.error,
  };
}

export async function updateStudent(
  db: SupabaseClient,
  ownerId: string,
  id: string,
  input: StudentUpdateInput,
): Promise<RepositoryResult<Student>> {
  const result = await db
    .from("students")
    .update(studentUpdate(input))
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();

  const error =
    result.error?.code === "PSC01"
      ? new StudentCampDateConflictError()
      : result.error;

  return {
    data: result.data ? studentFromRow(result.data as StudentRow) : null,
    error,
  };
}

export async function deleteStudent(
  db: SupabaseClient,
  ownerId: string,
  id: string,
): Promise<RepositoryResult<{ id: string }>> {
  const result = await db
    .from("students")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  return {
    data: result.data as { id: string } | null,
    error: result.error,
  };
}

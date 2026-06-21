import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DailyRecord,
  DailyRecordInput,
} from "@/lib/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";

type RepositoryError = { message: string };

type RepositoryResult<T> = {
  data: T | null;
  error: RepositoryError | null;
  notFound?: boolean;
};

type DailyRecordRow = {
  id: string;
  owner_id: string;
  student_id: string;
  record_date: string;
  camp_day: number;
  achievements: string;
  evidence: string;
  challenges: string;
  next_plan: string;
  process_notes: string;
  behavior_tags: string[];
  ao1_note: string;
  ao2_note: string;
  ao3_note: string;
  ao4_note: string;
  revision: number;
};

export type StoredDailyRecord = DailyRecord & {
  id: string;
  revision: number;
};

export class DailyRecordConflictError extends Error {
  readonly code = "daily_record_conflict";

  constructor() {
    super("Daily record was changed by another request");
    this.name = "DailyRecordConflictError";
  }
}

export class DailyRecordStorageUnavailableError extends Error {
  readonly code = "daily_record_storage_unavailable";

  constructor() {
    super("Daily record storage is temporarily unavailable");
    this.name = "DailyRecordStorageUnavailableError";
  }
}

export async function verifyStudentOwnership(
  db: SupabaseClient,
  ownerId: string,
  studentId: string,
) {
  const result = await db
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return {
    owned: Boolean(result.data),
    error: result.error as RepositoryError | null,
  };
}

export function dailyRecordUpsert(ownerId: string, input: DailyRecordInput) {
  return {
    owner_id: ownerId,
    student_id: input.studentId,
    record_date: input.recordDate,
    camp_day: input.campDay,
    achievements: input.achievements,
    evidence: input.evidence ?? "",
    challenges: input.challenges ?? "",
    next_plan: input.nextPlan,
    process_notes: input.processNotes ?? "",
    behavior_tags: input.behaviorTags ?? [],
    ao1_note: input.ao1Note ?? "",
    ao2_note: input.ao2Note ?? "",
    ao3_note: input.ao3Note ?? "",
    ao4_note: input.ao4Note ?? "",
    updated_at: new Date().toISOString(),
  };
}

function dailyRecordFromRow(row: DailyRecordRow): StoredDailyRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    recordDate: row.record_date,
    campDay: row.camp_day,
    achievements: row.achievements,
    evidence: row.evidence,
    challenges: row.challenges,
    nextPlan: row.next_plan,
    processNotes: row.process_notes,
    behaviorTags: row.behavior_tags,
    ao1Note: row.ao1_note,
    ao2Note: row.ao2_note,
    ao3Note: row.ao3_note,
    ao4Note: row.ao4_note,
    revision: row.revision,
  };
}

export async function getDailyRecord(
  db: SupabaseClient,
  ownerId: string,
  studentId: string,
  recordDate: string,
): Promise<RepositoryResult<StoredDailyRecord>> {
  const ownership = await verifyStudentOwnership(db, ownerId, studentId);
  if (ownership.error) {
    return { data: null, error: ownership.error };
  }
  if (!ownership.owned) {
    return { data: null, error: null, notFound: true };
  }

  const result = await db
    .from("daily_records")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("student_id", studentId)
    .eq("record_date", recordDate)
    .maybeSingle();

  return {
    data: result.data
      ? dailyRecordFromRow(result.data as DailyRecordRow)
      : null,
    error: result.error,
    notFound: false,
  };
}

export async function upsertDailyRecord(
  db: SupabaseClient,
  ownerId: string,
  input: DailyRecordInput,
  expectedRevision: number | null,
): Promise<RepositoryResult<StoredDailyRecord>> {
  const ownership = await verifyStudentOwnership(
    db,
    ownerId,
    input.studentId,
  );
  if (ownership.error) {
    return { data: null, error: ownership.error };
  }
  if (!ownership.owned) {
    return { data: null, error: null, notFound: true };
  }

  let result;
  try {
    result = await createAdminClient().rpc("save_daily_record", {
      p_owner_id: ownerId,
      p_student_id: input.studentId,
      p_record_date: input.recordDate,
      p_camp_day: input.campDay,
      p_achievements: input.achievements,
      p_evidence: input.evidence ?? "",
      p_challenges: input.challenges ?? "",
      p_next_plan: input.nextPlan,
      p_process_notes: input.processNotes ?? "",
      p_behavior_tags: input.behaviorTags ?? [],
      p_ao1_note: input.ao1Note ?? "",
      p_ao2_note: input.ao2Note ?? "",
      p_ao3_note: input.ao3Note ?? "",
      p_ao4_note: input.ao4Note ?? "",
      p_expected_revision: expectedRevision,
    });
  } catch {
    return {
      data: null,
      error: new DailyRecordStorageUnavailableError(),
      notFound: false,
    };
  }
  if (result.error) {
    return {
      data: null,
      error: new DailyRecordStorageUnavailableError(),
      notFound: false,
    };
  }
  const row = (result.data as DailyRecordRow[] | null)?.[0];
  if (!row) {
    return {
      data: null,
      error: new DailyRecordConflictError(),
      notFound: false,
    };
  }

  return {
    data: dailyRecordFromRow(row),
    error: null,
    notFound: false,
  };
}

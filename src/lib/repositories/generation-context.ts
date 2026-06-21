import type { SupabaseClient } from "@supabase/supabase-js";

import type { LanguageMode } from "@/lib/domain/types";

type RepositoryError = { message: string };

type DailyRecordRow = {
  id: string;
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
};

type StudentContextRow = {
  id: string;
  display_name: string;
  grade: "10" | "11";
  project_title: string;
  background_notes: string;
  current_focus: string;
};

type PriorFeedbackRow = {
  id: string;
  daily_record_id: string;
  created_at: string;
  language_mode: LanguageMode;
  content_zh: string | null;
  content_en: string | null;
};

export type GenerationRecord = {
  id: string;
  recordDate: string;
  campDay: number;
  achievements: string;
  evidence: string;
  challenges: string;
  nextPlan: string;
  processNotes: string;
  behaviorTags: string[];
  ao1Note: string;
  ao2Note: string;
  ao3Note: string;
  ao4Note: string;
};

export type GenerationContext = {
  targetRecordId: string;
  student: {
    id: string;
    displayName: string;
    grade: "10" | "11";
    projectTitle: string;
    backgroundNotes: string;
    currentFocus: string;
  };
  records: GenerationRecord[];
  priorFeedbacks: Array<{
    createdAt: string;
    mode: LanguageMode;
    contentZh: string | null;
    contentEn: string | null;
  }>;
};

type GenerationContextResult = {
  data: GenerationContext | null;
  error: RepositoryError | null;
  notFound: boolean;
};

const DAILY_RECORD_FIELDS = [
  "id",
  "student_id",
  "record_date",
  "camp_day",
  "achievements",
  "evidence",
  "challenges",
  "next_plan",
  "process_notes",
  "behavior_tags",
  "ao1_note",
  "ao2_note",
  "ao3_note",
  "ao4_note",
].join(",");

function recordFromRow(row: DailyRecordRow): GenerationRecord {
  return {
    id: row.id,
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
  };
}

export async function loadGenerationContext(
  db: SupabaseClient,
  ownerId: string,
  dailyRecordId: string,
): Promise<GenerationContextResult> {
  const targetResult = await db
    .from("daily_records")
    .select(DAILY_RECORD_FIELDS)
    .eq("id", dailyRecordId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (targetResult.error) {
    return { data: null, error: targetResult.error, notFound: false };
  }
  if (!targetResult.data) {
    return { data: null, error: null, notFound: true };
  }
  const target = targetResult.data as unknown as DailyRecordRow;

  const studentResult = await db
    .from("students")
    .select(
      "id,display_name,grade,project_title,background_notes,current_focus",
    )
    .eq("id", target.student_id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (studentResult.error) {
    return { data: null, error: studentResult.error, notFound: false };
  }
  if (!studentResult.data) {
    return { data: null, error: null, notFound: true };
  }
  const student = studentResult.data as StudentContextRow;

  const recordsResult = await db
    .from("daily_records")
    .select(DAILY_RECORD_FIELDS)
    .eq("owner_id", ownerId)
    .eq("student_id", target.student_id)
    .lte("record_date", target.record_date)
    .order("record_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(5);
  if (recordsResult.error) {
    return { data: null, error: recordsResult.error, notFound: false };
  }

  const eligibleRecordIdsResult = await db
    .from("daily_records")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("student_id", target.student_id)
    .lt("record_date", target.record_date)
    .order("record_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(10);
  if (eligibleRecordIdsResult.error) {
    return {
      data: null,
      error: eligibleRecordIdsResult.error,
      notFound: false,
    };
  }
  const eligibleRecordIds = (
    (eligibleRecordIdsResult.data ?? []) as Array<{ id: string }>
  ).map(({ id }) => id);

  const feedbackResult = await db
    .from("feedbacks")
    .select(
      "id,daily_record_id,created_at,language_mode,content_zh,content_en",
    )
    .eq("owner_id", ownerId)
    .eq("student_id", target.student_id)
    .eq("status", "final")
    .in("daily_record_id", eligibleRecordIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(3);
  if (feedbackResult.error) {
    return { data: null, error: feedbackResult.error, notFound: false };
  }

  const records = ((recordsResult.data ?? []) as unknown as DailyRecordRow[])
    .map(recordFromRow)
    .toReversed();
  const priorFeedbacks = (
    (feedbackResult.data ?? []) as PriorFeedbackRow[]
  )
    .map((feedback) => ({
      createdAt: feedback.created_at,
      mode: feedback.language_mode,
      contentZh: feedback.content_zh,
      contentEn: feedback.content_en,
    }))
    .toReversed();

  return {
    data: {
      targetRecordId: target.id,
      student: {
        id: student.id,
        displayName: student.display_name,
        grade: student.grade,
        projectTitle: student.project_title,
        backgroundNotes: student.background_notes,
        currentFocus: student.current_focus,
      },
      records,
      priorFeedbacks,
    },
    error: null,
    notFound: false,
  };
}

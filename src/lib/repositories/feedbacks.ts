import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import {
  checkFeedbackQuality,
  type FeedbackQualityIssue,
} from "@/lib/domain/quality";
import type { LanguageMode } from "@/lib/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";

type RepositoryError = {
  message: string;
  code?: string;
};

export class RepositoryStorageUnavailableError extends Error {
  readonly code = "repository_storage_unavailable";

  constructor() {
    super("Feedback storage is temporarily unavailable");
    this.name = "RepositoryStorageUnavailableError";
  }
}

export class FeedbackConflictError extends Error {
  readonly code = "feedback_conflict";

  constructor(message = "Feedback was changed by another request") {
    super(message);
    this.name = "FeedbackConflictError";
  }
}

type FeedbackRow = {
  id: string;
  student_id: string;
  daily_record_id: string;
  language_mode: LanguageMode;
  content_zh: string | null;
  content_en: string | null;
  evidence_used_zh: string[];
  evidence_used_en: string[];
  next_step_zh: string | null;
  next_step_en: string | null;
  status: "draft" | "final";
  version: number;
  revision: number;
};

type FeedbackMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type FeedbackGroundingRecordRow = {
  id: string;
  achievements: string;
  evidence: string;
  challenges: string;
  process_notes: string;
  ao1_note: string;
  ao2_note: string;
  ao3_note: string;
  ao4_note: string;
  next_plan: string;
};

export type FeedbackGroundingRecord = {
  id: string;
  achievements: string;
  evidence: string;
  challenges: string;
  processNotes: string;
  ao1Note: string;
  ao2Note: string;
  ao3Note: string;
  ao4Note: string;
  nextPlan: string;
};

export type StoredFeedback = {
  id: string;
  studentId: string;
  dailyRecordId: string;
  draft: GeneratedFeedback;
  status: "draft" | "final";
  version: number;
  revision: number;
  contextRecordIds: string[];
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
};

type FeedbackResult = {
  data: StoredFeedback | null;
  error:
    | RepositoryError
    | FeedbackConflictError
    | RepositoryStorageUnavailableError
    | null;
  notFound: boolean;
};

const FEEDBACK_FIELDS = [
  "id",
  "student_id",
  "daily_record_id",
  "language_mode",
  "content_zh",
  "content_en",
  "evidence_used_zh",
  "evidence_used_en",
  "next_step_zh",
  "next_step_en",
  "status",
  "version",
  "revision",
].join(",");

const feedbackRowSchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  daily_record_id: z.string().uuid(),
  language_mode: z.enum(["zh", "en", "bilingual"]),
  content_zh: z.string().nullable(),
  content_en: z.string().nullable(),
  evidence_used_zh: z.array(z.string()),
  evidence_used_en: z.array(z.string()),
  next_step_zh: z.string().nullable(),
  next_step_en: z.string().nullable(),
  status: z.enum(["draft", "final"]),
  version: z.number().int().positive(),
  revision: z.number().int().min(0),
});

const finalizeRpcRowSchema = z.object({
  feedback_id: z.string().uuid(),
  revision: z.number().int().min(0),
});

function payloadColumns(draft: GeneratedFeedback) {
  return {
    languageMode: draft.mode,
    contentZh: draft.mode === "en" ? null : draft.zh.content,
    contentEn: draft.mode === "zh" ? null : draft.en.content,
    evidenceUsedZh:
      draft.mode === "en" ? [] : [...draft.zh.evidenceUsed],
    evidenceUsedEn:
      draft.mode === "zh" ? [] : [...draft.en.evidenceUsed],
    nextStepZh: draft.mode === "en" ? null : draft.zh.nextStep,
    nextStepEn: draft.mode === "zh" ? null : draft.en.nextStep,
  };
}

function rpcPayload(draft: GeneratedFeedback) {
  const payload = payloadColumns(draft);
  return {
    p_language_mode: payload.languageMode,
    p_content_zh: payload.contentZh,
    p_content_en: payload.contentEn,
    p_evidence_used_zh: payload.evidenceUsedZh,
    p_evidence_used_en: payload.evidenceUsedEn,
    p_next_step_zh: payload.nextStepZh,
    p_next_step_en: payload.nextStepEn,
  };
}

function payloadFromRow(row: FeedbackRow): GeneratedFeedback {
  const zh = {
    content: row.content_zh ?? "",
    evidenceUsed: row.evidence_used_zh ?? [],
    nextStep: row.next_step_zh ?? "",
  };
  const en = {
    content: row.content_en ?? "",
    evidenceUsed: row.evidence_used_en ?? [],
    nextStep: row.next_step_en ?? "",
  };

  if (row.language_mode === "zh") return { mode: "zh", zh };
  if (row.language_mode === "en") return { mode: "en", en };
  return { mode: "bilingual", zh, en };
}

function storedFromRow(
  row: FeedbackRow,
  contextRecordIds: string[],
  messages: StoredFeedback["messages"] = [],
): StoredFeedback {
  return {
    id: row.id,
    studentId: row.student_id,
    dailyRecordId: row.daily_record_id,
    draft: payloadFromRow(row),
    status: row.status,
    version: row.version,
    revision: row.revision,
    contextRecordIds,
    messages,
  };
}

export async function createFeedbackDraft(
  ownerId: string,
  input: {
    dailyRecordId: string;
    draft: GeneratedFeedback;
    contextRecordIds: string[];
    sourceFeedbackId?: string;
    expectedRevision?: number;
    userMessage?: string;
    assistantMessage?: string;
  },
): Promise<FeedbackResult> {
  const contextRecordIds = [...new Set(input.contextRecordIds)];
  let result;
  try {
    result = await createAdminClient().rpc("create_feedback_draft", {
      p_owner_id: ownerId,
      p_daily_record_id: input.dailyRecordId,
      ...rpcPayload(input.draft),
      p_context_record_ids: contextRecordIds,
      p_source_feedback_id: input.sourceFeedbackId ?? null,
      p_expected_revision: input.expectedRevision ?? null,
      p_user_message: input.userMessage ?? null,
      p_assistant_message: input.assistantMessage ?? null,
    });
  } catch {
    return {
      data: null,
      error: new RepositoryStorageUnavailableError(),
      notFound: false,
    };
  }

  if (result.error) {
    return {
      data: null,
      error: new RepositoryStorageUnavailableError(),
      notFound: false,
    };
  }

  const rawRow = (result.data as unknown[] | null)?.[0];
  if (!rawRow) {
    if (input.sourceFeedbackId) {
      return {
        data: null,
        error: new FeedbackConflictError(),
        notFound: false,
      };
    }
    return { data: null, error: null, notFound: true };
  }
  const parsedRow = feedbackRowSchema.safeParse(rawRow);
  if (!parsedRow.success) {
    return {
      data: null,
      error: new RepositoryStorageUnavailableError(),
      notFound: false,
    };
  }

  return {
    data: storedFromRow(parsedRow.data, contextRecordIds),
    error: null,
    notFound: false,
  };
}

export async function loadFeedback(
  db: SupabaseClient,
  ownerId: string,
  feedbackId: string,
): Promise<FeedbackResult> {
  const feedbackResult = await db
    .from("feedbacks")
    .select(FEEDBACK_FIELDS)
    .eq("id", feedbackId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (feedbackResult.error) {
    return {
      data: null,
      error: feedbackResult.error as RepositoryError,
      notFound: false,
    };
  }
  if (!feedbackResult.data) {
    return { data: null, error: null, notFound: true };
  }

  const messageResult = await db
    .from("feedback_messages")
    .select("id,role,content,created_at")
    .eq("feedback_id", feedbackId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (messageResult.error) {
    return {
      data: null,
      error: messageResult.error as RepositoryError,
      notFound: false,
    };
  }

  const contextResult = await db
    .from("feedback_context_records")
    .select("daily_record_id")
    .eq("feedback_id", feedbackId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  if (contextResult.error) {
    return {
      data: null,
      error: contextResult.error as RepositoryError,
      notFound: false,
    };
  }

  const row = feedbackResult.data as unknown as FeedbackRow;
  const contextRecordIds = (
    (contextResult.data ?? []) as Array<{ daily_record_id: string }>
  ).map(({ daily_record_id }) => daily_record_id);
  const messages = ((messageResult.data ?? []) as FeedbackMessageRow[])
    .toReversed()
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    }));

  return {
    data: storedFromRow(row, contextRecordIds, messages),
    error: null,
    notFound: false,
  };
}

export async function loadFeedbackGroundingRecords(
  db: SupabaseClient,
  ownerId: string,
  contextRecordIds: readonly string[],
): Promise<{
  data: FeedbackGroundingRecord[];
  error: RepositoryError | null;
}> {
  if (contextRecordIds.length === 0) {
    return { data: [], error: null };
  }

  const result = await db
    .from("daily_records")
    .select(
      "id,achievements,evidence,challenges,process_notes,ao1_note,ao2_note,ao3_note,ao4_note,next_plan",
    )
    .eq("owner_id", ownerId)
    .in("id", [...contextRecordIds]);
  if (result.error) {
    return { data: [], error: result.error as RepositoryError };
  }

  const rows = (result.data ?? []) as FeedbackGroundingRecordRow[];
  return {
    data: rows.map((row) => ({
      id: row.id,
      achievements: row.achievements,
      evidence: row.evidence,
      challenges: row.challenges,
      processNotes: row.process_notes,
      ao1Note: row.ao1_note,
      ao2Note: row.ao2_note,
      ao3Note: row.ao3_note,
      ao4Note: row.ao4_note,
      nextPlan: row.next_plan,
    })),
    error: null,
  };
}

export async function finalizeFeedback(
  ownerId: string,
  feedbackId: string,
  expectedRevision: number,
  draft: GeneratedFeedback,
): Promise<{
  finalized: boolean;
  revision?: number;
  issues: FeedbackQualityIssue[];
  error: RepositoryError | FeedbackConflictError | null;
}> {
  const issues = checkFeedbackQuality(draft);
  if (issues.length > 0) {
    return { finalized: false, issues, error: null };
  }

  let result;
  try {
    result = await createAdminClient().rpc("finalize_feedback", {
      p_owner_id: ownerId,
      p_feedback_id: feedbackId,
      p_expected_revision: expectedRevision,
      ...rpcPayload(draft),
    });
  } catch {
    return {
      finalized: false,
      issues: [],
      error: new RepositoryStorageUnavailableError(),
    };
  }
  if (result.error) {
    return {
      finalized: false,
      issues: [],
      error: new RepositoryStorageUnavailableError(),
    };
  }

  const rawRow = (result.data as unknown[] | null)?.[0];
  if (!rawRow) {
    return {
      finalized: false,
      issues: [],
      error: new FeedbackConflictError(),
    };
  }
  const parsedRow = finalizeRpcRowSchema.safeParse(rawRow);
  if (!parsedRow.success) {
    return {
      finalized: false,
      issues: [],
      error: new RepositoryStorageUnavailableError(),
    };
  }

  return {
    finalized: true,
    revision: parsedRow.data.revision,
    issues: [],
    error: null,
  };
}

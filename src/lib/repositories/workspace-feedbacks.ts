import type { SupabaseClient } from "@supabase/supabase-js";

import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import type { LanguageMode } from "@/lib/domain/types";

type WorkspaceFeedbackRow = {
  id: string;
  status: "draft" | "final";
  version: number;
  revision: number;
  created_at: string;
  language_mode: LanguageMode;
  content_zh: string | null;
  content_en: string | null;
  evidence_used_zh: string[];
  evidence_used_en: string[];
  next_step_zh: string | null;
  next_step_en: string | null;
};

function draftFromRow(row: WorkspaceFeedbackRow): GeneratedFeedback {
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

export async function loadWorkspaceFeedbacks(
  db: SupabaseClient,
  ownerId: string,
  dailyRecordId: string,
) {
  const result = await db
    .from("feedbacks")
    .select(
      "id,status,version,revision,created_at,language_mode,content_zh,content_en,evidence_used_zh,evidence_used_en,next_step_zh,next_step_en",
    )
    .eq("owner_id", ownerId)
    .eq("daily_record_id", dailyRecordId)
    .order("version", { ascending: false })
    .limit(10);
  const rows = (result.data ?? []) as WorkspaceFeedbackRow[];
  const currentDraft = rows.find((row) => row.status === "draft");

  return {
    error: result.error as { message: string } | null,
    feedback: currentDraft
      ? {
          id: currentDraft.id,
          draft: draftFromRow(currentDraft),
          revision: currentDraft.revision,
        }
      : null,
    history: rows.map((row) => ({
      id: row.id,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
    })),
  };
}

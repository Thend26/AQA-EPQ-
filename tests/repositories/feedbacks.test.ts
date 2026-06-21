import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, test, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import {
  createFeedbackDraft,
  FeedbackConflictError,
  finalizeFeedback,
  loadFeedback,
  RepositoryStorageUnavailableError,
} from "@/lib/repositories/feedbacks";

const feedbackId = "123e4567-e89b-42d3-a456-426614174010";
const studentId = "123e4567-e89b-42d3-a456-426614174000";
const recordId = "123e4567-e89b-42d3-a456-426614174001";
const priorRecordId = "123e4567-e89b-42d3-a456-426614174002";
const sourceFeedbackId = "123e4567-e89b-42d3-a456-426614174011";
const draft = {
  mode: "zh" as const,
  zh: {
    content: "今天完成了四篇资料的筛选和批注，并记录了作者、日期与主要观点。学生识别了来源之间的结论差异，并开始比较证据质量。接下来需要把比较结果写入研究日志并说明取舍理由。",
    evidenceUsed: ["四篇带批注的文献"],
    nextStep: "明天完成来源比较表并写出两项取舍理由",
  },
};

function rpcDb(result: unknown) {
  const rpc = vi.fn().mockResolvedValue(result);
  createAdminClient.mockReturnValue({ rpc });
  return { rpc };
}

describe("feedback repository atomic writes", () => {
  test("creates a draft, context rows, inherited messages, and revision in one RPC", async () => {
    const { rpc } = rpcDb({
      data: [
        {
          id: feedbackId,
          student_id: studentId,
          daily_record_id: recordId,
          language_mode: "zh",
          content_zh: draft.zh.content,
          content_en: null,
          evidence_used_zh: draft.zh.evidenceUsed,
          evidence_used_en: [],
          next_step_zh: draft.zh.nextStep,
          next_step_en: null,
          status: "draft",
          version: 2,
          revision: 0,
        },
      ],
      error: null,
    });

    const result = await createFeedbackDraft("owner-ignored", {
      dailyRecordId: recordId,
      draft,
      contextRecordIds: [priorRecordId, recordId],
      sourceFeedbackId,
      expectedRevision: 4,
      userMessage: "更简洁",
      assistantMessage: JSON.stringify(draft),
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("create_feedback_draft", {
      p_owner_id: "owner-ignored",
      p_daily_record_id: recordId,
      p_language_mode: "zh",
      p_content_zh: draft.zh.content,
      p_content_en: null,
      p_evidence_used_zh: draft.zh.evidenceUsed,
      p_evidence_used_en: [],
      p_next_step_zh: draft.zh.nextStep,
      p_next_step_en: null,
      p_context_record_ids: [priorRecordId, recordId],
      p_source_feedback_id: sourceFeedbackId,
      p_expected_revision: 4,
      p_user_message: "更简洁",
      p_assistant_message: JSON.stringify(draft),
    });
    expect(result.data?.revision).toBe(0);
  });

  test("returns a typed conflict when an atomic revision RPC returns no row", async () => {
    rpcDb({ data: [], error: null });

    const result = await createFeedbackDraft("owner-ignored", {
      dailyRecordId: recordId,
      draft,
      contextRecordIds: [recordId],
      sourceFeedbackId,
      expectedRevision: 2,
      userMessage: "修改",
      assistantMessage: JSON.stringify(draft),
    });

    expect(result.error).toBeInstanceOf(FeedbackConflictError);
    expect(result.notFound).toBe(false);
  });

  test("does not issue partial table writes when the RPC fails", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "context insert failed", code: "23503" },
    });
    const from = vi.fn();
    createAdminClient.mockReturnValue({ rpc, from });

    const result = await createFeedbackDraft("owner-ignored", {
      dailyRecordId: recordId,
      draft,
      contextRecordIds: ["bad-record"],
    });

    expect(result.error).toBeInstanceOf(RepositoryStorageUnavailableError);
    expect(from).not.toHaveBeenCalled();
  });

  test("rejects malformed RPC success payloads as storage unavailable", async () => {
    rpcDb({
      data: [{ id: "not-a-complete-feedback-row" }],
      error: null,
    });

    const result = await createFeedbackDraft("owner-123", {
      dailyRecordId: recordId,
      draft,
      contextRecordIds: [recordId],
    });

    expect(result.error).toBeInstanceOf(RepositoryStorageUnavailableError);
  });

  test("quality issues prevent finalize RPC", async () => {
    const { rpc } = rpcDb({ data: [], error: null });

    const result = await finalizeFeedback(
      "owner-ignored",
      feedbackId,
      3,
      {
        mode: "zh",
        zh: { content: "太短", evidenceUsed: [], nextStep: "" },
      },
    );

    expect(result.issues.length).toBeGreaterThan(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("finalizes with expected revision and reports stale writes as conflict", async () => {
    const { rpc } = rpcDb({ data: [], error: null });

    const result = await finalizeFeedback(
      "owner-ignored",
      feedbackId,
      3,
      draft,
    );

    expect(rpc).toHaveBeenCalledWith("finalize_feedback", {
      p_owner_id: "owner-ignored",
      p_feedback_id: feedbackId,
      p_expected_revision: 3,
      p_language_mode: "zh",
      p_content_zh: draft.zh.content,
      p_content_en: null,
      p_evidence_used_zh: draft.zh.evidenceUsed,
      p_evidence_used_en: [],
      p_next_step_zh: draft.zh.nextStep,
      p_next_step_en: null,
    });
    expect(result.error).toBeInstanceOf(FeedbackConflictError);
  });

});

describe("owner-scoped feedback loading", () => {
  test("loads revision, messages, and authoritative context with owner scope", async () => {
    const feedbackMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: feedbackId,
        student_id: studentId,
        daily_record_id: recordId,
        language_mode: "zh",
        content_zh: draft.zh.content,
        content_en: null,
        evidence_used_zh: draft.zh.evidenceUsed,
        evidence_used_en: [],
        next_step_zh: draft.zh.nextStep,
        next_step_en: null,
        status: "draft",
        version: 2,
        revision: 5,
      },
      error: null,
    });
    const feedbackOwnerEq = vi.fn(() => ({
      maybeSingle: feedbackMaybeSingle,
    }));
    const feedbackIdEq = vi.fn(() => ({ eq: feedbackOwnerEq }));
    const feedbackSelect = vi.fn(() => ({ eq: feedbackIdEq }));
    const messageLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const messageOrder = vi.fn(() => ({ limit: messageLimit }));
    const messageOwnerEq = vi.fn(() => ({ order: messageOrder }));
    const messageFeedbackEq = vi.fn(() => ({ eq: messageOwnerEq }));
    const messageSelect = vi.fn(() => ({ eq: messageFeedbackEq }));
    const contextOrder = vi.fn().mockResolvedValue({
      data: [{ daily_record_id: recordId }],
      error: null,
    });
    const contextOwnerEq = vi.fn(() => ({ order: contextOrder }));
    const contextFeedbackEq = vi.fn(() => ({ eq: contextOwnerEq }));
    const contextSelect = vi.fn(() => ({ eq: contextFeedbackEq }));
    const db = {
      from: vi.fn((table: string) => {
        if (table === "feedbacks") return { select: feedbackSelect };
        if (table === "feedback_messages") return { select: messageSelect };
        return { select: contextSelect };
      }),
    } as unknown as SupabaseClient;

    const result = await loadFeedback(db, "owner-123", feedbackId);

    expect(feedbackOwnerEq).toHaveBeenCalledWith("owner_id", "owner-123");
    expect(result.data?.revision).toBe(5);
    expect(result.data?.contextRecordIds).toEqual([recordId]);
    expect(messageOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(messageLimit).toHaveBeenCalledWith(10);
  });
});

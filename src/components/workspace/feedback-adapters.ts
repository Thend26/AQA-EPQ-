import { z } from "zod";

import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import { generatedFeedbackSchema } from "@/lib/deepseek/schema";
import type { LanguageMode } from "@/lib/domain/types";
import {
  requestWorkspaceJson,
  WorkspaceApiError,
} from "@/lib/workspace/api";

export { WorkspaceApiError };

type Fetcher = typeof fetch;

const feedbackIdentitySchema = z.object({
  id: z.string().trim().min(1),
  revision: z.number().int().min(0),
}).passthrough();
const draftResponseSchema = z.object({
  feedback: feedbackIdentitySchema,
  draft: generatedFeedbackSchema,
}).passthrough();
const finalizeResponseSchema = z.object({
  revision: z.number().int().min(0),
}).passthrough();

function postJson<T>(
  fetcher: Fetcher,
  url: string,
  body: unknown,
  schema: z.ZodType<T>,
) {
  return requestWorkspaceJson(
    fetcher,
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    schema,
  );
}

export function createFeedbackAdapters({
  dailyRecordId,
  feedbackId,
  fetcher = fetch,
}: {
  dailyRecordId: string;
  feedbackId?: string;
  fetcher?: Fetcher;
}) {
  let currentFeedbackId = feedbackId;

  return {
    async generate(languageMode: LanguageMode) {
      const payload = await postJson(
        fetcher,
        "/api/feedback/generate",
        { dailyRecordId, languageMode, instruction: "" },
        draftResponseSchema,
      );
      const feedback = payload.feedback;
      currentFeedbackId = feedback.id;
      return {
        draft: payload.draft as GeneratedFeedback,
        revision: feedback.revision,
      };
    },

    async revise(
      instruction: string,
      draft: GeneratedFeedback,
      expectedRevision: number,
    ) {
      if (!currentFeedbackId) {
        throw new WorkspaceApiError("请先生成反馈", 400);
      }
      const payload = await postJson(
        fetcher,
        `/api/feedback/${currentFeedbackId}/messages`,
        { instruction, draft, expectedRevision },
        draftResponseSchema,
      );
      const feedback = payload.feedback;
      currentFeedbackId = feedback.id;
      return {
        draft: payload.draft as GeneratedFeedback,
        revision: feedback.revision,
      };
    },

    async finalize(draft: GeneratedFeedback, expectedRevision: number) {
      if (!currentFeedbackId) {
        throw new WorkspaceApiError("请先生成反馈", 400);
      }
      const payload = await postJson(
        fetcher,
        `/api/feedback/${currentFeedbackId}/finalize`,
        { draft, expectedRevision },
        finalizeResponseSchema,
      );
      return { revision: payload.revision };
    },
  };
}

import { z } from "zod";

const behaviorTagSchema = z.enum([
  "主动提问",
  "按时完成",
  "需要提醒",
  "能回应建议",
  "合作表现突出",
]);

export const documentRecordDraftResponseSchema = z
  .object({
    achievements: z.string().trim().min(1).max(4_000),
    evidence: z.string().trim().max(4_000),
    challenges: z.string().trim().max(4_000),
    nextPlan: z.string().trim().min(1).max(4_000),
    behaviorTags: z.array(behaviorTagSchema).max(5),
    ao1Note: z.string().trim().min(1).max(2_000),
    ao2Note: z.string().trim().min(1).max(2_000),
    ao3Note: z.string().trim().min(1).max(2_000),
    ao4Note: z.string().trim().min(1).max(2_000),
  })
  .strict();

export type DocumentRecordDraftResponse = z.infer<
  typeof documentRecordDraftResponseSchema
>;

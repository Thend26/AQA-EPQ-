import { z } from "zod";

const localizedFeedbackSchema = z
  .object({
    content: z.string(),
    evidenceUsed: z.array(z.string()),
    nextStep: z.string(),
  })
  .strict();

const chineseFeedbackSchema = z
  .object({
    mode: z.literal("zh"),
    zh: localizedFeedbackSchema,
  })
  .strict();

const englishFeedbackSchema = z
  .object({
    mode: z.literal("en"),
    en: localizedFeedbackSchema,
  })
  .strict();

const bilingualFeedbackSchema = z
  .object({
    mode: z.literal("bilingual"),
    zh: localizedFeedbackSchema,
    en: localizedFeedbackSchema,
  })
  .strict();

export const generatedFeedbackSchema = z.discriminatedUnion("mode", [
  chineseFeedbackSchema,
  englishFeedbackSchema,
  bilingualFeedbackSchema,
]);

export type GeneratedFeedback = z.infer<typeof generatedFeedbackSchema>;

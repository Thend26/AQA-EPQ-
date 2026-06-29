import { z } from "zod";

export const aoKeySchema = z.enum(["ao1", "ao2", "ao3", "ao4"]);

export const aoSuggestionSchema = z
  .object({
    suggestedNote: z.string().trim().min(1).max(2_000),
    evidenceQuotes: z.array(z.string().trim().min(1).max(300)).max(6),
    confidence: z.enum(["high", "medium", "low"]),
    caution: z.string().trim().max(1_000),
  })
  .strict();

export const aoAnalysisResponseSchema = z
  .object({
    ao1: aoSuggestionSchema,
    ao2: aoSuggestionSchema,
    ao3: aoSuggestionSchema,
    ao4: aoSuggestionSchema,
  })
  .strict();

export type AoKey = z.infer<typeof aoKeySchema>;
export type AoSuggestion = z.infer<typeof aoSuggestionSchema>;
export type AoAnalysisResponse = z.infer<typeof aoAnalysisResponseSchema>;

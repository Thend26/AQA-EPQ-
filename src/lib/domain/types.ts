import { z } from "zod";

export const languageModeSchema = z.enum(["zh", "en", "bilingual"]);
export type LanguageMode = z.infer<typeof languageModeSchema>;

export const studentSchema = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(80),
  grade: z.enum(["10", "11"]),
  projectTitle: z.string().trim().min(1).max(300),
  campStartDate: z.string().date(),
  backgroundNotes: z.string().max(2000).default(""),
  currentFocus: z.string().max(1000).default(""),
});
export type StudentInput = z.input<typeof studentSchema>;
export type Student = z.output<typeof studentSchema>;

export const dailyRecordSchema = z.object({
  studentId: z.string().uuid(),
  recordDate: z.string().date(),
  campDay: z.number().int().min(1).max(100),
  achievements: z.string().trim().min(1).max(4000),
  evidence: z.string().max(4000).default(""),
  challenges: z.string().max(4000).default(""),
  nextPlan: z.string().trim().min(1).max(4000),
  processNotes: z.string().max(4000).default(""),
  behaviorTags: z
    .array(z.string().trim().min(1).max(60))
    .max(12)
    .default([])
    .transform((tags) => [...new Set(tags)]),
  ao1Note: z.string().max(2000).default(""),
  ao2Note: z.string().max(2000).default(""),
  ao3Note: z.string().max(2000).default(""),
  ao4Note: z.string().max(2000).default(""),
});
export type DailyRecordInput = z.input<typeof dailyRecordSchema>;
export type DailyRecord = z.output<typeof dailyRecordSchema>;

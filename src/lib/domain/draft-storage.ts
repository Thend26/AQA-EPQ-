import { z } from "zod";

export const dailyRecordDraftValuesSchema = z.object({
  campDay: z.number().int().min(1).max(100),
  achievements: z.string().max(4000),
  evidence: z.string().max(4000),
  challenges: z.string().max(4000),
  nextPlan: z.string().max(4000),
  processNotes: z.string().max(4000),
  behaviorTags: z
    .array(z.string().trim().min(1).max(60))
    .max(12)
    .transform((tags) => [...new Set(tags)]),
  ao1Note: z.string().max(2000),
  ao2Note: z.string().max(2000),
  ao3Note: z.string().max(2000),
  ao4Note: z.string().max(2000),
}).strict();

export const dailyRecordDraftSchema = z.object({
  ownerId: z.string().min(1),
  studentId: z.string().uuid(),
  date: z.string().date(),
  values: dailyRecordDraftValuesSchema,
}).strict();

export type DailyRecordDraftIdentity = Pick<
  z.output<typeof dailyRecordDraftSchema>,
  "ownerId" | "studentId" | "date"
>;

export type DailyRecordDraftValues = z.output<
  typeof dailyRecordDraftValuesSchema
>;

export function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readDailyRecordDraft(
  storage: Storage | null,
  key: string,
  identity: DailyRecordDraftIdentity,
): DailyRecordDraftValues | null {
  try {
    const serialized = storage?.getItem(key);
    if (!serialized) {
      return null;
    }

    const parsed = dailyRecordDraftSchema.safeParse(JSON.parse(serialized));
    if (
      !parsed.success ||
      parsed.data.ownerId !== identity.ownerId ||
      parsed.data.studentId !== identity.studentId ||
      parsed.data.date !== identity.date
    ) {
      return null;
    }

    return parsed.data.values;
  } catch {
    return null;
  }
}

export function writeDailyRecordDraft(
  storage: Storage | null,
  key: string,
  identity: DailyRecordDraftIdentity,
  values: DailyRecordDraftValues,
) {
  try {
    storage?.setItem(
      key,
      JSON.stringify(dailyRecordDraftSchema.parse({ ...identity, values })),
    );
    return storage !== null;
  } catch {
    return false;
  }
}

export function removeDailyRecordDraft(
  storage: Storage | null,
  key: string,
) {
  try {
    storage?.removeItem(key);
    return storage !== null;
  } catch {
    return false;
  }
}

export function clearOwnerDailyRecordDrafts(
  storage: Storage | null,
  ownerId: string,
) {
  try {
    if (!storage) return false;
    const prefix = `epq-draft:${ownerId}:`;
    const keys = Array.from(
      { length: storage.length },
      (_, index) => storage.key(index),
    ).filter((key): key is string => Boolean(key?.startsWith(prefix)));
    keys.forEach((key) => storage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

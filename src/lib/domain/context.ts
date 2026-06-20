export type ContextRecord = {
  id: string;
  recordDate: string;
  achievements: string;
  evidence: string;
  nextPlan: string;
};

export type PreviousContextRecord = {
  recordId: string;
  recordDate: string;
  nextPlan: string;
};

export type HistoricalContinuityContext = {
  targetDate: string;
  current: {
    recordId: string;
    achievements: string;
  };
  previousRecord: PreviousContextRecord | null;
  /** @deprecated Use previousRecord. It represents the latest prior record, not necessarily yesterday. */
  previousDay: PreviousContextRecord | null;
};

/** @deprecated Use HistoricalContinuityContext. */
export type PlanAchievementContext = HistoricalContinuityContext;

function compareRecords(a: ContextRecord, b: ContextRecord) {
  return a.recordDate.localeCompare(b.recordDate) || a.id.localeCompare(b.id);
}

export function selectRecentContext<T extends ContextRecord>(
  records: readonly T[],
  targetDate: string,
  limit = 5,
): T[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const normalizedLimit = Math.floor(limit);
  if (normalizedLimit <= 0) return [];

  return records
    .filter((record) => record.recordDate <= targetDate)
    .toSorted(compareRecords)
    .slice(-normalizedLimit);
}

function lastRecordOnDate<T extends ContextRecord>(
  records: readonly T[],
  date: string,
) {
  return records
    .filter((record) => record.recordDate === date)
    .toSorted(compareRecords)
    .at(-1);
}

function latestRecordBefore<T extends ContextRecord>(
  records: readonly T[],
  targetDate: string,
) {
  return records
    .filter((record) => record.recordDate < targetDate)
    .toSorted(compareRecords)
    .at(-1);
}

export function buildPlanAchievementContext<T extends ContextRecord>(
  records: readonly T[],
  targetDate: string,
): HistoricalContinuityContext | null {
  const current = lastRecordOnDate(records, targetDate);
  if (!current) return null;

  const previous = latestRecordBefore(records, targetDate);
  const previousRecord = previous
    ? {
        recordId: previous.id,
        recordDate: previous.recordDate,
        nextPlan: previous.nextPlan,
      }
    : null;

  return {
    targetDate,
    current: {
      recordId: current.id,
      achievements: current.achievements,
    },
    previousRecord,
    previousDay: previousRecord,
  };
}

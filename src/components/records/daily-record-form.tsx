"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { AoObservations } from "@/components/records/ao-observations";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useQueuedAutosave } from "@/components/records/use-queued-autosave";
import {
  getBrowserStorage,
  readDailyRecordDraft,
  writeDailyRecordDraft,
  type DailyRecordDraftValues,
} from "@/lib/domain/draft-storage";
import { draftKey } from "@/lib/domain/drafts";
import {
  dailyRecordSchema,
  type DailyRecord,
  type DailyRecordObservationDraft,
} from "@/lib/domain/types";

type DailyRecordFormProps = {
  ownerId: string;
  studentId: string;
  date: string;
  initialValue?: (DailyRecord & { id?: string; revision?: number }) | null;
  save?: (record: DailyRecord) => Promise<SavedDailyRecord | void>;
  onSaved?: (
    result: SavedDailyRecord | void,
    snapshot: DailyRecord,
  ) => void;
  onDraftChange?: (draft: DailyRecordObservationDraft) => void;
};

export type SavedDailyRecord = DailyRecord & { id: string; revision?: number };

const behaviorTagOptions = [
  "主动提问",
  "按时完成",
  "需要提醒",
  "能回应建议",
  "合作表现突出",
];

const emptyValues: DailyRecordDraftValues = {
  campDay: 1,
  achievements: "",
  evidence: "",
  challenges: "",
  nextPlan: "",
  processNotes: "",
  behaviorTags: [],
  ao1Note: "",
  ao2Note: "",
  ao3Note: "",
  ao4Note: "",
};

function formValues(record?: DailyRecord | null): DailyRecordDraftValues {
  if (!record) {
    return { ...emptyValues, behaviorTags: [] };
  }

  return {
    campDay: record.campDay,
    achievements: record.achievements,
    evidence: record.evidence,
    challenges: record.challenges,
    nextPlan: record.nextPlan,
    processNotes: record.processNotes,
    behaviorTags: record.behaviorTags,
    ao1Note: record.ao1Note,
    ao2Note: record.ao2Note,
    ao3Note: record.ao3Note,
    ao4Note: record.ao4Note,
  };
}

async function saveDailyRecord(
  record: DailyRecord,
  expectedRevision: number | null,
) {
  const response = await fetch("/api/daily-records", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...record, expectedRevision }),
  });

  if (!response.ok) {
    throw new Error("Failed to save daily record");
  }
  const payload = (await response.json()) as {
    data?: SavedDailyRecord;
  };
  if (!payload.data?.id) {
    throw new Error("Saved daily record id is missing");
  }
  return payload.data;
}

function DailyRecordFormFields({
  ownerId,
  studentId,
  date,
  initialValue,
  save,
  onSaved,
  onDraftChange,
}: DailyRecordFormProps) {
  const key = useMemo(
    () => draftKey(ownerId, studentId, date),
    [ownerId, studentId, date],
  );
  const draftIdentity = useMemo(
    () => ({ ownerId, studentId, date }),
    [date, ownerId, studentId],
  );
  const storage = useMemo(() => getBrowserStorage(), []);
  const initialValues = useMemo(
    () =>
      readDailyRecordDraft(storage, key, draftIdentity) ??
      formValues(initialValue),
    [draftIdentity, initialValue, key, storage],
  );
  const [values, setValues] =
    useState<DailyRecordDraftValues>(initialValues);
  const [revision, setRevision] = useState(0);
  const revisionRef = useRef(0);
  const serverRevisionRef = useRef(
    (initialValue as (DailyRecord & { revision?: number }) | null | undefined)
      ?.revision ?? null,
  );

  function replaceValues(next: DailyRecordDraftValues) {
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    setRevision(revision);
    setValues(next);
    writeDailyRecordDraft(storage, key, draftIdentity, next);
    onDraftChange?.({
      processNotes: next.processNotes,
      behaviorTags: next.behaviorTags,
      ao1Note: next.ao1Note,
      ao2Note: next.ao2Note,
      ao3Note: next.ao3Note,
      ao4Note: next.ao4Note,
    });
  }

  function update<K extends keyof DailyRecordDraftValues>(
    field: K,
    value: DailyRecordDraftValues[K],
  ) {
    replaceValues({ ...values, [field]: value });
  }

  function toggleBehaviorTag(tag: string, checked: boolean) {
    const behaviorTags = checked
      ? [...values.behaviorTags, tag]
      : values.behaviorTags.filter((currentTag) => currentTag !== tag);
    replaceValues({ ...values, behaviorTags });
  }

  const record = useMemo(() => {
    const parsed = dailyRecordSchema.safeParse({
      studentId,
      recordDate: date,
      ...values,
    });
    return parsed.success ? parsed.data : null;
  }, [date, studentId, values]);
  const saveRecord = useCallback(
    async (nextRecord: DailyRecord) => {
      if (save) return save(nextRecord);
      return saveDailyRecord(nextRecord, serverRevisionRef.current);
    },
    [save],
  );
  const { status, retry } = useQueuedAutosave({
    identity: key,
    draftIdentity,
    storage,
    revision,
    values,
    record,
    save: saveRecord,
    onPersisted: (result) => {
      if (
        result &&
        typeof result === "object" &&
        "revision" in result &&
        typeof result.revision === "number"
      ) {
        serverRevisionRef.current = Number(result.revision);
      }
    },
    onSaved: (result, snapshot) => {
      onSaved?.(result, snapshot);
    },
  });

  return (
    <form className="space-y-4">
      <label className="block">
        日期
        <input name="recordDate" type="date" value={date} readOnly />
      </label>
      <label className="block">
        营地天数
        <input
          name="campDay"
          type="number"
          min={1}
          max={100}
          value={values.campDay}
          onChange={(event) => update("campDay", Number(event.target.value))}
          required
        />
      </label>
      <label className="block">
        今日完成成果
        <textarea
          name="achievements"
          value={values.achievements}
          onChange={(event) => update("achievements", event.target.value)}
          maxLength={4000}
          required
        />
      </label>
      <label className="block">
        成果证据或数量信息
        <textarea
          name="evidence"
          value={values.evidence}
          onChange={(event) => update("evidence", event.target.value)}
          maxLength={4000}
        />
      </label>
      <label className="block">
        遇到的困难
        <textarea
          name="challenges"
          value={values.challenges}
          onChange={(event) => update("challenges", event.target.value)}
          maxLength={4000}
        />
      </label>
      <label className="block">
        明日计划
        <textarea
          name="nextPlan"
          value={values.nextPlan}
          onChange={(event) => update("nextPlan", event.target.value)}
          maxLength={4000}
          required
        />
      </label>
      <label className="block">
        助教过程观察
        <textarea
          name="processNotes"
          value={values.processNotes}
          onChange={(event) => update("processNotes", event.target.value)}
          maxLength={4000}
        />
      </label>
      <fieldset className="space-y-3 rounded-xl bg-stone-50 p-4">
        <legend className="font-semibold">行为标签</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {behaviorTagOptions.map((tag) => (
          <label
            className="flex items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
            key={tag}
          >
            <input
              type="checkbox"
              checked={values.behaviorTags.includes(tag)}
              onChange={(event) =>
                toggleBehaviorTag(tag, event.target.checked)
              }
            />
            {tag}
          </label>
          ))}
        </div>
      </fieldset>
      <AoObservations values={values} onChange={update} />
      {status === "pending" ? (
        <p
          className="inline-flex items-center gap-2 text-sm text-stone-500"
          role="status"
        >
          <LoadingSpinner size="sm" />
          <span>正在保存</span>
        </p>
      ) : null}
      {status === "saved" ? (
        <p className="text-sm font-medium text-emerald-700" role="status">
          已保存
        </p>
      ) : null}
      {status === "failure" ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p>保存失败或记录已被更新，请重试；若仍失败请刷新页面。</p>
          <button
            className="mt-2 rounded-lg bg-red-700 px-3 py-2 font-semibold text-white"
            type="button"
            onClick={retry}
          >
            立即重试
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function DailyRecordForm(props: DailyRecordFormProps) {
  const key = draftKey(props.ownerId, props.studentId, props.date);
  return <DailyRecordFormFields key={key} {...props} />;
}

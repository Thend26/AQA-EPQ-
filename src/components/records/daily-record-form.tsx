"use client";

import { useMemo, useRef, useState } from "react";

import { AoObservations } from "@/components/records/ao-observations";
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
} from "@/lib/domain/types";

type DailyRecordFormProps = {
  ownerId: string;
  studentId: string;
  date: string;
  initialValue?: DailyRecord | null;
  save?: (record: DailyRecord) => Promise<void>;
};

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

async function saveDailyRecord(record: DailyRecord) {
  const response = await fetch("/api/daily-records", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error("Failed to save daily record");
  }
}

function DailyRecordFormFields({
  ownerId,
  studentId,
  date,
  initialValue,
  save = saveDailyRecord,
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

  function replaceValues(next: DailyRecordDraftValues) {
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    setRevision(revision);
    setValues(next);
    writeDailyRecordDraft(storage, key, draftIdentity, next);
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
  const status = useQueuedAutosave({
    identity: key,
    draftIdentity,
    storage,
    revision,
    values,
    record,
    save,
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
      <fieldset className="space-y-2">
        <legend>行为标签</legend>
        {behaviorTagOptions.map((tag) => (
          <label className="block" key={tag}>
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
      </fieldset>
      <AoObservations values={values} onChange={update} />
      {status === "pending" ? <p role="status">正在保存</p> : null}
      {status === "saved" ? <p role="status">已保存</p> : null}
      {status === "failure" ? (
        <p role="alert">保存失败，稍后重试</p>
      ) : null}
    </form>
  );
}

export function DailyRecordForm(props: DailyRecordFormProps) {
  const key = draftKey(props.ownerId, props.studentId, props.date);
  return <DailyRecordFormFields key={key} {...props} />;
}

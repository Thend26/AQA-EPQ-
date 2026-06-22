"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  readDailyRecordDraft,
  removeDailyRecordDraft,
  type DailyRecordDraftIdentity,
  type DailyRecordDraftValues,
} from "@/lib/domain/draft-storage";
import type { DailyRecord } from "@/lib/domain/types";

export type SaveStatus = "idle" | "pending" | "saved" | "failure";
export type AutosaveState = {
  status: SaveStatus;
  retry: () => void;
};

type SaveJob = {
  identity: string;
  revision: number;
  record: DailyRecord;
  values: DailyRecordDraftValues;
};

type UseQueuedAutosaveOptions<TResult> = {
  identity: string;
  draftIdentity: DailyRecordDraftIdentity;
  storage: Storage | null;
  revision: number;
  values: DailyRecordDraftValues;
  record: DailyRecord | null;
  save: (record: DailyRecord) => Promise<TResult>;
  onPersisted?: (result: TResult, snapshot: DailyRecord) => void;
  onSaved?: (result: TResult, snapshot: DailyRecord) => void;
};

function sameValues(
  left: DailyRecordDraftValues,
  right: DailyRecordDraftValues,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useQueuedAutosave<TResult>({
  identity,
  draftIdentity,
  storage,
  revision,
  values,
  record,
  save,
  onPersisted,
  onSaved,
}: UseQueuedAutosaveOptions<TResult>): AutosaveState {
  const [settled, setSettled] = useState<{
    revision: number;
    status: "saved" | "failure";
  } | null>(null);
  const activeRef = useRef(true);
  const latestRef = useRef({ identity, revision, values });
  const saveRef = useRef(save);
  const onPersistedRef = useRef(onPersisted);
  const onSavedRef = useRef(onSaved);
  const inFlightRef = useRef<SaveJob | null>(null);
  const queuedRef = useRef<SaveJob | null>(null);

  useEffect(() => {
    latestRef.current = { identity, revision, values };
  }, [identity, revision, values]);

  useEffect(() => {
    saveRef.current = save;
    onPersistedRef.current = onPersisted;
    onSavedRef.current = onSaved;
  }, [onPersisted, onSaved, save]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      queuedRef.current = null;
    };
  }, []);

  const startSave = useCallback(
    function runSave(job: SaveJob) {
      inFlightRef.current = job;

      void saveRef.current(job.record).then(
        (result) => {
          inFlightRef.current = null;
          if (!activeRef.current) {
            queuedRef.current = null;
            return;
          }

          onPersistedRef.current?.(result, job.record);

          const latest = latestRef.current;
          const canAcknowledge =
            latest.identity === job.identity &&
            latest.revision === job.revision &&
            sameValues(latest.values, job.values);

          if (canAcknowledge) {
            const stored = readDailyRecordDraft(
              storage,
              job.identity,
              draftIdentity,
            );
            if (stored && sameValues(stored, job.values)) {
              removeDailyRecordDraft(storage, job.identity);
            }
            onSavedRef.current?.(result, job.record);
            setSettled({ revision: job.revision, status: "saved" });
          }

          const next = queuedRef.current;
          queuedRef.current = null;
          if (next) {
            runSave(next);
          }
        },
        () => {
          inFlightRef.current = null;
          if (!activeRef.current) {
            queuedRef.current = null;
            return;
          }

          const latest = latestRef.current;
          if (
            latest.identity === job.identity &&
            latest.revision === job.revision
          ) {
            setSettled({ revision: job.revision, status: "failure" });
          }

          const next = queuedRef.current;
          queuedRef.current = null;
          if (next) {
            runSave(next);
          }
        },
      );
    },
    [draftIdentity, storage],
  );

  const enqueueSave = useCallback(
    (job: SaveJob) => {
      if (!activeRef.current) {
        return;
      }
      if (inFlightRef.current) {
        queuedRef.current = job;
        return;
      }
      startSave(job);
    },
    [startSave],
  );

  useEffect(() => {
    if (!record) {
      return;
    }

    const job = { identity, revision, record, values };
    const timeout = window.setTimeout(() => enqueueSave(job), 800);
    return () => window.clearTimeout(timeout);
  }, [enqueueSave, identity, record, revision, values]);

  const retry = useCallback(() => {
    if (!record || !activeRef.current) return;
    setSettled(null);
    enqueueSave({ identity, revision, record, values });
  }, [enqueueSave, identity, record, revision, values]);

  if (!record) {
    return { status: "idle", retry };
  }
  if (settled?.revision === revision) {
    return { status: settled.status, retry };
  }
  return { status: "pending", retry };
}

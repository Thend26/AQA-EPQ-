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

type SaveJob = {
  identity: string;
  revision: number;
  record: DailyRecord;
  values: DailyRecordDraftValues;
};

type UseQueuedAutosaveOptions = {
  identity: string;
  draftIdentity: DailyRecordDraftIdentity;
  storage: Storage | null;
  revision: number;
  values: DailyRecordDraftValues;
  record: DailyRecord | null;
  save: (record: DailyRecord) => Promise<void>;
};

function sameValues(
  left: DailyRecordDraftValues,
  right: DailyRecordDraftValues,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useQueuedAutosave({
  identity,
  draftIdentity,
  storage,
  revision,
  values,
  record,
  save,
}: UseQueuedAutosaveOptions): SaveStatus {
  const [settled, setSettled] = useState<{
    revision: number;
    status: "saved" | "failure";
  } | null>(null);
  const activeRef = useRef(true);
  const latestRef = useRef({ identity, revision, values });
  const inFlightRef = useRef<SaveJob | null>(null);
  const queuedRef = useRef<SaveJob | null>(null);

  useEffect(() => {
    latestRef.current = { identity, revision, values };
  }, [identity, revision, values]);

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

      void save(job.record).then(
        () => {
          inFlightRef.current = null;
          if (!activeRef.current) {
            queuedRef.current = null;
            return;
          }

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
    [draftIdentity, save, storage],
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

  if (!record) {
    return "idle";
  }
  if (settled?.revision === revision) {
    return settled.status;
  }
  return "pending";
}

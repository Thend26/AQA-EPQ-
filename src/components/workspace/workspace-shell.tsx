"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

import { FeedbackAssistant } from "@/components/feedback/feedback-assistant";
import {
  DailyRecordForm,
  type SavedDailyRecord,
} from "@/components/records/daily-record-form";
import { StudentForm } from "@/components/students/student-form";
import { StudentList } from "@/components/students/student-list";
import { AqaOverview } from "@/components/workspace/aqa-overview";
import { createFeedbackAdapters } from "@/components/workspace/feedback-adapters";
import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import type {
  DailyRecord,
  DailyRecordObservationDraft,
  Student,
  StudentProfile,
} from "@/lib/domain/types";
import { studentSchema } from "@/lib/domain/types";
import {
  requestWorkspaceJson,
  WorkspaceApiError,
} from "@/lib/workspace/api";

type LoadedFeedback = {
  id: string;
  draft: GeneratedFeedback;
  revision: number;
};

type HistoryItem = {
  id: string;
  status: "draft" | "final";
  version: number;
  createdAt: string;
};

type WorkspaceShellProps = {
  ownerId: string;
  profileName: string;
  date: string;
  dateWasProvided: boolean;
  students: Student[];
  selectedStudent: Student | null;
  dailyRecord: (DailyRecord & { id?: string }) | null;
  feedback: LoadedFeedback | null;
  feedbackHistory: HistoryItem[];
  navigate?: (
    href: string,
    options?: { replace?: boolean },
  ) => void;
};

const emptyDraft: GeneratedFeedback = {
  mode: "zh",
  zh: { content: "", evidenceUsed: [], nextStep: "" },
};

const studentResponseSchema = z.object({ data: studentSchema });
const deletedStudentResponseSchema = z.object({
  data: z.object({ id: z.string().min(1) }),
});

export function WorkspaceShell({
  ownerId,
  profileName,
  date,
  students,
  selectedStudent,
  dailyRecord,
  feedback,
  feedbackHistory,
  navigate,
}: WorkspaceShellProps) {
  const [editing, setEditing] = useState<Student | null>(null);
  const [panelOpen, setPanelOpen] = useState(students.length === 0);
  const recordIdentity = `${selectedStudent?.id ?? "none"}:${date}`;
  const [savedRecord, setSavedRecord] = useState<{
    identity: string;
    id: string;
  } | null>(null);
  const [liveDraft, setLiveDraft] = useState<{
    identity: string;
    record: DailyRecordObservationDraft;
  } | null>(null);
  const [logoutError, setLogoutError] = useState("");
  const go = useMemo(
    () =>
      navigate ??
      ((href: string, options?: { replace?: boolean }) => {
        if (options?.replace) window.location.replace(href);
        else window.location.assign(href);
      }),
    [navigate],
  );

  const currentDailyRecordId =
    dailyRecord?.id ??
    (savedRecord?.identity === recordIdentity ? savedRecord.id : undefined);
  const liveRecord =
    liveDraft?.identity === recordIdentity ? liveDraft.record : dailyRecord;
  const feedbackId = feedback?.id;
  const adapters = useMemo(() => {
    if (!currentDailyRecordId) return null;
    return createFeedbackAdapters({
      dailyRecordId: currentDailyRecordId,
      feedbackId,
    });
  }, [currentDailyRecordId, feedbackId]);

  function selectStudent(id: string) {
    const params = new URLSearchParams({ student: id, date });
    go(`/workspace?${params.toString()}`);
  }

  async function saveStudent(input: StudentProfile) {
    const url = editing?.id ? `/api/students/${editing.id}` : "/api/students";
    await requestWorkspaceJson(
      fetch,
      url,
      {
        method: editing?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      studentResponseSchema,
    );
    setEditing(null);
    setPanelOpen(false);
    window.location.reload();
  }

  async function deleteStudent(id: string) {
    await requestWorkspaceJson(
      fetch,
      `/api/students/${id}`,
      { method: "DELETE" },
      deletedStudentResponseSchema,
    );
    window.location.reload();
  }

  async function logout() {
    setLogoutError("");
    try {
      const response = await fetch("/auth/signout", { method: "POST" });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "退出失败，请稍后重试";
        throw new WorkspaceApiError(message, response.status);
      }
      go("/login");
    } catch {
      setLogoutError("退出失败，请稍后重试");
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-100 text-emerald-950">
      <header className="flex min-h-16 items-center justify-between gap-4 bg-emerald-950 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
            EPQ Camp Companion
          </p>
          <p className="truncate font-medium">
            {profileName || "助教工作台"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-lg border border-emerald-700 px-3 py-2 text-sm hover:bg-emerald-900"
        >
          退出登录
        </button>
        {logoutError ? <p role="alert">{logoutError}</p> : null}
      </header>

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 overflow-x-hidden xl:grid-cols-[14rem_minmax(30rem,1fr)_23rem]">
        <nav
          aria-label="学生档案"
          className="min-w-0 border-b border-stone-200 bg-white p-4 xl:border-b-0 xl:border-r"
        >
          <button
            type="button"
            className="mb-4 w-full rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
            onClick={() => {
              setEditing(null);
              setPanelOpen(true);
            }}
          >
            新增学生
          </button>
          <StudentList
            students={students}
            selectedId={selectedStudent?.id}
            onSelect={selectStudent}
            onEdit={(student) => {
              setEditing(student);
              setPanelOpen(true);
            }}
            onDelete={deleteStudent}
          />
        </nav>

        <main className="min-w-0 space-y-5 p-4 sm:p-6">
          {selectedStudent ? (
            <>
              <section className="rounded-2xl bg-emerald-900 p-5 text-white shadow-sm">
                <p className="text-sm text-emerald-200">
                  {selectedStudent.grade} 年级 · {date}
                </p>
                <h1 className="mt-1 text-2xl font-semibold">
                  {selectedStudent.displayName}
                </h1>
                <p className="mt-2 break-words text-emerald-50">
                  {selectedStudent.projectTitle}
                </p>
                {selectedStudent.currentFocus ? (
                  <p className="mt-3 text-sm text-emerald-100">
                    当前关注：{selectedStudent.currentFocus}
                  </p>
                ) : null}
              </section>
              <AqaOverview record={liveRecord} />
              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold">当日记录</h2>
                <DailyRecordForm
                  ownerId={ownerId}
                  studentId={selectedStudent.id!}
                  date={date}
                  initialValue={dailyRecord}
                  onSaved={(result: SavedDailyRecord | void) => {
                    if (result?.id) {
                      setSavedRecord({
                        identity: recordIdentity,
                        id: result.id,
                      });
                    }
                  }}
                  onDraftChange={(record) =>
                    setLiveDraft({ identity: recordIdentity, record })
                  }
                />
              </section>
            </>
          ) : (
            <section className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <div>
                <h1 className="text-xl font-semibold">先新增一名学生</h1>
                <p className="mt-2 text-stone-600">
                  建立学生档案后即可记录每日进展并生成反馈。
                </p>
              </div>
            </section>
          )}

          <section
            aria-label="学生档案编辑面板"
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            {panelOpen ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">
                    {editing ? "编辑学生档案" : "新增学生档案"}
                  </h2>
                  <button
                    type="button"
                    className="text-sm text-stone-500"
                    onClick={() => setPanelOpen(false)}
                  >
                    收起
                  </button>
                </div>
                <StudentForm
                  initialValue={editing ?? undefined}
                  onSave={saveStudent}
                />
              </>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-emerald-800"
                onClick={() => setPanelOpen(true)}
              >
                打开学生档案编辑面板
              </button>
            )}
          </section>
        </main>

        <aside
          aria-label="AI 反馈助手"
          className="min-w-0 border-t border-stone-200 bg-stone-50 p-4 xl:border-l xl:border-t-0"
        >
          {selectedStudent ? (
            <>
              <FeedbackAssistant
                contextSummary={
                  currentDailyRecordId
                    ? `已载入 ${feedbackHistory.length} 条反馈历史`
                    : "保存有效的当日记录后即可生成反馈"
                }
                initialDraft={feedback?.draft ?? emptyDraft}
                initialRevision={feedback?.revision ?? 0}
                hasExistingFeedback={Boolean(feedback)}
                generate={adapters?.generate}
                revise={adapters?.revise}
                finalize={adapters?.finalize}
              />
              {feedbackHistory.length > 0 ? (
                <section className="mt-6 border-t border-stone-200 pt-4">
                  <h2 className="font-semibold">反馈历史</h2>
                  <ul className="mt-2 space-y-2 text-sm text-stone-600">
                    {feedbackHistory.map((item) => (
                      <li key={item.id}>
                        第 {item.version} 版 ·{" "}
                        {item.status === "final" ? "已归档" : "草稿"}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl bg-white p-4 text-sm text-stone-600">
              新增并选择学生后，AI 反馈助手将在这里显示。
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

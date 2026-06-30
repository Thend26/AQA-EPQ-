"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { FeedbackAssistant } from "@/components/feedback/feedback-assistant";
import { DocumentPanel } from "@/components/documents/document-panel";
import type { AoNotePatch } from "@/components/documents/ao-analysis-review";
import {
  DailyRecordForm,
  type SavedDailyRecord,
} from "@/components/records/daily-record-form";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { ThemeProvider } from "@/components/settings/theme-provider";
import { StudentForm } from "@/components/students/student-form";
import { StudentList } from "@/components/students/student-list";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AqaOverview } from "@/components/workspace/aqa-overview";
import { createFeedbackAdapters } from "@/components/workspace/feedback-adapters";
import { campDayForDate } from "@/lib/camp/date";
import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import type { DocumentRecordDraftResponse } from "@/lib/documents/record-draft-schema";
import type {
  DailyRecord,
  DailyRecordObservationDraft,
  Student,
  StudentProfile,
} from "@/lib/domain/types";
import { clearOwnerDailyRecordDrafts } from "@/lib/domain/draft-storage";
import { studentSchema } from "@/lib/domain/types";
import { defaultUserSettings, type UserSettings } from "@/lib/settings/schema";
import { themeVariables } from "@/lib/settings/theme";
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
  draft: GeneratedFeedback;
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
  settings?: UserSettings;
  documentsEnabled?: boolean;
  navigate?: (
    href: string,
    options?: { replace?: boolean },
  ) => void;
};

const emptyDraft: GeneratedFeedback = {
  mode: "zh",
  zh: { content: "", evidenceUsed: [], nextStep: "" },
};

const MAX_STUDENTS = 30;
const IDLE_WARNING_MS = 115 * 60 * 1000;
const IDLE_LOGOUT_MS = 120 * 60 * 1000;

const studentResponseSchema = z.object({ data: studentSchema });
const deletedStudentResponseSchema = z.object({
  data: z.object({ id: z.string().min(1) }),
});

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function WorkspaceShell({
  ownerId,
  profileName,
  date,
  students,
  selectedStudent,
  dailyRecord,
  feedback,
  feedbackHistory,
  settings = defaultUserSettings,
  documentsEnabled = false,
  navigate,
}: WorkspaceShellProps) {
  const [activeSettings, setActiveSettings] = useState<UserSettings>(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [externalAoPatch, setExternalAoPatch] = useState<{
    identity: string;
    id: string;
    values: AoNotePatch;
  } | null>(null);
  const [externalRecordPatch, setExternalRecordPatch] = useState<{
    identity: string;
    id: string;
    values: Partial<DocumentRecordDraftResponse>;
  } | null>(null);
  const [logoutError, setLogoutError] = useState("");
  const [logoutPending, setLogoutPending] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const idleWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleLogoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const go = useMemo(
    () =>
      navigate ??
      ((href: string, options?: { replace?: boolean }) => {
        if (options?.replace) window.location.replace(href);
        else window.location.assign(href);
      }),
    [navigate],
  );

  const selectedCampDay = selectedStudent
    ? campDayForDate(selectedStudent.campStartDate, date)
    : null;
  const currentDailyRecordId =
    selectedCampDay === null
      ? undefined
      : dailyRecord?.id ??
        (savedRecord?.identity === recordIdentity ? savedRecord.id : undefined);
  const liveRecord =
    liveDraft?.identity === recordIdentity ? liveDraft.record : dailyRecord;
  const existingAoNotes = {
    ao1Note: liveRecord?.ao1Note ?? "",
    ao2Note: liveRecord?.ao2Note ?? "",
    ao3Note: liveRecord?.ao3Note ?? "",
    ao4Note: liveRecord?.ao4Note ?? "",
  };
  const feedbackId = feedback?.id;
  const adapters = useMemo(() => {
    if (!currentDailyRecordId) return null;
    return createFeedbackAdapters({
      dailyRecordId: currentDailyRecordId,
      feedbackId,
    });
  }, [currentDailyRecordId, feedbackId]);
  const variables = themeVariables(activeSettings) as CSSProperties;

  function selectStudent(id: string) {
    const params = new URLSearchParams({ student: id, date });
    setNavigationPending(true);
    go(`/workspace?${params.toString()}`);
  }

  function selectDate(nextDate?: string) {
    const params = new URLSearchParams();
    if (selectedStudent?.id) params.set("student", selectedStudent.id);
    if (nextDate) params.set("date", nextDate);
    const query = params.toString();
    setNavigationPending(true);
    go(query ? `/workspace?${query}` : "/workspace");
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
    if (logoutPending) return;
    setLogoutError("");
    setLogoutPending(true);
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
      clearOwnerDailyRecordDrafts(window.localStorage, ownerId);
      go("/login");
    } catch {
      setLogoutError("退出失败，请稍后重试");
      setLogoutPending(false);
    }
  }

  useEffect(() => {
    function clearIdleTimers() {
      if (idleWarningTimerRef.current) {
        clearTimeout(idleWarningTimerRef.current);
      }
      if (idleLogoutTimerRef.current) {
        clearTimeout(idleLogoutTimerRef.current);
      }
    }

    function scheduleIdleTimers() {
      clearIdleTimers();
      setIdleWarning(false);
      idleWarningTimerRef.current = setTimeout(() => {
        setIdleWarning(true);
      }, IDLE_WARNING_MS);
      idleLogoutTimerRef.current = setTimeout(() => {
        void logout();
      }, IDLE_LOGOUT_MS);
    }

    const events = ["mousemove", "keydown", "pointerdown", "touchstart"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, scheduleIdleTimers, { passive: true }),
    );
    scheduleIdleTimers();

    return () => {
      clearIdleTimers();
      events.forEach((eventName) =>
        window.removeEventListener(eventName, scheduleIdleTimers),
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings(nextSettings: UserSettings) {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    });
    if (!response.ok) throw new Error("Failed to update settings");
    setActiveSettings(nextSettings);
  }

  return (
    <ThemeProvider settings={activeSettings}>
    <div
      className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,var(--theme-primary-soft),transparent_34%),var(--theme-surface)] text-[var(--theme-text)] transition-colors duration-500"
      style={variables}
    >
      <header className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/20 bg-[var(--theme-primary)]/95 px-4 py-3 text-white shadow-lg shadow-slate-950/10 backdrop-blur-xl sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-100">
            EPQ Camp Companion
          </p>
          <p className="break-words font-medium">
            {profileName || "助教工作台"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10"
        >
          设置
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={logoutPending}
          aria-busy={logoutPending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-wait disabled:opacity-80"
        >
          {logoutPending ? (
            <>
              <LoadingSpinner size="sm" />
              退出中…
            </>
          ) : (
            "退出登录"
          )}
        </button>
        {logoutError ? (
          <p role="alert" className="w-full text-sm text-red-200">
            {logoutError}
          </p>
        ) : null}
      </header>

      {navigationPending ? (
        <div
          role="status"
          aria-label="页面载入状态"
          className="fixed right-4 top-20 z-50 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white shadow-lg"
        >
          <LoadingSpinner size="sm" />
          <span>正在载入…</span>
        </div>
      ) : null}

      {idleWarning ? (
        <div
          role="status"
          aria-label="空闲退出提醒"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-3xl border border-amber-200 bg-white/90 p-4 text-sm text-amber-950 shadow-2xl backdrop-blur"
        >
          <p className="font-semibold">即将自动退出登录</p>
          <p className="mt-1 leading-6">
            工作台已长时间未操作。移动鼠标、点击或按键即可继续保持登录。
          </p>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4">
          <div className="mx-auto max-w-2xl">
            <SettingsPanel
              initialSettings={activeSettings}
              onClose={() => setSettingsOpen(false)}
              onSave={saveSettings}
            />
          </div>
        </div>
      ) : null}

      <div className="motion-soft-enter grid min-h-[calc(100vh-4rem)] grid-cols-1 overflow-x-hidden xl:grid-cols-[15rem_minmax(30rem,1fr)_24rem]">
        <nav
          aria-label="学生档案"
          className="min-w-0 border-b border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-xl xl:border-b-0 xl:border-r"
        >
          <button
            type="button"
            className="mb-4 w-full rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
            disabled={students.length >= MAX_STUDENTS}
            onClick={() => {
              setEditing(null);
              setPanelOpen(true);
            }}
          >
            {students.length >= MAX_STUDENTS ? "已达到 30 名上限" : "新增学生"}
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
              <section className="rounded-[2rem] bg-[var(--theme-primary)] p-5 text-white shadow-xl shadow-slate-950/10 transition-all duration-300">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-blue-100">
                      {selectedStudent.grade} 年级 · {date}
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold">
                      {selectedStudent.displayName}
                    </h1>
                    <p className="mt-2 break-words text-blue-50">
                      {selectedStudent.projectTitle}
                    </p>
                  </div>
                  <div
                    data-testid="workspace-date-controls"
                    className="grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-2 sm:w-auto sm:min-w-[15rem]"
                  >
                    <button
                      type="button"
                      aria-label="上一天"
                      className="min-h-11 rounded-lg border border-white/30 px-2 py-2 hover:bg-white/10"
                      onClick={() => selectDate(shiftDate(date, -1))}
                    >
                      ‹
                    </button>
                    <label className="sr-only" htmlFor="workspace-date">
                      查看日期
                    </label>
                    <input
                      id="workspace-date"
                      aria-label="查看日期"
                      type="date"
                      value={date}
                      className="m-0 min-w-0 border-white/30 bg-white/10 text-white"
                      onChange={(event) => selectDate(event.target.value)}
                    />
                    <button
                      type="button"
                      aria-label="下一天"
                      className="min-h-11 rounded-lg border border-white/30 px-2 py-2 hover:bg-white/10"
                      onClick={() => selectDate(shiftDate(date, 1))}
                    >
                      ›
                    </button>
                    <button
                      type="button"
                      className="col-span-3 min-h-11 rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10"
                      onClick={() => selectDate()}
                    >
                      回到今天
                    </button>
                  </div>
                </div>
                {selectedStudent.currentFocus ? (
                  <p className="mt-3 text-sm text-blue-100">
                    当前关注：{selectedStudent.currentFocus}
                  </p>
                ) : null}
              </section>
              <AqaOverview record={liveRecord} />
              <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-950/5 backdrop-blur">
                <h2 className="mb-4 text-lg font-semibold">当日记录</h2>
                <DailyRecordForm
                  ownerId={ownerId}
                  studentId={selectedStudent.id!}
                  date={date}
                  campStartDate={selectedStudent.campStartDate}
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
                  externalAoPatch={
                    externalAoPatch?.identity === recordIdentity
                      ? {
                          id: externalAoPatch.id,
                          values: externalAoPatch.values,
                        }
                      : null
                  }
                  externalRecordPatch={
                    externalRecordPatch?.identity === recordIdentity
                      ? {
                          id: externalRecordPatch.id,
                          values: externalRecordPatch.values,
                        }
                      : null
                  }
                />
              </section>
              {documentsEnabled ? (
                <DocumentPanel
                  studentId={selectedStudent.id!}
                  campDay={selectedCampDay}
                  recordDate={date}
                  existingAoNotes={existingAoNotes}
                  onApplyAoSuggestions={(values) =>
                    setExternalAoPatch({
                      identity: recordIdentity,
                      id: `${recordIdentity}:${Date.now()}`,
                      values,
                    })
                  }
                  onApplyRecordDraft={(values) =>
                    setExternalRecordPatch({
                      identity: recordIdentity,
                      id: `${recordIdentity}:record:${Date.now()}`,
                      values,
                    })
                  }
                />
              ) : null}
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
            className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-950/5 backdrop-blur"
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
                className="text-sm font-medium text-[var(--theme-primary)]"
                onClick={() => setPanelOpen(true)}
              >
                打开学生档案编辑面板
              </button>
            )}
          </section>
        </main>

        <aside
          aria-label="AI 反馈助手"
          className="min-w-0 border-t border-white/60 bg-white/60 p-4 backdrop-blur-xl xl:border-l xl:border-t-0"
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
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline"
                          onClick={() =>
                            setSelectedHistoryId((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                        >
                          第 {item.version} 版 ·{" "}
                          {item.status === "final" ? "已归档" : "草稿"}
                        </button>
                        {selectedHistoryId === item.id ? (
                          <div className="mt-2 space-y-2 rounded-xl bg-white p-3 text-stone-700">
                            {item.draft.mode !== "en" ? (
                              <>
                                <p className="font-medium">中文反馈</p>
                                <p className="whitespace-pre-wrap">
                                  {item.draft.zh.content}
                                </p>
                                <p>
                                  引用证据：
                                  {item.draft.zh.evidenceUsed.join("；")}
                                </p>
                                <p>下一步：{item.draft.zh.nextStep}</p>
                              </>
                            ) : null}
                            {item.draft.mode !== "zh" ? (
                              <>
                                <p className="font-medium">
                                  English feedback
                                </p>
                                <p className="whitespace-pre-wrap">
                                  {item.draft.en.content}
                                </p>
                                <p>
                                  Evidence:{" "}
                                  {item.draft.en.evidenceUsed.join("; ")}
                                </p>
                                <p>Next step: {item.draft.en.nextStep}</p>
                              </>
                            ) : null}
                          </div>
                        ) : null}
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
    </ThemeProvider>
  );
}

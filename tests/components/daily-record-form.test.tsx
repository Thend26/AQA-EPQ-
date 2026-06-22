import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DailyRecordForm } from "@/components/records/daily-record-form";
import { draftKey } from "@/lib/domain/drafts";

const ownerId = "owner-123";
const studentId = "123e4567-e89b-42d3-a456-426614174000";
const date = "2026-07-18";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("renders all record fields, behavior tags, and focused AO observations", () => {
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={async () => {}}
    />,
  );

  for (const label of [
    "营地天数",
    "今日完成成果",
    "成果证据或数量信息",
    "遇到的困难",
    "明日计划",
    "助教过程观察",
    "AO1 Manage 当日观察",
    "AO2 Use resources 当日观察",
    "AO3 Develop and realise 当日观察",
    "AO4 Review 当日观察",
  ]) {
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  }
  expect(screen.getByRole("checkbox", { name: "主动提问" })).toBeInTheDocument();
});

test("restores the scoped local draft on mount", () => {
  localStorage.setItem(
    draftKey(ownerId, studentId, date),
    JSON.stringify({
      ownerId,
      studentId,
      date,
      values: {
        campDay: 3,
        achievements: "已恢复的成果",
        evidence: "",
        challenges: "",
        nextPlan: "已恢复的计划",
        processNotes: "",
        behaviorTags: ["主动提问"],
        ao1Note: "",
        ao2Note: "",
        ao3Note: "",
        ao4Note: "",
      },
    }),
  );

  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={async () => {}}
    />,
  );

  expect(screen.getByLabelText("今日完成成果")).toHaveValue("已恢复的成果");
  expect(screen.getByLabelText("明日计划")).toHaveValue("已恢复的计划");
  expect(screen.getByRole("checkbox", { name: "主动提问" })).toBeChecked();
});

test("writes edits to the scoped local draft immediately", () => {
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={async () => {}}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "筛选了四篇文献" },
  });

  expect(
    JSON.parse(localStorage.getItem(draftKey(ownerId, studentId, date)) ?? "{}"),
  ).toMatchObject({
    ownerId,
    studentId,
    date,
    values: { achievements: "筛选了四篇文献" },
  });
});

test("debounces a valid cloud save by 800ms and reports success", async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "筛选了四篇文献" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "比较研究方法" },
  });

  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent("正在保存");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(799);
  });
  expect(save).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      studentId,
      recordDate: date,
      achievements: "筛选了四篇文献",
      nextPlan: "比较研究方法",
    }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("已保存");
  expect(localStorage.getItem(draftKey(ownerId, studentId, date))).toBeNull();
});

test("does not save the same unchanged snapshot again after reporting success", async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "筛选了四篇文献" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "比较研究方法" },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("已保存");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });
  expect(save).toHaveBeenCalledTimes(1);
});

test("reports the saved record result with the acknowledged snapshot", async () => {
  vi.useFakeTimers();
  const savedRecord = {
    id: "323e4567-e89b-42d3-a456-426614174000",
    studentId,
    recordDate: date,
    campDay: 1,
    achievements: "筛选了四篇文献",
    evidence: "",
    challenges: "",
    nextPlan: "比较研究方法",
    processNotes: "",
    behaviorTags: [],
    ao1Note: "",
    ao2Note: "",
    ao3Note: "",
    ao4Note: "",
  };
  const onSaved = vi.fn();
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={async () => savedRecord}
      onSaved={onSaved}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: savedRecord.achievements },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: savedRecord.nextPlan },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });

  expect(onSaved).toHaveBeenCalledWith(
    savedRecord,
    expect.objectContaining({
      studentId,
      recordDate: date,
      achievements: savedRecord.achievements,
    }),
  );
});

test("serializes saves and sends the latest queued snapshot after completion", async () => {
  vi.useFakeTimers();
  const first = deferred<void>();
  const second = deferred<void>();
  const save = vi
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "第一版成果" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "第一版计划" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(save).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "最新成果" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(save).toHaveBeenCalledTimes(1);

  await act(async () => {
    first.resolve();
    await first.promise;
  });
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      achievements: "最新成果",
      nextPlan: "第一版计划",
    }),
  );
  expect(localStorage.getItem(draftKey(ownerId, studentId, date))).toContain(
    "最新成果",
  );

  await act(async () => {
    second.resolve();
    await second.promise;
  });
  expect(screen.getByRole("status")).toHaveTextContent("已保存");
  expect(localStorage.getItem(draftKey(ownerId, studentId, date))).toBeNull();
});

test("uses the server revision returned by an older successful save for the queued save", async () => {
  vi.useFakeTimers();
  const firstResponse = deferred<{
    ok: boolean;
    json: () => Promise<{ data: Record<string, unknown> }>;
  }>();
  const fetchMock = vi
    .fn()
    .mockImplementationOnce(() => firstResponse.promise)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: "323e4567-e89b-42d3-a456-426614174000",
          studentId,
          recordDate: date,
          campDay: 1,
          achievements: "第二版成果",
          evidence: "新增证据",
          challenges: "",
          nextPlan: "第一版计划",
          processNotes: "",
          behaviorTags: [],
          ao1Note: "",
          ao2Note: "",
          ao3Note: "",
          ao4Note: "",
          revision: 2,
        },
      }),
    });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      initialValue={{
        studentId,
        recordDate: date,
        campDay: 1,
        achievements: "初始成果",
        evidence: "",
        challenges: "",
        nextPlan: "第一版计划",
        processNotes: "",
        behaviorTags: [],
        ao1Note: "",
        ao2Note: "",
        ao3Note: "",
        ao4Note: "",
        revision: 0,
      }}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "第二版成果" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText("成果证据或数量信息"), {
    target: { value: "新增证据" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    firstResponse.resolve({
      ok: true,
      json: async () => ({
        data: {
          id: "323e4567-e89b-42d3-a456-426614174000",
          studentId,
          recordDate: date,
          campDay: 1,
          achievements: "第二版成果",
          evidence: "",
          challenges: "",
          nextPlan: "第一版计划",
          processNotes: "",
          behaviorTags: [],
          ao1Note: "",
          ao2Note: "",
          ao3Note: "",
          ao4Note: "",
          revision: 1,
        },
      }),
    });
    await firstResponse.promise;
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
    evidence: "新增证据",
    expectedRevision: 1,
  });
});

test("keeps the draft and retries the same snapshot after autosave fails", async () => {
  vi.useFakeTimers();
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "筛选了四篇文献" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "比较研究方法" },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });

  expect(screen.getByLabelText("今日完成成果")).toHaveValue("筛选了四篇文献");
  expect(screen.getByRole("alert")).toHaveTextContent("保存失败");
  expect(localStorage.getItem(draftKey(ownerId, studentId, date))).toContain(
    "筛选了四篇文献",
  );

  fireEvent.click(screen.getByRole("button", { name: "立即重试" }));
  await act(async () => {
    await Promise.resolve();
  });

  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0]).toMatchObject({
    achievements: "筛选了四篇文献",
    nextPlan: "比较研究方法",
  });
  expect(screen.getByRole("status")).toHaveTextContent("已保存");
});

test("cancels the old debounce when switching student or date", async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "旧学生成果" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "旧学生计划" },
  });

  const nextStudentId = "223e4567-e89b-42d3-a456-426614174000";
  rerender(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={nextStudentId}
      date="2026-07-19"
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "新学生成果" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "新学生计划" },
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });

  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      studentId: nextStudentId,
      recordDate: "2026-07-19",
      achievements: "新学生成果",
    }),
  );
});

test("an old identity completion cannot clear the new draft or mark it saved", async () => {
  vi.useFakeTimers();
  const oldSave = deferred<void>();
  const newSave = deferred<void>();
  const save = vi
    .fn()
    .mockImplementationOnce(() => oldSave.promise)
    .mockImplementationOnce(() => newSave.promise);
  const { rerender } = render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "旧学生成果" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "旧学生计划" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });

  const nextStudentId = "223e4567-e89b-42d3-a456-426614174000";
  const nextDate = "2026-07-19";
  rerender(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={nextStudentId}
      date={nextDate}
      save={save}
    />,
  );
  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "新学生成果" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "新学生计划" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(save).toHaveBeenCalledTimes(2);

  await act(async () => {
    oldSave.resolve();
    await oldSave.promise;
  });

  expect(localStorage.getItem(draftKey(ownerId, nextStudentId, nextDate))).toContain(
    "新学生成果",
  );
  expect(screen.getByRole("status")).toHaveTextContent("正在保存");
  expect(screen.queryByText("已保存")).not.toBeInTheDocument();
});

test("successful save removes the draft so remount uses the server initial value", async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue(undefined);
  const initialValue = {
    studentId,
    recordDate: date,
    campDay: 3,
    achievements: "服务器旧值",
    evidence: "",
    challenges: "",
    nextPlan: "服务器计划",
    processNotes: "",
    behaviorTags: [],
    ao1Note: "",
    ao2Note: "",
    ao3Note: "",
    ao4Note: "",
  };
  const { unmount } = render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      initialValue={initialValue}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "服务器最新值" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(localStorage.getItem(draftKey(ownerId, studentId, date))).toBeNull();

  unmount();
  render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      initialValue={{ ...initialValue, achievements: "服务器最新值" }}
      save={save}
    />,
  );

  expect(screen.getByLabelText("今日完成成果")).toHaveValue("服务器最新值");
});

test("retains the local draft when unmounted before the debounce", async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={async () => {}}
    />,
  );

  await user.type(screen.getByLabelText("今日完成成果"), "离开前输入");
  unmount();

  expect(localStorage.getItem(draftKey(ownerId, studentId, date))).toContain(
    "离开前输入",
  );
});

test("does not consume a queued save after unmount", async () => {
  vi.useFakeTimers();
  const first = deferred<void>();
  const save = vi.fn().mockImplementation(() => first.promise);
  const { unmount } = render(
    <DailyRecordForm
      ownerId={ownerId}
      studentId={studentId}
      date={date}
      save={save}
    />,
  );

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "第一版成果" },
  });
  fireEvent.change(screen.getByLabelText("明日计划"), {
    target: { value: "第一版计划" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(save).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "排队成果" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(save).toHaveBeenCalledTimes(1);

  unmount();
  await act(async () => {
    first.resolve();
    await first.promise;
  });

  expect(save).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(draftKey(ownerId, studentId, date))).toContain(
    "排队成果",
  );
});

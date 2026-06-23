import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const student = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  displayName: "林同学",
  grade: "10" as const,
  projectTitle: "Attention and memory",
  campStartDate: "2026-07-16",
  backgroundNotes: "",
  currentFocus: "完善资料筛选标准",
};

const record = {
  studentId: student.id,
  recordDate: "2026-07-18",
  campDay: 3,
  achievements: "筛选了四篇文献",
  evidence: "四篇带批注的文献",
  challenges: "",
  nextPlan: "完成来源比较表",
  processNotes: "",
  behaviorTags: [],
  ao1Note: "按计划推进",
  ao2Note: "",
  ao3Note: "开始比较证据",
  ao4Note: "",
};

const baseProps = {
  ownerId: "owner-123",
  profileName: "Max",
  date: "2026-07-18",
  dateWasProvided: true,
  students: [student],
  selectedStudent: student,
  dailyRecord: record,
  feedback: null,
  feedbackHistory: [],
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("renders responsive students, record, and AI regions without horizontal overflow", () => {
  render(<WorkspaceShell {...baseProps} />);

  expect(
    screen.getByRole("navigation", { name: "学生档案" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(
    screen.getByRole("complementary", { name: "AI 反馈助手" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("main").parentElement).toHaveClass(
    "grid-cols-1",
    "xl:grid-cols-[14rem_minmax(30rem,1fr)_23rem]",
    "overflow-x-hidden",
  );
  expect(screen.getByRole("banner")).toHaveClass("flex-wrap");
  expect(screen.getByTestId("workspace-date-controls")).toHaveClass(
    "grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]",
  );
});

test("shows an addable empty state when there are no students", async () => {
  render(
    <WorkspaceShell
      {...baseProps}
      students={[]}
      selectedStudent={null}
      dailyRecord={null}
    />,
  );

  expect(screen.getByText("还没有学生档案")).toBeInTheDocument();
  expect(screen.getByText(/先新增一名学生/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "新增学生档案" })).toBeInTheDocument();
});

test("shows AO note completeness and summaries without invented scores", () => {
  render(<WorkspaceShell {...baseProps} />);

  expect(screen.getByText("AO1 Manage")).toBeInTheDocument();
  expect(screen.getAllByText("已记录")).toHaveLength(2);
  expect(screen.getAllByText("待补充")).toHaveLength(2);
  expect(screen.getAllByText("按计划推进")).not.toHaveLength(0);
  expect(screen.queryByText(/%|分数|评分/)).not.toBeInTheDocument();
});

test("exposes an accessible student panel and logout action", () => {
  render(<WorkspaceShell {...baseProps} />);

  expect(
    screen.getByRole("region", { name: "学生档案编辑面板" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
});

test("opens a read-only feedback history entry with its saved content", async () => {
  const user = userEvent.setup();
  render(
    <WorkspaceShell
      {...baseProps}
      feedbackHistory={[
        {
          id: "feedback-history-1",
          status: "final",
          version: 1,
          createdAt: "2026-07-18T10:00:00Z",
          draft: {
            mode: "zh",
            zh: {
              content: "这是已经归档的匿名历史反馈内容。",
              evidenceUsed: ["筛选了四篇文献"],
              nextStep: "继续制作证据比较表。",
            },
          },
        },
      ]}
    />,
  );

  await user.click(screen.getByRole("button", { name: /第 1 版/ }));
  expect(
    screen.getByText("这是已经归档的匿名历史反馈内容。"),
  ).toBeInTheDocument();
  expect(screen.getByText("引用证据：筛选了四篇文献")).toBeInTheDocument();
  expect(screen.getByText("下一步：继续制作证据比较表。")).toBeInTheDocument();
});

test("does not replace the server business date on mount", () => {
  const navigate = vi.fn();
  render(
    <WorkspaceShell
      {...baseProps}
      dateWasProvided={false}
      navigate={navigate}
    />,
  );

  expect(navigate).not.toHaveBeenCalled();
});

test("navigates between record dates while preserving the selected student", async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  render(<WorkspaceShell {...baseProps} navigate={navigate} />);

  await user.click(screen.getByRole("button", { name: "上一天" }));
  expect(navigate).toHaveBeenLastCalledWith(
    `/workspace?student=${student.id}&date=2026-07-17`,
  );
  const loadingStatus = screen.getByRole("status", {
    name: "页面载入状态",
  });
  expect(loadingStatus).toHaveTextContent("正在载入");
  expect(
    loadingStatus.querySelector('[data-testid="loading-spinner"]'),
  ).not.toBeNull();

  await user.click(screen.getByRole("button", { name: "下一天" }));
  expect(navigate).toHaveBeenLastCalledWith(
    `/workspace?student=${student.id}&date=2026-07-19`,
  );

  fireEvent.change(screen.getByLabelText("查看日期"), {
    target: { value: "2026-07-21" },
  });
  expect(navigate).toHaveBeenLastCalledWith(
    `/workspace?student=${student.id}&date=2026-07-21`,
  );
});

test("returns to today's server-selected workspace date", async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  render(<WorkspaceShell {...baseProps} navigate={navigate} />);

  await user.click(screen.getByRole("button", { name: "回到今天" }));

  expect(navigate).toHaveBeenLastCalledWith(
    `/workspace?student=${student.id}`,
  );
});

test("passes the camp start date through and shows the pre-camp locked state", () => {
  render(
    <WorkspaceShell
      {...baseProps}
      date="2026-07-15"
      dailyRecord={null}
    />,
  );

  expect(screen.getByText("营地尚未开始，该日期仅供查看")).toBeInTheDocument();
  expect(screen.getByLabelText("今日完成成果")).toBeDisabled();
  expect(screen.getByRole("button", { name: "生成反馈" })).toBeDisabled();
});

test("keeps feedback generation disabled before camp when a legacy record has an id", () => {
  render(
    <WorkspaceShell
      {...baseProps}
      date="2026-07-15"
      dailyRecord={{
        ...record,
        id: "323e4567-e89b-42d3-a456-426614174000",
        recordDate: "2026-07-15",
        campDay: 1,
      }}
    />,
  );

  expect(screen.getByRole("button", { name: "生成反馈" })).toBeDisabled();
});

test("enables generation with the id returned by the first record save without refreshing", async () => {
  vi.useFakeTimers();
  localStorage.clear();
  const savedRecordId = "323e4567-e89b-42d3-a456-426614174000";
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { ...record, id: savedRecordId } }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feedback: { id: "feedback-1", revision: 0 },
          draft: {
            mode: "en",
            en: {
              content: "Generated feedback",
              evidenceUsed: ["Saved record"],
              nextStep: "Continue",
            },
          },
        }),
        { status: 200 },
      ),
    );
  render(<WorkspaceShell {...baseProps} dailyRecord={record} />);

  expect(screen.getByRole("button", { name: "生成反馈" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("今日完成成果"), {
    target: { value: "首次保存成果" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
    await Promise.resolve();
  });
  expect(screen.getByRole("button", { name: "生成反馈" })).toBeEnabled();

  fireEvent.click(screen.getByRole("button", { name: "英文" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "生成反馈" }));
    await Promise.resolve();
  });

  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/feedback/generate",
    expect.objectContaining({
      body: JSON.stringify({
        dailyRecordId: savedRecordId,
        languageMode: "en",
        instruction: "",
      }),
    }),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("resets the saved record identity when student or date changes", async () => {
  const { rerender } = render(
    <WorkspaceShell
      {...baseProps}
      dailyRecord={{ ...record, id: "record-old" }}
    />,
  );
  expect(screen.getByRole("button", { name: "生成反馈" })).toBeEnabled();

  rerender(
    <WorkspaceShell
      {...baseProps}
      date="2026-07-19"
      dailyRecord={null}
    />,
  );

  await act(async () => {});
  expect(screen.getByRole("button", { name: "生成反馈" })).toBeDisabled();
});

test("updates the AO overview immediately from the live draft", () => {
  render(
    <WorkspaceShell
      {...baseProps}
      dailyRecord={{
        ...record,
        achievements: "",
        nextPlan: "",
        ao2Note: "",
      }}
    />,
  );

  expect(screen.getAllByText("待补充")).toHaveLength(2);
  fireEvent.change(
    screen.getByLabelText("AO2 Use resources 当日观察"),
    { target: { value: "已比较来源可信度" } },
  );

  expect(screen.getAllByText("已记录")).toHaveLength(3);
  expect(screen.getAllByText("已比较来源可信度")).not.toHaveLength(0);
});

test("shows an error and stays on the workspace when logout fails", async () => {
  const navigate = vi.fn();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }),
  );
  render(<WorkspaceShell {...baseProps} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("退出失败");
  expect(navigate).not.toHaveBeenCalled();
});

test("navigates to login only after a successful logout response", async () => {
  const navigate = vi.fn();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 204 }),
  );
  render(<WorkspaceShell {...baseProps} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

  await act(async () => {});
  expect(navigate).toHaveBeenCalledWith("/login");
});

test("shows a spinner and busy state while logging out", async () => {
  const navigate = vi.fn();
  let resolveLogout: ((value: Response) => void) | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        resolveLogout = resolve;
      }),
  );
  render(<WorkspaceShell {...baseProps} navigate={navigate} />);

  fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

  const button = screen.getByRole("button", { name: "退出中…" });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(button.querySelector('[data-testid="loading-spinner"]')).not.toBeNull();

  resolveLogout?.(new Response(null, { status: 204 }));
  await act(async () => {});
  expect(navigate).toHaveBeenCalledWith("/login");
});

test("treats malformed student success JSON as a save failure", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ data: { id: student.id } }), {
      status: 201,
    }),
  );
  render(<WorkspaceShell {...baseProps} />);

  await user.click(
    screen.getByRole("button", { name: "打开学生档案编辑面板" }),
  );
  await user.type(screen.getByLabelText("学生称呼"), "新同学");
  await user.type(screen.getByLabelText("EPQ 研究题目"), "新题目");
  await user.type(screen.getByLabelText("营地开始日期"), "2026-07-18");
  await user.click(screen.getAllByRole("button", { name: "新增学生" })[1]);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "保存失败，请稍后重试",
  );
});

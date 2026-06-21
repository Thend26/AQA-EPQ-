import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { FeedbackAssistant } from "@/components/feedback/feedback-assistant";

const initialDraft = {
  mode: "bilingual" as const,
  zh: {
    content: "现有中文反馈内容",
    evidenceUsed: ["筛选了四篇文献"],
    nextStep: "完成来源比较表",
  },
  en: {
    content: "Existing English feedback content",
    evidenceUsed: ["Reviewed four sources"],
    nextStep: "Complete the source comparison table",
  },
};

const emptyDraft = {
  mode: "zh" as const,
  zh: { content: "", evidenceUsed: [], nextStep: "" },
};

test.each([
  ["中文", "zh"],
  ["英文", "en"],
  ["中英双语", "bilingual"],
] as const)(
  "allows choosing %s before the first generation",
  async (button, mode) => {
  const user = userEvent.setup();
  const generate = vi.fn(async (mode: "zh" | "en" | "bilingual") => ({
    draft:
      mode === "zh"
        ? emptyDraft
        : mode === "en"
          ? {
              mode: "en" as const,
              en: { content: "", evidenceUsed: [], nextStep: "" },
            }
          : {
              mode: "bilingual" as const,
              zh: emptyDraft.zh,
              en: { content: "", evidenceUsed: [], nextStep: "" },
            },
    revision: 0,
  }));
  render(
    <FeedbackAssistant
      contextSummary="尚无反馈"
      initialDraft={emptyDraft}
      generate={generate}
    />,
  );

  expect(screen.queryByLabelText("质量问题")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: button }));
  await user.click(screen.getByRole("button", { name: "生成反馈" }));
  expect(generate).toHaveBeenLastCalledWith(mode);
  expect(screen.getByLabelText("质量问题")).toBeInTheDocument();
  },
);

test("preserves entered language content while changing output mode", async () => {
  const user = userEvent.setup();
  render(
    <FeedbackAssistant
      contextSummary="尚无反馈"
      initialDraft={emptyDraft}
    />,
  );

  await user.type(screen.getByLabelText("中文反馈"), "中文草稿");
  await user.click(screen.getByRole("button", { name: "中英双语" }));
  expect(screen.getByLabelText("中文反馈")).toHaveValue("中文草稿");
  await user.click(screen.getByRole("button", { name: "英文内容" }));
  expect(screen.getByLabelText("English feedback")).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "中文内容" }));
  expect(screen.getByLabelText("中文反馈")).toHaveValue("中文草稿");
});

test("uses Chinese labels and named language groups", () => {
  render(
    <FeedbackAssistant
      contextSummary="尚无反馈"
      initialDraft={emptyDraft}
    />,
  );

  expect(
    screen.getByRole("group", { name: "选择反馈输出语言" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "英文" })).toBeInTheDocument();
});

test("keeps the current draft when a revision request fails", async () => {
  const user = userEvent.setup();
  render(
    <FeedbackAssistant
      contextSummary="前 5 天记录"
      initialDraft={initialDraft}
      initialRevision={3}
      revise={async () => {
        throw new Error("network");
      }}
    />,
  );

  await user.type(screen.getByLabelText("修改要求"), "语气更简洁");
  await user.click(screen.getByRole("button", { name: "发送修改要求" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("修改失败");
  expect(screen.getByDisplayValue("现有中文反馈内容")).toBeInTheDocument();
});

describe("feedback language and pending state", () => {
  test("switches between Chinese and English drafts without losing edits", async () => {
    const user = userEvent.setup();
    render(
      <FeedbackAssistant
        contextSummary="前 5 天记录"
        initialDraft={initialDraft}
      />,
    );

    const chinese = screen.getByLabelText("中文反馈");
    await user.clear(chinese);
    await user.type(chinese, "修改后的中文");
    await user.click(screen.getByRole("button", { name: "英文内容" }));

    expect(screen.getByLabelText("English feedback")).toHaveValue(
      "Existing English feedback content",
    );

    await user.click(screen.getByRole("button", { name: "中文内容" }));
    expect(screen.getByLabelText("中文反馈")).toHaveValue("修改后的中文");
  });

  test("disables actions while a revision is pending", async () => {
    const user = userEvent.setup();
    let resolveRevision:
      | ((value: { draft: typeof initialDraft; revision: number }) => void)
      | undefined;
    const revise = vi.fn(
      () =>
        new Promise<{ draft: typeof initialDraft; revision: number }>((resolve) => {
          resolveRevision = resolve;
        }),
    );
    render(
      <FeedbackAssistant
        contextSummary="前 5 天记录"
        initialDraft={initialDraft}
        initialRevision={2}
        revise={revise}
      />,
    );

    await user.type(screen.getByLabelText("修改要求"), "更简洁");
    await user.click(screen.getByRole("button", { name: "发送修改要求" }));

    expect(screen.getByRole("button", { name: "修改中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认归档" })).toBeDisabled();
    expect(screen.getByLabelText("中文反馈")).toBeDisabled();
    expect(screen.getByLabelText("下一步建议")).toBeDisabled();
    expect(screen.getByLabelText("修改要求")).toBeDisabled();
    expect(screen.getByRole("button", { name: "英文内容" })).toBeDisabled();

    resolveRevision?.({ draft: initialDraft, revision: 3 });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "修改中…" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("修改要求")).toHaveValue("");
  });

  test("passes expected revision and preserves draft with refresh guidance on 409", async () => {
    const user = userEvent.setup();
    const revise = vi.fn(async () => {
      throw Object.assign(new Error("stale"), { status: 409 });
    });
    render(
      <FeedbackAssistant
        contextSummary="前 5 天记录"
        initialDraft={initialDraft}
        initialRevision={8}
        revise={revise}
      />,
    );

    await user.type(screen.getByLabelText("修改要求"), "更简洁");
    await user.click(screen.getByRole("button", { name: "发送修改要求" }));

    expect(revise).toHaveBeenCalledWith("更简洁", initialDraft, 8);
    expect(await screen.findByRole("alert")).toHaveTextContent("刷新");
    expect(screen.getByDisplayValue("现有中文反馈内容")).toBeInTheDocument();
  });

  test("marks finalized feedback immutable after a successful finalize", async () => {
    const user = userEvent.setup();
    const validDraft = {
      mode: "zh" as const,
      zh: {
        content:
          "今天完成了四篇资料的筛选和批注，并记录了作者、日期与主要观点。学生识别了来源之间的结论差异，并开始比较证据质量。接下来需要把比较结果写入研究日志并说明取舍理由。",
        evidenceUsed: ["四篇带批注的文献"],
        nextStep: "明天完成来源比较表并写出两项取舍理由",
      },
    };
    render(
      <FeedbackAssistant
        contextSummary="前 5 天记录"
        initialDraft={validDraft}
        initialRevision={5}
        finalize={async () => ({ revision: 6 })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "确认归档" }));

    expect(await screen.findByText("已归档")).toBeInTheDocument();
    expect(screen.getByLabelText("中文反馈")).toBeDisabled();
    expect(screen.getByLabelText("修改要求")).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认归档" })).toBeDisabled();
  });
});

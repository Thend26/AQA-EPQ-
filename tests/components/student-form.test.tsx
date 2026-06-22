import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { StudentForm } from "@/components/students/student-form";

test("marks the required student profile fields", () => {
  render(<StudentForm onSave={async () => {}} />);

  expect(screen.getByLabelText("学生称呼")).toBeRequired();
  expect(screen.getByLabelText("年级")).toBeRequired();
  expect(screen.getByLabelText("EPQ 研究题目")).toBeRequired();
  expect(screen.getByLabelText("营地开始日期")).toBeRequired();
  expect(screen.getByLabelText("背景信息")).toBeInTheDocument();
  expect(screen.getByLabelText("当前关注")).toBeInTheDocument();
});

test("submits parsed student data", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<StudentForm onSave={onSave} />);

  await user.type(screen.getByLabelText("学生称呼"), "  林同学  ");
  await user.selectOptions(screen.getByLabelText("年级"), "11");
  await user.type(screen.getByLabelText("EPQ 研究题目"), "  Attention  ");
  await user.type(screen.getByLabelText("营地开始日期"), "2026-07-16");
  await user.type(screen.getByLabelText("背景信息"), "First EPQ");
  await user.type(screen.getByLabelText("当前关注"), "Research question");
  await user.click(screen.getByRole("button", { name: "新增学生" }));

  expect(onSave).toHaveBeenCalledWith({
    displayName: "林同学",
    grade: "11",
    projectTitle: "Attention",
    campStartDate: "2026-07-16",
    backgroundNotes: "First EPQ",
    currentFocus: "Research question",
  });
});

test("preserves entered values when saving fails", async () => {
  const user = userEvent.setup();
  render(
    <StudentForm
      onSave={async () => {
        throw new Error("database details");
      }}
    />,
  );

  await user.type(screen.getByLabelText("学生称呼"), "林同学");
  await user.type(screen.getByLabelText("EPQ 研究题目"), "Attention");
  await user.type(screen.getByLabelText("营地开始日期"), "2026-07-16");
  await user.click(screen.getByRole("button", { name: "新增学生" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "保存失败，请稍后重试",
  );
  expect(screen.getByLabelText("学生称呼")).toHaveValue("林同学");
  expect(screen.getByLabelText("EPQ 研究题目")).toHaveValue("Attention");
});

test("supports editing an existing student", () => {
  render(
    <StudentForm
      initialValue={{
        id: "123e4567-e89b-42d3-a456-426614174000",
        displayName: "林同学",
        grade: "10",
        projectTitle: "Attention",
        campStartDate: "2026-07-16",
        backgroundNotes: "",
        currentFocus: "",
      }}
      onSave={async () => {}}
    />,
  );

  expect(screen.getByLabelText("学生称呼")).toHaveValue("林同学");
  expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument();
});

test("shows a spinner and busy state while saving", async () => {
  const user = userEvent.setup();
  let resolveSave: (() => void) | undefined;
  const onSave = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
  );
  render(<StudentForm onSave={onSave} />);

  await user.type(screen.getByLabelText("学生称呼"), "林同学");
  await user.type(screen.getByLabelText("EPQ 研究题目"), "Attention");
  await user.type(screen.getByLabelText("营地开始日期"), "2026-07-16");
  await user.click(screen.getByRole("button", { name: "新增学生" }));

  const button = screen.getByRole("button", { name: "保存中…" });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(button.querySelector('[data-testid="loading-spinner"]')).not.toBeNull();

  resolveSave?.();
});

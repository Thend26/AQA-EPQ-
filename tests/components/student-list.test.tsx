import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { StudentList } from "@/components/students/student-list";

const student = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  displayName: "林同学",
  grade: "10" as const,
  projectTitle: "Attention",
  campStartDate: "2026-07-16",
  backgroundNotes: "",
  currentFocus: "",
};

test("shows an empty state and the suggested student count", () => {
  render(
    <StudentList
      students={[]}
      onSelect={() => {}}
      onEdit={() => {}}
      onDelete={async () => {}}
    />,
  );

  expect(screen.getByText("还没有学生档案")).toBeInTheDocument();
  expect(screen.getByText(/建议管理 1–10 名学生/)).toBeInTheDocument();
});

test("selects and edits a student", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onEdit = vi.fn();
  render(
    <StudentList
      students={[student]}
      onSelect={onSelect}
      onEdit={onEdit}
      onDelete={async () => {}}
    />,
  );

  await user.click(screen.getByRole("button", { name: /选择林同学/ }));
  await user.click(screen.getByRole("button", { name: /编辑林同学/ }));

  expect(onSelect).toHaveBeenCalledWith(student.id);
  expect(onEdit).toHaveBeenCalledWith(student);
});

test("requires confirmation before deleting", async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const confirm = vi.spyOn(window, "confirm");
  confirm.mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(
    <StudentList
      students={[student]}
      onSelect={() => {}}
      onEdit={() => {}}
      onDelete={onDelete}
    />,
  );

  await user.click(screen.getByRole("button", { name: /删除林同学/ }));
  expect(onDelete).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenLastCalledWith(
    "将永久删除该学生及其每日记录、反馈和对话，无法恢复。确认删除林同学？",
  );

  await user.click(screen.getByRole("button", { name: /删除林同学/ }));
  expect(onDelete).toHaveBeenCalledWith(student.id);

  confirm.mockRestore();
});

test("disables deletion while pending", async () => {
  const user = userEvent.setup();
  let resolveDelete: (() => void) | undefined;
  const onDelete = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(
    <StudentList
      students={[student]}
      onSelect={() => {}}
      onEdit={() => {}}
      onDelete={onDelete}
    />,
  );

  await user.click(screen.getByRole("button", { name: /删除林同学/ }));

  expect(screen.getByRole("button", { name: "删除中…" })).toBeDisabled();
  resolveDelete?.();
});

test("shows a safe error and restores deletion after failure", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(
    <StudentList
      students={[student]}
      onSelect={() => {}}
      onEdit={() => {}}
      onDelete={async () => {
        throw new Error("sensitive database details");
      }}
    />,
  );

  await user.click(screen.getByRole("button", { name: /删除林同学/ }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "删除失败，请稍后重试",
  );
  expect(screen.getByRole("button", { name: /删除林同学/ })).toBeEnabled();
});

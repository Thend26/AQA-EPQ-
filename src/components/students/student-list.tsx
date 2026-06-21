"use client";

import { useState } from "react";

import type { Student } from "@/lib/domain/types";

type StudentListProps = {
  students: Student[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => Promise<void>;
};

export function StudentList({
  students,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: StudentListProps) {
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(student: Student) {
    if (
      !window.confirm(
        `将永久删除该学生及其每日记录、反馈和对话，无法恢复。确认删除${student.displayName}？`,
      )
    ) {
      return;
    }

    setDeletingId(student.id ?? null);
    setError("");
    try {
      if (student.id) {
        await onDelete(student.id);
      }
    } catch {
      setError("删除失败，请稍后重试");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-label="学生档案">
      <p>
        建议管理 1–10 名学生；当前 {students.length} 名，首版上限 10 名。
      </p>
      {students.length === 0 ? <p>还没有学生档案</p> : null}
      <ul>
        {students.map((student) => (
          <li key={student.id}>
            <button
              aria-pressed={selectedId === student.id}
              onClick={() => student.id && onSelect(student.id)}
              type="button"
            >
              选择{student.displayName}
            </button>
            <span>
              {student.grade} 年级 · {student.projectTitle}
            </span>
            <button onClick={() => onEdit(student)} type="button">
              编辑{student.displayName}
            </button>
            <button
              disabled={deletingId === student.id}
              onClick={() => void handleDelete(student)}
              type="button"
            >
              {deletingId === student.id
                ? "删除中…"
                : `删除${student.displayName}`}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

"use client";

import { useState } from "react";

import type { Student } from "@/lib/domain/types";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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
      <p className="mb-3 text-sm leading-6 text-stone-600">
        建议管理 1–10 名学生；当前 {students.length} 名，首版上限 10 名。
      </p>
      {students.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">
          还没有学生档案
        </p>
      ) : null}
      <ul className="space-y-3">
        {students.map((student) => (
          <li
            key={student.id}
            className={`rounded-xl border p-3 ${
              selectedId === student.id
                ? "border-emerald-600 bg-emerald-50"
                : "border-stone-200 bg-stone-50"
            }`}
          >
            <button
              aria-label={`选择${student.displayName}`}
              aria-pressed={selectedId === student.id}
              className="block w-full text-left font-semibold text-emerald-950"
              onClick={() => student.id && onSelect(student.id)}
              type="button"
            >
              <span className="sr-only">选择</span>
              {student.displayName}
            </button>
            <span className="mt-1 block break-words text-sm leading-5 text-stone-600">
              {student.grade} 年级 · {student.projectTitle}
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                aria-label={`编辑${student.displayName}`}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:border-emerald-500 hover:text-emerald-800"
                onClick={() => onEdit(student)}
                type="button"
              >
                编辑<span className="sr-only">{student.displayName}</span>
              </button>
              <button
                aria-busy={deletingId === student.id}
                aria-label={
                  deletingId === student.id
                    ? "删除中…"
                    : `删除${student.displayName}`
                }
                className="rounded-lg px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                disabled={deletingId === student.id}
                onClick={() => void handleDelete(student)}
                type="button"
              >
                {deletingId === student.id ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span>删除中…</span>
                  </span>
                ) : (
                  <>
                    删除<span className="sr-only">{student.displayName}</span>
                  </>
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

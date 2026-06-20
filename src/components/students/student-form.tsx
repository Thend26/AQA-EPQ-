"use client";

import { type FormEvent, useState } from "react";

import {
  studentInputSchema,
  type Student,
  type StudentProfile,
} from "@/lib/domain/types";

type StudentFormProps = {
  initialValue?: Student;
  onSave: (student: StudentProfile) => Promise<void>;
};

type FormValues = {
  displayName: string;
  grade: "10" | "11";
  projectTitle: string;
  campStartDate: string;
  backgroundNotes: string;
  currentFocus: string;
};

const emptyValues: FormValues = {
  displayName: "",
  grade: "10",
  projectTitle: "",
  campStartDate: "",
  backgroundNotes: "",
  currentFocus: "",
};

function valuesFromStudent(student?: Student): FormValues {
  if (!student) {
    return emptyValues;
  }

  return {
    displayName: student.displayName,
    grade: student.grade,
    projectTitle: student.projectTitle,
    campStartDate: student.campStartDate,
    backgroundNotes: student.backgroundNotes,
    currentFocus: student.currentFocus,
  };
}

function StudentFormFields({ initialValue, onSave }: StudentFormProps) {
  const [values, setValues] = useState(() => valuesFromStudent(initialValue));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const parsed = studentInputSchema.safeParse(values);

    if (!parsed.success) {
      setError("请检查必填项和输入长度");
      return;
    }

    setPending(true);
    try {
      await onSave(parsed.data);
      if (!initialValue) {
        setValues(emptyValues);
      }
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block">
        学生称呼
        <input
          name="displayName"
          value={values.displayName}
          onChange={(event) => update("displayName", event.target.value)}
          required
          maxLength={80}
        />
      </label>
      <label className="block">
        年级
        <select
          name="grade"
          value={values.grade}
          onChange={(event) =>
            update("grade", event.target.value as FormValues["grade"])
          }
          required
        >
          <option value="10">10 年级</option>
          <option value="11">11 年级</option>
        </select>
      </label>
      <label className="block">
        EPQ 研究题目
        <input
          name="projectTitle"
          value={values.projectTitle}
          onChange={(event) => update("projectTitle", event.target.value)}
          required
          maxLength={300}
        />
      </label>
      <label className="block">
        营地开始日期
        <input
          name="campStartDate"
          type="date"
          value={values.campStartDate}
          onChange={(event) => update("campStartDate", event.target.value)}
          required
        />
      </label>
      <label className="block">
        背景信息
        <textarea
          name="backgroundNotes"
          value={values.backgroundNotes}
          onChange={(event) => update("backgroundNotes", event.target.value)}
          maxLength={2000}
        />
      </label>
      <label className="block">
        当前关注
        <textarea
          name="currentFocus"
          value={values.currentFocus}
          onChange={(event) => update("currentFocus", event.target.value)}
          maxLength={1000}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={pending} type="submit">
        {pending ? "保存中…" : initialValue ? "保存修改" : "新增学生"}
      </button>
    </form>
  );
}

export function StudentForm(props: StudentFormProps) {
  return (
    <StudentFormFields
      key={props.initialValue?.id ?? "new-student"}
      {...props}
    />
  );
}

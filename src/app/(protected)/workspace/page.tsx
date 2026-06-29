import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { defaultWorkspaceDate } from "@/lib/camp/date";
import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import { getDailyRecord } from "@/lib/repositories/daily-records";
import { getUserSettings } from "@/lib/repositories/settings";
import { listStudents } from "@/lib/repositories/students";
import { loadWorkspaceFeedbacks } from "@/lib/repositories/workspace-feedbacks";
import { createClient } from "@/lib/supabase/server";
import {
  dateInTimeZone,
  resolveWorkspaceDate,
} from "@/lib/workspace/date";

type WorkspacePageProps = {
  searchParams: Promise<{
    student?: string | string[];
    date?: string | string[];
  }>;
};

function safeServerDate() {
  return dateInTimeZone(new Date());
}

function logWorkspaceLoadError(scope: string, error: unknown) {
  console.error("[workspace-load]", scope, error);
}

export default async function WorkspacePage({
  searchParams,
}: WorkspacePageProps) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const query = await searchParams;
  const [profileResult, studentsResult] = await Promise.all([
    db
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    listStudents(db, user.id),
  ]);
  if (studentsResult.error) {
    logWorkspaceLoadError("students", studentsResult.error);
  }

  const students = studentsResult.error ? [] : studentsResult.data ?? [];
  const settingsResult = await getUserSettings(db, user.id);
  if (settingsResult.error) {
    logWorkspaceLoadError("settings", settingsResult.error);
  }
  const requestedStudent =
    typeof query.student === "string" ? query.student : undefined;
  const selectedStudent =
    students.find((student) => student.id === requestedStudent) ??
    students[0] ??
    null;
  const today = safeServerDate();
  const fallbackDate = selectedStudent
    ? defaultWorkspaceDate(today, selectedStudent.campStartDate)
    : today;
  const { date, provided } = resolveWorkspaceDate(
    query.date,
    fallbackDate,
  );

  let dailyRecord = null;
  let feedback = null;
  let feedbackHistory: Array<{
    id: string;
    status: "draft" | "final";
    version: number;
    createdAt: string;
    draft: GeneratedFeedback;
  }> = [];

  if (selectedStudent?.id) {
    const recordResult = await getDailyRecord(
      db,
      user.id,
      selectedStudent.id,
      date,
    );
    if (recordResult.error) {
      logWorkspaceLoadError("daily-record", recordResult.error);
    } else {
      dailyRecord = recordResult.data;
    }

    if (dailyRecord?.id) {
      const loadedFeedback = await loadWorkspaceFeedbacks(
        db,
        user.id,
        dailyRecord.id,
      );
      if (loadedFeedback.error) {
        logWorkspaceLoadError("feedback-history", loadedFeedback.error);
      } else {
        feedback = loadedFeedback.feedback;
        feedbackHistory = loadedFeedback.history;
      }
    }
  }

  return (
    <WorkspaceShell
      ownerId={user.id}
      profileName={
        (profileResult.data as { display_name?: string } | null)
          ?.display_name ??
        user.email ??
        ""
      }
      date={date}
      dateWasProvided={provided}
      students={students}
      selectedStudent={selectedStudent}
      dailyRecord={dailyRecord}
      feedback={feedback}
      feedbackHistory={feedbackHistory}
      settings={settingsResult.data ?? undefined}
      documentsEnabled
    />
  );
}

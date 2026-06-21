import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getDailyRecord } from "@/lib/repositories/daily-records";
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

export default async function WorkspacePage({
  searchParams,
}: WorkspacePageProps) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const query = await searchParams;
  const { date, provided } = resolveWorkspaceDate(
    query.date,
    safeServerDate(),
  );
  const [profileResult, studentsResult] = await Promise.all([
    db
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    listStudents(db, user.id),
  ]);
  if (studentsResult.error) {
    throw new Error("Unable to load students");
  }

  const students = studentsResult.data ?? [];
  const requestedStudent =
    typeof query.student === "string" ? query.student : undefined;
  const selectedStudent =
    students.find((student) => student.id === requestedStudent) ??
    students[0] ??
    null;

  let dailyRecord = null;
  let feedback = null;
  let feedbackHistory: Array<{
    id: string;
    status: "draft" | "final";
    version: number;
    createdAt: string;
  }> = [];

  if (selectedStudent?.id) {
    const recordResult = await getDailyRecord(
      db,
      user.id,
      selectedStudent.id,
      date,
    );
    if (recordResult.error) throw new Error("Unable to load daily record");
    dailyRecord = recordResult.data;

    if (dailyRecord?.id) {
      const loadedFeedback = await loadWorkspaceFeedbacks(
        db,
        user.id,
        dailyRecord.id,
      );
      if (loadedFeedback.error) {
        throw new Error("Unable to load feedback history");
      }
      feedback = loadedFeedback.feedback;
      feedbackHistory = loadedFeedback.history;
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
    />
  );
}

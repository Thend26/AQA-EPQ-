import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import { dailyRecordSchema } from "@/lib/domain/types";
import {
  DailyRecordConflictError,
  getDailyRecord,
  upsertDailyRecord,
} from "@/lib/repositories/daily-records";

const dailyRecordQuerySchema = z.object({
  studentId: z.string().uuid(),
  date: z.string().date(),
}).strict();
const dailyRecordSaveSchema = dailyRecordSchema.extend({
  expectedRevision: z.number().int().min(0).nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return auth.response;
    }

    const url = new URL(request.url);
    const parsed = dailyRecordQuerySchema.safeParse({
      studentId: url.searchParams.get("studentId"),
      date: url.searchParams.get("date"),
    });
    if (!parsed.success) {
      return validationError(parsed.error, "Invalid daily record query");
    }

    const { data, error, notFound } = await getDailyRecord(
      auth.db,
      auth.user.id,
      parsed.data.studentId,
      parsed.data.date,
    );
    if (error) {
      return apiError("Failed to load daily record", 500);
    }
    if (notFound) {
      return apiError("Student not found", 404);
    }

    return NextResponse.json({ data });
  } catch {
    return apiError("Failed to load daily record", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return auth.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON", 400);
    }

    const parsed = dailyRecordSaveSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error, "Invalid daily record data");
    }

    const { expectedRevision, ...record } = parsed.data;
    const { data, error, notFound } = await upsertDailyRecord(
      auth.db,
      auth.user.id,
      record,
      expectedRevision,
    );
    if (error instanceof DailyRecordConflictError) {
      return apiError("Daily record changed; refresh before saving", 409);
    }
    if (error) {
      return apiError("Failed to save daily record", 500);
    }
    if (notFound) {
      return apiError("Student not found", 404);
    }

    return NextResponse.json({ data });
  } catch {
    return apiError("Failed to save daily record", 500);
  }
}

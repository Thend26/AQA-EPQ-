import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import { studentUpdateSchema } from "@/lib/domain/types";
import {
  deleteStudent,
  StudentCampDateConflictError,
  updateStudent,
} from "@/lib/repositories/students";
const studentIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return auth.response;
    }

    const id = studentIdSchema.safeParse((await context.params).id);
    if (!id.success) {
      return apiError("Invalid student id", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON", 400);
    }

    const parsed = studentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error, "Invalid student data");
    }

    const { data, error } = await updateStudent(
      auth.db,
      auth.user.id,
      id.data,
      parsed.data,
    );
    if (error instanceof StudentCampDateConflictError) {
      return apiError(
        "Camp start date conflicts with existing records or documents",
        409,
      );
    }
    if (error) {
      return apiError("Failed to update student", 500);
    }
    if (!data) {
      return apiError("Student not found", 404);
    }

    return NextResponse.json({ data });
  } catch {
    return apiError("Failed to update student", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return auth.response;
    }

    const id = studentIdSchema.safeParse((await context.params).id);
    if (!id.success) {
      return apiError("Invalid student id", 400);
    }

    const { data, error } = await deleteStudent(
      auth.db,
      auth.user.id,
      id.data,
    );
    if (error) {
      return apiError("Failed to delete student", 500);
    }
    if (!data) {
      return apiError("Student not found", 404);
    }

    return NextResponse.json({ data });
  } catch {
    return apiError("Failed to delete student", 500);
  }
}

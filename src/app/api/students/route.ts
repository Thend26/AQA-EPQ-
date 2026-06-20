import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import { studentInputSchema } from "@/lib/domain/types";
import {
  createStudent,
  listStudents,
} from "@/lib/repositories/students";

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return auth.response;
    }

    const { data, error } = await listStudents(auth.db, auth.user.id);
    if (error) {
      return apiError("Failed to list students", 500);
    }

    return NextResponse.json({ data });
  } catch {
    return apiError("Failed to list students", 500);
  }
}

export async function POST(request: Request) {
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

    const parsed = studentInputSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error, "Invalid student data");
    }

    const { data, error } = await createStudent(
      auth.db,
      auth.user.id,
      parsed.data,
    );
    if (error) {
      return apiError("Failed to create student", 500);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return apiError("Failed to create student", 500);
  }
}

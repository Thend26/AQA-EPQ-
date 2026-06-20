import { NextResponse } from "next/server";
import type { z } from "zod";

export type ApiErrorStatus = 400 | 401 | 404 | 500 | 503;

export function apiError(message: string, status: ApiErrorStatus) {
  return NextResponse.json({ error: message }, { status });
}

export function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: "Invalid student data", issues: error.issues },
    { status: 400 },
  );
}

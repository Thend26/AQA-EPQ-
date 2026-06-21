import { NextResponse } from "next/server";
import type { z } from "zod";

export type ApiErrorStatus =
  | 400
  | 401
  | 404
  | 409
  | 422
  | 429
  | 500
  | 502
  | 503;

export function apiError(message: string, status: ApiErrorStatus) {
  return NextResponse.json({ error: message }, { status });
}

export function validationError(
  error: z.ZodError,
  message = "Invalid data",
) {
  return NextResponse.json(
    { error: message, issues: error.issues },
    { status: 400 },
  );
}

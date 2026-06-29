import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import {
  deleteDeepSeekKey,
  getDeepSeekKeyStatus,
  saveDeepSeekKey,
} from "@/lib/settings/deepseek-config";

const keySchema = z.object({
  apiKey: z.string().trim().min(8).max(500),
}).strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({
      data: await getDeepSeekKeyStatus(auth.db, auth.user.id),
    });
  } catch {
    return apiError("Failed to load DeepSeek key status", 500);
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }
  const parsed = keySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid DeepSeek key");
  }

  try {
    return NextResponse.json({
      data: await saveDeepSeekKey(auth.db, auth.user.id, parsed.data.apiKey),
    });
  } catch {
    return apiError("Failed to save DeepSeek key", 500);
  }
}

export async function DELETE() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({
      data: await deleteDeepSeekKey(auth.db, auth.user.id),
    });
  } catch {
    return apiError("Failed to delete DeepSeek key", 500);
  }
}

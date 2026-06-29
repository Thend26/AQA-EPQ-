import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import {
  getUserSettings,
  updateUserSettings,
} from "@/lib/repositories/settings";
import { userSettingsPatchSchema } from "@/lib/settings/schema";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await getUserSettings(auth.db, auth.user.id);
  if (error) return apiError("Failed to load settings", 500);

  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const parsed = userSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid settings");
  }

  const { data, error } = await updateUserSettings(
    auth.db,
    auth.user.id,
    parsed.data,
  );
  if (error) return apiError("Failed to update settings", 500);

  return NextResponse.json({ data });
}

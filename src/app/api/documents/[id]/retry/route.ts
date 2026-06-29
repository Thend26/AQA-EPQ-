import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError } from "@/lib/api/responses";
import { retryDocumentJob } from "@/lib/repositories/documents";

const idSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return apiError("Invalid document id", 400);

  const result = await retryDocumentJob(auth.db, auth.user.id, id.data);
  if (result.error) return apiError("Failed to retry document", 500);

  return NextResponse.json({ ok: true });
}

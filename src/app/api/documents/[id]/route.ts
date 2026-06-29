import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError } from "@/lib/api/responses";
import { markStudentDocumentDeleted } from "@/lib/repositories/documents";

const idSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return apiError("Invalid document id", 400);

  const { data, error, notFound } = await markStudentDocumentDeleted(
    auth.db,
    auth.user.id,
    id.data,
  );
  if (error) return apiError("Failed to delete document", 500);
  if (notFound || !data) return apiError("Document not found", 404);

  return NextResponse.json({ data });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError } from "@/lib/api/responses";
import { createSignedDownloadUrl } from "@/lib/documents/storage-service";
import { getDocumentForOwner } from "@/lib/repositories/documents";

const idSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return apiError("Invalid document id", 400);

  const { data, error } = await getDocumentForOwner(
    auth.db,
    auth.user.id,
    id.data,
  );
  if (error) return apiError("Failed to load document", 500);
  if (!data) return apiError("Document not found", 404);

  try {
    const url = await createSignedDownloadUrl(data.storagePath);
    return NextResponse.json({ url });
  } catch {
    return apiError("Failed to create download link", 500);
  }
}

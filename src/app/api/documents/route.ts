import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api/auth";
import { apiError, validationError } from "@/lib/api/responses";
import {
  validateDocumentMetadata,
} from "@/lib/documents/file-validation";
import { documentStoragePath } from "@/lib/documents/storage-path";
import {
  createStudentDocument,
  listStudentDocuments,
} from "@/lib/repositories/documents";

const querySchema = z.object({
  studentId: z.string().uuid(),
}).strict();

const createSchema = z.object({
  studentId: z.string().uuid(),
  campDay: z.number().int().min(1).max(100),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(200),
  byteSize: z.number().int().positive(),
  sha256: z.string().trim().min(3).max(128),
}).strict();

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    studentId: url.searchParams.get("studentId"),
  });
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid document query");
  }

  const { data, error } = await listStudentDocuments(
    auth.db,
    auth.user.id,
    parsed.data.studentId,
  );
  if (error) return apiError("Failed to list documents", 500);

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Invalid document metadata");
  }
  const validation = validateDocumentMetadata({
    filename: parsed.data.filename,
    mimeType: parsed.data.mimeType,
    size: parsed.data.byteSize,
  });
  if (!validation.ok) {
    return apiError(validation.error, 400);
  }

  const id = randomUUID();
  const storagePath = documentStoragePath({
    ownerId: auth.user.id,
    studentId: parsed.data.studentId,
    documentId: id,
    filename: parsed.data.filename,
  });
  const { data, error } = await createStudentDocument(auth.db, auth.user.id, {
    id,
    studentId: parsed.data.studentId,
    campDay: parsed.data.campDay,
    originalFilename: parsed.data.filename,
    storagePath,
    mimeType: parsed.data.mimeType,
    byteSize: parsed.data.byteSize,
    sha256: parsed.data.sha256,
  });
  if (error) return apiError("Failed to create document", 500);

  return NextResponse.json({ data, storagePath }, { status: 201 });
}

import { sanitizeFilename } from "@/lib/documents/file-validation";

export function documentStoragePath(input: {
  ownerId: string;
  studentId: string;
  documentId: string;
  filename: string;
}) {
  return [
    input.ownerId,
    input.studentId,
    input.documentId,
    sanitizeFilename(input.filename),
  ].join("/");
}

export function parseDocumentStoragePath(path: string) {
  if (path.includes("..")) return null;
  const parts = path.split("/");
  if (parts.length < 4 || parts.some((part) => part.trim() === "")) {
    return null;
  }
  const [ownerId, studentId, documentId] = parts;
  return { ownerId, studentId, documentId };
}

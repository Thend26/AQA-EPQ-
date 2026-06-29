import { z } from "zod";

export const documentStatusSchema = z.enum([
  "uploaded",
  "queued",
  "processing",
  "extracted",
  "failed",
  "deleted",
]);
export type DocumentStatus = z.output<typeof documentStatusSchema>;

export type StudentDocument = {
  id: string;
  ownerId: string;
  studentId: string;
  campDay: number;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  status: DocumentStatus;
  extractedText: string | null;
  extractionError: string | null;
  createdAt: string;
  updatedAt: string;
};

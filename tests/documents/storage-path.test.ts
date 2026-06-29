import { expect, test } from "vitest";

import {
  documentStoragePath,
  parseDocumentStoragePath,
} from "@/lib/documents/storage-path";

test("builds owner/student/day scoped private storage paths", () => {
  const path = documentStoragePath({
    ownerId: "owner-123",
    studentId: "student-456",
    documentId: "doc-789",
    filename: "研究 计划.pdf",
  });

  expect(path).toBe("owner-123/student-456/doc-789/研究_计划.pdf");
  expect(parseDocumentStoragePath(path)).toEqual({
    ownerId: "owner-123",
    studentId: "student-456",
    documentId: "doc-789",
  });
});

test("rejects malformed storage paths", () => {
  expect(parseDocumentStoragePath("owner/doc.pdf")).toBeNull();
  expect(parseDocumentStoragePath("../owner/student/doc/file.pdf")).toBeNull();
});

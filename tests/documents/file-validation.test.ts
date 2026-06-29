import { describe, expect, test } from "vitest";

import {
  MAX_DOCUMENT_BYTES,
  sanitizeFilename,
  validateDocumentMetadata,
  validateMagicBytes,
} from "@/lib/documents/file-validation";

describe("student document validation", () => {
  test("accepts supported extensions and the 25MB boundary", () => {
    for (const name of [
      "proposal.pdf",
      "notes.docx",
      "draft.doc",
      "table.xlsx",
      "slides.pptx",
      "reflection.txt",
      "photo.png",
      "scan.jpg",
    ]) {
      expect(
        validateDocumentMetadata({
          filename: name,
          mimeType: "application/octet-stream",
          size: MAX_DOCUMENT_BYTES,
        }).ok,
      ).toBe(true);
    }
  });

  test("rejects oversized, unsafe, and unsupported metadata", () => {
    expect(
      validateDocumentMetadata({
        filename: "../secret.pdf",
        mimeType: "application/pdf",
        size: 100,
      }).ok,
    ).toBe(false);
    expect(
      validateDocumentMetadata({
        filename: "video.mp4",
        mimeType: "video/mp4",
        size: 100,
      }).ok,
    ).toBe(false);
    expect(
      validateDocumentMetadata({
        filename: "large.pdf",
        mimeType: "application/pdf",
        size: MAX_DOCUMENT_BYTES + 1,
      }).ok,
    ).toBe(false);
  });

  test("checks common magic bytes", () => {
    expect(validateMagicBytes("paper.pdf", bytes("%PDF-1.7")).ok).toBe(true);
    expect(validateMagicBytes("notes.docx", zipBytes()).ok).toBe(true);
    expect(validateMagicBytes("draft.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])).ok).toBe(true);
    expect(validateMagicBytes("photo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47])).ok).toBe(true);
    expect(validateMagicBytes("scan.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])).ok).toBe(true);
    expect(validateMagicBytes("fake.pdf", bytes("not pdf")).ok).toBe(false);
  });

  test("sanitizes filenames for display and storage", () => {
    expect(sanitizeFilename("  学生/文档?.pdf  ")).toBe("学生_文档_.pdf");
    expect(sanitizeFilename("")).toBe("document");
  });
});

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function zipBytes() {
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
}

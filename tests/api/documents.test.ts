import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  requireUser,
  listStudentDocuments,
  createStudentDocument,
  retryDocumentJob,
  getDocumentForOwner,
  markStudentDocumentDeleted,
  createSignedDownloadUrl,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  listStudentDocuments: vi.fn(),
  createStudentDocument: vi.fn(),
  retryDocumentJob: vi.fn(),
  getDocumentForOwner: vi.fn(),
  markStudentDocumentDeleted: vi.fn(),
  createSignedDownloadUrl: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireUser }));
vi.mock("@/lib/repositories/documents", () => ({
  listStudentDocuments,
  createStudentDocument,
  retryDocumentJob,
  getDocumentForOwner,
  markStudentDocumentDeleted,
}));
vi.mock("@/lib/documents/storage-service", () => ({
  createSignedDownloadUrl,
}));

import { GET, POST } from "@/app/api/documents/route";
import { DELETE } from "@/app/api/documents/[id]/route";
import { GET as DOWNLOAD } from "@/app/api/documents/[id]/download/route";
import { POST as RETRY } from "@/app/api/documents/[id]/retry/route";

const studentId = "123e4567-e89b-42d3-a456-426614174000";
const documentId = "223e4567-e89b-42d3-a456-426614174000";
const document = {
  id: documentId,
  ownerId: "owner-123",
  studentId,
  campDay: 3,
  originalFilename: "proposal.pdf",
  storagePath: `owner-123/${studentId}/${documentId}/proposal.pdf`,
  mimeType: "application/pdf",
  byteSize: 1000,
  sha256: "abc",
  status: "uploaded",
  extractedText: null,
  extractionError: null,
  createdAt: "2026-06-29T10:00:00.000Z",
  updatedAt: "2026-06-29T10:00:00.000Z",
};

const context = { params: Promise.resolve({ id: documentId }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({
    ok: true,
    db: { marker: "db" },
    user: { id: "owner-123" },
  });
});

describe("document API", () => {
  test("lists documents for an owned student", async () => {
    listStudentDocuments.mockResolvedValue({ data: [document], error: null });

    const response = await GET(
      new Request(`https://app.example/api/documents?studentId=${studentId}`),
    );

    expect(response.status).toBe(200);
    expect(listStudentDocuments).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      studentId,
    );
  });

  test("creates document metadata for a validated upload", async () => {
    createStudentDocument.mockResolvedValue({ data: document, error: null });

    const response = await POST(
      new Request("https://app.example/api/documents", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          campDay: 3,
          filename: "proposal.pdf",
          mimeType: "application/pdf",
          byteSize: 1000,
          sha256: "abc",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toMatchObject({ id: documentId });
    expect(body.storagePath).toContain("proposal.pdf");
    expect(createStudentDocument).toHaveBeenCalledWith(
      expect.anything(),
      "owner-123",
      expect.objectContaining({
        studentId,
        campDay: 3,
        originalFilename: "proposal.pdf",
      }),
    );
  });

  test("returns a signed download URL", async () => {
    getDocumentForOwner.mockResolvedValue({ data: document, error: null });
    createSignedDownloadUrl.mockResolvedValue("https://signed.example/file");

    const response = await DOWNLOAD(
      new Request(`https://app.example/api/documents/${documentId}/download`),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://signed.example/file",
    });
  });

  test("retries and deletes documents", async () => {
    retryDocumentJob.mockResolvedValue({ ok: true });
    markStudentDocumentDeleted.mockResolvedValue({
      data: document,
      error: null,
      notFound: false,
    });

    expect(
      (
        await RETRY(
          new Request(`https://app.example/api/documents/${documentId}/retry`, {
            method: "POST",
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect((await DELETE(new Request("https://app.example"), context)).status).toBe(200);
  });
});

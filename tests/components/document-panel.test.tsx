import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

const upload = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ upload }),
    },
  }),
}));

import { DocumentPanel } from "@/components/documents/document-panel";

afterEach(() => {
  vi.restoreAllMocks();
  upload.mockReset();
});

test("uploads a selected document and refreshes the list", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { id: "doc-1", originalFilename: "proposal.pdf", status: "uploaded" },
          storagePath: "owner/student/doc-1/proposal.pdf",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: "doc-1", originalFilename: "proposal.pdf", status: "uploaded" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  upload.mockResolvedValue({ data: {}, error: null });

  render(<DocumentPanel studentId="student-1" campDay={3} />);

  await user.upload(
    screen.getByLabelText("上传学生文档"),
    new File(["%PDF-1.7"], "proposal.pdf", { type: "application/pdf" }),
  );
  await user.click(screen.getByRole("button", { name: "上传文档" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/documents",
    expect.objectContaining({ method: "POST" }),
  );
  expect(upload).toHaveBeenCalledWith(
    "owner/student/doc-1/proposal.pdf",
    expect.any(File),
    expect.objectContaining({ upsert: false }),
  );
  expect(await screen.findByText("proposal.pdf")).toBeInTheDocument();
});

test("disables upload before camp starts", () => {
  render(<DocumentPanel studentId="student-1" campDay={null} />);

  expect(screen.getByLabelText("上传学生文档")).toBeDisabled();
  expect(screen.getByRole("button", { name: "上传文档" })).toBeDisabled();
});

test("generates and applies AO observation suggestions", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: "doc-1", originalFilename: "proposal.pdf", status: "extracted" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            ao1: {
              suggestedNote: "AO1 建议",
              evidenceQuotes: ["证据"],
              confidence: "medium",
              caution: "",
            },
            ao2: {
              suggestedNote: "AO2 建议",
              evidenceQuotes: [],
              confidence: "low",
              caution: "谨慎",
            },
            ao3: {
              suggestedNote: "AO3 建议",
              evidenceQuotes: [],
              confidence: "medium",
              caution: "",
            },
            ao4: {
              suggestedNote: "AO4 建议",
              evidenceQuotes: [],
              confidence: "medium",
              caution: "",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

  render(
    <DocumentPanel
      studentId="student-1"
      campDay={3}
      recordDate="2026-07-18"
      existingAoNotes={{}}
      onApplyAoSuggestions={onApply}
    />,
  );

  await user.click(await screen.findByRole("button", { name: "生成 AO 观察建议" }));
  await user.click(await screen.findByRole("button", { name: "应用选中 AO 备注" }));

  expect(fetch).toHaveBeenCalledWith(
    "/api/ao-analysis",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        studentId: "student-1",
        recordDate: "2026-07-18",
      }),
    }),
  );
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({ ao1Note: "AO1 建议" }),
  );
});

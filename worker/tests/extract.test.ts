import assert from "node:assert/strict";
import { test } from "node:test";

import { extractTextFromBuffer, ExtractionError } from "../src/extract.ts";

const encoder = new TextEncoder();

test("extracts and normalizes UTF-8 text documents", async () => {
  const result = await extractTextFromBuffer({
    bytes: encoder.encode("  EPQ   question\n\nResearch   log  "),
    filename: "student-notes.txt",
    mimeType: "text/plain",
  });

  assert.equal(result.format, "text");
  assert.equal(result.text, "EPQ question\nResearch log");
  assert.equal(result.truncated, false);
});

test("extracts visible text from a text-based PDF buffer", async () => {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Page >>
stream
BT
(EPQ sample PDF) Tj
(AO1 planning evidence) Tj
ET
endstream
endobj`;

  const result = await extractTextFromBuffer({
    bytes: encoder.encode(pdf),
    filename: "sample.pdf",
    mimeType: "application/pdf",
  });

  assert.equal(result.format, "pdf");
  assert.match(result.text, /EPQ sample PDF/);
  assert.match(result.text, /AO1 planning evidence/);
});

test("extracts office XML text for docx xlsx and pptx uploads", async () => {
  const cases = [
    ["draft.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["tracker.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ] as const;

  for (const [filename, mimeType] of cases) {
    const result = await extractTextFromBuffer({
      bytes: encoder.encode("<w:t>Research question</w:t><w:t>method notes</w:t>"),
      filename,
      mimeType,
    });

    assert.equal(result.format, "ooxml");
    assert.equal(result.text, "Research question method notes");
  }
});

test("fails image extraction clearly when OCR is unavailable", async () => {
  await assert.rejects(
    extractTextFromBuffer({
      bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
      filename: "scan.png",
      mimeType: "image/png",
      ocrEnabled: false,
    }),
    (error) => error instanceof ExtractionError && error.code === "OCR_UNAVAILABLE",
  );
});

test("truncates extracted text to the configured maximum", async () => {
  const result = await extractTextFromBuffer({
    bytes: encoder.encode("A".repeat(210_000)),
    filename: "long.txt",
    mimeType: "text/plain",
    maxCharacters: 1_000,
  });

  assert.equal(result.text.length, 1_000);
  assert.equal(result.truncated, true);
});

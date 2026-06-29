import { normalizeExtractedText } from "./text.ts";

function unescapePdfString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

export function extractPdfText(raw: string): string {
  const literalStrings = [...raw.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)].map((match) =>
    unescapePdfString(match[0].replace(/\)\s*Tj$/, "").slice(1)),
  );

  if (literalStrings.length > 0) {
    return normalizeExtractedText(literalStrings.join("\n"));
  }

  const printable = raw
    .replace(/%PDF-\d\.\d/g, " ")
    .replace(/\b(?:obj|endobj|stream|endstream|xref|trailer|startxref|BT|ET)\b/g, " ")
    .replace(/[^\x20-\x7e\n]+/g, " ");

  return normalizeExtractedText(printable);
}

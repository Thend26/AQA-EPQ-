export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const supported = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
]);

export type ValidationResult = { ok: true } | { ok: false; error: string };

function extension(filename: string) {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : "";
}

export function sanitizeFilename(filename: string) {
  const sanitized = filename
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_");
  return sanitized || "document";
}

export function validateDocumentMetadata(input: {
  filename: string;
  mimeType: string;
  size: number;
}): ValidationResult {
  const safeName = sanitizeFilename(input.filename);
  if (safeName !== input.filename.trim() || safeName.includes("..")) {
    return { ok: false, error: "Unsafe filename" };
  }
  if (!supported.has(extension(safeName))) {
    return { ok: false, error: "Unsupported file type" };
  }
  if (!Number.isInteger(input.size) || input.size < 1 || input.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "File size must be between 1 byte and 25 MB" };
  }
  return { ok: true };
}

export function validateMagicBytes(
  filename: string,
  bytes: Uint8Array,
): ValidationResult {
  const ext = extension(filename);
  const starts = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  const text = new TextDecoder().decode(bytes.slice(0, 8));

  if (ext === "txt") return { ok: true };
  if (ext === "pdf") return text.startsWith("%PDF") ? { ok: true } : badMagic();
  if (["docx", "xlsx", "pptx"].includes(ext)) {
    return starts(0x50, 0x4b, 0x03, 0x04) ||
      starts(0x50, 0x4b, 0x05, 0x06) ||
      starts(0x50, 0x4b, 0x07, 0x08)
      ? { ok: true }
      : badMagic();
  }
  if (["doc", "xls", "ppt"].includes(ext)) {
    return starts(0xd0, 0xcf, 0x11, 0xe0) ? { ok: true } : badMagic();
  }
  if (ext === "png") {
    return starts(0x89, 0x50, 0x4e, 0x47) ? { ok: true } : badMagic();
  }
  if (ext === "jpg" || ext === "jpeg") {
    return starts(0xff, 0xd8, 0xff) ? { ok: true } : badMagic();
  }
  return { ok: false, error: "Unsupported file type" };
}

function badMagic(): ValidationResult {
  return { ok: false, error: "File content does not match extension" };
}

import { extname } from "node:path";

import { extractOfficeXmlText } from "./extractors/ooxml.ts";
import { extractPdfText } from "./extractors/pdf.ts";
import { decodeUtf8, normalizeExtractedText } from "./extractors/text.ts";

export type ExtractedDocumentFormat =
  | "text"
  | "pdf"
  | "ooxml"
  | "image"
  | "legacy-office"
  | "unknown";

export type ExtractionErrorCode =
  | "EMPTY_DOCUMENT"
  | "OCR_UNAVAILABLE"
  | "LIBREOFFICE_UNAVAILABLE"
  | "UNSUPPORTED_FORMAT"
  | "NO_EXTRACTABLE_TEXT";

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;

  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ExtractionError";
  }
}

export type ExtractTextInput = {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  ocrEnabled?: boolean;
  maxCharacters?: number;
};

export type ExtractTextResult = {
  text: string;
  format: ExtractedDocumentFormat;
  truncated: boolean;
};

const DEFAULT_MAX_CHARACTERS = 200_000;

const OOXML_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const LEGACY_OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

function identifyFormat(filename: string, mimeType: string): ExtractedDocumentFormat {
  const extension = extname(filename).toLowerCase();

  if (mimeType === "text/plain" || extension === ".txt") {
    return "text";
  }

  if (mimeType === "application/pdf" || extension === ".pdf") {
    return "pdf";
  }

  if (OOXML_MIME_TYPES.has(mimeType) || [".docx", ".xlsx", ".pptx"].includes(extension)) {
    return "ooxml";
  }

  if (LEGACY_OFFICE_MIME_TYPES.has(mimeType) || [".doc", ".xls", ".ppt"].includes(extension)) {
    return "legacy-office";
  }

  if (IMAGE_MIME_TYPES.has(mimeType) || [".png", ".jpg", ".jpeg"].includes(extension)) {
    return "image";
  }

  return "unknown";
}

function limitText(text: string, maxCharacters: number): Pick<ExtractTextResult, "text" | "truncated"> {
  if (text.length <= maxCharacters) {
    return { text, truncated: false };
  }

  return { text: text.slice(0, maxCharacters), truncated: true };
}

export async function extractTextFromBuffer(input: ExtractTextInput): Promise<ExtractTextResult> {
  if (input.bytes.byteLength === 0) {
    throw new ExtractionError("EMPTY_DOCUMENT", "文件为空，无法解析。");
  }

  const format = identifyFormat(input.filename, input.mimeType);
  const raw = decodeUtf8(input.bytes);
  let text = "";

  switch (format) {
    case "text":
      text = normalizeExtractedText(raw);
      break;
    case "pdf":
      text = extractPdfText(raw);
      break;
    case "ooxml":
      text = extractOfficeXmlText(raw);
      break;
    case "image":
      if (!input.ocrEnabled) {
        throw new ExtractionError("OCR_UNAVAILABLE", "图片或扫描件需要启用 OCR 后才能解析。");
      }
      throw new ExtractionError("OCR_UNAVAILABLE", "OCR 执行器尚未配置。");
    case "legacy-office":
      throw new ExtractionError(
        "LIBREOFFICE_UNAVAILABLE",
        "旧版 Office 文件需要 LibreOffice 转换服务后才能解析。",
      );
    case "unknown":
      throw new ExtractionError("UNSUPPORTED_FORMAT", "暂不支持该文件格式。");
  }

  const normalized = normalizeExtractedText(text);

  if (!normalized) {
    throw new ExtractionError("NO_EXTRACTABLE_TEXT", "没有从文件中解析到可用文本。");
  }

  return {
    format,
    ...limitText(normalized, input.maxCharacters ?? DEFAULT_MAX_CHARACTERS),
  };
}

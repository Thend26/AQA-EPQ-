import { normalizeExtractedText, stripXmlTags } from "./text.ts";

export function extractOfficeXmlText(raw: string): string {
  return normalizeExtractedText(stripXmlTags(raw).replace(/\s+/g, " "));
}

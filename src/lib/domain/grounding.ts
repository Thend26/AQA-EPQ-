type GroundingRecord = {
  id: string;
  achievements: string;
  evidence: string;
  processNotes: string;
  ao1Note: string;
  ao2Note: string;
  ao3Note: string;
  ao4Note: string;
  nextPlan: string;
};

const EVIDENCE_FIELDS = [
  "achievements",
  "evidence",
  "processNotes",
  "ao1Note",
  "ao2Note",
  "ao3Note",
  "ao4Note",
  "nextPlan",
] as const satisfies readonly (keyof GroundingRecord)[];

export type EvidenceCorpusEntry = {
  id: string;
  text: string;
};

function normalizedText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function compactText(value: string) {
  return normalizedText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function evidenceText(value: string) {
  return value.replace(/^\s*\[([^\]]+)\]\s*/u, "").trim();
}

function sourceMarker(value: string) {
  return value.match(/^\s*\[([^\]]+)\]/u)?.[1];
}

function tokens(value: string) {
  const normalized = normalizedText(value);
  const latinAndNumberTokens =
    normalized.match(/[\p{Script=Latin}\p{N}]+/gu) ?? [];
  const hanRuns = normalized.match(/\p{Script=Han}+/gu) ?? [];
  const hanBigrams = hanRuns.flatMap((run) => {
    if (run.length === 1) return [run];
    return Array.from(
      { length: run.length - 1 },
      (_, index) => run.slice(index, index + 2),
    );
  });
  return [...new Set([...latinAndNumberTokens, ...hanBigrams])];
}

function matchesEvidence(evidence: string, source: string) {
  const evidenceCompact = compactText(evidence);
  const sourceCompact = compactText(source);
  if (!evidenceCompact || !sourceCompact) return false;
  if (
    sourceCompact.includes(evidenceCompact) ||
    evidenceCompact.includes(sourceCompact)
  ) {
    return true;
  }

  const evidenceTokens = tokens(evidence);
  if (evidenceTokens.length < 2) return false;
  const sourceTokens = new Set(tokens(source));
  const overlap = evidenceTokens.filter((token) =>
    sourceTokens.has(token),
  ).length;
  return overlap >= 2 && overlap / evidenceTokens.length >= 0.65;
}

export function buildEvidenceCorpus(
  records: readonly GroundingRecord[],
): EvidenceCorpusEntry[] {
  return records.flatMap((record) =>
    EVIDENCE_FIELDS.flatMap((field) => {
      const text = record[field].trim();
      return text ? [{ id: `${record.id}:${field}`, text }] : [];
    }),
  );
}

export function mapEvidenceToCanonicalIds(
  evidenceItems: readonly string[],
  corpus: readonly EvidenceCorpusEntry[],
) {
  const ids = new Set<string>();
  const unsupported: string[] = [];

  for (const item of evidenceItems) {
    const marker = sourceMarker(item);
    const text = evidenceText(item);
    const candidates = marker
      ? corpus.filter((entry) => entry.id === marker)
      : corpus;
    const match = candidates.find((entry) =>
      matchesEvidence(text, entry.text),
    );
    if (match) ids.add(match.id);
    else unsupported.push(item);
  }

  return { ids: [...ids].toSorted(), unsupported };
}

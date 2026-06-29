"use client";

import { useState } from "react";

import type { AoAnalysisResponse, AoKey } from "@/lib/documents/ao-schema";

export type AoNotePatch = Partial<{
  ao1Note: string;
  ao2Note: string;
  ao3Note: string;
  ao4Note: string;
}>;

type AoAnalysisReviewProps = {
  analysis: AoAnalysisResponse;
  existingNotes: AoNotePatch;
  onApply: (patch: AoNotePatch) => void;
};

const aoItems = [
  ["ao1", "AO1", "ao1Note"],
  ["ao2", "AO2", "ao2Note"],
  ["ao3", "AO3", "ao3Note"],
  ["ao4", "AO4", "ao4Note"],
] as const;

export function AoAnalysisReview({
  analysis,
  existingNotes,
  onApply,
}: AoAnalysisReviewProps) {
  const [selected, setSelected] = useState<Record<AoKey, boolean>>({
    ao1: true,
    ao2: true,
    ao3: true,
    ao4: true,
  });
  const [notes, setNotes] = useState<Record<AoKey, string>>({
    ao1: analysis.ao1.suggestedNote,
    ao2: analysis.ao2.suggestedNote,
    ao3: analysis.ao3.suggestedNote,
    ao4: analysis.ao4.suggestedNote,
  });

  function apply() {
    const patch: AoNotePatch = {};
    const overwrites: string[] = [];

    for (const [aoKey, label, noteKey] of aoItems) {
      if (!selected[aoKey]) continue;
      const nextNote = notes[aoKey].trim();
      if (!nextNote) continue;
      if (existingNotes[noteKey]?.trim()) {
        overwrites.push(label);
      }
      patch[noteKey] = nextNote;
    }

    if (
      overwrites.length > 0 &&
      !window.confirm(`以下备注已有内容，是否覆盖：${overwrites.join("、")}？`)
    ) {
      return;
    }

    onApply(patch);
  }

  return (
    <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <h3 className="font-semibold text-blue-950">AO 观察建议</h3>
      <p className="mt-1 text-sm text-blue-800">
        AI 建议仅作助教观察草稿，请结合现场过程判断后再采用。
      </p>
      <div className="mt-3 space-y-3">
        {aoItems.map(([aoKey, label]) => {
          const suggestion = analysis[aoKey];
          return (
            <article key={aoKey} className="rounded-xl bg-white p-3 shadow-sm">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={selected[aoKey]}
                  onChange={(event) =>
                    setSelected((current) => ({
                      ...current,
                      [aoKey]: event.target.checked,
                    }))
                  }
                />
                采用 {label}
              </label>
              <label className="mt-2 block text-sm">
                编辑 {label} 建议
                <textarea
                  aria-label={`编辑 ${label} 建议`}
                  value={notes[aoKey]}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [aoKey]: event.target.value,
                    }))
                  }
                  maxLength={2_000}
                />
              </label>
              <p className="mt-2 text-xs text-stone-600">
                置信度：{suggestion.confidence}
              </p>
              {suggestion.evidenceQuotes.length > 0 ? (
                <p className="mt-1 text-xs text-stone-600">
                  证据：{suggestion.evidenceQuotes.join("；")}
                </p>
              ) : null}
              {suggestion.caution ? (
                <p className="mt-1 text-xs text-amber-700">
                  谨慎提示：{suggestion.caution}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-4 rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white"
        onClick={apply}
      >
        应用选中 AO 备注
      </button>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";

import { LanguageSwitcher } from "@/components/feedback/language-switcher";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import { checkFeedbackQuality } from "@/lib/domain/quality";
import type { LanguageMode } from "@/lib/domain/types";

type FeedbackAssistantProps = {
  contextSummary: string;
  initialDraft: GeneratedFeedback;
  initialRevision?: number;
  hasExistingFeedback?: boolean;
  generate?: (mode: LanguageMode) => Promise<{
    draft: GeneratedFeedback;
    revision: number;
  }>;
  revise?: (
    instruction: string,
    draft: GeneratedFeedback,
    expectedRevision: number,
  ) => Promise<{ draft: GeneratedFeedback; revision: number }>;
  finalize?: (
    draft: GeneratedFeedback,
    expectedRevision: number,
  ) => Promise<{ revision: number } | void>;
};

export function FeedbackAssistant({
  contextSummary,
  initialDraft,
  initialRevision = 0,
  hasExistingFeedback,
  generate,
  revise,
  finalize,
}: FeedbackAssistantProps) {
  const initialHasContent =
    ("zh" in initialDraft &&
      Boolean(
        initialDraft.zh.content ||
          initialDraft.zh.nextStep ||
          initialDraft.zh.evidenceUsed.length,
      )) ||
    ("en" in initialDraft &&
      Boolean(
        initialDraft.en.content ||
          initialDraft.en.nextStep ||
          initialDraft.en.evidenceUsed.length,
      ));
  const [mode, setMode] = useState<LanguageMode>(initialDraft.mode);
  const [localized, setLocalized] = useState(() => ({
    zh:
      "zh" in initialDraft
        ? initialDraft.zh
        : { content: "", evidenceUsed: [], nextStep: "" },
    en:
      "en" in initialDraft
        ? initialDraft.en
        : { content: "", evidenceUsed: [], nextStep: "" },
  }));
  const [revision, setRevision] = useState(initialRevision);
  const [activeLanguage, setActiveLanguage] = useState<"zh" | "en">(
    initialDraft.mode === "en" ? "en" : "zh",
  );
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState<
    "generate" | "revise" | "finalize" | null
  >(null);
  const [error, setError] = useState("");
  const [finalized, setFinalized] = useState(false);
  const [generated, setGenerated] = useState(
    hasExistingFeedback ?? initialHasContent,
  );
  const draft = useMemo<GeneratedFeedback>(() => {
    if (mode === "zh") return { mode, zh: localized.zh };
    if (mode === "en") return { mode, en: localized.en };
    return { mode, zh: localized.zh, en: localized.en };
  }, [localized, mode]);
  const immutable = pending !== null || finalized;
  const issues = useMemo(
    () => (generated ? checkFeedbackQuality(draft) : []),
    [draft, generated],
  );
  const visibleLanguage =
    mode === "bilingual"
      ? activeLanguage
      : mode === "en"
        ? "en"
        : "zh";

  function updateContent(content: string) {
    setLocalized((current) => ({
      ...current,
      [visibleLanguage]: { ...current[visibleLanguage], content },
    }));
  }

  function updateNextStep(nextStep: string) {
    setLocalized((current) => ({
      ...current,
      [visibleLanguage]: { ...current[visibleLanguage], nextStep },
    }));
  }

  const visibleDraft = localized[visibleLanguage];

  function acceptGenerated(next: GeneratedFeedback) {
    setMode(next.mode);
    setLocalized((current) => ({
      zh: "zh" in next ? next.zh : current.zh,
      en: "en" in next ? next.en : current.en,
    }));
    setActiveLanguage(next.mode === "en" ? "en" : "zh");
    setGenerated(true);
  }

  async function run(
    kind: "generate" | "revise" | "finalize",
    action: () => Promise<void>,
  ) {
    setError("");
    setPending(kind);
    try {
      await action();
    } catch (error) {
      const conflict =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 409;
      setError(
        conflict
          ? "草稿已在其他位置更新，请刷新后重试；当前草稿已保留"
          : kind === "generate"
            ? "生成失败，当前草稿已保留"
            : kind === "revise"
              ? "修改失败，当前草稿已保留"
              : "归档失败，当前草稿已保留",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-label="AI 反馈助手" className="space-y-5">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <h2 className="font-semibold text-emerald-950">AI 反馈助手</h2>
        <p className="mt-1 text-sm leading-6 text-emerald-800">
          {contextSummary}
        </p>
      </div>

      <LanguageSwitcher
        mode={mode}
        active={activeLanguage}
        canChangeMode={!generated}
        disabled={immutable}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          if (nextMode !== "bilingual") {
            setActiveLanguage(nextMode);
          }
        }}
        onActiveChange={setActiveLanguage}
      />

      <label className="block">
        {visibleLanguage === "zh" ? "中文反馈" : "English feedback"}
        <textarea
          aria-label={
            visibleLanguage === "zh" ? "中文反馈" : "English feedback"
          }
          value={visibleDraft.content}
          disabled={immutable}
          onChange={(event) => updateContent(event.target.value)}
          maxLength={12000}
        />
      </label>

      <label className="block">
        {visibleLanguage === "zh" ? "下一步建议" : "Next step"}
        <textarea
          value={visibleDraft.nextStep}
          disabled={immutable}
          aria-label={
            visibleLanguage === "zh" ? "下一步建议" : "Next step"
          }
          onChange={(event) => updateNextStep(event.target.value)}
          maxLength={4000}
        />
      </label>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">引用证据</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-600">
          {visibleDraft.evidenceUsed.map((evidence, index) => (
            <li key={`${index}:${evidence}`}>{evidence}</li>
          ))}
        </ul>
      </div>

      {issues.length > 0 ? (
        <div
          aria-label="质量问题"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <h3 className="font-semibold text-amber-900">归档前需处理</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block">
        修改要求
        <textarea
          value={instruction}
          disabled={immutable}
          onChange={(event) => setInstruction(event.target.value)}
          maxLength={2000}
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="text-sm text-stone-600" role="status">
          请求处理中
        </p>
      ) : null}
      {finalized ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          已归档
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
        <button
          aria-busy={pending === "generate"}
          type="button"
          className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900"
          disabled={immutable || !generate}
          onClick={() =>
            run("generate", async () => {
              if (generate) {
                const result = await generate(mode);
                acceptGenerated(result.draft);
                setRevision(result.revision);
              }
            })
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            {pending === "generate" ? <LoadingSpinner size="sm" /> : null}
            <span>{pending === "generate" ? "生成中…" : "生成反馈"}</span>
          </span>
        </button>
        <button
          aria-busy={pending === "revise"}
          type="button"
          className="min-h-11 rounded-xl border border-emerald-700 bg-white px-4 py-2.5 font-semibold text-emerald-800 hover:bg-emerald-50"
          disabled={
            immutable || !revise || instruction.trim().length === 0
          }
          onClick={() =>
            run("revise", async () => {
              if (!revise) return;
              const revised = await revise(
                instruction.trim(),
                draft,
                revision,
              );
              acceptGenerated(revised.draft);
              setRevision(revised.revision);
              setInstruction("");
            })
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            {pending === "revise" ? <LoadingSpinner size="sm" /> : null}
            <span>
              {pending === "revise" ? "修改中…" : "发送修改要求"}
            </span>
          </span>
        </button>
        <button
          aria-busy={pending === "finalize"}
          type="button"
          className="min-h-11 rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white hover:bg-orange-600"
          disabled={immutable || !finalize || issues.length > 0}
          onClick={() =>
            run("finalize", async () => {
              if (finalize) {
                const finalized = await finalize(draft, revision);
                if (finalized) {
                  setRevision(finalized.revision);
                }
                setFinalized(true);
              }
            })
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            {pending === "finalize" ? <LoadingSpinner size="sm" /> : null}
            <span>{pending === "finalize" ? "归档中…" : "确认归档"}</span>
          </span>
        </button>
      </div>
    </section>
  );
}

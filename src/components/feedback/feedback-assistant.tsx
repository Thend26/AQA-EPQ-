"use client";

import { useMemo, useState } from "react";

import { LanguageSwitcher } from "@/components/feedback/language-switcher";
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
    <section aria-label="AI 反馈助手" className="space-y-4">
      <div>
        <h2>上下文摘要</h2>
        <p>{contextSummary}</p>
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

      <div>
        <h3>引用证据</h3>
        <ul>
          {visibleDraft.evidenceUsed.map((evidence, index) => (
            <li key={`${index}:${evidence}`}>{evidence}</li>
          ))}
        </ul>
      </div>

      {issues.length > 0 ? (
        <div aria-label="质量问题">
          <h3>归档前需处理</h3>
          <ul>
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

      {error ? <p role="alert">{error}</p> : null}
      {pending ? <p role="status">请求处理中</p> : null}
      {finalized ? <p role="status">已归档</p> : null}

      <div>
        <button
          type="button"
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
          {pending === "generate" ? "生成中…" : "生成反馈"}
        </button>
        <button
          type="button"
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
          {pending === "revise" ? "修改中…" : "发送修改要求"}
        </button>
        <button
          type="button"
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
          {pending === "finalize" ? "归档中…" : "确认归档"}
        </button>
      </div>
    </section>
  );
}

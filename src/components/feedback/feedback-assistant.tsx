"use client";

import { useMemo, useState } from "react";

import { LanguageSwitcher } from "@/components/feedback/language-switcher";
import type { GeneratedFeedback } from "@/lib/deepseek/schema";
import { checkFeedbackQuality } from "@/lib/domain/quality";

type FeedbackAssistantProps = {
  contextSummary: string;
  initialDraft: GeneratedFeedback;
  initialRevision?: number;
  generate?: () => Promise<{
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
  generate,
  revise,
  finalize,
}: FeedbackAssistantProps) {
  const [draft, setDraft] = useState(initialDraft);
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
  const immutable = pending !== null || finalized;
  const issues = useMemo(() => checkFeedbackQuality(draft), [draft]);
  const visibleLanguage =
    draft.mode === "bilingual"
      ? activeLanguage
      : draft.mode === "en"
        ? "en"
        : "zh";

  function updateContent(content: string) {
    if (visibleLanguage === "zh" && draft.mode !== "en") {
      setDraft({ ...draft, zh: { ...draft.zh, content } });
    } else if (visibleLanguage === "en" && draft.mode !== "zh") {
      setDraft({ ...draft, en: { ...draft.en, content } });
    }
  }

  function updateNextStep(nextStep: string) {
    if (visibleLanguage === "zh" && draft.mode !== "en") {
      setDraft({ ...draft, zh: { ...draft.zh, nextStep } });
    } else if (visibleLanguage === "en" && draft.mode !== "zh") {
      setDraft({ ...draft, en: { ...draft.en, nextStep } });
    }
  }

  const visibleDraft =
    visibleLanguage === "zh" && draft.mode !== "en"
      ? draft.zh
      : draft.mode !== "zh"
        ? draft.en
        : draft.zh;

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
        mode={draft.mode}
        active={activeLanguage}
        disabled={immutable}
        onChange={setActiveLanguage}
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
                const generated = await generate();
                setDraft(generated.draft);
                setRevision(generated.revision);
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
              setDraft(revised.draft);
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

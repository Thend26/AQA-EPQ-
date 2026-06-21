"use client";

import type { LanguageMode } from "@/lib/domain/types";

type LanguageSwitcherProps = {
  mode: LanguageMode;
  active: "zh" | "en";
  canChangeMode: boolean;
  disabled?: boolean;
  onModeChange: (mode: LanguageMode) => void;
  onActiveChange: (language: "zh" | "en") => void;
};

export function LanguageSwitcher({
  mode,
  active,
  canChangeMode,
  disabled = false,
  onModeChange,
  onActiveChange,
}: LanguageSwitcherProps) {
  return (
    <div className="space-y-2">
      {canChangeMode ? (
        <fieldset disabled={disabled}>
          <legend>选择反馈输出语言</legend>
          {(
            [
              ["zh", "中文"],
              ["en", "英文"],
              ["bilingual", "中英双语"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={mode === value}
              type="button"
              onClick={() => onModeChange(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      ) : null}
      {mode === "bilingual" ? (
        <fieldset disabled={disabled}>
          <legend>切换双语内容</legend>
          <button
            aria-pressed={active === "zh"}
            type="button"
            onClick={() => onActiveChange("zh")}
          >
            中文内容
          </button>
          <button
            aria-pressed={active === "en"}
            type="button"
            onClick={() => onActiveChange("en")}
          >
            英文内容
          </button>
        </fieldset>
      ) : null}
    </div>
  );
}

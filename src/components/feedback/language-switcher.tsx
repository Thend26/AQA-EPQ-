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
        <fieldset disabled={disabled} className="space-y-2">
          <legend className="font-medium">选择反馈输出语言</legend>
          <div className="grid grid-cols-3 gap-2">
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
              className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                mode === value
                  ? "border-emerald-700 bg-emerald-800 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:border-emerald-500"
              }`}
              type="button"
              onClick={() => onModeChange(value)}
            >
              {label}
            </button>
          ))}
          </div>
        </fieldset>
      ) : null}
      {mode === "bilingual" ? (
        <fieldset disabled={disabled} className="space-y-2">
          <legend className="font-medium">切换双语内容</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              aria-pressed={active === "zh"}
              className={`rounded-lg px-3 py-2 text-sm ${
                active === "zh"
                  ? "bg-stone-800 text-white"
                  : "bg-stone-200 text-stone-700"
              }`}
              type="button"
              onClick={() => onActiveChange("zh")}
            >
              中文内容
            </button>
            <button
              aria-pressed={active === "en"}
              className={`rounded-lg px-3 py-2 text-sm ${
                active === "en"
                  ? "bg-stone-800 text-white"
                  : "bg-stone-200 text-stone-700"
              }`}
              type="button"
              onClick={() => onActiveChange("en")}
            >
              英文内容
            </button>
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

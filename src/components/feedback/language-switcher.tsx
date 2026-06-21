"use client";

import type { LanguageMode } from "@/lib/domain/types";

type LanguageSwitcherProps = {
  mode: LanguageMode;
  active: "zh" | "en";
  disabled?: boolean;
  onChange: (language: "zh" | "en") => void;
};

export function LanguageSwitcher({
  mode,
  active,
  disabled = false,
  onChange,
}: LanguageSwitcherProps) {
  if (mode !== "bilingual") return null;

  return (
    <div aria-label="反馈语言">
      <button
        aria-pressed={active === "zh"}
        disabled={disabled}
        type="button"
        onClick={() => onChange("zh")}
      >
        中文
      </button>
      <button
        aria-pressed={active === "en"}
        disabled={disabled}
        type="button"
        onClick={() => onChange("en")}
      >
        English
      </button>
    </div>
  );
}

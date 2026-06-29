"use client";

import { useMemo, useState } from "react";

import {
  defaultUserSettings,
  type UserSettings,
} from "@/lib/settings/schema";
import { themeVariables, validateThemeContrast } from "@/lib/settings/theme";

type SettingsPanelProps = {
  initialSettings?: UserSettings;
  onSave: (settings: UserSettings) => Promise<void>;
  onClose: () => void;
};

const presets = [
  ["professional", "专业蓝橙"],
  ["ocean", "海洋蓝"],
  ["sunrise", "日出橙"],
  ["forest", "森林绿"],
  ["custom", "自定义"],
] as const;

export function SettingsPanel({
  initialSettings = defaultUserSettings,
  onSave,
  onClose,
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const variables = useMemo(() => {
    try {
      return themeVariables(settings);
    } catch {
      return themeVariables(defaultUserSettings);
    }
  }, [settings]);

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function save() {
    setError("");
    let nextVariables;
    try {
      nextVariables = themeVariables(settings);
    } catch {
      setError("请输入 #RRGGBB 格式颜色");
      return;
    }
    const contrast = validateThemeContrast({
      primary: nextVariables["--theme-primary"],
      accent: nextVariables["--theme-accent"],
      background: nextVariables["--theme-surface"],
    });
    if (!contrast.ok) {
      setError("当前颜色对比度不足，请选择更深的主色或强调色");
      return;
    }

    setPending(true);
    try {
      await onSave(settings);
      onClose();
    } catch {
      setError("设置保存失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="设置"
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">设置</h2>
          <p className="mt-1 text-sm text-stone-600">
            调整主题、阅读字号和 DeepSeek 默认模型。
          </p>
        </div>
        <button type="button" className="text-sm text-stone-500" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <label>
          主题预设
          <select
            value={settings.themePreset}
            onChange={(event) =>
              update("themePreset", event.target.value as UserSettings["themePreset"])
            }
          >
            {presets.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {settings.themePreset === "custom" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              主色
              <input
                value={settings.customPrimary ?? "#123c69"}
                onChange={(event) => update("customPrimary", event.target.value)}
              />
            </label>
            <label>
              强调色
              <input
                value={settings.customAccent ?? "#f97316"}
                onChange={(event) => update("customAccent", event.target.value)}
              />
            </label>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            字体大小
            <select
              value={settings.fontScale}
              onChange={(event) =>
                update("fontScale", event.target.value as UserSettings["fontScale"])
              }
            >
              <option value="small">小</option>
              <option value="medium">中</option>
              <option value="large">大</option>
            </select>
          </label>
          <label>
            字体粗细
            <select
              value={settings.fontWeight}
              onChange={(event) =>
                update("fontWeight", event.target.value as UserSettings["fontWeight"])
              }
            >
              <option value="regular">常规</option>
              <option value="medium">适中</option>
              <option value="bold">加粗</option>
            </select>
          </label>
          <label>
            DeepSeek 模型
            <select
              value={settings.deepseekModel}
              onChange={(event) =>
                update(
                  "deepseekModel",
                  event.target.value as UserSettings["deepseekModel"],
                )
              }
            >
              <option value="chat">Chat</option>
              <option value="reason">Reason</option>
              <option value="v4-pro">V4 Pro</option>
            </select>
          </label>
        </div>

        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: variables["--theme-primary-soft"],
            color: variables["--theme-primary"],
            fontSize: `calc(1rem * ${variables["--font-scale"]})`,
            fontWeight: variables["--font-weight"],
          }}
        >
          预览：今日反馈将以更清晰的蓝橙视觉呈现，方便营地现场快速阅读。
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="min-h-11 rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white hover:bg-orange-600"
          disabled={pending}
          onClick={() => void save()}
        >
          {pending ? "保存中…" : "保存设置"}
        </button>
      </div>
    </section>
  );
}

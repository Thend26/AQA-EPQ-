"use client";

import { useEffect, useMemo, useState } from "react";

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
  ["lavender", "薰衣草"],
  ["graphite", "石墨黑"],
  ["rose", "玫瑰红"],
  ["mint", "薄荷绿"],
  ["custom", "自定义"],
] as const;

type DeepSeekKeyStatus = {
  configured: boolean;
  last4?: string;
  updatedAt?: string;
};

export function SettingsPanel({
  initialSettings = defaultUserSettings,
  onSave,
  onClose,
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [error, setError] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [keyStatus, setKeyStatus] = useState<DeepSeekKeyStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
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

  useEffect(() => {
    let cancelled = false;
    async function loadKeyStatus() {
      try {
        const response = await fetch("/api/settings/deepseek-key", {
          method: "GET",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: DeepSeekKeyStatus };
        if (!cancelled) setKeyStatus(payload.data ?? { configured: false });
      } catch {
        if (!cancelled) setKeyStatus({ configured: false });
      }
    }
    void loadKeyStatus();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function saveApiKey() {
    setError("");
    setKeyMessage("");
    if (apiKey.trim().length < 8) {
      setError("请输入有效的 DeepSeek API Key");
      return;
    }
    const response = await fetch("/api/settings/deepseek-key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!response.ok) {
      setError("DeepSeek Key 保存失败，请稍后重试");
      return;
    }
    const payload = (await response.json()) as { data?: DeepSeekKeyStatus };
    setKeyStatus(payload.data ?? { configured: true });
    setApiKey("");
    setKeyMessage("DeepSeek Key 已保存");
  }

  async function testApiKey() {
    setError("");
    setKeyMessage("");
    const response = await fetch("/api/settings/deepseek-test", {
      method: "POST",
    });
    if (!response.ok) {
      setError("DeepSeek 连接测试失败，请检查 Key 和模型");
      return;
    }
    setKeyMessage("DeepSeek 连接测试成功");
  }

  async function deleteApiKey() {
    setError("");
    setKeyMessage("");
    const response = await fetch("/api/settings/deepseek-key", {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("DeepSeek Key 删除失败，请稍后重试");
      return;
    }
    setKeyStatus({ configured: false });
    setKeyMessage("DeepSeek Key 已删除");
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
                type="color"
                value={settings.customPrimary ?? "#123c69"}
                onChange={(event) => update("customPrimary", event.target.value)}
              />
            </label>
            <label>
              强调色
              <input
                type="color"
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

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <h3 className="font-semibold">个人 DeepSeek API Key</h3>
          <div className="mt-3 rounded-2xl border border-white bg-white p-3 shadow-sm">
            <p className="font-medium text-stone-900">
              {keyStatus?.configured ? "DeepSeek API 已配置" : "DeepSeek API 未配置"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {keyStatus?.configured
                ? `当前账号已保存个人 Key${keyStatus.last4 ? `，尾号 ${keyStatus.last4}` : ""}。`
                : "保存个人 Key 后，文档分析和反馈生成会优先使用你的配置。"}
            </p>
          </div>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Key 会加密保存到你的账号设置中；页面不会回显完整 Key。
          </p>
          <label className="mt-3 block">
            DeepSeek API Key
            <input
              aria-label="DeepSeek API Key"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              type="password"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-10 rounded-lg bg-[var(--theme-primary)] px-3 py-2 text-sm font-semibold text-white"
              onClick={() => void saveApiKey()}
            >
              保存 Key
            </button>
            <button
              type="button"
              className="min-h-10 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
              onClick={() => void testApiKey()}
            >
              测试连接
            </button>
            <button
              type="button"
              className="min-h-10 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
              onClick={() => void deleteApiKey()}
            >
              删除 Key
            </button>
          </div>
          {keyMessage ? (
            <p role="status" className="mt-3 text-sm text-blue-800">
              {keyMessage}
            </p>
          ) : null}
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

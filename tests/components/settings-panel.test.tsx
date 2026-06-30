import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { SettingsPanel } from "@/components/settings/settings-panel";

const baseSettings = {
  themePreset: "professional" as const,
  fontScale: "medium" as const,
  fontWeight: "medium" as const,
  deepseekModel: "chat" as const,
};

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ data: { configured: false } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

test("edits appearance and model settings", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);

  render(
    <SettingsPanel
      initialSettings={baseSettings}
      onClose={() => undefined}
      onSave={onSave}
    />,
  );

  await user.selectOptions(screen.getByLabelText("主题预设"), "ocean");
  await user.selectOptions(screen.getByLabelText("字体大小"), "large");
  await user.selectOptions(screen.getByLabelText("字体粗细"), "bold");
  await user.selectOptions(screen.getByLabelText("DeepSeek 模型"), "reason");
  await user.click(screen.getByRole("button", { name: "保存设置" }));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      themePreset: "ocean",
      fontScale: "large",
      fontWeight: "bold",
      deepseekModel: "reason",
    }),
  );
});

test("shows an alert for invalid custom colors", async () => {
  const user = userEvent.setup();

  render(
    <SettingsPanel
      initialSettings={{
        ...baseSettings,
        themePreset: "custom",
        customPrimary: "blue",
        customAccent: "#f97316",
      } as typeof baseSettings & { themePreset: "custom"; customPrimary: string; customAccent: string }}
      onClose={() => undefined}
      onSave={async () => undefined}
    />,
  );

  await user.click(screen.getByRole("button", { name: "保存设置" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "请输入 #RRGGBB 格式颜色",
  );
});

test("uses visual color pickers for custom colors", async () => {
  render(
    <SettingsPanel
      initialSettings={{
        ...baseSettings,
        themePreset: "custom",
        customPrimary: "#123c69",
        customAccent: "#f97316",
      }}
      onClose={() => undefined}
      onSave={async () => undefined}
    />,
  );

  expect(screen.getByLabelText("主色")).toHaveAttribute("type", "color");
  expect(screen.getByLabelText("强调色")).toHaveAttribute("type", "color");
});

test("shows the saved DeepSeek key status with the configured suffix", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        data: { configured: true, last4: "wxyz", updatedAt: "2026-06-30T00:00:00Z" },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );

  render(
    <SettingsPanel
      initialSettings={baseSettings}
      onClose={() => undefined}
      onSave={async () => undefined}
    />,
  );

  expect(await screen.findByText("DeepSeek API 已配置")).toBeInTheDocument();
  expect(screen.getByText(/尾号 wxyz/)).toBeInTheDocument();
});

test("saves a personal DeepSeek key without showing it again", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { configured: false } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { configured: true, last4: "wxyz" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

  render(
    <SettingsPanel
      initialSettings={baseSettings}
      onClose={() => undefined}
      onSave={async () => undefined}
    />,
  );

  await user.type(screen.getByLabelText("DeepSeek API Key"), "sk-secret-wxyz");
  await user.click(screen.getByRole("button", { name: "保存 Key" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/settings/deepseek-key",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ apiKey: "sk-secret-wxyz" }),
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("已保存");
  expect(screen.getByText(/尾号 wxyz/)).toBeInTheDocument();
  expect(screen.queryByDisplayValue("sk-secret-wxyz")).not.toBeInTheDocument();
});

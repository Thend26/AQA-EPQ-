import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { SettingsPanel } from "@/components/settings/settings-panel";

const baseSettings = {
  themePreset: "professional" as const,
  fontScale: "medium" as const,
  fontWeight: "medium" as const,
  deepseekModel: "chat" as const,
};

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
        customPrimary: "#123c69",
        customAccent: "#f97316",
      }}
      onClose={() => undefined}
      onSave={async () => undefined}
    />,
  );

  await user.clear(screen.getByLabelText("主色"));
  await user.type(screen.getByLabelText("主色"), "blue");
  await user.click(screen.getByRole("button", { name: "保存设置" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "请输入 #RRGGBB 格式颜色",
  );
});

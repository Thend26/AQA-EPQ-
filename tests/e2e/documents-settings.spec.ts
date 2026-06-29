import { expect, test } from "@playwright/test";

const credentialsConfigured = Boolean(
  process.env.E2E_EMAIL &&
    process.env.E2E_PASSWORD &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.E2E_DEEPSEEK_API_KEY,
);

test("persists settings, masks keys, uploads documents, and applies AO suggestions", async ({
  page,
}) => {
  test.skip(
    !credentialsConfigured,
    "Set E2E credentials, Supabase keys, and E2E_DEEPSEEK_API_KEY for full document/settings coverage.",
  );

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("密码").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/workspace/);

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("DeepSeek API Key").fill(process.env.E2E_DEEPSEEK_API_KEY!);
  await page.getByRole("button", { name: "保存 Key" }).click();
  await expect(page.getByText("DeepSeek Key 已保存")).toBeVisible();
  await expect(page.getByText(/已配置/)).toBeVisible();
  await expect(page.getByText(process.env.E2E_DEEPSEEK_API_KEY!)).toHaveCount(0);
  await page.getByLabel("字体大小").selectOption("large");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByText("设置已保存")).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();

  await expect(
    page.getByLabel("今日完成成果"),
    "Seed the E2E account with one anonymized current-start student and enable documents.",
  ).toHaveCount(1);
  await page.getByLabel("今日完成成果").fill("完成研究问题与来源比较初稿");
  await page.getByLabel("明日计划").fill("补充反思并完善引用");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByLabel("上传学生文档").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "e2e-epq-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Research question\nsource comparison\nreflection", "utf8"),
  });
  await page.getByRole("button", { name: "上传文档" }).click();
  await expect(page.getByText("e2e-epq-notes.txt")).toBeVisible();

  await expect
    .poll(async () => page.getByText("extracted").count(), {
      timeout: 60_000,
      message: "worker should parse the uploaded document",
    })
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "生成 AO 观察建议" }).click();
  await expect(page.getByRole("button", { name: "应用选中 AO 备注" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "应用选中 AO 备注" }).click();
  await expect(page.getByLabel("AO1 Manage 当日观察")).not.toHaveValue("");
});

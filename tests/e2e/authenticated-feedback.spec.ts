import { expect, test } from "@playwright/test";

const credentialsConfigured = Boolean(
  process.env.E2E_EMAIL &&
    process.env.E2E_PASSWORD &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.DEEPSEEK_API_KEY,
);

test("records progress and opens feedback generation", async ({ page }) => {
  test.skip(
    !credentialsConfigured,
    "Set E2E credentials, Supabase keys, and DEEPSEEK_API_KEY.",
  );

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("密码").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/workspace/);

  const achievement = page.getByLabel("今日完成成果");
  await expect(
    achievement,
    "Seed the E2E account with at least one anonymized student.",
  ).toHaveCount(1);

  await achievement.fill("筛选并评价了四篇匿名示例文献");
  await page.getByLabel("明日计划").fill("制作证据比较表并复核引用");
  await expect(page.getByText(/已保存|正在保存/)).toBeVisible();
  await expect(page.getByRole("button", { name: "生成反馈" })).toBeEnabled();
  await page.getByRole("button", { name: "生成反馈" }).click();
  await expect(page.getByLabel("中文反馈")).not.toHaveValue("");
  await expect(page.getByRole("button", { name: "确认归档" })).toBeEnabled();
  await page.getByRole("button", { name: "确认归档" }).click();
  await expect(page.getByText("已归档")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /第 \d+ 版/ })).toBeVisible();
});

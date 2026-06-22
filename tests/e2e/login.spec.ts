import { expect, test } from "@playwright/test";

test("shows login and email registration modes", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
  await expect(page.getByRole("button", { name: "注册账号" })).toBeVisible();
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page.getByLabel("确认密码")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建账号" })).toBeVisible();
});

test("redirects an unauthenticated workspace visit to login", async ({
  page,
}) => {
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/login$/);
});

test("does not overflow horizontally on the configured viewport", async ({
  page,
}) => {
  await page.goto("/login");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

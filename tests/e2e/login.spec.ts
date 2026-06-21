import { expect, test } from "@playwright/test";

test("shows the private mentor login without public registration", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
  await expect(page.getByText("注册", { exact: true })).toHaveCount(0);
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

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

test("registration controls do not overlap at narrow widths", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "注册账号" }).click();

  const result = await page.evaluate(() => {
    const controls = [
      ...document.querySelectorAll("button, input"),
    ] as HTMLElement[];
    const overlap = controls.some((control, index) =>
      controls.slice(index + 1).some((candidate) => {
        const first = control.getBoundingClientRect();
        const second = candidate.getBoundingClientRect();
        return (
          first.left < second.right &&
          first.right > second.left &&
          first.top < second.bottom &&
          first.bottom > second.top
        );
      }),
    );
    return {
      overlap,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(result.overlap).toBe(false);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth);
});

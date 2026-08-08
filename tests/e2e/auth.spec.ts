import { expect, test } from "@playwright/test";

test("sign-in explains contactability without claiming student identity", async ({ page }) => {
  await page.goto("/login?returnTo=%2Faccount");

  await expect(
    page.getByRole("heading", { name: "Sign in without a password." }),
  ).toBeVisible();
  await expect(page.getByText("No university domain is required.")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.locator('input[name="returnTo"]')).toHaveValue("/account");
});

test("an external return target is replaced with the safe account fallback", async ({
  page,
}) => {
  await page.goto("/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal");
  await expect(page.locator('input[name="returnTo"]')).toHaveValue("/account");
});

test("the sign-in screen has no horizontal overflow", async ({ page }) => {
  await page.goto("/login");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
});

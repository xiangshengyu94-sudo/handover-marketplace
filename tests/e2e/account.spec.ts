import { expect, test } from "@playwright/test";

test("an unauthenticated visitor is returned to sign-in with their intent", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?returnTo=\/account$/);
  await expect(page.locator('input[name="returnTo"]')).toHaveValue("/account");
});

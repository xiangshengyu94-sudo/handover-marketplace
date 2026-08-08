import { expect, test } from "@playwright/test";

const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("a claim link requires verified authentication before any preview", async ({ page }) => {
  await page.goto(`/assisted/${token}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=/assisted/${token}$`));
  await expect(page.locator("body")).not.toContainText(/source label|private bicycle|author@example/i);
});

test("assisted mutations reject cross-site and unauthenticated requests", async ({ request, page }) => {
  expect((await request.post("/api/assisted-listings", { data: {} })).status()).toBe(400);
  await page.goto("/login");
  const status = await page.evaluate(async (claimToken) => (await fetch(`/api/assisted-listings/${claimToken}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim" }) })).status, token);
  expect(status).toBe(401);
});

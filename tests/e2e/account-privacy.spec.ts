import { expect, test } from "@playwright/test";

test("account privacy redirects an unauthenticated visitor with intent", async ({ page }) => {
  await page.goto("/account/privacy");
  await expect(page).toHaveURL(/\/login\?returnTo=\/account\/privacy$/);
  await expect(page.locator('input[name="returnTo"]')).toHaveValue("/account/privacy");
});

test("privacy mutations reject cross-origin requests before account lookup", async ({ request }) => {
  for (const path of ["/api/account/export", "/api/account/delete"]) {
    const response = await request.post(path, {
      data: path.endsWith("delete") ? { confirmation: "DELETE" } : undefined,
      headers: { Origin: "https://evil.example" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  }
});

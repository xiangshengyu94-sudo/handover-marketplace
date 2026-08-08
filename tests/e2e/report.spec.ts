import { expect, test } from "@playwright/test";

test("anonymous notice entry is public, specific, and receipt-oriented", async ({ page }) => {
  await page.goto("/notices/new");
  await expect(page.getByRole("heading", { name: "Report potentially illegal content." })).toBeVisible();
  await expect(page.getByLabel("Detailed explanation")).toHaveAttribute("minlength", "80");
  await expect(page.getByRole("button", { name: "Submit notice" })).toBeVisible();
});

test("report mutations reject missing origin and protected queues require sign-in", async ({ request, page }) => {
  expect((await request.post("/api/notices", { data: {} })).status()).toBe(400);
  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/login\?returnTo=\/admin\/reports$/);
  await expect(page.locator("body")).not.toContainText(/member reports|anonymous notices|reporter/i);
});

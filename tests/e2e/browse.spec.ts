import { expect, test } from "@playwright/test";

test("public discovery renders usable filters without JavaScript-only controls", async ({ page }) => {
  await page.goto("/?city=valencia&kind=housing&maxPrice=650");
  await expect(page.getByRole("heading", { name: "Pass useful things forward." })).toBeVisible();
  await expect(page.getByLabel("City")).toHaveValue("valencia");
  await expect(page.getByLabel("Housing")).toBeChecked();
  await expect(page.getByLabel("Maximum price")).toHaveValue("650");
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Clear all/ })).toBeVisible();
});

test("malformed public filters do not break or expose internal errors", async ({ page }) => {
  await page.goto("/?city=../../private&page=-1");
  await expect(page.getByText(/current listings/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/supabase|postgres|stack|owner_id/i);
});

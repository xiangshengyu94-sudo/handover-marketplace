import { expect, test } from "@playwright/test";

test("public discovery renders usable filters without JavaScript-only controls", async ({ page }) => {
  await page.goto("/?city=valencia&kind=housing&maxPrice=650");
  await expect(page.getByRole("link", { name: "ReLoop" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Give things another life." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Second-hand things" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local knowledge" })).toBeVisible();
  await expect(page.getByLabel("City")).toHaveValue("valencia");
  await expect(page.getByLabel("Housing")).toBeChecked();
  await expect(page.getByLabel("Maximum price")).toHaveValue("650");
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Clear all/ })).toBeVisible();
});

test("other-information and ISO date filters survive a browser form submission", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Tips & info", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Available by")).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Available by")).toHaveAttribute("placeholder", "YYYY-MM-DD");

  await page.getByLabel("Tips & info", { exact: true }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();

  await expect(page).toHaveURL(/(?:\?|&)kind=other(?:&|$)/);
  await expect(page.getByLabel("Tips & info", { exact: true })).toBeChecked();
});

test("malformed public filters do not break or expose internal errors", async ({ page }) => {
  await page.goto("/?city=../../private&page=-1");
  await expect(page.getByText(/current listings/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/supabase|postgres|stack|owner_id/i);
});

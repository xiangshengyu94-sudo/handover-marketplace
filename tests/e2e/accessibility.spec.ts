import { expect, test } from "@playwright/test";

for (const path of ["/", "/login", "/safety", "/privacy", "/terms", "/notices/new"]) {
  test(`${path} exposes a keyboard-usable document structure`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    const interactive = page.locator("a:visible, button:visible, input:visible, select:visible, textarea:visible").first();
    if (await interactive.count()) {
      await interactive.focus();
      await expect(interactive).toBeFocused();
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("forms expose programmatic labels for visible controls", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.goto("/notices/new");
  await expect(page.getByLabel(/Category/)).toBeVisible();
  await expect(page.getByLabel(/explanation/i)).toBeVisible();
});

test("keyboard activation reaches listing contact sign-in and preserves intent", async ({
  page,
}) => {
  const listingId = "50000000-0000-4000-8000-000000000001";
  const listingTitle = "Sunny furnished room in Benimaclet";

  await page.goto("/?city=valencia");
  const listingLink = page.getByRole("link", { name: listingTitle });
  test.skip(
    (await listingLink.count()) === 0,
    "Requires a seeded Supabase listing; the projection and route contracts are covered by unit tests.",
  );
  await expect(listingLink).toBeVisible();
  await listingLink.focus();
  await expect(listingLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/listings/${listingId}$`));

  const contactEntry = page.getByRole("link", { name: "Sign in to contact" });
  await contactEntry.focus();
  await expect(contactEntry).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`/login\\?returnTo=/listings/${listingId}$`),
  );
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeFocused();
});

test("account privacy intent lands on a keyboard-usable sign-in form", async ({
  page,
}) => {
  await page.goto("/account/privacy");
  await expect(page).toHaveURL(/\/login\?returnTo=\/account\/privacy$/);
  await expect(page.locator('input[name="returnTo"]')).toHaveValue(
    "/account/privacy",
  );
  await expect(page.getByLabel("Email address")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeFocused();
});

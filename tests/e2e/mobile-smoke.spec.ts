import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("core public journeys fit a narrow viewport", async ({ page }) => {
  for (const path of ["/", "/login", "/notices/new"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

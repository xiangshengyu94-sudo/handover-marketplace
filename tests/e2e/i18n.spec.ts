import { expect, test } from "@playwright/test";

test("language switcher changes and remembers the core marketplace language", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const switcher = page.getByTestId("language-switcher");
  await expect(switcher).toHaveValue("en");
  await expect(switcher.locator("option")).toHaveText([
    "English",
    "Polski",
    "Italiano",
    "Deutsch",
    "Español",
  ]);

  const expectations = [
    ["pl", "Daj rzeczom drugie życie."],
    ["it", "Dai alle cose una seconda vita."],
    ["de", "Gib Dingen ein zweites Leben."],
    ["es", "Dale una segunda vida a las cosas."],
  ] as const;

  for (const [locale, heading] of expectations) {
    await Promise.all([
      page.waitForNavigation(),
      switcher.selectOption(locale),
    ]);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }

  await page.reload();
  await expect(page.getByTestId("language-switcher")).toHaveValue("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Inicia sesión sin contraseña." }),
  ).toBeVisible();
});

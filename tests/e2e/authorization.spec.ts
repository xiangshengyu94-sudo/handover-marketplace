import { expect, test } from "@playwright/test";

test("a forged session-shaped cookie does not unlock a protected route", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "sb-local-auth-token",
      value: "forged.payload.signature",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?returnTo=\/account$/);
});

import { expect, test } from "@playwright/test";

test("protected listing authoring routes preserve a safe return path", async ({ page }) => {
  await page.goto("/listings/new");
  await expect(page).toHaveURL(/\/login\?returnTo=\/listings\/new$/);

  await page.goto("/listings/11111111-1111-4111-8111-111111111111/edit");
  await expect(page).toHaveURL(
    /\/login\?returnTo=\/listings\/11111111-1111-4111-8111-111111111111\/edit$/,
  );
});

test("the image processor rejects a request without a same-origin browser context", async ({ request }) => {
  const response = await request.post(
    "/api/listings/11111111-1111-4111-8111-111111111111/images/process",
    {
      data: {
        imageId: "22222222-2222-4222-8222-222222222222",
        generation: "33333333-3333-4333-8333-333333333333",
      },
    },
  );
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "Request not accepted." });
});

test("private media uses a non-enumerating not-found response", async ({ request }) => {
  const response = await request.get("/api/media/not-an-image-id");
  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toEqual({ error: "Not found." });
});

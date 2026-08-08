import { expect, test } from "@playwright/test";

test("contact preparation requires both same-origin context and authentication", async ({ page, request }) => {
  const crossSite = await request.post("/api/contact-intents", { data: { listingId: "11111111-1111-4111-8111-111111111111", message: "I arrive next week and would like to collect this item.", consent: true, requestKey: "22222222-2222-4222-8222-222222222222" } });
  expect(crossSite.status()).toBe(400);

  await page.goto("/login");
  const sameOriginStatus = await page.evaluate(async () => (await fetch("/api/contact-intents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: "11111111-1111-4111-8111-111111111111", message: "I arrive next week and would like to collect this item.", consent: true, requestKey: "22222222-2222-4222-8222-222222222222" }) })).status);
  expect(sameOriginStatus).toBe(401);
});

test("contact status is private and unsigned provider events are rejected", async ({ request }) => {
  expect((await request.get("/api/contact-status/22222222-2222-4222-8222-222222222222")).status()).toBe(401);
  expect((await request.post("/api/webhooks/resend", { data: { type: "email.delivered" } })).status()).toBe(400);
});

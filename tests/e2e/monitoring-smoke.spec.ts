import { expect, test } from "@playwright/test";

test("internal job and canary endpoints hide missing and invalid credentials", async ({ request }) => {
  for (const path of ["/api/internal/retention", "/api/internal/monitoring-canary"]) {
    const missing = await request.post(path);
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toEqual({ error: "Not found." });

    const invalid = await request.post(path, {
      headers: { Authorization: "Bearer definitely-not-the-production-secret" },
    });
    expect(invalid.status()).toBe(404);
    expect(await invalid.json()).toEqual({ error: "Not found." });
  }
});

test("authenticated release canary is accepted and identifies the Sentry event", async ({ request }) => {
  const secret = process.env.MONITORING_CANARY_SECRET;
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL || !secret,
    "Run against staging with MONITORING_CANARY_SECRET; unit tests use a controlled Sentry transport.",
  );

  const response = await request.post("/api/internal/monitoring-canary", {
    headers: { Authorization: `Bearer ${secret}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    captured: true,
    eventId: expect.stringMatching(/^[a-f0-9]{32}$/i),
  });
});

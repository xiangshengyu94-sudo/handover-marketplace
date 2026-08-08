import { expect, test } from "@playwright/test";

test("a cross-origin Server Action POST is rejected", async ({ page, request }) => {
  await page.goto("/login");
  const form = page.locator("form").first();
  const action = (await form.getAttribute("action")) || "/login";
  const fields = await form.locator("input").evaluateAll((inputs) =>
    Object.fromEntries(
      inputs
        .map((input) => input as HTMLInputElement)
        .filter((input) => input.name)
        .map((input) => [input.name, input.value]),
    ),
  );

  const response = await request.post(new URL(action, page.url()).toString(), {
    headers: { Origin: "https://evil.example" },
    multipart: { ...fields, email: "person@example.test" },
    maxRedirects: 0,
  });

  expect(response.status()).toBeGreaterThanOrEqual(400);
});

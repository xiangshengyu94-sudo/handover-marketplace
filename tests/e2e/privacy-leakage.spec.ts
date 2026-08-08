import { expect, test } from "@playwright/test";

const implementationMarkers = [
  "SUPABASE_SECRET_KEY",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "contact_outbox",
  "provider_email_id",
  "author_email_hmac",
  "message_body",
];

const seededListing = {
  id: "50000000-0000-4000-8000-000000000001",
  title: "Sunny furnished room in Benimaclet",
};

test("populated public pages and payloads exclude private implementation data", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const listingLink = page.getByRole("link", { name: seededListing.title });
  test.skip(
    (await listingLink.count()) === 0,
    "Requires seeded public/private records; value-level boundary projection is covered by the canary unit test.",
  );

  const paths = ["/", `/listings/${seededListing.id}`, "/safety"];
  const responses = await Promise.all(
    paths.flatMap((path) => [
      request.get(path),
      request.get(path, { headers: { Rsc: "1" } }),
    ]),
  );
  await expect(listingLink).toBeVisible();
  const browserDocuments = [await page.content()];

  await page.goto(`/listings/${seededListing.id}`);
  await expect(
    page.getByRole("heading", { name: seededListing.title }),
  ).toBeVisible();
  browserDocuments.push(await page.content());

  const sourceDocuments = await Promise.all(
    responses.map(async (response) => {
      expect(response.ok()).toBe(true);
      return response.text();
    }),
  );
  const documents = [...browserDocuments, ...sourceDocuments];

  for (const marker of implementationMarkers) {
    await expect(page.locator("html")).not.toContainText(marker);
    for (const document of documents) expect(document).not.toContain(marker);
  }
});

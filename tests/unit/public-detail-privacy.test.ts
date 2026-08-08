import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizeListing } from "@/lib/listings/queries";
import { PRIVACY_CANARIES } from "../fixtures/privacy-canaries";

const publicDetail = readFileSync("src/app/(public)/listings/[id]/page.tsx", "utf8");
const publicQuery = readFileSync("src/lib/listings/queries.ts", "utf8");

describe("public listing projection", () => {
  it("does not select identity, moderation, or private evidence fields", () => {
    for (const forbidden of ["owner_id", "owner_email", "source_evidence", "moderation_reason", "storage_path", "derivative_path"]) {
      expect(publicDetail).not.toContain(forbidden);
      expect(publicQuery).not.toContain(forbidden);
    }
  });

  it("obtains only authorized image identifiers through the public RPC", () => {
    expect(publicDetail).toContain("get_public_listing_images");
    expect(publicDetail).toContain("/api/media/");
  });

  it("drops canary values from every private boundary while preserving public data", () => {
    const listing = normalizeListing({
      id: "50000000-0000-4000-8000-000000000001",
      title: "Visible listing control",
      description: "This public description proves the projection is populated.",
      kind: "item",
      status: "active",
      price_amount: 25,
      currency: "EUR",
      approximate_area: "Ruzafa",
      available_from: "2026-08-15",
      expires_at: "2026-09-15T00:00:00.000Z",
      city: { id: "city-1", slug: "valencia", name: "Valencia", country_code: "ES" },
      category: { id: "category-1", slug: "bicycle", label: "Bicycle" },
      listing_organizations: [],
      item_details: {
        condition: "good",
        quantity: 1,
        pickup_area: "Ruzafa",
        is_giveaway: false,
      },
      owner_id: PRIVACY_CANARIES.publicRecord,
      profile: { display_name: PRIVACY_CANARIES.privateRecord },
      contact_outbox: { message_body: PRIVACY_CANARIES.contactOutbox },
      moderation_history: { reason: PRIVACY_CANARIES.moderationEvidence },
      assisted_claim: { source_label: PRIVACY_CANARIES.assistedClaim },
    });
    const serialized = JSON.stringify(listing);

    expect(serialized).toContain("Visible listing control");
    for (const canary of Object.values(PRIVACY_CANARIES)) {
      expect(serialized).not.toContain(canary);
    }
  });
});

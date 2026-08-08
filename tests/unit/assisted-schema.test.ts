import { describe, expect, it } from "vitest";

import { createAssistedInputSchema } from "@/lib/assisted/schema";

const category = { id: "30000000-0000-4000-8000-000000000003", kind: "item" as const };
const valid = {
  authorEmail: "Author@Example.test",
  sourceLabel: "Valencia exchange group",
  authorizationAttested: true,
  listing: {
    kind: "item", title: "Reliable city bicycle", description: "A practical bicycle that is ready for the next exchange student.",
    cityId: "10000000-0000-4000-8000-000000000001", organizationIds: [], resourceCategoryId: category.id,
    priceAmount: 45, currency: "EUR", approximateArea: "Ruzafa", availableFrom: "2026-09-01",
    expiresAt: "2026-10-01T23:59:59.999Z", source: "assisted",
    item: { condition: "good", quantity: 1, pickupArea: "Ruzafa", isGiveaway: false },
  },
};

describe("assisted intake schema", () => {
  it("normalizes the invited email while preserving a minimal source label", () => {
    const parsed = createAssistedInputSchema([category]).parse(valid);
    expect(parsed.authorEmail).toBe("author@example.test");
    expect(parsed.listing.source).toBe("assisted");
  });

  it("rejects source links, missing attestation, and self-submission masquerading as assisted", () => {
    expect(createAssistedInputSchema([category]).safeParse({ ...valid, sourceLabel: "https://chat.whatsapp.com/private" }).success).toBe(false);
    expect(createAssistedInputSchema([category]).safeParse({ ...valid, authorizationAttested: false }).success).toBe(false);
    expect(createAssistedInputSchema([category]).safeParse({ ...valid, listing: { ...valid.listing, source: "self" } }).success).toBe(false);
  });
});

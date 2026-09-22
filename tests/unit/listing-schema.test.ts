import { describe, expect, it } from "vitest";

import { createListingInputSchema } from "@/lib/listings/schema";

const ids = {
  city: "11111111-1111-4111-8111-111111111111",
  organization: "22222222-2222-4222-8222-222222222222",
  room: "33333333-3333-4333-8333-333333333333",
  bicycle: "44444444-4444-4444-8444-444444444444",
  other: "55555555-5555-4555-8555-555555555555",
} as const;

const schema = createListingInputSchema([
  { id: ids.room, kind: "housing" },
  { id: ids.bicycle, kind: "item" },
  { id: ids.other, kind: "other" },
]);

const common = {
  title: "Sunny room near the university",
  description: "Available for the autumn semester, shared kitchen included.",
  cityId: ids.city,
  organizationIds: [ids.organization],
  priceAmount: 430,
  currency: "EUR",
  approximateArea: "Benimaclet",
  availableFrom: "2026-09-01",
  expiresAt: "2026-09-30T22:00:00.000Z",
  source: "self",
} as const;

describe("kind-specific listing input", () => {
  it("accepts housing with its publication and safety acknowledgments", () => {
    const listing = schema.parse({
      ...common,
      kind: "housing",
      resourceCategoryId: ids.room,
      housing: {
        subtype: "room",
        furnished: true,
        billsIncluded: false,
        publicationRightsAcknowledged: true,
        permissionAcknowledged: true,
        safetyWarningAcknowledged: true,
      },
    });

    expect(listing.kind).toBe("housing");
  });

  it("accepts a zero-price item only as a giveaway", () => {
    const listing = schema.parse({
      ...common,
      title: "Desk lamp",
      kind: "item",
      resourceCategoryId: ids.bicycle,
      priceAmount: 0,
      item: {
        condition: "good",
        quantity: 1,
        pickupArea: "Benimaclet",
        isGiveaway: true,
      },
    });

    expect(listing.priceAmount).toBe(0);
  });

  it("rejects a subtype from the other resource kind", () => {
    expect(() =>
      schema.parse({
        ...common,
        kind: "item",
        resourceCategoryId: ids.room,
        item: {
          condition: "good",
          quantity: 1,
          pickupArea: "Benimaclet",
          isGiveaway: false,
        },
      }),
    ).toThrow("does not belong to item");
  });

  it("rejects duplicate organization tags", () => {
    expect(() =>
      schema.parse({
        ...common,
        organizationIds: [ids.organization, ids.organization],
        kind: "housing",
        resourceCategoryId: ids.room,
        housing: {
          subtype: "room",
          furnished: false,
          billsIncluded: false,
          publicationRightsAcknowledged: true,
          permissionAcknowledged: true,
          safetyWarningAcknowledged: true,
        },
      }),
    ).toThrow("Organization tags must be unique");
  });

  it("rejects exact-address fields instead of silently stripping them", () => {
    expect(() =>
      schema.parse({
        ...common,
        kind: "housing",
        resourceCategoryId: ids.room,
        streetAddress: "Carrer de Example 42",
        housing: {
          subtype: "room",
          furnished: false,
          billsIncluded: false,
          publicationRightsAcknowledged: true,
          permissionAcknowledged: true,
          safetyWarningAcknowledged: true,
        },
      }),
    ).toThrow();
  });

  it("rejects inconsistent item giveaway and price state", () => {
    expect(() =>
      schema.parse({
        ...common,
        kind: "item",
        resourceCategoryId: ids.bicycle,
        priceAmount: 12,
        item: {
          condition: "good",
          quantity: 1,
          pickupArea: "Benimaclet",
          isGiveaway: true,
        },
      }),
    ).toThrow("Giveaway items must have a zero price");
  });

  it("requires a supported housing subtype", () => {
    expect(() =>
      schema.parse({
        ...common,
        kind: "housing",
        resourceCategoryId: ids.room,
        housing: {
          furnished: true,
          billsIncluded: true,
          publicationRightsAcknowledged: true,
          permissionAcknowledged: true,
          safetyWarningAcknowledged: true,
        },
      }),
    ).toThrow();
  });

  it("accepts a generic other-information listing without housing or item details", () => {
    const listing = schema.parse({
      ...common,
      title: "Language exchange meetup",
      description: "A casual weekly meetup for newcomers who want to practise together.",
      kind: "other",
      resourceCategoryId: ids.other,
      priceAmount: 0,
    });

    expect(listing.kind).toBe("other");
    expect(listing).not.toHaveProperty("housing");
    expect(listing).not.toHaveProperty("item");
  });
});

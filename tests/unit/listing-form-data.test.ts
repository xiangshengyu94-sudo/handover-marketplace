import { describe, expect, it } from "vitest";

import { parseListingFormData } from "@/lib/listings/form-data";

const ids = {
  city: "11111111-1111-4111-8111-111111111111",
  organization: "22222222-2222-4222-8222-222222222222",
  housing: "33333333-3333-4333-8333-333333333333",
  item: "44444444-4444-4444-8444-444444444444",
};

const categories = [
  { id: ids.housing, kind: "housing" as const },
  { id: ids.item, kind: "item" as const },
];

function common(kind: "housing" | "item") {
  const data = new FormData();
  data.set("kind", kind);
  data.set("title", kind === "housing" ? "Bright semester room" : "Reliable city bicycle");
  data.set(
    "description",
    "Available for an international handover with a flexible collection window.",
  );
  data.set("cityId", ids.city);
  data.append("organizationIds", ids.organization);
  data.set("resourceCategoryId", kind === "housing" ? ids.housing : ids.item);
  data.set("priceAmount", kind === "housing" ? "480" : "75");
  data.set("currency", "EUR");
  data.set("approximateArea", "Benimaclet");
  data.set("availableFrom", "2026-09-01");
  data.set("expiresOn", "2026-10-01");
  return data;
}

describe("listing form parser", () => {
  it("builds housing input with all three acknowledgements", () => {
    const data = common("housing");
    data.set("housingSubtype", "room");
    data.set("furnished", "on");
    data.set("publicationRightsAcknowledged", "on");
    data.set("permissionAcknowledged", "on");
    data.set("safetyWarningAcknowledged", "on");

    const parsed = parseListingFormData(data, categories);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        kind: "housing",
        housing: { subtype: "room", furnished: true },
      });
      expect(parsed.data).not.toHaveProperty("item");
    }
  });

  it("builds item input and ignores stale housing-only browser fields", () => {
    const data = common("item");
    data.set("condition", "good");
    data.set("quantity", "1");
    data.set("pickupArea", "Benimaclet");
    data.set("housingSubtype", "room");
    data.set("permissionAcknowledged", "on");

    const parsed = parseListingFormData(data, categories);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        kind: "item",
        item: { condition: "good", quantity: 1, isGiveaway: false },
      });
      expect(parsed.data).not.toHaveProperty("housing");
    }
  });

  it("retains correction errors for missing housing acknowledgements", () => {
    const data = common("housing");
    data.set("housingSubtype", "studio");

    const parsed = parseListingFormData(data, categories);
    expect(parsed.success).toBe(false);
  });
});

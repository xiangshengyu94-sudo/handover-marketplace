import { describe, expect, it } from "vitest";

import { validatePublicListingText } from "@/lib/listings/public-text-policy";

const safeListing = {
  title: "Bright room near the university",
  description:
    "A calm room in a shared flat with a broad move-in window and shared kitchen.",
  approximateArea: "Benimaclet",
};

describe("public listing text policy", () => {
  it("allows ordinary descriptive text and broad areas", () => {
    expect(validatePublicListingText(safeListing)).toEqual([]);
  });

  it.each([
    ["email", { description: "Email me at person@example.com for details" }],
    ["phone", { description: "WhatsApp me on +34 612 345 678" }],
    ["private-group invitation", { description: "Join https://chat.whatsapp.com/secret" }],
    ["exact address", { approximateArea: "Carrer de Colón 42, Valencia" }],
    ["exact address", { approximateArea: "42 Main Street" }],
  ])("rejects a public %s", (code, replacement) => {
    expect(
      validatePublicListingText({ ...safeListing, ...replacement }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it("checks item pickup areas under the same exact-address rule", () => {
    expect(
      validatePublicListingText({
        ...safeListing,
        pickupArea: "12 Rue de Rivoli",
      }),
    ).toContainEqual(expect.objectContaining({ field: "pickupArea" }));
  });
});

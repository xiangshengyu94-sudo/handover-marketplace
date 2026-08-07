import { describe, expect, it } from "vitest";

import {
  canAssignTaxonomy,
  citySchema,
  organizationMatchesCity,
  organizationSchema,
  resourceCategorySchema,
} from "@/lib/taxonomy/schema";

const cityId = "11111111-1111-4111-8111-111111111111";
const otherCityId = "22222222-2222-4222-8222-222222222222";

describe("controlled taxonomy schemas", () => {
  it("accepts an active city with an IANA timezone", () => {
    const city = citySchema.parse({
      id: cityId,
      slug: "valencia",
      name: "Valencia",
      countryCode: "ES",
      timezone: "Europe/Madrid",
      status: "active",
    });

    expect(city.timezone).toBe("Europe/Madrid");
    expect(canAssignTaxonomy(city)).toBe(true);
  });

  it("rejects an unknown timezone and malformed country code", () => {
    expect(() =>
      citySchema.parse({
        id: cityId,
        slug: "nowhere",
        name: "Nowhere",
        countryCode: "Spain",
        timezone: "Mars/Olympus",
        status: "active",
      }),
    ).toThrow();
  });

  it("keeps retired taxonomy readable but not assignable", () => {
    const retired = resourceCategorySchema.parse({
      id: "33333333-3333-4333-8333-333333333333",
      slug: "bicycle",
      label: "Bicycle",
      kind: "item",
      status: "retired",
    });

    expect(retired.label).toBe("Bicycle");
    expect(canAssignTaxonomy(retired)).toBe(false);
  });

  it("accepts city-scoped and global organizations", () => {
    const scoped = organizationSchema.parse({
      id: "44444444-4444-4444-8444-444444444444",
      cityId,
      slug: "mercuri",
      name: "MERCURI",
      status: "active",
    });
    const global = organizationSchema.parse({
      id: "55555555-5555-4555-8555-555555555555",
      cityId: null,
      slug: "erasmus-community",
      name: "Erasmus community",
      status: "active",
    });

    expect(organizationMatchesCity(scoped, cityId)).toBe(true);
    expect(organizationMatchesCity(scoped, otherCityId)).toBe(false);
    expect(organizationMatchesCity(global, otherCityId)).toBe(true);
  });
});

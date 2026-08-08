import { describe, expect, it } from "vitest";

import { activeFilterCount, parseListingFilters } from "@/lib/listings/filters";

describe("public listing filters", () => {
  it("parses a shareable URL into typed filters", () => {
    expect(parseListingFilters({ city: "valencia", organization: "mercuri", kind: "housing", maxPrice: "650", page: "2" })).toEqual({ city: "valencia", organization: "mercuri", kind: "housing", maxPrice: 650, page: 2 });
  });

  it("fails closed to the first page for malformed inputs", () => {
    expect(parseListingFilters({ city: "../../private", page: "-3" })).toEqual({ page: 1 });
  });

  it("counts only meaningful filter fields", () => {
    expect(activeFilterCount(parseListingFilters({ city: "berlin", kind: "item", page: "7" }))).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import { allowedLifecycleActions, parseRenewalDate } from "@/lib/listings/transitions";

describe("listing lifecycle controls", () => {
  it("exposes only actions allowed for the current projection", () => {
    expect(allowedLifecycleActions("active")).toEqual(["reserve", "complete", "withdraw", "renew", "delete"]);
    expect(allowedLifecycleActions("completed")).toEqual(["delete"]);
    expect(allowedLifecycleActions("unknown")).toEqual([]);
  });

  it("normalizes renewal dates at the inclusive UTC day boundary", () => {
    expect(parseRenewalDate("2026-12-31")).toBe("2026-12-31T23:59:59.999Z");
    expect(parseRenewalDate("31/12/2026")).toBeNull();
  });
});

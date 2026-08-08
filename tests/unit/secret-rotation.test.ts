import { describe, expect, it } from "vitest";

import {
  SECRET_INVENTORY,
  validateRotationWindow,
} from "@/lib/secrets/inventory";

describe("secret inventory", () => {
  it("separates every privileged purpose", () => {
    const variables = SECRET_INVENTORY.map((secret) => secret.variable);
    const purposes = SECRET_INVENTORY.map((secret) => secret.purpose);

    expect(new Set(variables).size).toBe(variables.length);
    expect(new Set(purposes).size).toBe(purposes.length);
    expect(purposes).toEqual(
      expect.arrayContaining([
        "database-administration",
        "transactional-email",
        "webhook-verification",
        "scheduled-dispatch",
        "scheduled-retention",
        "monitoring-canary",
        "assisted-claim-signing",
      ]),
    );
  });

  it("permits a bounded old/new overlap", () => {
    expect(() =>
      validateRotationWindow({
        current: "current-value",
        previous: "previous-value",
        previousValidUntil: new Date("2026-08-08T12:00:00Z"),
        now: new Date("2026-08-08T11:30:00Z"),
      }),
    ).not.toThrow();
  });

  it("rejects key reuse and expired overlap", () => {
    expect(() =>
      validateRotationWindow({
        current: "same-value",
        previous: "same-value",
        previousValidUntil: new Date("2026-08-08T12:00:00Z"),
        now: new Date("2026-08-08T11:30:00Z"),
      }),
    ).toThrow("must not reuse");

    expect(() =>
      validateRotationWindow({
        current: "current-value",
        previous: "previous-value",
        previousValidUntil: new Date("2026-08-08T11:00:00Z"),
        now: new Date("2026-08-08T11:30:00Z"),
      }),
    ).toThrow("expired");
  });
});

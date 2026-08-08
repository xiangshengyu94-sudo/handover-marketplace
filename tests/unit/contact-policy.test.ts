import { describe, expect, it } from "vitest";

import { contactRequestSchema, digestContactPayload, publicDeliveryState } from "@/lib/contact/policy";

describe("contact relay policy", () => {
  it("binds a normalized message to exactly one listing", () => {
    const first = digestContactPayload("11111111-1111-4111-8111-111111111111", "  I arrive next week and would like to view it.  ");
    expect(first).toBe(digestContactPayload("11111111-1111-4111-8111-111111111111", "I arrive next week and would like to view it."));
    expect(first).not.toBe(digestContactPayload("22222222-2222-4222-8222-222222222222", "I arrive next week and would like to view it."));
  });

  it("requires explicit consent and a request-stable UUID", () => {
    expect(contactRequestSchema.safeParse({ message: "I arrive next week and would like to view it.", consent: true, requestKey: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
    expect(contactRequestSchema.safeParse({ message: "I arrive next week and would like to view it.", consent: false, requestKey: "11111111-1111-4111-8111-111111111111" }).success).toBe(false);
  });

  it("never presents a lease or retry as provider delivery", () => {
    expect(publicDeliveryState("sending")).toBe("queued");
    expect(publicDeliveryState("retrying")).toBe("queued");
    expect(publicDeliveryState("accepted")).toBe("accepted");
    expect(publicDeliveryState("delivered")).toBe("delivered");
  });
});

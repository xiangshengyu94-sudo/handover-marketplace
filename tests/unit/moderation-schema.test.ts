import { describe, expect, it } from "vitest";

import { illegalNoticeSchema, memberReportSchema, taxonomyRequestSchema } from "@/lib/moderation/schema";

describe("moderation input schemas", () => {
  it("routes high-signal member reasons with enough context", () => {
    expect(memberReportSchema.safeParse({ listingId: "11111111-1111-4111-8111-111111111111", reason: "privacy", details: "This description includes a private exact address and personal information." }).success).toBe(true);
    expect(memberReportSchema.safeParse({ listingId: "11111111-1111-4111-8111-111111111111", reason: "other", details: "Too vague" }).success).toBe(false);
  });

  it("requires an actionable good-faith anonymous notice", () => {
    const explanation = "This notice identifies the specific listing content, why it may be unlawful, and the factual basis needed for an assessment.";
    expect(illegalNoticeSchema.safeParse({ listingId: null, category: "illegal-content", explanation, goodFaithAttested: true }).success).toBe(true);
    expect(illegalNoticeSchema.safeParse({ listingId: null, category: "illegal-content", explanation, goodFaithAttested: false }).success).toBe(false);
  });

  it("keeps taxonomy payloads typed by entity", () => {
    expect(taxonomyRequestSchema.safeParse({ entityType: "category", payload: { kind: "item", slug: "kitchenware", label: "Kitchenware" } }).success).toBe(true);
    expect(taxonomyRequestSchema.safeParse({ entityType: "city", payload: { kind: "item", slug: "kitchenware", label: "Kitchenware" } }).success).toBe(false);
  });
});

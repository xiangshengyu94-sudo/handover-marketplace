import { describe, expect, it } from "vitest";

import { brandedEmailSender } from "@/lib/email/sender";

describe("branded email sender", () => {
  it("replaces a configured display name while preserving the verified address", () => {
    expect(brandedEmailSender("Handover <verified@example.test>")).toBe(
      "ReLoop <verified@example.test>",
    );
  });

  it("adds the brand display name to a bare address", () => {
    expect(brandedEmailSender("verified@example.test")).toBe(
      "ReLoop <verified@example.test>",
    );
  });
});

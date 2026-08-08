import { describe, expect, it } from "vitest";

import { OPERATIONAL_SIGNALS } from "@/lib/monitoring/signals";

describe("operational monitoring contract", () => {
  it("assigns every launch-critical signal to an actionable escalation", () => {
    expect(OPERATIONAL_SIGNALS.map(({ key }) => key)).toEqual([
      "otp-delivery-failure-rate",
      "contact-send-failure-rate",
      "contact-duplicate-rate",
      "oldest-contact-queue-age",
      "webhook-signature-or-replay-failures",
      "webhook-processing-failures",
      "expiry-job-lag",
      "cleanup-consecutive-failures",
      "orphaned-storage-cleanup-errors",
      "authorization-privacy-signal",
      "urgent-report-age",
      "notification-backlog-age",
    ]);
  });

  it("does not permit ownerless, threshold-free, or actionless signals", () => {
    for (const signal of OPERATIONAL_SIGNALS) {
      expect(signal.owner).not.toBe("");
      expect(signal.threshold).not.toBe("");
      expect(signal.window).not.toBe("");
      expect(signal.destination).not.toBe("");
      expect(signal.action).not.toBe("");
    }
  });
});

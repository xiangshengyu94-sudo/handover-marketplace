import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureMessage: vi.fn<(message: string, context: unknown) => string>(),
  flush: vi.fn<(timeout?: number) => Promise<boolean>>(),
  getClient: vi.fn<() => { getDsn: () => object | undefined } | undefined>(),
  isEnabled: vi.fn<() => boolean>(),
}));

vi.mock("@sentry/nextjs", () => sentry);

import { captureOperationalCanary } from "@/lib/monitoring/sentry";

describe("operational Sentry canary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentry.getClient.mockReturnValue({ getDsn: () => ({ projectId: "1" }) });
    sentry.isEnabled.mockReturnValue(true);
    sentry.captureMessage.mockReturnValue("0123456789abcdef0123456789abcdef");
    sentry.flush.mockResolvedValue(true);
  });

  it("returns the PII-free event ID only after the SDK flushes", async () => {
    await expect(captureOperationalCanary("launch-readiness")).resolves.toBe(
      "0123456789abcdef0123456789abcdef",
    );
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      "operational-canary:launch-readiness",
      {
        level: "info",
        tags: { synthetic: "true", containsPii: "false" },
      },
    );
    expect(sentry.flush).toHaveBeenCalledWith(2_000);
  });

  it("fails closed when Sentry is unconfigured or cannot flush", async () => {
    sentry.getClient.mockReturnValueOnce(undefined);
    await expect(captureOperationalCanary("launch-readiness")).resolves.toBeNull();
    expect(sentry.captureMessage).not.toHaveBeenCalled();

    sentry.flush.mockResolvedValueOnce(false);
    await expect(captureOperationalCanary("launch-readiness")).resolves.toBeNull();
  });
});

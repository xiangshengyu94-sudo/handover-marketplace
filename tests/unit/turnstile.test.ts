import { afterEach, describe, expect, it, vi } from "vitest";

import { TurnstileProvider } from "@/lib/abuse/turnstile";

afterEach(() => vi.unstubAllGlobals());

describe("Turnstile provider", () => {
  it("accepts a successful token only for the configured hostname and action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          hostname: "handover.example",
          action: "request-otp",
        }),
      ),
    );

    await expect(
      new TurnstileProvider(
        "secret",
        "203.0.113.10",
        "handover.example",
      ).verify("single-use-token"),
    ).resolves.toEqual({
      success: true,
      action: "request-otp",
      challengeId: "single-use-token",
    });
  });

  it("fails closed when a valid token was issued for another hostname", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          hostname: "evil.example",
          action: "request-otp",
        }),
      ),
    );

    await expect(
      new TurnstileProvider(
        "secret",
        undefined,
        "handover.example",
      ).verify("single-use-token"),
    ).resolves.toMatchObject({ success: false });
  });
});

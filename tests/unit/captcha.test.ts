import { describe, expect, it, vi } from "vitest";

import {
  CaptchaError,
  evaluateCaptchaRequirement,
  verifyCaptcha,
  type CaptchaReplayStore,
} from "@/lib/abuse/captcha";

describe("adaptive CAPTCHA", () => {
  it("only challenges elevated-risk requests", () => {
    expect(
      evaluateCaptchaRequirement({
        ipAttempts: 1,
        identityAttempts: 1,
        recentFailures: 0,
      }),
    ).toBe(false);
    expect(
      evaluateCaptchaRequirement({
        ipAttempts: 9,
        identityAttempts: 1,
        recentFailures: 0,
      }),
    ).toBe(true);
    expect(
      evaluateCaptchaRequirement({
        ipAttempts: 2,
        identityAttempts: 4,
        recentFailures: 3,
      }),
    ).toBe(true);
  });

  it("accepts the expected action and consumes its challenge once", async () => {
    const consume = vi.fn(async () => true);
    const replayStore: CaptchaReplayStore = { consume };

    await expect(
      verifyCaptcha({
        token: "captcha-token",
        expectedAction: "request-otp",
        provider: {
          verify: async () => ({
            success: true,
            action: "request-otp",
            challengeId: "challenge-1",
          }),
        },
        replayStore,
      }),
    ).resolves.toBeUndefined();
    expect(consume).toHaveBeenCalledWith("challenge-1", expect.any(Date));
  });

  it.each([
    ["replayed", async () => false, "replayed"],
    ["wrong action", async () => true, "action_mismatch"],
  ])("fails closed for a %s challenge", async (_label, consume, code) => {
    await expect(
      verifyCaptcha({
        token: "captcha-token",
        expectedAction: "request-otp",
        provider: {
          verify: async () => ({
            success: true,
            action: code === "action_mismatch" ? "contact" : "request-otp",
            challengeId: "challenge-1",
          }),
        },
        replayStore: { consume },
      }),
    ).rejects.toMatchObject({ code });
  });

  it("turns provider outages into a retryable, generic failure", async () => {
    await expect(
      verifyCaptcha({
        token: "captcha-token",
        expectedAction: "request-otp",
        provider: { verify: async () => Promise.reject(new Error("secret")) },
        replayStore: { consume: async () => true },
      }),
    ).rejects.toMatchObject({ code: "provider_unavailable", retryable: true });
  });

  it("does not expose provider details in CAPTCHA errors", () => {
    expect(new CaptchaError("provider_unavailable", true).message).not.toMatch(
      /provider|secret/i,
    );
  });
});

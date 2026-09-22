import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  const repository = {
    supersedeActive: vi.fn(),
    insert: vi.fn(),
    findByNonceHash: vi.fn(),
    markConsumed: vi.fn(),
  };
  return {
    assertSameOrigin: vi.fn(),
    captureOperationalFailure: vi.fn(),
    consumeCaptchaChallenge: vi.fn(),
    consumeRateLimit: vi.fn(),
    cookieGet: vi.fn(() => ({ value: "browser-binding" })),
    cookieSet: vi.fn(),
    createAuthIntent: vi.fn(),
    createAuthIntentRepository: vi.fn(() => repository),
    createClient: vi.fn(),
    evaluateCaptchaRequirement: vi.fn(),
    hashAbuseKey: vi.fn((value: string) => `hash:${value}`),
    readPublicEnv: vi.fn(),
    readServerEnv: vi.fn(),
    repository,
    signInWithOtp: vi.fn(),
    turnstileConstructor: vi.fn(),
    verifyCaptcha: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: dependencies.cookieGet,
    set: dependencies.cookieSet,
  })),
  headers: vi.fn(async () =>
    new Headers({
      origin: "https://handover.example",
      host: "handover.example",
      "cf-connecting-ip": "198.51.100.24",
    }),
  ),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/abuse/captcha", () => ({
  evaluateCaptchaRequirement: dependencies.evaluateCaptchaRequirement,
  verifyCaptcha: dependencies.verifyCaptcha,
}));
vi.mock("@/lib/abuse/turnstile", () => ({
  TurnstileProvider: class {
    constructor(...args: unknown[]) {
      dependencies.turnstileConstructor(...args);
    }
  },
}));
vi.mock("@/lib/auth/admin", () => ({
  consumeCaptchaChallenge: dependencies.consumeCaptchaChallenge,
  consumeRateLimit: dependencies.consumeRateLimit,
  createAuthIntentRepository: dependencies.createAuthIntentRepository,
  hashAbuseKey: dependencies.hashAbuseKey,
}));
vi.mock("@/lib/auth/csrf", () => ({
  assertSameOrigin: dependencies.assertSameOrigin,
}));
vi.mock("@/lib/auth/intent", () => ({
  createAuthIntent: dependencies.createAuthIntent,
  inspectAuthIntent: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  readPublicEnv: dependencies.readPublicEnv,
  readServerEnv: dependencies.readServerEnv,
}));
vi.mock("@/lib/monitoring/sentry", () => ({
  captureOperationalFailure: dependencies.captureOperationalFailure,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: dependencies.createClient,
}));

import { requestOtpAction } from "@/app/(auth)/login/actions";

const allowed = { allowed: true, attemptCount: 2, retryAfterSeconds: 0 };

function requestForm(options?: { captchaToken?: string }) {
  const form = new FormData();
  form.set("email", "  Student@Example.COM ");
  form.set("returnTo", "/account");
  if (options?.captchaToken) {
    form.set("cf-turnstile-response", options.captchaToken);
  }
  return form;
}

describe("requestOtpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.consumeRateLimit.mockResolvedValue(allowed);
    dependencies.evaluateCaptchaRequirement.mockReturnValue(false);
    dependencies.readServerEnv.mockReturnValue({
      captchaSecretKey: "captcha-secret",
      appUrl: new URL("https://handover.example"),
    });
    dependencies.createAuthIntent.mockResolvedValue({
      nonce: "intent-nonce-value-that-is-long-enough",
    });
    dependencies.signInWithOtp.mockResolvedValue({ error: null });
    dependencies.createClient.mockResolvedValue({
      auth: { signInWithOtp: dependencies.signInWithOtp },
    });
  });

  it("normalizes email, consumes all request limits, verifies captcha, and requests OTP", async () => {
    dependencies.evaluateCaptchaRequirement.mockReturnValue(true);

    const state = await requestOtpAction(
      { step: "email", returnTo: "/account" },
      requestForm({ captchaToken: "captcha-token" }),
    );

    expect(dependencies.assertSameOrigin).toHaveBeenCalledWith({
      origin: "https://handover.example",
      host: "handover.example",
      forwardedHost: undefined,
    });
    expect(dependencies.consumeRateLimit.mock.calls).toEqual([
      [{ scope: "otp-request-ip", keyHash: "hash:198.51.100.24", limit: 12, windowSeconds: 900 }],
      [{ scope: "otp-request-email", keyHash: "hash:student@example.com", limit: 5, windowSeconds: 900 }],
      [{ scope: "otp-request-cooldown", keyHash: "hash:student@example.com", limit: 1, windowSeconds: 60 }],
    ]);
    expect(dependencies.evaluateCaptchaRequirement).toHaveBeenCalledWith({
      ipAttempts: 2,
      identityAttempts: 2,
      recentFailures: 0,
    });
    expect(dependencies.turnstileConstructor).toHaveBeenCalledWith(
      "captcha-secret",
      "198.51.100.24",
      "handover.example",
    );
    expect(dependencies.verifyCaptcha).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "captcha-token",
        expectedAction: "request-otp",
        replayStore: { consume: dependencies.consumeCaptchaChallenge },
      }),
    );
    expect(dependencies.createAuthIntent).toHaveBeenCalledWith({
      repository: dependencies.repository,
      browserBinding: "browser-binding",
      purpose: "login",
      returnTo: "/account",
    });
    expect(dependencies.signInWithOtp).toHaveBeenCalledWith({
      email: "student@example.com",
      options: { shouldCreateUser: true },
    });
    expect(state).toEqual({
      step: "code",
      email: "student@example.com",
      intent: "intent-nonce-value-that-is-long-enough",
      returnTo: "/account",
      message: "If the address can receive mail, a six-digit code is on its way.",
    });
  });

  it("stops before captcha, intent, and provider calls when a rate limit rejects", async () => {
    dependencies.consumeRateLimit
      .mockResolvedValueOnce({ allowed: false, attemptCount: 13, retryAfterSeconds: 30 })
      .mockResolvedValueOnce(allowed)
      .mockResolvedValueOnce(allowed);

    const state = await requestOtpAction(
      { step: "email" },
      requestForm(),
    );

    expect(state).toEqual({
      step: "email",
      returnTo: "/account",
      error: "Too many requests. Wait a while and try again.",
    });
    expect(dependencies.verifyCaptcha).not.toHaveBeenCalled();
    expect(dependencies.createAuthIntent).not.toHaveBeenCalled();
    expect(dependencies.signInWithOtp).not.toHaveBeenCalled();
  });

  it("returns a retryable form error when rate limiting is unavailable", async () => {
    dependencies.consumeRateLimit.mockRejectedValue(
      new Error("rate limiter unavailable"),
    );

    const state = await requestOtpAction(
      { step: "email" },
      requestForm(),
    );

    expect(state).toEqual({
      step: "email",
      email: "student@example.com",
      returnTo: "/account",
      error: "Sign-in is temporarily unavailable. Try again shortly.",
    });
    expect(dependencies.createAuthIntent).not.toHaveBeenCalled();
    expect(dependencies.signInWithOtp).not.toHaveBeenCalled();
    expect(dependencies.captureOperationalFailure).toHaveBeenCalledWith(
      "otp-delivery-failure-rate",
    );
  });

  it("maps provider rejection to a retryable form state and operational signal", async () => {
    dependencies.signInWithOtp.mockResolvedValue({
      error: new Error("provider unavailable"),
    });

    const state = await requestOtpAction(
      { step: "email" },
      requestForm(),
    );

    expect(state).toEqual({
      step: "email",
      email: "student@example.com",
      returnTo: "/account",
      error: "Sign-in is temporarily unavailable. Try again shortly.",
    });
    expect(dependencies.captureOperationalFailure).toHaveBeenCalledWith(
      "otp-delivery-failure-rate",
    );
  });
});

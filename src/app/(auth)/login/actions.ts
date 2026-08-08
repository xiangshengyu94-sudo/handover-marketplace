"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { evaluateCaptchaRequirement, verifyCaptcha } from "@/lib/abuse/captcha";
import { TurnstileProvider } from "@/lib/abuse/turnstile";
import {
  consumeCaptchaChallenge,
  consumeRateLimit,
  createAuthIntentRepository,
  hashAbuseKey,
} from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  createAuthIntent,
  inspectAuthIntent,
} from "@/lib/auth/intent";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { readPublicEnv, readServerEnv } from "@/lib/env";
import type { OtpActionState } from "@/lib/auth/form-state";
import { createClient } from "@/lib/supabase/server";

const BROWSER_BINDING_COOKIE = "handover-browser-binding";
const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function requestOtpAction(
  previous: OtpActionState,
  formData: FormData,
): Promise<OtpActionState> {
  await assertRequestOrigin();
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  const returnTo = sanitizeReturnTo(formData.get("returnTo"));
  if (!parsedEmail.success) {
    return { step: "email", returnTo, error: "Enter a valid email address." };
  }

  const email = parsedEmail.data;
  const requestContext = await readRequestContext();
  const [ipLimit, identityLimit, cooldown] = await Promise.all([
    consumeRateLimit({
      scope: "otp-request-ip",
      keyHash: hashAbuseKey(requestContext.ip),
      limit: 12,
      windowSeconds: 15 * 60,
    }),
    consumeRateLimit({
      scope: "otp-request-email",
      keyHash: hashAbuseKey(email),
      limit: 5,
      windowSeconds: 15 * 60,
    }),
    consumeRateLimit({
      scope: "otp-request-cooldown",
      keyHash: hashAbuseKey(email),
      limit: 1,
      windowSeconds: 60,
    }),
  ]);

  if (!ipLimit.allowed || !identityLimit.allowed) {
    return {
      step: "email",
      returnTo,
      error: "Too many requests. Wait a while and try again.",
    };
  }
  if (!cooldown.allowed) {
    if (previous.step === "code" && previous.intent) {
      return {
        ...previous,
        message: "A code was requested recently. Check your inbox before resending.",
      };
    }
    return {
      step: "email",
      email,
      returnTo,
      error: "A code was requested recently. Wait before trying again.",
    };
  }

  const captchaRequired = evaluateCaptchaRequirement({
    ipAttempts: ipLimit.attemptCount,
    identityAttempts: identityLimit.attemptCount,
    recentFailures: 0,
  });
  if (captchaRequired) {
    const captchaToken = formData.get("cf-turnstile-response");
    if (typeof captchaToken !== "string" || !captchaToken) {
      return {
        step: "email",
        email,
        returnTo,
        captchaRequired: true,
        error: "Complete the verification challenge and submit again.",
      };
    }
    try {
      const environment = readServerEnv();
      await verifyCaptcha({
        token: captchaToken,
        expectedAction: "request-otp",
        provider: new TurnstileProvider(
          environment.captchaSecretKey,
          requestContext.ip,
          environment.appUrl.hostname,
        ),
        replayStore: { consume: consumeCaptchaChallenge },
      });
    } catch {
      return {
        step: "email",
        email,
        returnTo,
        captchaRequired: true,
        error: "Verification could not be completed. Refresh it and try again.",
      };
    }
  }

  const binding = await getOrCreateBrowserBinding();
  let intent: string;
  try {
    ({ nonce: intent } = await createAuthIntent({
      repository: createAuthIntentRepository(),
      browserBinding: binding,
      purpose: "login",
      returnTo,
    }));
  } catch {
    return {
      step: "email",
      email,
      returnTo,
      error: "Sign-in is temporarily unavailable. Try again shortly.",
    };
  }

  const client = await createClient();
  await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  return {
    step: "code",
    email,
    intent,
    returnTo,
    message:
      "If the address can receive mail, a six-digit code is on its way.",
  };
}

export async function verifyOtpAction(
  _previous: OtpActionState,
  formData: FormData,
): Promise<OtpActionState> {
  await assertRequestOrigin();
  const parsed = z
    .object({
      email: emailSchema,
      token: z.string().trim().regex(/^\d{6}$/),
      intent: z.string().min(20).max(200),
      returnTo: z.string().optional(),
    })
    .safeParse({
      email: formData.get("email"),
      token: formData.get("token"),
      intent: formData.get("intent"),
      returnTo: formData.get("returnTo"),
    });
  if (!parsed.success) {
    return {
      step: "code",
      error: "Enter the six-digit code from the latest email.",
    };
  }

  const cookieStore = await cookies();
  const binding = cookieStore.get(BROWSER_BINDING_COOKIE)?.value;
  if (!binding) return invalidCodeState(parsed.data);

  const requestContext = await readRequestContext();
  const [ipLimit, identityLimit] = await Promise.all([
    consumeRateLimit({
      scope: "otp-verify-ip",
      keyHash: hashAbuseKey(requestContext.ip),
      limit: 30,
      windowSeconds: 15 * 60,
    }),
    consumeRateLimit({
      scope: "otp-verify-email",
      keyHash: hashAbuseKey(parsed.data.email),
      limit: 10,
      windowSeconds: 15 * 60,
    }),
  ]);
  if (!ipLimit.allowed || !identityLimit.allowed) {
    return {
      ...invalidCodeState(parsed.data),
      error: "Too many attempts. Wait a while and request a new code.",
    };
  }

  const repository = createAuthIntentRepository();
  let inspected: Awaited<ReturnType<typeof inspectAuthIntent>>;
  try {
    inspected = await inspectAuthIntent({
      repository,
      browserBinding: binding,
      purpose: "login",
      nonce: parsed.data.intent,
    });
  } catch {
    return invalidCodeState(parsed.data);
  }

  const client = await createClient();
  const { error } = await client.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error) return invalidCodeState(parsed.data);

  if (!(await repository.markConsumed(inspected.id, new Date()))) {
    await client.auth.signOut({ scope: "local" });
    return invalidCodeState(parsed.data);
  }

  redirect(inspected.returnTo);
}

export async function logoutAction() {
  await assertRequestOrigin();
  const client = await createClient();
  await client.auth.signOut({ scope: "local" });
  redirect("/login");
}

function invalidCodeState(data: {
  email: string;
  intent: string;
  returnTo?: string;
}): OtpActionState {
  return {
    step: "code",
    email: data.email,
    intent: data.intent,
    returnTo: sanitizeReturnTo(data.returnTo),
    error: "That code could not be used. Check the latest email or request a new one.",
  };
}

async function assertRequestOrigin() {
  const requestHeaders = await headers();
  assertSameOrigin({
    origin: requestHeaders.get("origin") ?? undefined,
    host: requestHeaders.get("host") ?? undefined,
    forwardedHost: requestHeaders.get("x-forwarded-host") ?? undefined,
  });
}

async function readRequestContext() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip:
      requestHeaders.get("cf-connecting-ip")?.trim() ||
      forwarded ||
      "unknown",
  };
}

async function getOrCreateBrowserBinding() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(BROWSER_BINDING_COOKIE)?.value;
  if (existing) return existing;

  const value = randomBytes(32).toString("base64url");
  cookieStore.set(BROWSER_BINDING_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: readPublicEnv().appUrl.protocol === "https:",
    maxAge: 24 * 60 * 60,
    path: "/",
    priority: "high",
  });
  return value;
}

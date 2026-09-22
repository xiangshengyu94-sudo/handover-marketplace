import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateCaptchaRequirement, verifyCaptcha } from "@/lib/abuse/captcha";
import { TurnstileProvider } from "@/lib/abuse/turnstile";
import { consumeCaptchaChallenge, consumeRateLimit, hashAbuseKey } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { consumeContactIntent } from "@/lib/contact/admin";
import { hashContactIntentToken } from "@/lib/contact/intent";
import { contactMessageSchema, digestContactPayload, publicDeliveryState } from "@/lib/contact/policy";
import { readServerEnv } from "@/lib/env";

const bodySchema = z.object({ token: z.string().min(32).max(256), message: contactMessageSchema, consent: z.literal(true), captchaToken: z.string().max(2_048).optional() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin({ origin: request.headers.get("origin") ?? undefined, host: request.headers.get("host") ?? undefined, forwardedHost: request.headers.get("x-forwarded-host") ?? undefined });
    const [{ id }, member, body] = await Promise.all([params, requireActiveMember(), request.json().then((value) => bodySchema.parse(value))]);
    const listingId = z.uuid().parse(id);
    const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const [ipLimit, memberLimit, listingLimit] = await Promise.all([
      consumeRateLimit({ scope: "contact-send-ip", keyHash: hashAbuseKey(ip), limit: 20, windowSeconds: 60 * 60 }),
      consumeRateLimit({ scope: "contact-send-member", keyHash: hashAbuseKey(member.id), limit: 12, windowSeconds: 60 * 60 }),
      consumeRateLimit({ scope: "contact-send-listing", keyHash: hashAbuseKey(`${member.id}:${listingId}`), limit: 3, windowSeconds: 24 * 60 * 60 }),
    ]);
    if (!ipLimit.allowed || !memberLimit.allowed || !listingLimit.allowed) return NextResponse.json({ error: "Contact limit reached. Wait before trying again." }, { status: 429 });
    const captchaRequired = evaluateCaptchaRequirement({ ipAttempts: ipLimit.attemptCount, identityAttempts: memberLimit.attemptCount, recentFailures: 0 });
    if (captchaRequired) {
      const environment = readServerEnv();
      try {
        await verifyCaptcha({ token: body.captchaToken, expectedAction: "contact-owner", provider: new TurnstileProvider(environment.captchaSecretKey, ip, environment.appUrl.hostname), replayStore: { consume: consumeCaptchaChallenge } });
      } catch {
        return NextResponse.json({ error: "Complete the verification challenge and try again.", captchaRequired: true }, { status: 403 });
      }
    }
    const { data, error } = await consumeContactIntent({ senderId: member.id, tokenHash: hashContactIntentToken(body.token), listingId, payloadHash: digestContactPayload(listingId, body.message), message: body.message });
    const queued = Array.isArray(data) ? data[0] : null;
    if (error || !queued) return NextResponse.json({ error: "This listing is not accepting new messages." }, { status: 409 });
    return NextResponse.json({ intentId: queued.intent_id, status: publicDeliveryState(String(queued.delivery_status)), updatedAt: queued.delivery_updated_at }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 400;
    return NextResponse.json({ error: status === 401 ? "Sign in to contact this owner." : "Contact request not accepted." }, { status });
  }
}

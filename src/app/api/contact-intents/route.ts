import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeRateLimit, hashAbuseKey } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { issueContactIntent } from "@/lib/contact/admin";
import { deriveContactIntentToken, hashContactIntentToken } from "@/lib/contact/intent";
import { contactRequestSchema, digestContactPayload } from "@/lib/contact/policy";

const bodySchema = contactRequestSchema.pick({ message: true, consent: true, requestKey: true }).extend({ listingId: z.uuid() }).strict();

export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const member = await requireActiveMember();
    const body = bodySchema.parse(await request.json());
    const ip = requestIp(request);
    const [ipLimit, memberLimit] = await Promise.all([
      consumeRateLimit({ scope: "contact-intent-ip", keyHash: hashAbuseKey(ip), limit: 30, windowSeconds: 15 * 60 }),
      consumeRateLimit({ scope: "contact-intent-member", keyHash: hashAbuseKey(member.id), limit: 20, windowSeconds: 15 * 60 }),
    ]);
    if (!ipLimit.allowed || !memberLimit.allowed) return NextResponse.json({ error: "Too many requests. Wait and try again." }, { status: 429 });
    const token = deriveContactIntentToken(member.id, body.requestKey);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1_000).toISOString();
    const { data, error } = await issueContactIntent({
      senderId: member.id, id: randomUUID(), requestKey: body.requestKey, listingId: body.listingId,
      tokenHash: hashContactIntentToken(token), payloadHash: digestContactPayload(body.listingId, body.message),
      message: body.message, expiresAt,
    });
    const intent = Array.isArray(data) ? data[0] : null;
    if (error || !intent) return unavailable();
    return NextResponse.json({ token, intentId: intent.intent_id, expiresAt: intent.intent_expires_at }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 400;
    return NextResponse.json({ error: status === 401 ? "Sign in to contact this owner." : "Contact request not accepted." }, { status });
  }
}

function unavailable() { return NextResponse.json({ error: "Contact request not accepted." }, { status: 400 }); }
function verifyOrigin(request: Request) { assertSameOrigin({ origin: request.headers.get("origin") ?? undefined, host: request.headers.get("host") ?? undefined, forwardedHost: request.headers.get("x-forwarded-host") ?? undefined }); }
function requestIp(request: Request) { return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip") || "unknown"; }

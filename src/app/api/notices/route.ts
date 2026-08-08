import { NextResponse } from "next/server";

import { consumeRateLimit, hashAbuseKey } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { illegalNoticeSchema } from "@/lib/moderation/schema";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin({ origin: request.headers.get("origin") ?? undefined, host: request.headers.get("host") ?? undefined, forwardedHost: request.headers.get("x-forwarded-host") ?? undefined });
    const body = illegalNoticeSchema.parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",",1)[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const limit = await consumeRateLimit({ scope: "illegal-notice-ip", keyHash: hashAbuseKey(ip), limit: 5, windowSeconds: 24 * 60 * 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Notice limit reached." }, { status: 429 });
    const client = await createClient(); const { data, error } = await client.rpc("submit_illegal_content_notice", { p_listing_id: body.listingId, p_category: body.category, p_explanation: body.explanation, p_good_faith_attested: body.goodFaithAttested });
    if (error || !data) throw new Error();
    return NextResponse.json({ receipt: data, status: "open" }, { status: 201 });
  } catch { return NextResponse.json({ error: "Notice not accepted. Add enough detail and try again." }, { status: 400 }); }
}

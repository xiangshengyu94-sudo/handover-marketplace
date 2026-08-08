import { NextResponse } from "next/server";

import { consumeRateLimit, hashAbuseKey } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { memberReportSchema } from "@/lib/moderation/schema";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin({ origin: request.headers.get("origin") ?? undefined, host: request.headers.get("host") ?? undefined, forwardedHost: request.headers.get("x-forwarded-host") ?? undefined });
    const member = await requireActiveMember(); const body = memberReportSchema.parse(await request.json());
    const limit = await consumeRateLimit({ scope: "member-report", keyHash: hashAbuseKey(member.id), limit: 10, windowSeconds: 24 * 60 * 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Report limit reached." }, { status: 429 });
    const client = await createClient(); const { data, error } = await client.rpc("submit_member_report", { p_listing_id: body.listingId, p_reason: body.reason, p_details: body.details });
    if (error || !data) throw new Error();
    return NextResponse.json({ receipt: data, status: "open" }, { status: 201 });
  } catch (caught) { const status = caught instanceof AuthorizationError ? caught.status : 400; return NextResponse.json({ error: status === 401 ? "Authentication required." : "Report not accepted." }, { status }); }
}

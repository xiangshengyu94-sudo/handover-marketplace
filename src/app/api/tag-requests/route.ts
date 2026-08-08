import { NextResponse } from "next/server";

import { consumeRateLimit, hashAbuseKey } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { taxonomyRequestSchema } from "@/lib/moderation/schema";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    sameOrigin(request); const member = await requireActiveMember();
    const parsed = taxonomyRequestSchema.parse(await request.json());
    const limit = await consumeRateLimit({ scope: "tag-request-member", keyHash: hashAbuseKey(member.id), limit: 5, windowSeconds: 24 * 60 * 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Tag request limit reached." }, { status: 429 });
    const client = await createClient();
    const { data, error } = await client.rpc("submit_taxonomy_request", { p_entity_type: parsed.entityType, p_payload: parsed.payload });
    if (error || !data) throw new Error();
    return NextResponse.json({ requestId: data, status: "open" }, { status: 201 });
  } catch (caught) { return failure(caught); }
}

function sameOrigin(request: Request) { assertSameOrigin({ origin: request.headers.get("origin") ?? undefined, host: request.headers.get("host") ?? undefined, forwardedHost: request.headers.get("x-forwarded-host") ?? undefined }); }
function failure(caught: unknown) { const status = caught instanceof AuthorizationError ? caught.status : 400; return NextResponse.json({ error: status === 401 ? "Authentication required." : "Request not accepted." }, { status }); }

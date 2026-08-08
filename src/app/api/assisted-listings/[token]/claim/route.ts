import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAssistedClaim } from "@/lib/assisted/claims";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const actionSchema = z.object({ action: z.enum(["claim", "reject"]) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin({ origin: request.headers.get("origin") ?? undefined, host: request.headers.get("host") ?? undefined, forwardedHost: request.headers.get("x-forwarded-host") ?? undefined });
    const member = await requireActiveMember();
    const token = tokenSchema.parse((await params).token);
    const { action } = actionSchema.parse(await request.json());
    const result = await resolveAssistedClaim({ token, claimantId: member.id, email: member.email, action });
    if (!result) return NextResponse.json({ error: "This invitation is unavailable." }, { status: 409 });
    return NextResponse.json({ status: result.status, destination: action === "claim" ? `/listings/${result.listingId}/edit` : "/dashboard" }, { headers: { "cache-control": "no-store" } });
  } catch (caught) {
    const status = caught instanceof AuthorizationError ? caught.status : 400;
    return NextResponse.json({ error: status === 401 ? "Authentication required." : "Invitation request not accepted." }, { status });
  }
}

import { NextResponse } from "next/server";

import { createAssistedDraft } from "@/lib/assisted/claims";
import { createAssistedInputSchema } from "@/lib/assisted/schema";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/require-role";
import { validatePublicListingText } from "@/lib/listings/public-text-policy";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin({ origin: request.headers.get("origin") ?? undefined, host: request.headers.get("host") ?? undefined, forwardedHost: request.headers.get("x-forwarded-host") ?? undefined });
    const operator = await requireRole("operator");
    const client = await createClient();
    const { data: categories, error } = await client.from("resource_categories").select("id, kind").eq("status", "active");
    if (error || !categories) return unavailable();
    const parsed = createAssistedInputSchema(categories).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Assisted draft fields are invalid.", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    const listing = parsed.data.listing;
    const textIssues = validatePublicListingText({ title: listing.title, description: listing.description, approximateArea: listing.approximateArea, pickupArea: listing.kind === "item" ? listing.item.pickupArea : undefined });
    if (textIssues.length) return NextResponse.json({ error: "Remove contact details, private links, and exact addresses from public fields." }, { status: 400 });
    const result = await createAssistedDraft(operator.id, parsed.data);
    return NextResponse.json({ listingId: result.listingId, claimUrl: `/assisted/${result.token}`, expiresAt: result.expiresAt }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (caught) {
    const status = caught instanceof AuthorizationError ? caught.status : 400;
    return NextResponse.json({ error: status === 401 ? "Authentication required." : status === 403 ? "Operator access required." : "Assisted draft not accepted." }, { status });
  }
}

function unavailable() { return NextResponse.json({ error: "Assisted intake is unavailable." }, { status: 503 }); }

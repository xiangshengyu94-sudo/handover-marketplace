import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { publicDeliveryState } from "@/lib/contact/policy";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ intentId: string }> }) {
  try {
    await requireActiveMember();
    const intentId = z.uuid().parse((await params).intentId);
    const client = await createClient();
    const { data, error } = await client.rpc("get_own_contact_status", { p_intent_id: intentId });
    const status = Array.isArray(data) ? data[0] : null;
    if (error || !status) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ intentId, status: publicDeliveryState(String(status.delivery_status)), updatedAt: status.delivery_updated_at }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthorizationError && error.status === 401 ? "Authentication required." : "Not found." }, { status: error instanceof AuthorizationError ? error.status : 404 });
  }
}

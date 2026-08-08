import { NextResponse } from "next/server";

import { applyResendEvent } from "@/lib/email/dispatcher";
import { verifyResendWebhook } from "@/lib/email/resend";

export async function POST(request: Request) {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  try {
    const event = verifyResendWebhook({ payload: await request.text(), id, timestamp, signature });
    if (!("email_id" in event.data)) return NextResponse.json({ received: true, applied: false });
    const applied = await applyResendEvent({ eventId: id, providerEmailId: event.data.email_id, type: event.type, occurredAt: event.created_at });
    return NextResponse.json({ received: true, applied });
  } catch {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }
}

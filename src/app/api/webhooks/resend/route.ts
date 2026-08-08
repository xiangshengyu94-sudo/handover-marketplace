import { NextResponse } from "next/server";

import { applyResendEvent } from "@/lib/email/dispatcher";
import { verifyResendWebhook } from "@/lib/email/resend";
import { captureOperationalFailure } from "@/lib/monitoring/sentry";

export async function POST(request: Request) {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    captureOperationalFailure("webhook-signature-or-replay-failures");
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  let event: ReturnType<typeof verifyResendWebhook>;
  try {
    event = verifyResendWebhook({ payload: await request.text(), id, timestamp, signature });
  } catch {
    captureOperationalFailure("webhook-signature-or-replay-failures");
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  if (!("email_id" in event.data)) {
    return NextResponse.json({ received: true, applied: false });
  }

  try {
    const applied = await applyResendEvent({ eventId: id, providerEmailId: event.data.email_id, type: event.type, occurredAt: event.created_at });
    return NextResponse.json({ received: true, applied });
  } catch {
    captureOperationalFailure("webhook-processing-failures");
    return NextResponse.json(
      { error: "Webhook processing unavailable." },
      { status: 503 },
    );
  }
}

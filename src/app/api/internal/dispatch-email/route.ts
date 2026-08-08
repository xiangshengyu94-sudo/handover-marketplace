import { NextResponse } from "next/server";

import { dispatchContactBatch, dispatchNotificationBatch } from "@/lib/email/dispatcher";
import { readServerEnv } from "@/lib/env";
import { matchesBearerSecret } from "@/lib/http/internal-secret";
import { captureOperationalFailure } from "@/lib/monitoring/sentry";

export async function POST(request: Request) {
  let expected: string;
  try {
    expected = readServerEnv().cronDispatchSecret;
  } catch {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
  if (!matchesBearerSecret(request, expected)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const [contacts, notifications] = await Promise.all([
      dispatchContactBatch(10),
      dispatchNotificationBatch(10),
    ]);
    return NextResponse.json({
      processed: contacts.length + notifications.length,
      contacts,
      notifications,
    });
  } catch {
    captureOperationalFailure("contact-send-failure-rate");
    return NextResponse.json({ error: "Dispatch failed." }, { status: 503 });
  }
}

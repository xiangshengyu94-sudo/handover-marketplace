import { NextResponse } from "next/server";

import { readServerEnv } from "@/lib/env";
import { matchesBearerSecret } from "@/lib/http/internal-secret";
import { captureOperationalCanary } from "@/lib/monitoring/sentry";

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = readServerEnv().monitoringCanarySecret;
  } catch {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
  if (!matchesBearerSecret(request, secret)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const eventId = await captureOperationalCanary("launch-readiness");
  if (!eventId) {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
  return NextResponse.json({ captured: true, eventId });
}

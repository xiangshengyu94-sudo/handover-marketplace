import { NextResponse } from "next/server";

import { readServerEnv } from "@/lib/env";
import { matchesBearerSecret } from "@/lib/http/internal-secret";
import { captureOperationalFailure } from "@/lib/monitoring/sentry";
import { runRetention } from "@/lib/retention/cleanup";

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = readServerEnv().cronRetentionSecret;
  } catch {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
  if (!matchesBearerSecret(request, secret)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    return NextResponse.json(await runRetention());
  } catch {
    captureOperationalFailure("cleanup-consecutive-failures");
    return NextResponse.json({ error: "Retention failed." }, { status: 503 });
  }
}

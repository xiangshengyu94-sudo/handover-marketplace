import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { OPERATIONAL_SIGNALS } from "@/lib/monitoring/signals";

type OperationalSignalKey = (typeof OPERATIONAL_SIGNALS)[number]["key"];
type OperationalCanaryName = "launch-readiness";

const CANARY_FLUSH_TIMEOUT_MS = 2_000;

export async function captureOperationalCanary(
  name: OperationalCanaryName,
): Promise<string | null> {
  const client = Sentry.getClient();
  if (!client?.getDsn() || !Sentry.isEnabled()) return null;

  try {
    const eventId = Sentry.captureMessage(`operational-canary:${name}`, {
      level: "info",
      tags: { synthetic: "true", containsPii: "false" },
    });
    const flushed = await Sentry.flush(CANARY_FLUSH_TIMEOUT_MS);
    return flushed ? eventId : null;
  } catch {
    return null;
  }
}

export function captureOperationalFailure(signal: OperationalSignalKey) {
  Sentry.captureMessage(`operational-failure:${signal}`, {
    level: "error",
    tags: { operationalSignal: signal, containsPii: "false" },
  });
}

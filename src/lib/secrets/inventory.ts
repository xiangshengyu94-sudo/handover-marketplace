export const SECRET_INVENTORY = [
  {
    variable: "SUPABASE_SECRET_KEY",
    purpose: "database-administration",
    exposure: "server-only",
    rotationOwner: "database-owner",
  },
  {
    variable: "RESEND_API_KEY",
    purpose: "transactional-email",
    exposure: "server-only",
    rotationOwner: "infrastructure-email-owner",
  },
  {
    variable: "RESEND_WEBHOOK_SECRET",
    purpose: "webhook-verification",
    exposure: "server-only",
    rotationOwner: "infrastructure-email-owner",
  },
  {
    variable: "CRON_DISPATCH_SECRET",
    purpose: "scheduled-dispatch",
    exposure: "server-only",
    rotationOwner: "infrastructure-owner",
  },
  {
    variable: "CRON_RETENTION_SECRET",
    purpose: "scheduled-retention",
    exposure: "server-only",
    rotationOwner: "database-owner",
  },
  {
    variable: "MONITORING_CANARY_SECRET",
    purpose: "monitoring-canary",
    exposure: "server-only",
    rotationOwner: "infrastructure-owner",
  },
  {
    variable: "ASSISTED_CLAIM_HMAC_SECRET",
    purpose: "assisted-claim-signing",
    exposure: "server-only",
    rotationOwner: "security-owner",
  },
  {
    variable: "CAPTCHA_SECRET_KEY",
    purpose: "bot-challenge",
    exposure: "server-only",
    rotationOwner: "security-owner",
  },
  {
    variable: "ABUSE_HASH_SECRET",
    purpose: "abuse-identifier-hashing",
    exposure: "server-only",
    rotationOwner: "security-owner",
  },
  {
    variable: "SENTRY_AUTH_TOKEN",
    purpose: "telemetry-upload",
    exposure: "build-server-only",
    rotationOwner: "infrastructure-owner",
  },
] as const;

type RotationWindow = {
  current: string;
  previous?: string;
  previousValidUntil?: Date;
  now?: Date;
};

export function validateRotationWindow({
  current,
  previous,
  previousValidUntil,
  now = new Date(),
}: RotationWindow) {
  if (!current.trim()) {
    throw new Error("The current secret is required.");
  }

  if (!previous) {
    return;
  }

  if (current === previous) {
    throw new Error("A rotation must not reuse the previous secret.");
  }

  if (!previousValidUntil || previousValidUntil <= now) {
    throw new Error("The previous secret overlap has expired.");
  }
}

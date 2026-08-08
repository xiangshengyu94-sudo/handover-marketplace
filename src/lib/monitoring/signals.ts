export const OPERATIONAL_SIGNALS = [
  { key: "otp-delivery-failure-rate", owner: "infrastructure-email-owner", threshold: ">5%", window: "15m", destination: "email-ops", action: "Check Supabase Auth and SMTP provider; pause new traffic if sustained." },
  { key: "contact-send-failure-rate", owner: "infrastructure-email-owner", threshold: ">5%", window: "15m", destination: "email-ops", action: "Inspect provider status and retry queue without changing idempotency keys." },
  { key: "contact-duplicate-rate", owner: "database-owner", threshold: ">0", window: "24h", destination: "security-privacy", action: "Stop dispatcher and preserve outbox/provider evidence." },
  { key: "oldest-contact-queue-age", owner: "infrastructure-email-owner", threshold: ">10m", window: "5m", destination: "email-ops", action: "Verify Cron, leases, provider availability, and scheduler secret." },
  { key: "webhook-signature-or-replay-failures", owner: "security-owner", threshold: ">10", window: "5m", destination: "security-privacy", action: "Inspect source and signing-key rotation; block abusive origins upstream." },
  { key: "webhook-processing-failures", owner: "infrastructure-email-owner", threshold: ">0", window: "5m", destination: "email-ops", action: "Inspect database availability and webhook persistence; preserve the event for provider replay." },
  { key: "expiry-job-lag", owner: "database-owner", threshold: ">10m", window: "5m", destination: "database-ops", action: "Run retention canary; public query-time expiry remains authoritative." },
  { key: "cleanup-consecutive-failures", owner: "database-owner", threshold: ">=3", window: "24h", destination: "database-ops", action: "Pause destructive cleanup and inspect paths; do not relax visibility predicates." },
  { key: "orphaned-storage-cleanup-errors", owner: "infrastructure-owner", threshold: ">0", window: "1h", destination: "database-ops", action: "Reconcile generation-bound image rows and private bucket objects." },
  { key: "authorization-privacy-signal", owner: "security-owner", threshold: ">0 confirmed", window: "immediate", destination: "security-privacy", action: "Contain traffic, revoke affected access, and preserve audit evidence." },
  { key: "urgent-report-age", owner: "moderation-on-call", threshold: ">30m", window: "5m", destination: "moderation-urgent", action: "Page primary and deputy; hide credible high-risk content while assessing." },
  { key: "notification-backlog-age", owner: "moderation-on-call", threshold: ">15m", window: "5m", destination: "moderation-ops", action: "Inspect independent notification leases; do not repeat moderation decisions." },
] as const;

# Production launch checklist

Every field needs a production-specific value, owner, UTC timestamp, and evidence link. `[record]` is deliberately incomplete and therefore a launch blocker.

## Authority, privacy, and moderation

- [ ] Operating entity, jurisdiction, controller/contact: `[record]`
- [ ] DSA service classification and notice obligations approved by: `[record]`
- [ ] GDPR lawful bases, DPIA decision, data-subject process, retention schedule, and legal-hold procedure approved by qualified reviewer: `[record]`
- [ ] Supabase, Resend, Vercel, Sentry, and any Cloudflare DPAs/subprocessors/retention reviewed: `[record]`
- [ ] Moderation primary/deputy, published coverage, urgent destination, 30-minute SLA, appeal/escalation contact: `[record]`
- [ ] Release commander, database owner/deputy, infrastructure/email owner/deputy, privacy/security approver/deputy: `[record]`

## Exact production environment

- [ ] Vercel team/project/deployment ID, production origin, function region: `[record]`
- [ ] Supabase organization/project reference, API/Auth/Storage/database regions: `[record]`
- [ ] Auth Site URL and complete allow-listed redirect URLs contain production only: `[record]`
- [ ] Publishable and secret key fingerprints are production-specific; preview/staging cannot address production and production cannot address staging: `[record]`
- [ ] Resend account/domain/from-address/API-key fingerprint/webhook URL/event types/signing-key owner: `[record]`
- [ ] DNS SPF, DKIM, DMARC and sending-domain provider status verified: `[record]`
- [ ] Dispatcher and retention scheduler project, target origin, Vault secret, cadence, last-success evidence: `[record]`
- [ ] Sentry project/DSN environment/release/alert destinations, purpose-specific canary secret, and canary event: `[record]`
- [ ] Turnstile site/secret key hostnames and fail-closed provider behavior: `[record]`
- [ ] Backup region, retention, PITR window, last restore rehearsal and approved cross-region/data-residency path: `[record]`

Stop for any unapproved cross-region transfer, staging project/key/URL, missing production redirect, unresolved DNS/provider state, shared purpose secret, or missing restoration evidence.

## Build and security evidence

- [ ] Node 24 clean `npm ci`, lint, typecheck, unit, database reset/pgTAP, Storage matrix, E2E, accessibility, build, and dependency advisory evidence attached.
- [ ] No unresolved relevant critical/high advisory; current Next.js, Supabase, Vercel, Resend, Sentry, and Turnstile release notices reviewed.
- [ ] Privileged import allowlist, environment isolation, same-origin mutation checks, RLS/grants, raw-body webhook verification, and secret rotation tested.
- [ ] Public HTML/RSC/API/log/cache scan contains no secret, private schema field, raw contact address/body, claim evidence, or provider payload.
- [ ] Full migration chain and representative PITR restore rehearsal pass with counts/runtime/locks recorded.

## Product and pilot readiness

- [ ] Named city and one to three initial partner/community labels: `[record]`
- [ ] Supply lead evidence: ≥20 owners, ≥30 current author-confirmed listings, ≥10 housing, ≥15 items.
- [ ] Housing/item warnings, prohibited-content policy, public safety/privacy/terms, account privacy, report/notice receipts, and moderation/admin journeys reviewed on desktop/mobile/keyboard.
- [ ] City activation gates and go/iterate/stop scorecard accepted; organization labels explicitly do not verify membership.

## Cutover and observation

- [ ] Pre-deploy invariant output and baseline/backup evidence signed.
- [ ] Migration-complete evidence signed; no unexplained row loss, grant drift, long lock, or restore issue.
- [ ] Real production OTP, contact/reply, signed/replayed/invalid webhook, bounce/suppression/failure/retry, image revocation, and privacy cleanup canaries pass once without duplicate/leakage.
- [ ] Every operational signal has live ingestion, dashboard, threshold/window, owner/deputy, destination, and tested runbook action.
- [ ] Cutover, +5 minute, +1 hour, and +24 hour observations are signed with no abort threshold.

## Decision

- Decision: `[NO-GO until all unchecked fields are evidenced]`
- Release commander / UTC: `[record]`
- Database/migration owner / UTC: `[record]`
- Infrastructure/email owner / UTC: `[record]`
- Privacy/security approver / UTC: `[record]`
- Moderation on-call / UTC: `[record]`
- Commit, migration head, production deployment ID: `[record]`

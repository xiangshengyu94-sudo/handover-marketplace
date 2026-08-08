# Production deployment, migration, and observation runbook

## Named command roles

Record a primary and deputy for each role before starting: release commander; database/migration owner; infrastructure/email owner; privacy/security approver; moderation on-call. One person may fill multiple roles only when coverage and independent privacy approval remain credible. An unfilled role is a no-go.

## Migration classification

There are no automated down migrations. Classification describes the safe recovery after production side effects begin.

| Migration | Owner | Classification after use | Recovery posture |
|---|---|---|---|
| `001_core_taxonomy_and_listings` | Database owner | Restore-required | Foundational types/tables; recover from tested PITR/snapshot |
| `002_private_schemas_roles_and_rls` | Database + security | Forward-fix-only | Never roll security policy backward while traffic is live |
| `003_auth_intents_and_abuse_controls` | Database + infrastructure | Forward-fix-only | Preserve Auth/provider side effects; deploy compatible fix |
| `004_authoring_and_private_media` | Database + storage | Forward-fix-only | Reconcile private objects and generation-bound rows |
| `005_public_discovery_and_lifecycle` | Database owner | Forward-fix-only | Preserve history/outbox; correct functions and projections |
| `006_contact_relay` | Database + email | Forward-fix-only | Provider sends cannot be undone; retain idempotency evidence |
| `007_assisted_intake` | Database + privacy | Forward-fix-only | Revoke invitations and hide drafts before correction |
| `008_moderation_and_taxonomy` | Database + moderation | Forward-fix-only | Append reversals; never rewrite audit history |
| `009_retention_and_privacy` | Database + privacy | Forward-fix-only | Tombstones/provider cleanup are coordinated; restore only for unexplained row loss |

Code rollback alone is insufficient after database, Auth, Storage, email, webhook, or scheduler effects. If compatibility cannot be preserved, contain traffic and use the proven database restore procedure; reconcile irreversible provider actions separately.

## Production-like rehearsal

1. Restore a recent sanitized production-like snapshot into staging. It must contain representative Auth users, private Storage objects, active/expired/deleted listings, housing/item details, assisted drafts/claims, contact and notification outboxes in every state, reports/notices, moderation history, roles, privacy retries, and stale transient rows.
2. Record baseline counts per table, Storage bucket/object count, oldest/newest timestamps, outbox status counts, and a checksum/sample of critical rows.
3. Prove backup creation, retention, and PITR restore into an isolated project. Record restore point, duration, operator, project ID, and comparison to baseline.
4. Apply the complete migration chain while recording runtime, longest lock/wait, database load, warnings, and post-migration counts. Exercise concurrent representative reads/writes.
5. Run reset, pgTAP, Storage role matrix, `invariants.sql`, app tests, and provider staging canaries.
6. Rehearse both forward-fix and restore-required paths. Unexpected row loss, unexplained count drift, a long/blocking lock beyond the approved maintenance budget, failed restoration, or public-role access drift is a no-go.

## Promotion order

1. Freeze unrelated production changes; confirm owners, backups, current project IDs, secrets, regions, provider status, and abort channel.
2. Capture pre-deploy counts, queue age, grants/RLS, invariants, provider dashboards, and backup evidence.
3. Deploy schema/functions/grants first. Keep application compatibility with the previous and new schema.
4. Run invariants and representative visitor/member/moderator reads before deploying the application.
5. Deploy the compatible application. Confirm no staging URL, key, webhook, scheduler, or Storage project is referenced.
6. Run production Auth/email/webhook/Storage/privacy canaries with controlled data.
7. Enable email dispatcher and non-destructive scheduled work. Enable retention cleanup only after post-cutover invariants and backup evidence remain green.
8. Start general traffic only on release-commander approval. Observe through +24 hours.

## Production invariant evidence

Run [`invariants.sql`](./invariants.sql) as database owner and store the unedited output. Unless explicitly approved below, expected violations are zero and any nonzero result stops launch.

| Invariant/evidence | Expected | Owner | Stop condition |
|---|---:|---|---|
| Public tables have intended grants plus enabled/forced RLS | 0 violations | Database/security | Any missing RLS or grant drift |
| No public role can reach private/outbox/moderation/report/claim/privacy tables or admin RPCs | 0 | Security | Any reachable object |
| Exactly one kind-detail and category kind match | 0 | Database | Any malformed listing |
| Public city/category/organization context is active | 0 | Product/database | Any stale/ineligible context exposed |
| Lifecycle, moderation, deletion, and expiry state is current | 0; expiry lag 0 after canary | Database | Any ineligible public row or persistent lag |
| Contact intent/idempotency keys remain unique | 0 | Database/email | Any duplicate; stop dispatcher |
| Public image authorization points only to sanitized current media | 0 | Storage/security | Any original/deleted/ineligible media path |
| Moderation history append-only trigger is enabled | 0 missing | Moderation/database | Missing/disabled trigger |
| Privacy receipts, cleanup leases, and job state are service-only | 0 public access | Privacy/security | Any public access or lost retry payload |

Evidence record at each checkpoint: UTC timestamp, production project ID, git commit, migration head, operator, query output, provider screenshot/link, observed value, and approval/exception. Unapproved exceptions are no-go.

## Production provider canaries

Before general traffic, using controlled real addresses:

1. Request OTP and prove request, provider acceptance, inbox delivery, code completion, and correct redirect.
2. Send one contact message; prove owner delivery, protected reply behavior, and one provider message for one outbox row.
3. Deliver a real signed Resend event and prove it advances only the intended row once. Replay the event and submit an invalid signature; neither may duplicate or regress state.
4. Exercise delayed, bounce, suppression, and permanent-failure visibility. Retry a controlled transient failure with the same idempotency key and prove no duplicate.
5. Upload/process/read/delete a controlled image and measure public authorization revocation.
6. Exercise export and deletion, force one provider cleanup failure, then prove the leased retry completes without re-exposing the account.

Record enabled webhook event types, production URL, signing-secret rotation owner, provider IDs, timestamps, and dashboard evidence. Timeout, missing event, duplicate send, silent bounce/suppression, provider mismatch, or leaked address/body is a no-go.

## Monitoring and abort thresholds

`src/lib/monitoring/signals.ts` is the machine-checked signal inventory. The production dashboard and alert transport must map every key to the recorded owner, destination, threshold/window, and runbook action. Send an authenticated real Sentry canary before launch: the endpoint must return `200` with an event ID, and the operator must find that same ID in Sentry before completing the page/email test. A `503`, a missing event, or an unverified alert blocks launch.

Abort or contain immediately for any confirmed RLS/privacy exposure, duplicate contact delivery, ineligible public listing/media, failed migration/restore, staging credential in production, or unstaffed urgent moderation. Pause new traffic when OTP/contact failures exceed 5% for 15 minutes, oldest contact queue exceeds 10 minutes, expiry lag exceeds 10 minutes, or cleanup reaches three consecutive failures. Cleanup may be paused; query-time expiry and deletion visibility may not be relaxed.

Containment order: stop general traffic and affected workers, preserve logs/outbox/provider IDs, revoke compromised secrets/access, keep public reads fail-closed, decide forward fix versus proven restore, reconcile Auth/Storage/email effects, rerun invariants/canaries, and obtain privacy/security plus release approval before reopening.

## Timed go/no-go record

| Checkpoint | Required evidence | Required sign-off |
|---|---|---|
| Pre-deploy | Owners/deputies, backup/PITR, baselines, environment/region, clean invariants | All five roles |
| Migration complete | Runtime/locks/counts, grants/RLS, migration head, restore posture | Database + security + release |
| Application cutover | Commit/origin, journeys, production provider canaries, workers still controlled | Release + infrastructure + privacy |
| +5 minutes | Auth/contact error rates, queues, webhook, public privacy probes, urgent staffing | Release + infrastructure + moderation |
| +1 hour | All dashboards/alerts/jobs, invariants, Storage cleanup, representative journeys | All five roles |
| +24 hours | No abort threshold, queues current, backups healthy, expiry/deletion effective, incident review | All five roles |

Launch closes only after the +24-hour record is signed. A missed checkpoint, missing deputy, or unverifiable observation keeps the release open and blocks expansion.

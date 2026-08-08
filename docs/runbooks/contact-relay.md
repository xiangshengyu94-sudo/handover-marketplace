# Contact relay provider setup

## Production boundary

The browser creates and consumes a short-lived, sender/listing/payload-bound intent. It receives only an intent identifier and a coarse delivery state. Owner and sender email addresses are resolved inside `src/lib/email/dispatcher.ts` immediately before provider submission and are never stored in the contact outbox or returned by an application route.

## Resend

1. Verify the production sending domain and set `EMAIL_FROM` to an address on that domain.
2. Create a production-only API key as `RESEND_API_KEY`.
3. Create `POST /api/webhooks/resend` with only these event types enabled: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.suppressed`, and `email.failed`.
4. Store the endpoint signing secret as `RESEND_WEBHOOK_SECRET`. The route verifies the unmodified request body and `svix-id`, `svix-timestamp`, and `svix-signature` headers before writing an event.
5. Rotate the API and signing keys separately. During a signing-key overlap, deploy explicit old/new verification support before changing the provider; do not reuse an API key as a webhook or scheduler secret.

Provider submissions use `contact/{intent-id}` as the Resend idempotency key. Resend documents a 24-hour idempotency window, so this worker stops retrying before 23 hours rather than risking a duplicate after provider deduplication expires.

## Scheduled dispatcher

Set a production-only random `CRON_DISPATCH_SECRET`. Configure Supabase Cron to call `POST /api/internal/dispatch-email` every minute with `Authorization: Bearer <secret>`. Store the origin and token in Supabase Vault; do not place either production value in a migration or source control. The endpoint returns 404 for a wrong credential and never includes an address or message body in its response.

Confirm the Cron history shows a successful run, then exercise queued, provider-accepted, delivered, delayed, bounce, suppressed, retry, and terminal-failure states using controlled addresses. A response timeout is retried with the same provider idempotency key. A webhook that arrives before the send response remains in the event inbox and is projected when the provider email ID is attached.

## Launch stop conditions

- The sending domain, production webhook, or scheduler target is not verified.
- A retry produces two provider messages for one outbox row.
- An invalid/replayed webhook changes state, or a valid signed event regresses state.
- Owner email or contact body appears in browser output, public logs, cache entries, or route error responses.
- The oldest queued/retrying message exceeds the alert threshold without an assigned operator.

Official references: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests), and [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

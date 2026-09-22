# ReLoop pilot release review — 2026-09-22

Scope: local Next.js application and migrations compared with the existing
GitHub `main` static preview. Reviewers covered correctness, security, and
database migration behavior. Typecheck, lint, 219 unit tests, and the
production build passed locally after the security changes.

## Release fixes

- Direct client calls could bypass contact-email limits and anonymous notice
  limits. `202609220001_restrict_contact_and_notice_ingress.sql` adds
  service-only wrappers, then the application switches to them, and
  `202609220002_close_direct_contact_and_notice_ingress.sql` closes client
  grants. Keep those grants closed during rollback.

## Follow-up work

- OTP CAPTCHA is requested only after its rate-limit allowance is consumed;
  a challenged retry can be blocked. Rework the counter/challenge sequence.
- An OTP resend supersedes the prior browser intent before provider delivery
  succeeds. Make intent activation conditional on successful delivery.
- Moving a listing to another city can fail while old organization tags are
  still attached. Reorder the atomic update/association changes.
- Listing detail text is still partly English after changing locale. Complete
  translations on that page.
- Public listing rows still expose `owner_id` via direct Supabase access.
  Column grants alone break existing RLS policies on related tables; replace
  those predicates with safe definer helpers or a public projection before
  general traffic.
- Historical migration files were edited to use Supabase's current
  `auth.users.email_change` column. The current production functions already
  use that column, but migration history is absent. Reconcile the baseline
  before introducing automated database pushes; see the deployment runbook.

No general-traffic readiness claim follows from this pilot deploy. The
production provider canaries, backup/recovery evidence, monitoring, and
moderation coverage in the deployment runbook remain separate launch gates.

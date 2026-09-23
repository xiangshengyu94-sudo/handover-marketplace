# ReLoop pilot release review — 2026-09-22

Scope: local Next.js application and migrations compared with the existing
GitHub `main` static preview. Reviewers covered correctness, security, and
database migration behavior. Typecheck, lint, 218 unit tests, and the
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
- The `?kind=other` browse URL loads, but its radio control still displays
  "Everything". Keep the selected filter in sync with the URL.
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

## Pilot cutover evidence — 2026-09-23

- Supabase production project: `tcqundkadurrpbsnzlhx`. Preflight found the
  three old RPCs, no new contact wrappers, zero listings, and no tracked
  migration history. Both new SQL phases were applied separately through the
  SQL Editor, each in an explicit transaction with prerequisite checks.
- After the expand phase, the two new wrappers were `SECURITY DEFINER`,
  executable by `service_role` but not `anon` or `authenticated`; the old
  grants remained for the previous application build.
- Vercel production deployment `dpl_E3TK12NDGkzvpCt5JLPtgHBYqzzL` reached
  Ready and was aliased to `https://joinreloop.vercel.app`. The public home and
  login pages loaded; the login page described a six-digit code. No real OTP,
  contact delivery, or notice submission was performed in this cutover.
- After the contract phase, all five contact/notice functions were denied to
  `anon` and `authenticated` and executable by `service_role`. The public home
  still loaded after the permission change. GitHub `main` points to merge
  commit `c3b7a11`, whose tree is identical to the deployed `c6eed10` tree;
  old preview commits remain in its ancestry. The current unit suite passes
  (43 files, 218 tests).

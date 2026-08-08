# Data retention and privacy operations

These are pilot defaults, subject to approval by the operating entity’s qualified EU privacy/legal reviewer. A legal hold suspends only the named deletion rule, requires a recorded scope/reason/owner/review date, and never republishes hidden content.

| Data class | Purpose and visibility | Default retention | Export and deletion | Provider / hold handling |
|---|---|---|---|---|
| Auth account and profile | OTP access; profile is not public contact data | Active account lifetime | Email/profile exported; deletion tombstones profile before provider cleanup and soft-deletes Auth | Supabase Auth; partial cleanup is durably retried; legal hold preserves only required account evidence |
| Listings and kind details | Public handover notice while eligible | Owner lifecycle; public expiry is enforced at read time | Owner export includes listing content; account deletion hides and tombstones all listings immediately | Postgres and cache invalidation; moderation/legal references may require tombstone retention |
| Organization/city/category links | Discovery context, not verified affiliation | Listing lifetime | Included through listing context; removed from public view with listing | No organization membership claim or roster is stored |
| Original and sanitized images | Display authorized listing media | Staged/failed objects: 24h; eligible media: listing lifetime | Account/listing deletion revokes DB authorization first and schedules both private buckets for removal | Supabase Storage; generation binding prevents stale worker resurrection; failed removal alerts and retries |
| Contact message body | Deliver one relayed message | 30 days from creation | Included in sender export only while retained; purged for sender or owner deletion | Resend receives delivery payload; production provider-retention settings must be recorded separately |
| Contact intent/outbox metadata | Idempotency, status, abuse and delivery evidence | Pilot default 180 days; metadata cleanup requires approved production migration before that horizon | Status/IDs are exportable; body purge is independent | Private Postgres only; no owner email is stored in the outbox |
| Provider webhook events | Project delivery state and prevent replay | Pilot default 180 days pending provider/legal approval | Not user-facing; event IDs never expose message bodies | Private Postgres and Resend dashboard; preserve only for a scoped incident hold |
| Assisted claim token/HMAC | Let the intended account claim/reject a private draft | Pending until token expiry; terminal evidence retained under approved moderation schedule | Draft transfers to claimant export after claim; rejected content is erased | Hash/HMAC only, never raw group membership or invitation |
| Reports and illegal-content notices | Safety, legal notice handling and appeals | Case lifetime plus approved statutory/defence period | Member-authored reports included in export; third-party identities and internal decisions excluded | Private Postgres; legal holds are likely and require case-level review |
| Moderation and role audit | Explain and reverse protected decisions | Append-only for approved accountability period | Not deleted with public content; disclose only data-subject content required by review | Private Postgres; history cannot be edited or deleted by application roles |
| Auth intents/CAPTCHA/rate buckets | OTP binding and abuse control | Auth intent/CAPTCHA 24h; rate buckets 7d | Not exported; deleted automatically | Hashes only; purpose-separated abuse secret |
| Privacy requests/job state | Durable receipts, retry and operational evidence | Approval required; minimum through provider-cleanup completion and dispute window | Receipt is returned; provider work remains private | Private service-only Postgres; never public logs or analytics |

## Automated job

`POST /api/internal/retention` requires the purpose-specific `CRON_RETENTION_SECRET`. It materializes expired states, purges old contact bodies, expires pending assisted claims, removes stale/deleted image authorization, clears transient auth/abuse rows, cleans private Storage objects, and retries partial account-provider cleanup. Query-time expiry and deletion visibility remain authoritative if Cron stops.

Cleanup is idempotent. Storage failure increments job failure state and must alert; operators may pause destructive cleanup without weakening public visibility. Run the production job only after migration and invariant gates pass.

## User requests

- Export requires an active verified account, same-origin POST, private no-store response, and a durable receipt.
- Deletion requires literal `DELETE` confirmation. Database visibility, queued communication, roles, and media authorization change before Auth/Storage calls.
- Successful provider cleanup clears the private retry payload. Partial cleanup retains private object paths and Auth user ID behind a lease/backoff worker; the public account remains deleted.
- The final administrator cannot delete their account until another administrator is safely bootstrapped.

## Approval record

Before launch record reviewer, operating entity, jurisdiction, lawful-basis assessment, DSA classification, DPIA decision, provider data-processing terms, each final retention value, legal-hold procedure, approval date, and next review date in the launch checklist. Missing approval is a no-go.

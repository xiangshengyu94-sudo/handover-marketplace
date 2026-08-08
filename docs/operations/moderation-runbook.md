# Moderation runbook

## Queue ownership

- The named moderation on-call owns urgent fraud, impersonation, privacy, and unsafe-housing reports. A deputy must cover every published service window.
- Urgent reports are acknowledged within the pilot target; other member reports and anonymous notices are triaged in arrival order.
- The operator or administrator queue owns city, organization, and resource-category requests. Launch does not include tag merge or alias tooling.

## Decision flow

1. Open the protected reports queue and assess only the evidence needed for the decision.
2. Hide immediately when continued visibility creates a credible privacy, fraud, illegal-content, or safety risk. Database visibility fails closed before cache work completes.
3. Write a specific internal reason. Hide/restore appends moderation history, updates the current restriction projection, and queues both owner notification and cache invalidation in one transaction.
4. Restore only after the reason for restriction is resolved. Restoration appends a reversal; it never edits or deletes the original decision.
5. Preserve the receipt code when responding to an anonymous notifier. Do not copy reporter identity or report bodies into public listing fields.
6. Record appeal linkage in the follow-up decision reason until a dedicated appeal object is introduced.

## Notification and failure handling

The scheduled email dispatcher leases moderation notifications independently from the decision. Provider failure cannot roll back or repeat moderation. Queued/retrying age and terminal failures must be visible to the moderation owner; retry retains the original idempotency key.

## Protected role bootstrap and recovery

The first administrator is inserted once by the database owner using an audited production change after the user has completed OTP. Thereafter, the `/admin/roles` screen requires an administrator sign-in within ten minutes. An administrator cannot change their own roles or remove the final administrator. Every change appends `private.role_audit` and queues a notification to the target.

## Launch stop conditions

- No staffed urgent queue or deputy.
- A normal member can read a report, notice, role, claim, or moderation record.
- A hide action leaves a listing publicly readable at the database boundary.
- History can be edited/deleted, a reversal overwrites its predecessor, or notification/cache records are absent after a committed decision.
- The notification queue is failing without a visible owner and recovery action.

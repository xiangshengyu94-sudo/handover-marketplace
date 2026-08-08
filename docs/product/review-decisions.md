# Document review decisions

This is the durable record of the 28-item plan review. “Applied” means the implementation or launch contract carries the recommendation. “Deferred” means the decision remains deliberately open and has a named evidence requirement; it is not silently accepted.

| # | Review item | Decision | Required follow-up |
|---|---|---|---|
| 1 | External cache invalidation cannot be atomic with moderation | Applied | Retry, pending-state, stale-cache, and fail-closed tests |
| 2 | Deleted media may remain reachable through cached public URLs | Applied | Private delivery and measured revocation-SLA tests |
| 3 | DNS and SMTP readiness block unrelated foundation work | Applied | Separate build progress from production checkpoint evidence |
| 4 | Public discovery is blocked by authoring and image work | Applied | Seeded public-discovery smoke evidence |
| 5 | Email matching does not prove original authorship | Applied from best judgment | Narrow the claim to operator attestation plus email control; disclose that this does not prove authorship |
| 6 | Moderation notifications lack a durable delivery dependency | Applied | Typed outbox retry, replay, and template tests |
| 7 | Contact dispatcher has no production execution host | Applied | Cron authentication, lease, and recovery evidence |
| 8 | Monitoring has no telemetry backend or alert transport | Applied | Sentry ingestion, dashboard, and alert-delivery smoke |
| 9 | Export and deletion lack executable user surfaces | Applied | Account privacy E2E and partial-provider recovery tests |
| 10 | Storage policies lack direct-access role tests | Applied | Full Storage role matrix |
| 11 | Self-submitted text can expose private contact data | Applied | Housing/item paste and accessible-correction tests |
| 12 | Restricted accounts lack a shared mutation guard | Applied | Stale-session and direct-route denial tests |
| 13 | Privileged secrets lack purpose separation and rotation | Applied | Old/new overlap and post-revocation tests |
| 14 | Protected-role lifecycle is undefined | Applied | Bootstrap, grant, revoke, replay, and last-admin tests |
| 15 | Launch lacks a concentrated city/community liquidity plan | Applied | Named supply lead and minimum-current-listing evidence |
| 16 | Publishers still repeat work when sharing back to groups | Applied | Clipboard/native-share output and privacy tests |
| 17 | Member report and anonymous notice entry flows are missing | Applied | Validation, acknowledgment, duplicate, and focus tests |
| 18 | Contact delivery state has no sender interface | Applied | Queued-through-terminal accessible journey |
| 19 | Image processing states are not specified | Applied | Mobile, refresh, retry, replace, quota, and focus tests |
| 20 | Pilot success metrics have no falsification thresholds | Applied from best judgment | Use the go/iterate/stop thresholds in `pilot-scorecard.md`; tune after the first cohort |
| 21 | Cities have no independent activation/deactivation gates | Applied from best judgment | Use the supply, moderation-capacity, and safety gates in `pilot-scorecard.md` |
| 22 | Taxonomy merge and alias tooling is premature | Applied | Confirm launch excludes merge/alias paths |
| 23 | Contact retries lack a request-stable intent | Applied | Duplicate request and legitimate later-message tests |
| 24 | CAPTCHA treatment is not implementation-mapped | Applied | Distributed-IP/account and provider-failure tests |
| 25 | Primary responsive navigation is undefined | Applied | Visitor/member/moderator keyboard and role-change journeys |
| 26 | Mobile filter apply, clear, URL, and focus behavior is unresolved | Applied | Responsive and no-JavaScript filter journeys |
| 27 | Lifecycle actions lack confirmation and recovery states | Applied | Concurrent, destructive, reversible, and post-delete tests |
| 28 | Account and email-change management has no screen | Applied | Pending, resend, cancellation, notification, and recovery tests |

The implementation plan retains the original detailed review appendix and verification mapping. Future tuning should update this record and the relevant test or operational evidence together.

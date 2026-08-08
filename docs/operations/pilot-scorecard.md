# Pilot scorecard and city gates

## Cohort and denominators

Report weekly and cumulatively for a six-week cohort by city, optional organization label, housing/item kind, category, and acquisition cohort. Always show numerator, eligible denominator, window, and missing-data count. Organization labels are publisher-selected context, not verified membership.

A **qualified contact** is one unique contact intent from an active email-verified account to another owner’s public, contactable listing that reaches provider accepted or delivered state. Exclude retries, duplicate request keys, tests, abuse, owner self-contact, and contacts after listing ineligibility.

A **completed handover** is an owner-marked completed listing that had at least one qualified contact in the preceding 14 days. Treat this as a useful outcome proxy, not a contractual transaction confirmation.

## Activation gate per city

All are required before general pilot traffic:

- Named supply lead with evidence of at least 20 distinct participating owners and 30 current, author-confirmed listings.
- At least 10 current housing listings and 15 current item listings; remaining five may be either kind.
- Named moderation primary/deputy, 30-minute urgent-report response coverage during published hours, and tested escalation destination.
- Verified city taxonomy, local safety guidance, operator capacity, email/provider canary, backup restore evidence, and all launch gates green.
- No unresolved critical privacy, safety, illegal-content, or authorization incident.

## Weekly metrics

| Metric | Definition | Go | Iterate | Stop / pause acquisition |
|---|---|---:|---:|---:|
| Contacted-listing rate | Current listings with ≥1 qualified contact / current listings | ≥35% | 15–34% | <15% for 2 consecutive weeks |
| Completed-handover rate | Completed handovers / listings with ≥1 qualified contact | ≥25% | 10–24% | <10% after 6 weeks |
| Median time to first qualified contact | Publish to first qualified contact | ≤7 days | 8–14 days | >14 days |
| Stale-result rate | Public results reported expired/unavailable / public results viewed | ≤5% | 6–10% | >10% |
| Owner publishing effort | Median publish time, excluding image processing | ≤8 min | 9–12 min | >12 min with abandonment ≥40% |
| Urgent moderation SLA | Urgent reports acknowledged within 30 min during coverage | ≥95% | 90–94% | <90% or any unstaffed interval |
| Confirmed privacy/authorization breach | Confirmed incidents | 0 | 0 | Any confirmed incident pauses traffic |

Use “go” only when the supply gate remains true, no stop condition fires, and at least three of the first five outcome/effort metrics are green. “Iterate” keeps one city constrained while addressing an evidenced bottleneck. “Stop” pauses acquisition and new city activation; it does not erase records or weaken support for existing users.

## Deactivation and reactivation

Deactivate a city from general promotion when current supply stays below 15 listings for two weeks, urgent coverage is absent, a stop threshold fires, or a critical local safety/legal issue is unresolved. Existing eligible listings may remain searchable only if moderation and support continue; otherwise hide the city cohort through controlled taxonomy/moderation operations.

Reactivate only after the original activation gate, incident actions, and a fresh production canary pass. A separate city never inherits another city’s approval or staffing evidence.

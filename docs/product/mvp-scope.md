# Handover marketplace MVP scope

## Product promise

Handover gives people leaving a city one structured place to pass rooms and everyday items to people arriving next. It reduces repeated searching and reposting across fragmented WhatsApp and Facebook groups; it does not scrape those groups or claim to replace their communities.

The first operating cohort is concentrated in one city and one to three partner communities, while the data model and every listing remain multi-city. Valencia and MERCURI are seed examples, not hard-coded restrictions.

## Included

- Public discovery by city, optional self-selected organization labels, resource type, category, availability, area, and price.
- Separate housing and item forms, schemas, warnings, categories, and detail views.
- Email OTP accounts. “Email verified” means a reachable communication channel, not student, identity, tenancy, or organization verification.
- Private image ingestion and sanitized delivery, listing lifecycle, expiry, owner dashboard, and group-ready share text.
- Private email relay with request-stable intent, provider idempotency, delivery status, and no public owner address.
- Operator-assisted private drafts that only the matched email account can claim or reject.
- Taxonomy requests, member reports, anonymous illegal-content notices, protected moderation and role administration.
- Account export, fail-closed deletion, provider-cleanup retries, retention jobs, monitoring contracts, and launch evidence.

## Explicitly excluded

- Automated collection from WhatsApp, Facebook, or other private groups.
- Public phone numbers, owner email addresses, private-group member lists, screenshots, or invitations.
- Payments, deposits, escrow, contracts, identity checks, student-status checks, property inspections, or transaction guarantees.
- Organization-membership verification. Organization labels describe context selected by the publisher.
- Taxonomy merge/alias tooling, recommendation ranking, native apps, chat, and broad multi-city launch operations.

## Product boundaries

Housing and items share discovery, city/organization context, contact relay, lifecycle, and moderation. Their subtype fields and safety messages never collapse into one generic schema. A listing must have exactly one resource kind and exactly one matching kind-detail row.

Public reads are authoritative at request time: expired, hidden, deleted, unclaimed-assisted, or ineligible listings remain unavailable even if a scheduled job, cache, or provider is delayed.

## Launch boundary

Code completion is not launch approval. General traffic remains blocked until the launch checklist records approved privacy/legal classification, retention, moderation coverage, production environment isolation, verified email/DNS, backup restoration, provider canaries, invariants, and the timed observation window.

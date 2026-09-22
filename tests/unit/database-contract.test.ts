import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const coreMigration = readFileSync(
  "supabase/migrations/202608070001_core_taxonomy_and_listings.sql",
  "utf8",
);
const accessMigration = readFileSync(
  "supabase/migrations/202608070002_private_schemas_roles_and_rls.sql",
  "utf8",
);
const authMigration = readFileSync(
  "supabase/migrations/202608070003_auth_intents_and_abuse_controls.sql",
  "utf8",
);
const authoringMigration = readFileSync(
  "supabase/migrations/202608070004_authoring_and_private_media.sql",
  "utf8",
);
const lifecycleMigration = readFileSync(
  "supabase/migrations/202608070005_public_discovery_and_lifecycle.sql",
  "utf8",
);
const contactMigration = readFileSync(
  "supabase/migrations/202608070006_contact_relay.sql",
  "utf8",
);
const assistedMigration = readFileSync(
  "supabase/migrations/202608070007_assisted_intake.sql",
  "utf8",
);
const moderationMigration = readFileSync(
  "supabase/migrations/202608070008_moderation_and_taxonomy.sql",
  "utf8",
);
const retentionMigration = readFileSync(
  "supabase/migrations/202608070009_retention_and_privacy.sql",
  "utf8",
);
const otherKindMigration = readFileSync(
  "supabase/migrations/202608200001_add_other_listing_kind.sql",
  "utf8",
);
const otherListingsMigration = readFileSync(
  "supabase/migrations/202608200002_enable_other_information_listings.sql",
  "utf8",
);

const exposedTables = [
  "profiles",
  "cities",
  "organizations",
  "resource_categories",
  "listings",
  "listing_organizations",
  "housing_details",
  "item_details",
  "listing_images",
];

describe("database migration contract", () => {
  it.each(exposedTables)("enables and forces RLS for public.%s", (table) => {
    expect(accessMigration).toContain(
      `alter table public.${table} enable row level security;`,
    );
    expect(accessMigration).toContain(
      `alter table public.${table} force row level security;`,
    );
  });

  it("enforces kind-compatible resource categories in the database", () => {
    expect(coreMigration).toMatch(
      /foreign key \(resource_category_id, kind\)[\s\S]+references public\.resource_categories \(id, kind\)/,
    );
  });

  it("adds generic information as an explicit kind without detail-table leakage", () => {
    expect(otherKindMigration).toContain("add value if not exists 'other'");
    expect(otherListingsMigration).toContain("'other',\n  'other',\n  'Other'");
    expect(otherListingsMigration).toContain("target_kind = 'other'");
    expect(otherListingsMigration).toContain("other listing must not have housing or item detail rows");
    expect(otherListingsMigration).toContain("create or replace function public.save_own_other_listing(");
    expect(otherListingsMigration).toContain("delete from public.housing_details h where h.listing_id = v_id");
    expect(otherListingsMigration).toContain("where i.listing_id = v_id and i.status not in ('ready', 'deleted')");
    expect(otherListingsMigration).toContain("to authenticated;");
  });

  it("keeps private data and image metadata away from anonymous grants", () => {
    expect(accessMigration).toContain(
      "revoke all on schema private from public, anon, authenticated;",
    );
    expect(accessMigration).not.toMatch(
      /grant select on[^;]*listing_images[^;]*\bto anon\b/,
    );
    expect(accessMigration).not.toMatch(
      /grant select on[^;]*profiles[^;]*\bto anon\b/,
    );
  });

  it("defines query-time visibility with an exclusive expiry boundary", () => {
    expect(coreMigration).toContain("p_status in ('active', 'reserved')");
    expect(coreMigration).toContain("p_expires_at > p_at");
    expect(coreMigration).toContain("p_status = 'active'");
  });

  it("pins the search path on every security-definer helper", () => {
    const securityDefinerFunctions = [accessMigration, authMigration, authoringMigration, lifecycleMigration, contactMigration, assistedMigration, moderationMigration, retentionMigration, otherListingsMigration].flatMap(
      (migration) =>
        migration
          .split(/create(?: or replace)? function/)
          .filter((chunk) => chunk.includes("security definer")),
    );

    expect(securityDefinerFunctions.length).toBeGreaterThan(0);
    for (const functionBody of securityDefinerFunctions) {
      expect(functionBody).toMatch(/set search_path = pg_catalog,/);
    }
  });

  it("contains balanced PostgreSQL dollar-quoted bodies", () => {
    for (const migration of [coreMigration, accessMigration, authMigration, authoringMigration, lifecycleMigration, contactMigration, assistedMigration, moderationMigration, retentionMigration, otherListingsMigration]) {
      expect(migration.match(/\$\$/g)?.length ?? 0).toSatisfy(
        (count: number) => count % 2 === 0,
      );
    }
  });

  it("keeps originals and sanitized derivatives in private buckets", () => {
    expect(authoringMigration).toContain("'listing-staging', 'listing-staging', false");
    expect(authoringMigration).toContain("'listing-media', 'listing-media', false");
    expect(authoringMigration).not.toMatch(/create policy[^;]+listing-media[^;]+to anon/is);
    expect(authoringMigration).toContain("to service_role;");
  });

  it("routes listing writes through atomic member RPCs", () => {
    expect(authoringMigration).toContain("create function public.save_own_listing(");
    expect(authoringMigration).toContain("revoke insert, update, delete on public.listings");
    expect(authoringMigration).toContain("grant execute on function public.save_own_listing(");
    expect(authoringMigration).toContain("where id = v_id and version = p_expected_version");
    expect(authoringMigration).toContain("listing images are not ready");
  });

  it("records lifecycle history and cache work in private durable tables", () => {
    expect(lifecycleMigration).toContain("create table private.listing_status_history");
    expect(lifecycleMigration).toContain("create table private.cache_invalidation_outbox");
    expect(lifecycleMigration).toContain("force row level security");
    expect(lifecycleMigration).toContain("insert into private.listing_status_history");
    expect(lifecycleMigration).toContain("insert into private.cache_invalidation_outbox");
    expect(lifecycleMigration).toContain("where id = p_listing_id and version = p_expected_version");
  });

  it("queues contact exactly once without storing an owner email", () => {
    const outboxDefinition = contactMigration.match(/create table private\.contact_outbox \([\s\S]*?\n\);/)?.[0] ?? "";
    expect(contactMigration).toContain("intent_id uuid not null unique");
    expect(contactMigration).toContain("idempotency_key text not null unique");
    expect(outboxDefinition).not.toContain("owner_email");
    expect(contactMigration).toContain("for update skip locked");
    expect(contactMigration).toContain("first_attempt_at > now() - interval '23 hours'");
    expect(contactMigration).toContain("on conflict (event_id) do nothing");
  });

  it("keeps contact content and provider events private", () => {
    for (const table of ["contact_intents", "contact_outbox", "contact_provider_events"]) {
      expect(contactMigration).toContain(`alter table private.${table} force row level security;`);
    }
    expect(contactMigration).toContain("from public, anon, authenticated;");
    expect(contactMigration).not.toMatch(/grant (?:select|all) on private\.contact_(?:intents|outbox|provider_events)[^;]+to (?:anon|authenticated)/);
  });

  it("blocks assisted publication until an atomic author claim", () => {
    expect(assistedMigration).toContain("create trigger listings_guard_pending_assisted_draft");
    expect(assistedMigration).toContain("assisted draft must be claimed before publication");
    expect(assistedMigration).toContain("set status = 'claimed', claimant_id = p_claimant_id");
    expect(assistedMigration).toContain("update public.listings set owner_id = p_claimant_id");
    expect(assistedMigration).toContain("for update;");
  });

  it("keeps assisted identity evidence private and erases rejected content", () => {
    expect(assistedMigration).toContain("alter table private.assisted_claims force row level security;");
    expect(assistedMigration).toContain("author_email_hmac");
    expect(assistedMigration).not.toContain("author_email text");
    expect(assistedMigration).toContain("description = 'The intended author rejected this assisted draft.'");
    expect(assistedMigration).toContain("status = 'deleted', generation = gen_random_uuid()");
  });

  it("commits moderation, notification, and cache work atomically", () => {
    expect(moderationMigration).toContain("insert into private.moderation_history");
    expect(moderationMigration).toContain("insert into private.notification_outbox");
    expect(moderationMigration).toContain("insert into private.cache_invalidation_outbox");
    expect(moderationMigration).toContain("moderation_history_append_only");
    expect(moderationMigration).toContain("audit history is append-only");
  });

  it("protects role changes against self-grant and last-admin removal", () => {
    expect(moderationMigration).toContain("p_actor_id = p_target_id");
    expect(moderationMigration).toContain("last administrator cannot be removed");
    expect(moderationMigration).toContain("insert into private.role_audit");
    expect(moderationMigration).toContain("role_audit_append_only");
  });

  it("keeps reports, notices, roles, and notification queues out of public grants", () => {
    for (const table of ["taxonomy_requests", "member_reports", "illegal_content_notices", "moderation_history", "notification_outbox", "role_audit"]) {
      expect(moderationMigration).toContain(table);
    }
    expect(moderationMigration).toContain("from public, anon, authenticated;");
    expect(moderationMigration).not.toMatch(/grant all on private\.[^;]+ to (?:anon|authenticated)/);
  });

  it("keeps auth intent and abuse state private behind service-only RPCs", () => {
    for (const table of [
      "auth_intents",
      "rate_limit_buckets",
      "captcha_challenges",
    ]) {
      expect(authMigration).toContain(
        `alter table private.${table} force row level security;`,
      );
    }
    expect(authMigration).toContain(
      "from public, anon, authenticated;",
    );
    expect(authMigration).toContain("to service_role;");
    expect(authMigration).not.toMatch(
      /grant execute on function public\.admin_[^;]+to (?:anon|authenticated)/,
    );
  });

  it("revokes member capability while an email change is pending", () => {
    expect(authMigration).toContain("u.email_confirmed_at is not null");
    expect(authMigration).toContain("nullif(u.email_change, '') is null");
    for (const migration of [authMigration, assistedMigration, retentionMigration]) {
      expect(migration).not.toContain(".new_email");
    }
  });

  it("keeps privacy receipts and retention state service-only", () => {
    for (const table of [
      "privacy_requests",
      "job_state",
      "storage_cleanup_outbox",
    ]) {
      expect(retentionMigration).toContain(
        `alter table private.${table} force row level security;`,
      );
    }
    expect(retentionMigration).toContain(
      "revoke all on private.privacy_requests, private.job_state,",
    );
    expect(retentionMigration).not.toMatch(
      /grant all on private\.(?:privacy_requests|job_state|storage_cleanup_outbox) to (?:anon|authenticated)/,
    );
  });

  it("makes expiry, account hiding, and cleanup auditable and idempotent", () => {
    expect(retentionMigration).toContain(
      "update public.listings l set status='expired',version=l.version+1",
    );
    expect(retentionMigration).toContain("'account-deletion' from changed");
    expect(retentionMigration).toContain("insert into private.role_audit");
    expect(retentionMigration).toContain("on conflict do nothing");
    expect(retentionMigration).toContain("body_purged_at is null");
    expect(retentionMigration).toContain("interval '30 days'");
    expect(retentionMigration).toContain("interval '24 hours'");
    expect(retentionMigration).toContain("interval '7 days'");
    expect(retentionMigration).toContain("status='partial'");
    expect(retentionMigration).toContain("admin_lease_privacy_cleanups");
    expect(retentionMigration).toContain(
      "admin_record_retention_cleanup_failure",
    );
    expect(retentionMigration).toContain("for update skip locked limit 500");
    expect(retentionMigration).toContain("listing_images_retention_idx");
    expect(retentionMigration).toContain("'hasMore'");
  });

  it("durably coordinates image deletion with private Storage cleanup", () => {
    expect(retentionMigration).toContain(
      "create table private.storage_cleanup_outbox",
    );
    expect(retentionMigration).toContain(
      "create trigger listing_images_enqueue_storage_cleanup",
    );
    expect(retentionMigration).toContain(
      "values ('listing-staging',old.storage_path,old.id)",
    );
    expect(retentionMigration).toContain(
      "values ('listing-media',old.derivative_path,old.id)",
    );
    expect(retentionMigration).toContain(
      "create function public.admin_lease_storage_cleanup",
    );
    expect(retentionMigration).toContain(
      "create function public.admin_finish_storage_cleanup",
    );
    expect(retentionMigration).toContain(
      "where status='deleted'\non conflict(bucket,object_path) do nothing",
    );
  });

  it("preserves delivery truth and revalidates contact dispatch", () => {
    expect(retentionMigration).toContain(
      "create function public.admin_confirm_contact_dispatch",
    );
    expect(retentionMigration).toContain(
      "and private.contact_dispatch_is_eligible(outbox.id)",
    );
    expect(retentionMigration).toContain(
      "where o.status in ('queued','retrying')",
    );
    expect(retentionMigration).not.toMatch(
      /update private\.contact_outbox o set status='failed',message_body=/,
    );
  });

  it("fails exhausted provider cleanup instead of stranding partial work", () => {
    expect(retentionMigration).toContain(
      "when cleanup_attempts>=9 then 'failed'",
    );
    expect(retentionMigration).toContain("'provider-cleanup-exhausted'");
    expect(retentionMigration).toContain("values('privacy-cleanup',now(),1");
  });

  it("tombstones expired assisted drafts and only publishes claimed ownership", () => {
    expect(retentionMigration).toContain(
      "claim.status='claimed'\n        and claim.claimant_id=new.owner_id",
    );
    expect(retentionMigration).toContain(
      "create function private.expire_assisted_drafts",
    );
    expect(retentionMigration).toContain("title='Expired assisted draft'");
    expect(retentionMigration).toContain(
      "perform private.expire_assisted_drafts(now(),1,p_token_hash)",
    );
  });

  it("exports kind and taxonomy context without private object paths", () => {
    const exportFunction = retentionMigration.match(
      /create function public\.admin_export_user_data[\s\S]*?\nend; \$\$;/,
    )?.[0] ?? "";
    for (const field of [
      "'city'",
      "'category'",
      "'organizations'",
      "'housing'",
      "'item'",
      "'images'",
      "'subtype'",
      "'condition'",
    ]) {
      expect(exportFunction).toContain(field);
    }
    expect(exportFunction).not.toContain("storage_path");
    expect(exportFunction).not.toContain("derivative_path");
    expect(exportFunction).not.toContain("generation");
  });

  it("serializes administrator removal and defers retention success", () => {
    expect(
      retentionMigration.match(
        /pg_advisory_xact_lock\(hashtextextended\('handover:administrator-role-lifecycle',0\)\)/g,
      )?.length,
    ).toBe(2);
    const retentionRun = retentionMigration.match(
      /create function public\.admin_run_retention[\s\S]*?\nend; \$\$;/,
    )?.[0] ?? "";
    expect(retentionRun).not.toContain("last_succeeded_at");
    expect(retentionRun).not.toContain("v_paths");
    expect(retentionRun).not.toContain("'paths'");
    expect(retentionRun).not.toContain("storage_path");
    expect(retentionMigration).toContain(
      "create function public.admin_finish_retention_run",
    );
    const retentionFinish = retentionMigration.match(
      /create function public\.admin_finish_retention_run[\s\S]*?\nend; \$\$;/,
    )?.[0] ?? "";
    expect(retentionFinish).toContain(
      "where status in ('queued','leased','retrying','failed')",
    );
    expect(retentionFinish).toContain(
      "where request_type='delete' and status in ('partial','failed')",
    );
    expect(retentionFinish).toContain("'storageCompleted'");
    expect(retentionFinish).toContain("'privacyCompleted'");
    expect(retentionFinish).not.toContain("coalesce(p_result,'{}'::jsonb)");
    const storageFinish = retentionMigration.match(
      /create function public\.admin_finish_storage_cleanup[\s\S]*?\nend; \$\$;/,
    )?.[0] ?? "";
    const privacyFinish = retentionMigration.match(
      /create function public\.admin_finish_privacy_cleanup_retry[\s\S]*?\nend; \$\$;/,
    )?.[0] ?? "";
    expect(storageFinish).not.toContain("'cleanupId'");
    expect(privacyFinish).not.toContain("'requestId'");
  });
});

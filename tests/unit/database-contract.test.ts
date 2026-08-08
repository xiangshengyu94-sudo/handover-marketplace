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
    const securityDefinerFunctions = [accessMigration, authMigration, authoringMigration, lifecycleMigration, contactMigration, assistedMigration, moderationMigration].flatMap(
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
    for (const migration of [coreMigration, accessMigration, authMigration, authoringMigration, lifecycleMigration, contactMigration, assistedMigration, moderationMigration]) {
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
    expect(authMigration).toContain("u.new_email is null");
  });
});

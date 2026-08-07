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
    const securityDefinerFunctions = accessMigration
      .split("create function")
      .filter((chunk) => chunk.includes("security definer"));

    expect(securityDefinerFunctions.length).toBeGreaterThan(0);
    for (const functionBody of securityDefinerFunctions) {
      expect(functionBody).toMatch(/set search_path = pg_catalog,/);
    }
  });

  it("contains balanced PostgreSQL dollar-quoted bodies", () => {
    for (const migration of [coreMigration, accessMigration]) {
      expect(migration.match(/\$\$/g)?.length ?? 0).toSatisfy(
        (count: number) => count % 2 === 0,
      );
    }
  });
});

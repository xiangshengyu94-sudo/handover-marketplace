import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/202608070009_retention_and_privacy.sql",
  ),
  "utf8",
);

function functionBody(name: string) {
  const match = migration.match(
    new RegExp(`create function public\\.${name}\\([\\s\\S]*?end; \\$\\$;`),
  );
  expect(match, `${name} must be declared`).not.toBeNull();
  return match?.[0] ?? "";
}

describe("account deletion SQL contract", () => {
  it("checks an existing user/request operation before active-account checks", () => {
    const begin = functionBody("admin_begin_account_deletion");
    const existingCheck = begin.indexOf("request.id=p_request_id and request.user_id=p_user_id");
    const activeCheck = begin.indexOf("account_status='active'");

    expect(existingCheck).toBeGreaterThan(0);
    expect(existingCheck).toBeLessThan(activeCheck);
    expect(begin).toContain("request.request_type='delete'");
    expect(begin).toContain("'receipt',v_existing.receipt_code");
    expect(begin).toContain("'shouldCleanup',false");
    expect(begin).toContain("'requestId',p_request_id");
    expect(begin).toContain("'shouldCleanup',true");
  });

  it("anonymizes owned listing content without breaking item invariants", () => {
    const begin = functionBody("admin_begin_account_deletion");

    expect(begin).toContain("pickup_area='Removed',quantity=1,is_giveaway=true");
    expect(begin).toContain("delete from public.listing_organizations");
    expect(begin).toContain("title='Deleted listing'");
    expect(begin).toContain("description='This listing was removed after account deletion.'");
    expect(begin).toContain("approximate_area='Removed'");
    expect(begin).toContain("price_amount=0");
  });

  it("exposes a service-only recovery result without identity or provider data", () => {
    const recover = functionBody("admin_recover_account_deletion");

    expect(recover).toContain("'receipt',request.receipt_code");
    expect(recover).toContain("'status',case when request.status='completed'");
    expect(recover).not.toContain("user_id");
    expect(recover).not.toContain("provider_cleanup");
    expect(recover).not.toContain("authUserId");
    expect(migration).toContain(
      "revoke execute on function public.admin_recover_account_deletion(uuid) from public,anon,authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.admin_recover_account_deletion(uuid) to service_role;",
    );
  });
});

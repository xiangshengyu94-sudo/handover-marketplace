import type { SupabaseClient } from "@supabase/supabase-js";

export async function listActiveCities(client: SupabaseClient) {
  return client
    .from("cities")
    .select("id, slug, name, country_code, timezone, status")
    .eq("status", "active")
    .order("name");
}

export async function listAssignableOrganizations(
  client: SupabaseClient,
  cityId: string,
) {
  return client
    .from("organizations")
    .select("id, city_id, slug, name, status")
    .eq("status", "active")
    .or(`city_id.is.null,city_id.eq.${cityId}`)
    .order("name");
}

export async function listActiveResourceCategories(
  client: SupabaseClient,
  kind: "housing" | "item",
) {
  return client
    .from("resource_categories")
    .select("id, kind, slug, label, status")
    .eq("kind", kind)
    .eq("status", "active")
    .order("label");
}

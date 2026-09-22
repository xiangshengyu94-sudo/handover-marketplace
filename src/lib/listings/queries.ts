import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingFilters } from "./filters";

export const LISTINGS_PER_PAGE = 12;
export type ListingSummary = {
  id: string; title: string; description: string; kind: "housing" | "item" | "other"; status: "active" | "reserved";
  priceAmount: number; currency: string; approximateArea: string; availableFrom: string; expiresAt: string;
  city: { id: string; slug: string; name: string; countryCode: string };
  category: { id: string; slug: string; label: string };
  organizations: { id: string; slug: string; name: string }[];
  item?: { condition: string; quantity: number; pickupArea: string; isGiveaway: boolean };
  housing?: { subtype: string; furnished: boolean; billsIncluded: boolean };
};

export async function listPublicListings(client: SupabaseClient, filters: ListingFilters) {
  const [cities, organizations, categories] = await Promise.all([
    client.from("cities").select("id, slug").eq("status", "active"),
    client.from("organizations").select("id, slug").eq("status", "active"),
    client.from("resource_categories").select("id, slug, kind").eq("status", "active"),
  ]);
  if (cities.error || organizations.error || categories.error) throw new Error("Taxonomy unavailable");
  const cityId = filters.city ? cities.data.find(({ slug }) => slug === filters.city)?.id : undefined;
  const organizationId = filters.organization ? organizations.data.find(({ slug }) => slug === filters.organization)?.id : undefined;
  const category = filters.category ? categories.data.find(({ slug }) => slug === filters.category) : undefined;
  if ((filters.city && !cityId) || (filters.organization && !organizationId) || (filters.category && !category)) return { listings: [] as ListingSummary[], count: 0 };
  let organizationListingIds: string[] | undefined;
  if (organizationId) {
    const result = await client.from("listing_organizations").select("listing_id").eq("organization_id", organizationId);
    if (result.error) throw new Error("Organization filter unavailable");
    organizationListingIds = result.data.map(({ listing_id }) => listing_id);
    if (!organizationListingIds.length) return { listings: [] as ListingSummary[], count: 0 };
  }
  const from = (filters.page - 1) * LISTINGS_PER_PAGE;
  let query = client.from("listings").select("id, title, description, kind, status, price_amount, currency, approximate_area, available_from, expires_at, city:cities!inner(id, slug, name, country_code), category:resource_categories!inner(id, slug, label), listing_organizations(organization:organizations(id, slug, name)), item_details(condition, quantity, pickup_area, is_giveaway), housing_details(subtype, furnished, bills_included)", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, from + LISTINGS_PER_PAGE - 1);
  if (cityId) query = query.eq("city_id", cityId);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (category) query = query.eq("resource_category_id", category.id);
  if (filters.maxPrice !== undefined) query = query.lte("price_amount", filters.maxPrice);
  if (filters.availableBy) query = query.lte("available_from", filters.availableBy);
  if (organizationListingIds) query = query.in("id", organizationListingIds);
  const result = await query;
  if (result.error) throw new Error("Listings unavailable");
  return { listings: (result.data ?? []).map((row) => normalizeListing(row as unknown as Record<string, unknown>)), count: result.count ?? 0 };
}

export function normalizeListing(row: Record<string, unknown>): ListingSummary {
  const city = one(row.city) as Record<string, unknown>;
  const category = one(row.category) as Record<string, unknown>;
  const organizations = array(row.listing_organizations).map((relation) => one((relation as Record<string, unknown>).organization) as Record<string, unknown>);
  const item = one(row.item_details) as Record<string, unknown> | undefined;
  const housing = one(row.housing_details) as Record<string, unknown> | undefined;
  return { id: String(row.id), title: String(row.title), description: String(row.description), kind: row.kind as ListingSummary["kind"], status: row.status as ListingSummary["status"], priceAmount: Number(row.price_amount), currency: String(row.currency), approximateArea: String(row.approximate_area), availableFrom: String(row.available_from), expiresAt: String(row.expires_at), city: { id: String(city.id), slug: String(city.slug), name: String(city.name), countryCode: String(city.country_code) }, category: { id: String(category.id), slug: String(category.slug), label: String(category.label) }, organizations: organizations.map((organization) => ({ id: String(organization.id), slug: String(organization.slug), name: String(organization.name) })), item: item ? { condition: String(item.condition), quantity: Number(item.quantity), pickupArea: String(item.pickup_area), isGiveaway: Boolean(item.is_giveaway) } : undefined, housing: housing ? { subtype: String(housing.subtype), furnished: Boolean(housing.furnished), billsIncluded: Boolean(housing.bills_included) } : undefined };
}

function one(value: unknown) { return Array.isArray(value) ? value[0] : value; }
function array(value: unknown) { return Array.isArray(value) ? value : []; }

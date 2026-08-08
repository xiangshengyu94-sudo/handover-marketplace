import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { ListingForm, type ListingFormValue } from "@/components/listings/listing-form";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: candidateId } = await params;
  const parsedId = z.uuid().safeParse(candidateId);
  if (!parsedId.success) notFound();
  try { await requireActiveMember(); } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect(`/login?returnTo=/listings/${candidateId}/edit`);
    throw error;
  }
  const client = await createClient();
  const [listingResult, cities, organizations, categories] = await Promise.all([
    client.from("listings").select("id, version, kind, title, description, city_id, resource_category_id, price_amount, currency, approximate_area, available_from, expires_at, housing_details(*), item_details(*), listing_organizations(organization_id)").eq("id", parsedId.data).maybeSingle(),
    client.from("cities").select("id, name").eq("status", "active").order("name"),
    client.from("organizations").select("id, name, city_id").eq("status", "active").order("name"),
    client.from("resource_categories").select("id, label, kind").eq("status", "active").order("label"),
  ]);
  const listing = listingResult.data;
  if (listingResult.error || !listing) notFound();
  if (cities.error || organizations.error || categories.error) throw new Error("Taxonomy unavailable");
  const housing = Array.isArray(listing.housing_details) ? listing.housing_details[0] : listing.housing_details;
  const item = Array.isArray(listing.item_details) ? listing.item_details[0] : listing.item_details;
  const initial: ListingFormValue = {
    id: listing.id,
    version: Number(listing.version),
    kind: listing.kind,
    title: listing.title,
    description: listing.description,
    cityId: listing.city_id,
    organizationIds: (listing.listing_organizations ?? []).map(({ organization_id }) => organization_id),
    resourceCategoryId: listing.resource_category_id,
    priceAmount: Number(listing.price_amount),
    currency: listing.currency,
    approximateArea: listing.approximate_area,
    availableFrom: listing.available_from,
    expiresOn: listing.expires_at.slice(0, 10),
    housingSubtype: housing?.subtype,
    furnished: housing?.furnished,
    billsIncluded: housing?.bills_included,
    condition: item?.condition,
    quantity: item?.quantity,
    pickupArea: item?.pickup_area,
    isGiveaway: item?.is_giveaway,
  };
  return <main className="listing-page"><header className="listing-header"><Link href="/">Handover</Link><div><p className="eyebrow">Edit listing</p><h1>Keep it current.</h1></div></header><ListingForm cities={cities.data ?? []} organizations={organizations.data ?? []} categories={categories.data ?? []} initial={initial} /></main>;
}

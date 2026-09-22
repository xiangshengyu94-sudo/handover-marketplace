import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { ListingForm, type ListingFormValue } from "@/components/listings/listing-form";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { BRAND_NAME } from "@/lib/brand";
import { getDictionary, localizeCategories } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
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
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const client = await createClient();
  const [listingResult, cities, organizations, categories] = await Promise.all([
    client.from("listings").select("id, version, kind, title, description, city_id, resource_category_id, price_amount, currency, approximate_area, available_from, expires_at, housing_details(*), item_details(*), listing_organizations(organization_id)").eq("id", parsedId.data).maybeSingle(),
    client.from("cities").select("id, name").eq("status", "active").order("name"),
    client.from("organizations").select("id, name, city_id").eq("status", "active").order("name"),
    client.from("resource_categories").select("id, slug, label, kind").eq("status", "active").order("label"),
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
  const localizedCategories = localizeCategories(locale, categories.data ?? []);
  return <main className="listing-page"><header className="listing-header"><div className="listing-brand"><Link href="/">{BRAND_NAME}</Link><LanguageSwitcher locale={locale} label={dictionary.localeLabel} /></div><div><p className="eyebrow">{dictionary.listingEyebrow}</p><h1>{dictionary.listingTitle}</h1></div></header><ListingForm cities={cities.data ?? []} organizations={organizations.data ?? []} categories={localizedCategories} initial={initial} dictionary={dictionary} /></main>;
}

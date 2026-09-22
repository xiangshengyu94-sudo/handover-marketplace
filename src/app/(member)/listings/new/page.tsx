import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingForm } from "@/components/listings/listing-form";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { BRAND_NAME } from "@/lib/brand";
import { getDictionary, localizeCategories } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create a listing" };

export default async function NewListingPage() {
  try { await requireActiveMember(); } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect("/login?returnTo=/listings/new");
    throw error;
  }
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const client = await createClient();
  const [cities, organizations, categories] = await Promise.all([
    client.from("cities").select("id, name").eq("status", "active").order("name"),
    client.from("organizations").select("id, name, city_id").eq("status", "active").order("name"),
    client.from("resource_categories").select("id, slug, label, kind").eq("status", "active").order("label"),
  ]);
  if (cities.error || organizations.error || categories.error) throw new Error("Taxonomy unavailable");
  const localizedCategories = localizeCategories(locale, categories.data ?? []);
  return <main className="listing-page"><header className="listing-header"><div className="listing-brand"><Link href="/">{BRAND_NAME}</Link><LanguageSwitcher locale={locale} label={dictionary.localeLabel} /></div><div><p className="eyebrow">{dictionary.listingEyebrow}</p><h1>{dictionary.listingTitle}</h1><p className="lede">{dictionary.listingLede}</p></div></header><ListingForm cities={cities.data ?? []} organizations={organizations.data ?? []} categories={localizedCategories} dictionary={dictionary} /></main>;
}

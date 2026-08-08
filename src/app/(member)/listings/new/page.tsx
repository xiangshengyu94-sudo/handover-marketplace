import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingForm } from "@/components/listings/listing-form";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create a listing" };

export default async function NewListingPage() {
  try { await requireActiveMember(); } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect("/login?returnTo=/listings/new");
    throw error;
  }
  const client = await createClient();
  const [cities, organizations, categories] = await Promise.all([
    client.from("cities").select("id, name").eq("status", "active").order("name"),
    client.from("organizations").select("id, name, city_id").eq("status", "active").order("name"),
    client.from("resource_categories").select("id, label, kind").eq("status", "active").order("label"),
  ]);
  if (cities.error || organizations.error || categories.error) throw new Error("Taxonomy unavailable");
  return <main className="listing-page"><header className="listing-header"><Link href="/">Handover</Link><div><p className="eyebrow">Create a listing</p><h1>Pass it forward.</h1><p className="lede">One structured post can travel across communities while keeping public and private information separate.</p></div></header><ListingForm cities={cities.data ?? []} organizations={organizations.data ?? []} categories={categories.data ?? []} /></main>;
}

import Link from "next/link";

import { ListingCard } from "@/components/listings/listing-card";
import { ListingFiltersForm } from "@/components/listings/listing-filters";
import { SiteHeader } from "@/components/navigation/site-header";
import { parseListingFilters } from "@/lib/listings/filters";
import { LISTINGS_PER_PAGE, listPublicListings } from "@/lib/listings/queries";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseListingFilters(await searchParams);
  const client = await createClient();
  const taxonomyResults = await Promise.all([
    client.from("cities").select("slug, name").eq("status", "active").order("name"),
    client.from("organizations").select("slug, name").eq("status", "active").order("name"),
    client.from("resource_categories").select("slug, label, kind").eq("status", "active").order("label"),
  ]);
  const taxonomy = { cities: taxonomyResults[0].data ?? [], organizations: taxonomyResults[1].data ?? [], categories: taxonomyResults[2].data ?? [] };
  let result: Awaited<ReturnType<typeof listPublicListings>> = { listings: [], count: 0 };
  let unavailable = taxonomyResults.some(({ error }) => error);
  try { if (!unavailable) result = await listPublicListings(client, filters); } catch { unavailable = true; }
  const pageCount = Math.max(1, Math.ceil(result.count / LISTINGS_PER_PAGE));
  return <><SiteHeader /><main className="market-page"><section className="market-intro"><p className="eyebrow">Arriving soon? Leaving soon?</p><h1>Pass useful things forward.</h1><p className="lede">Rooms and everyday items from international communities, structured in one place instead of scattered across group messages.</p><Link className="button-link" href="/listings/new">Post a handover</Link></section><div className="market-layout"><ListingFiltersForm filters={filters} taxonomy={taxonomy} count={result.count} /><section className="results" aria-labelledby="results-title"><div className="results-header"><div><p className="eyebrow">Current handovers</p><h2 id="results-title">{result.count ? `${result.count} ways to arrive lighter` : "Nothing matches yet"}</h2></div><span>Page {Math.min(filters.page, pageCount)} of {pageCount}</span></div>{unavailable ? <div className="empty-state"><h3>Listings are temporarily unavailable.</h3><p>The public catalogue could not be reached. Please try again shortly.</p></div> : result.listings.length ? <div className="listing-grid">{result.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div> : <div className="empty-state"><h3>Try a wider handover circle.</h3><p>Clear one or more filters, or be the first to post in this city.</p><Link className="button-secondary" href="/">Clear filters</Link></div>}<nav className="pagination" aria-label="Listings pages">{filters.page > 1 ? <Link href={pageUrl(filters, filters.page - 1)}>Previous</Link> : <span />}{filters.page < pageCount ? <Link href={pageUrl(filters, filters.page + 1)}>Next</Link> : null}</nav></section></div></main></>;
}

function pageUrl(filters: ReturnType<typeof parseListingFilters>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) if (value !== undefined) params.set(key, String(value));
  return `/?${params}`;
}

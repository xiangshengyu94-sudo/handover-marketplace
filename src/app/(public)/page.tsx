import Link from "next/link";

import { ListingCard } from "@/components/listings/listing-card";
import { ListingFiltersForm } from "@/components/listings/listing-filters";
import { SiteHeader } from "@/components/navigation/site-header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { parseListingFilters } from "@/lib/listings/filters";
import { LISTINGS_PER_PAGE, listPublicListings } from "@/lib/listings/queries";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseListingFilters(await searchParams);
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
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

  return (
    <>
      <SiteHeader />
      <main className="market-page">
        <section className="market-intro">
          <p className="eyebrow">{dictionary.homeEyebrow}</p>
          <h1>{dictionary.homeTitle}</h1>
          <p className="lede">{dictionary.homeLede}</p>
          <Link className="button-link" href="/listings/new">{dictionary.homePost}</Link>
        </section>

        <section className="market-lanes" aria-label={dictionary.homeLanesLabel}>
          <article className="market-lane housing">
            <p className="eyebrow">01</p>
            <h2>{dictionary.homeHousingTitle}</h2>
            <p>{dictionary.homeHousingBody}</p>
          </article>
          <article className="market-lane items">
            <p className="eyebrow">02</p>
            <h2>{dictionary.homeItemsTitle}</h2>
            <p>{dictionary.homeItemsBody}</p>
          </article>
          <article className="market-lane knowledge">
            <p className="eyebrow">03</p>
            <h2>{dictionary.homeKnowledgeTitle}</h2>
            <p>{dictionary.homeKnowledgeBody}</p>
            <Link href="/?kind=other">{dictionary.homeKnowledgeLink}</Link>
          </article>
        </section>

        <div className="market-layout">
          <ListingFiltersForm filters={filters} taxonomy={taxonomy} count={result.count} locale={locale} dictionary={dictionary} />
          <section className="results" aria-labelledby="results-title">
            <div className="results-header">
              <div>
                <p className="eyebrow">{dictionary.homeCurrent}</p>
                <h2 id="results-title">{result.count ? `${dictionary.homeWays} ${result.count}` : dictionary.homeNothing}</h2>
              </div>
              <span>{dictionary.page} {Math.min(filters.page, pageCount)} {dictionary.of} {pageCount}</span>
            </div>

            {unavailable ? (
              <div className="empty-state">
                <h3>{dictionary.homeUnavailableTitle}</h3>
                <p>{dictionary.homeUnavailableBody}</p>
              </div>
            ) : result.listings.length ? (
              <div className="listing-grid">
                {result.listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} locale={locale} dictionary={dictionary} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>{dictionary.homeWiderTitle}</h3>
                <p>{dictionary.homeWiderBody}</p>
                <Link className="button-secondary" href="/">{dictionary.homeClearFilters}</Link>
              </div>
            )}

            <nav className="pagination" aria-label={dictionary.paginationLabel}>
              {filters.page > 1 ? <Link href={pageUrl(filters, filters.page - 1)}>{dictionary.previous}</Link> : <span />}
              {filters.page < pageCount ? <Link href={pageUrl(filters, filters.page + 1)}>{dictionary.next}</Link> : null}
            </nav>
          </section>
        </div>
      </main>
    </>
  );
}

function pageUrl(filters: ReturnType<typeof parseListingFilters>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) if (value !== undefined) params.set(key, String(value));
  return `/?${params}`;
}

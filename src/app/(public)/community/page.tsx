import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/navigation/site-header";
import { getCommunityCopy } from "@/lib/community/copy";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Questions & experiences" };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ type?: string; city?: string; page?: string }> }) {
  const { type, city, page: pageParam } = await searchParams;
  const locale = await getLocale();
  const copy = getCommunityCopy(locale);
  const dictionary = getDictionary(locale);
  const requestedPage = Number(pageParam);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 20;
  const client = await createClient();
  const [cities, organizations] = await Promise.all([
    client.from("cities").select("id, name").eq("status", "active"),
    client.from("organizations").select("id, name").eq("status", "active"),
  ]);
  let query = client.from("community_posts").select("id, type, title, body, city_id, organization_id, created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (type === "question" || type === "experience") query = query.eq("type", type);
  if (city && cities.data?.some((entry) => entry.id === city)) query = query.eq("city_id", city);
  const posts = await query;
  const cityNames = new Map((cities.data ?? []).map((entry) => [entry.id, entry.name]));
  const organizationNames = new Map((organizations.data ?? []).map((entry) => [entry.id, entry.name]));
  const unavailable = Boolean(cities.error || organizations.error || posts.error);
  const pageCount = Math.max(1, Math.ceil((posts.count ?? 0) / pageSize));
  const pageUrl = (target: number) => {
    const params = new URLSearchParams();
    if (type === "question" || type === "experience") params.set("type", type);
    if (city && cityNames.has(city)) params.set("city", city);
    params.set("page", String(target));
    return `/community?${params}`;
  };

  return <><SiteHeader /><main className="community-page"><section className="community-intro"><p className="eyebrow">ReLoop community</p><h1>{copy.browseTitle}</h1><p className="lede">{copy.browseIntro}</p><div className="button-row"><Link className="button-link" href="/community/new?type=question">{copy.ask}</Link><Link className="button-link button-secondary" href="/community/new?type=experience">{copy.share}</Link><Link className="button-link button-secondary" href="/listings/new">{copy.exchange}</Link></div></section><nav className="community-tabs" aria-label={copy.nav}><Link className={!type ? "selected" : ""} href="/community">{copy.all}</Link><Link className={type === "question" ? "selected" : ""} href="/community?type=question">{copy.questions}</Link><Link className={type === "experience" ? "selected" : ""} href="/community?type=experience">{copy.experiences}</Link></nav><form className="community-filter" method="get"><label htmlFor="community-filter-city">{copy.city}</label>{type === "question" || type === "experience" ? <input type="hidden" name="type" value={type} /> : null}<select id="community-filter-city" name="city" defaultValue={city && cityNames.has(city) ? city : ""}><option value="">{copy.allCities}</option>{(cities.data ?? []).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><button type="submit">{copy.filter}</button></form>{unavailable ? <p className="empty-state">{copy.unavailable}</p> : posts.data?.length ? <><div className="community-grid">{posts.data.map((post) => <article className="community-card" key={post.id}><div className="card-tags"><span className="tag resource">{post.type === "question" ? copy.question : copy.experience}</span><span className="tag context">{cityNames.get(post.city_id)}</span>{post.organization_id ? <span className="tag context">{organizationNames.get(post.organization_id)}</span> : null}</div><h2><Link href={`/community/${post.id}`}>{post.title}</Link></h2><p>{post.body}</p></article>)}</div><nav className="pagination" aria-label={copy.nav}><span>{dictionary.page} {page} {dictionary.of} {pageCount}</span>{page > 1 ? <Link href={pageUrl(page - 1)}>{dictionary.previous}</Link> : null}{page < pageCount ? <Link href={pageUrl(page + 1)}>{dictionary.next}</Link> : null}</nav></> : <p className="empty-state">{copy.empty}</p>}</main></>;
}

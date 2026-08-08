import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { SiteHeader } from "@/components/navigation/site-header";
import { ContactForm } from "@/components/contact/contact-form";
import { normalizeListing } from "@/lib/listings/queries";
import { createClient } from "@/lib/supabase/server";

const selection = "id, title, description, kind, status, price_amount, currency, approximate_area, available_from, expires_at, city:cities!inner(id, slug, name, country_code), category:resource_categories!inner(id, slug, label), listing_organizations(organization:organizations(id, slug, name)), item_details(condition, quantity, pickup_area, is_giveaway), housing_details(subtype, furnished, bills_included)";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { title: "Listing not found" };
  const client = await createClient();
  const { data } = await client.from("listings").select("title, description").eq("id", id).maybeSingle();
  return data ? { title: data.title, description: data.description.slice(0, 155) } : { title: "Listing not found" };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createClient();
  const [{ data, error }, imageResult, claimsResult] = await Promise.all([
    client.from("listings").select(selection).eq("id", id).maybeSingle(),
    client.rpc("get_public_listing_images", { p_listing_id: id }),
    client.auth.getClaims(),
  ]);
  if (error || !data) notFound();
  const listing = normalizeListing(data as unknown as Record<string, unknown>);
  const images: { image_id: string; width: number | null; height: number | null }[] = imageResult.error ? [] : imageResult.data ?? [];
  const price = listing.priceAmount === 0 ? "Free" : new Intl.NumberFormat("en", { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.priceAmount);
  const structuredData = { "@context": "https://schema.org", "@type": listing.kind === "housing" ? "Accommodation" : "Product", name: listing.title, description: listing.description, offers: { "@type": "Offer", price: listing.priceAmount, priceCurrency: listing.currency, availability: listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/PreOrder" } };
  const signedIn = typeof claimsResult.data?.claims.sub === "string";
  return <><SiteHeader /><main className="detail-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Browse</Link><span aria-hidden="true">/</span><span>{listing.category.label}</span></nav><div className="detail-layout"><section className="detail-main"><div className="detail-gallery">{images.length ? images.map((image) => <Image key={image.image_id} src={`/api/media/${image.image_id}`} alt="" width={image.width ?? 1200} height={image.height ?? 900} unoptimized />) : <div className={`detail-placeholder ${listing.kind}`}><span>{listing.kind === "housing" ? "Housing handover" : "Item handover"}</span></div>}</div><div className="card-tags"><span className="tag context">{listing.city.name}</span>{listing.organizations.map((organization) => <span className="tag context" key={organization.id}>{organization.name}</span>)}<span className="tag resource">{listing.category.label}</span></div><h1>{listing.title}</h1><p className="detail-description">{listing.description}</p><section className="detail-facts" aria-labelledby="facts-title"><h2 id="facts-title">Handover details</h2><dl><div><dt>Available from</dt><dd>{formatDate(listing.availableFrom)}</dd></div><div><dt>Broad area</dt><dd>{listing.approximateArea}</dd></div>{listing.housing ? <><div><dt>Housing type</dt><dd>{listing.housing.subtype.replaceAll("-", " ")}</dd></div><div><dt>Furnished</dt><dd>{listing.housing.furnished ? "Yes" : "No"}</dd></div><div><dt>Bills included</dt><dd>{listing.housing.billsIncluded ? "Yes" : "No"}</dd></div></> : null}{listing.item ? <><div><dt>Condition</dt><dd>{listing.item.condition.replaceAll("-", " ")}</dd></div><div><dt>Quantity</dt><dd>{listing.item.quantity}</dd></div><div><dt>Pickup area</dt><dd>{listing.item.pickupArea}</dd></div></> : null}</dl></section></section><aside className="contact-card"><p className="eyebrow">Handover price</p><strong className="detail-price">{price}</strong>{listing.status === "reserved" ? <><span className="reserved-badge">Reserved</span><p>This handover is still visible, but new contact requests are paused.</p></> : signedIn ? <ContactForm listingId={listing.id} /> : <><p>Owner contact details stay private. Sign in with a verified email to send a relayed message.</p><Link className="button-link" href={`/login?returnTo=/listings/${listing.id}`}>Sign in to contact</Link></>}<div className="safety-callout"><strong>Stay safe</strong><p>{listing.kind === "housing" ? "Verify the place and authority to offer it before sending money." : "Inspect the item before paying and meet publicly when possible."}</p></div></aside></div><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} /></main></>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(`${value}T12:00:00Z`)); }

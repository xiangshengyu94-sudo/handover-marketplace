import Link from "next/link";
import type { ListingSummary } from "@/lib/listings/queries";

export function ListingCard({ listing }: { listing: ListingSummary }) {
  const giveaway = listing.item?.isGiveaway || listing.priceAmount === 0;
  return <article className="listing-card"><div className={`card-art ${listing.kind}`} aria-hidden="true"><span>{listing.kind === "housing" ? "ROOM" : "ITEM"}</span></div><div className="card-body"><div className="card-tags"><span className="tag context">{listing.city.name}</span>{listing.organizations.map((organization) => <span className="tag context" key={organization.id}>{organization.name}</span>)}<span className="tag resource">{listing.category.label}</span></div><h2><Link href={`/listings/${listing.id}`}>{listing.title}</Link></h2><p>{listing.description}</p><dl className="card-meta"><div><dt>Available</dt><dd>{formatDate(listing.availableFrom)}</dd></div><div><dt>Area</dt><dd>{listing.approximateArea}</dd></div></dl><footer><strong>{giveaway ? "Free" : new Intl.NumberFormat("en", { style: "currency", currency: listing.currency, maximumFractionDigits: 0 }).format(listing.priceAmount)}</strong>{listing.status === "reserved" ? <span className="reserved-badge">Reserved</span> : <Link href={`/listings/${listing.id}`}>View handover <span aria-hidden="true">→</span></Link>}</footer></div></article>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00Z`)); }

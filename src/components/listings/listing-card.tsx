import Link from "next/link";

import { FORMAT_LOCALES, type Locale } from "@/lib/i18n/config";
import { localizeCategoryLabel, type Dictionary } from "@/lib/i18n/dictionaries";
import type { ListingSummary } from "@/lib/listings/queries";

const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();
const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function ListingCard({ listing, locale, dictionary }: { listing: ListingSummary; locale: Locale; dictionary: Dictionary }) {
  const giveaway = listing.item?.isGiveaway || listing.priceAmount === 0;
  const kindLabel = listing.kind === "housing" ? dictionary.cardRoom : listing.kind === "item" ? dictionary.cardItem : dictionary.cardOther;
  return <article className="listing-card"><div className={`card-art ${listing.kind}`} aria-hidden="true"><span>{kindLabel}</span></div><div className="card-body"><div className="card-tags"><span className="tag context">{listing.city.name}</span>{listing.organizations.map((organization) => <span className="tag context" key={organization.id}>{organization.name}</span>)}<span className="tag resource">{localizeCategoryLabel(locale, listing.category.slug, listing.category.label)}</span></div><h2><Link href={`/listings/${listing.id}`}>{listing.title}</Link></h2><p>{listing.description}</p><dl className="card-meta"><div><dt>{dictionary.cardAvailable}</dt><dd>{formatDate(listing.availableFrom, locale)}</dd></div><div><dt>{dictionary.cardArea}</dt><dd>{listing.approximateArea}</dd></div></dl><footer><strong>{giveaway ? dictionary.cardFree : formatCurrency(listing.priceAmount, listing.currency, locale)}</strong>{listing.status === "reserved" ? <span className="reserved-badge">{dictionary.cardReserved}</span> : <Link href={`/listings/${listing.id}`}>{dictionary.cardView} <span aria-hidden="true">→</span></Link>}</footer></div></article>;
}

function formatDate(value: string, locale: Locale) {
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(FORMAT_LOCALES[locale], { month: "short", day: "numeric" });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(`${value}T12:00:00Z`));
}

function formatCurrency(value: number, currency: string, locale: Locale) {
  const key = `${locale}:${currency}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(FORMAT_LOCALES[locale], { style: "currency", currency, maximumFractionDigits: 0 });
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

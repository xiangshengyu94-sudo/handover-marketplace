import type { Metadata } from "next";

import { SiteHeader } from "@/components/navigation/site-header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Safety" };

export default async function SafetyPage() {
  const dictionary = getDictionary(await getLocale());
  return <><SiteHeader /><main className="policy-page"><p className="eyebrow">{dictionary.safetyEyebrow}</p><h1>{dictionary.safetyTitle}</h1><h2>{dictionary.safetyHousing}</h2><p>{dictionary.safetyHousingBody}</p><h2>{dictionary.safetyItems}</h2><p>{dictionary.safetyItemsBody}</p><h2>{dictionary.safetyReport}</h2><p>{dictionary.safetyReportBody}</p></main></>;
}

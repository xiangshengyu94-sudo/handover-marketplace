import type { Metadata } from "next";
import { z } from "zod";

import { IllegalContentNoticeForm } from "@/components/reports/illegal-content-notice-form";
import { SiteHeader } from "@/components/navigation/site-header";

export const metadata: Metadata = { title: "Illegal content notice", robots: { index: false, follow: false } };

export default async function NewNoticePage({ searchParams }: { searchParams: Promise<{ listingId?: string }> }) {
  const parsed = z.uuid().safeParse((await searchParams).listingId);
  return <><SiteHeader /><main className="policy-page"><header><p className="eyebrow">Notice and action</p><h1>Report potentially illegal content.</h1><p className="lede">You can submit without an account. Give specific facts so the notice can be assessed; you will receive a receipt.</p></header><IllegalContentNoticeForm listingId={parsed.success ? parsed.data : undefined} /></main></>;
}

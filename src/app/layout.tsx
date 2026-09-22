import type { Metadata } from "next";

import "./globals.css";

import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { getLocale } from "@/lib/i18n/server";

const metadataDescription = `${BRAND_TAGLINE} Find and hand over rooms, furniture, bicycles, and everyday items across international communities.`;

export const metadata: Metadata = {
  applicationName: BRAND_NAME,
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: metadataDescription,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: metadataDescription,
  },
  twitter: {
    card: "summary",
    title: BRAND_NAME,
    description: metadataDescription,
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}

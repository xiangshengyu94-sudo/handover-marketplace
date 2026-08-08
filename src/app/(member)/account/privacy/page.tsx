import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PrivacyControls } from "@/components/account/privacy-controls";
import { SiteHeader } from "@/components/navigation/site-header";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";

export const metadata: Metadata = { title: "Account privacy" };

export default async function AccountPrivacyPage() {
  try {
    await requireActiveMember();
  } catch (caught) {
    if (caught instanceof AuthorizationError && caught.status === 401) {
      redirect("/login?returnTo=/account/privacy");
    }
    throw caught;
  }

  return (
    <>
      <SiteHeader />
      <main className="policy-page">
        <p className="eyebrow">Account privacy</p>
        <h1>Export or close your account.</h1>
        <p className="lede">
          Both actions create durable receipts. Deletion fails closed: public
          content disappears before provider cleanup, and partial provider work
          remains visible to operators.
        </p>
        <PrivacyControls />
      </main>
    </>
  );
}

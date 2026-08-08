import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { ClaimReview } from "@/components/assisted/claim-review";
import { inspectAssistedClaim } from "@/lib/assisted/claims";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";

export const metadata: Metadata = { title: "Review assisted draft", robots: { index: false, follow: false }, referrer: "no-referrer" };
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export default async function AssistedClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const token = tokenSchema.safeParse((await params).token);
  if (!token.success) notFound();
  let member: Awaited<ReturnType<typeof requireActiveMember>>;
  try { member = await requireActiveMember(); } catch (caught) {
    if (caught instanceof AuthorizationError && caught.status === 401) redirect(`/login?returnTo=/assisted/${token.data}`);
    throw caught;
  }
  const claim = await inspectAssistedClaim({ token: token.data, claimantId: member.id, email: member.email });
  if (!claim) notFound();
  return <main className="claim-page"><ClaimReview token={token.data} listing={claim} /></main>;
}

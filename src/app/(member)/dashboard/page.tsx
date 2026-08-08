import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LifecycleActions } from "@/components/listings/lifecycle-actions";
import { SiteHeader } from "@/components/navigation/site-header";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your handovers" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  try { await requireActiveMember(); } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect("/login?returnTo=/dashboard");
    throw error;
  }
  const client = await createClient();
  const { data, error } = await client.from("listings").select("id, title, kind, status, version, price_amount, currency, expires_at, updated_at").is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) throw new Error("Dashboard unavailable");
  const { result } = await searchParams;
  return <><SiteHeader /><main className="dashboard-page"><header className="dashboard-header"><div><p className="eyebrow">Your handovers</p><h1>Keep every post current.</h1><p className="lede">Reserve, complete, renew, or withdraw listings so incoming students do not chase stale group messages.</p></div><Link className="button-link" href="/listings/new">Post another</Link></header>{result ? <p className={result === "error" || result === "stale" ? "form-error dashboard-notice" : "dashboard-notice"} role="status">{feedback(result)}</p> : null}{data?.length ? <div className="dashboard-list">{data.map((listing) => <article className="dashboard-card" key={listing.id}><div><div className="card-tags"><span className="tag resource">{listing.kind}</span><span className="tag context">{listing.status}</span></div><h2>{listing.title}</h2><p>Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(listing.expires_at))} · version {listing.version}</p></div><div className="dashboard-card-links"><Link href={`/listings/${listing.id}/edit`}>Edit</Link>{["active", "reserved"].includes(listing.status) ? <Link href={`/listings/${listing.id}`}>View public page</Link> : null}</div><LifecycleActions listingId={listing.id} version={Number(listing.version)} status={listing.status} /></article>)}</div> : <div className="empty-state"><h2>No handovers yet.</h2><p>Save a draft to start gathering the details and photos.</p><Link className="button-link" href="/listings/new">Create your first listing</Link></div>}</main></>;
}

function feedback(result: string) {
  if (result === "stale") return "This listing changed elsewhere. The dashboard has been refreshed; review it before trying again.";
  if (result === "error") return "That action could not be completed. Review the current status and try again.";
  const messages: Record<string, string> = { reserve: "Listing marked reserved; new contact is now paused.", reopen: "Listing reopened for contact.", complete: "Handover marked complete.", withdraw: "Listing withdrawn from public discovery.", renew: "Listing renewed.", delete: "Listing deleted." };
  return messages[result] ?? "Listing updated.";
}

import type { Metadata } from "next";

import { reviewTaxonomyAction } from "@/app/admin/actions";
import { SiteHeader } from "@/components/navigation/site-header";
import { requireAnyRole } from "@/lib/auth/require-any-role";
import { listTaxonomyRequests } from "@/lib/moderation/actions";

export const metadata: Metadata = { title: "Taxonomy requests" };

export default async function TaxonomyAdminPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const actor = await requireAnyRole(["operator", "administrator"]); const requests = await listTaxonomyRequests(actor.id); const { result } = await searchParams;
  return <><SiteHeader /><main className="admin-page"><header><p className="eyebrow">Taxonomy operations</p><h1>Keep tags controlled.</h1><p className="lede">Approve or reject new cities, organizations, and resource categories. Merge and alias tooling remains outside the launch scope.</p></header>{result ? <p className="dashboard-notice" role="status">{result === "error" ? "Review failed." : "Request reviewed."}</p> : null}<div className="admin-list">{requests.map((request) => <article key={String(request.id)}><span className="tag context">{String(request.entity_type)}</span><pre>{JSON.stringify(request.payload, null, 2)}</pre><form action={reviewTaxonomyAction} className="admin-action-form"><input type="hidden" name="requestId" value={String(request.id)} /><label>Review note <textarea name="note" maxLength={1000} /></label><button className="button-primary" name="decision" value="approve">Approve</button><button className="button-danger" name="decision" value="reject">Reject</button></form></article>)}</div>{requests.length ? null : <p className="form-note">No open taxonomy requests.</p>}</main></>;
}

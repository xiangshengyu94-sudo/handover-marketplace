import type { Metadata } from "next";

import { moderateListingAction } from "@/app/admin/actions";
import { SiteHeader } from "@/components/navigation/site-header";
import { requireAnyRole } from "@/lib/auth/require-any-role";
import { listModerationWork } from "@/lib/moderation/actions";

export const metadata: Metadata = { title: "Moderation queue" };

export default async function ReportsAdminPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const actor = await requireAnyRole(["moderator", "administrator"]);
  const work = await listModerationWork(actor.id); const { result } = await searchParams;
  return <><SiteHeader /><main className="admin-page"><header><p className="eyebrow">Moderation</p><h1>Review with a trail.</h1><p className="lede">Urgent reports come first. Every hide or restore appends history and queues owner notice plus cache invalidation.</p></header>{result ? <p className="dashboard-notice" role="status">{result === "error" ? "Action failed." : `Listing ${result}.`}</p> : null}<section className="admin-section"><h2>Member reports</h2>{work.reports.length ? <div className="admin-list">{work.reports.map((report) => <article key={String(report.id)}><div className="card-tags">{report.urgent ? <span className="urgent-badge">Urgent</span> : null}<span className="tag resource">{String(report.reason)}</span></div><p>{String(report.details)}</p><small>Listing {String(report.listing_id)}</small><ModerationForm listingId={String(report.listing_id)} reportId={String(report.id)} /></article>)}</div> : <p className="form-note">No open member reports.</p>}</section><section className="admin-section"><h2>Anonymous notices</h2>{work.notices.length ? <div className="admin-list">{work.notices.map((notice) => <article key={String(notice.id)}><span className="tag resource">{String(notice.category)}</span><p>{String(notice.explanation)}</p><small>Receipt {String(notice.receipt_code)}</small>{notice.listing_id ? <ModerationForm listingId={String(notice.listing_id)} /> : null}</article>)}</div> : <p className="form-note">No open notices.</p>}</section></main></>;
}

function ModerationForm({ listingId, reportId }: { listingId: string; reportId?: string }) { return <form action={moderateListingAction} className="admin-action-form"><input type="hidden" name="listingId" value={listingId} />{reportId ? <input type="hidden" name="reportId" value={reportId} /> : null}<label>Reason <textarea name="reason" minLength={10} maxLength={1000} required /></label><button className="button-danger" name="action" value="hide">Hide listing</button><button className="button-secondary" name="action" value="restore">Restore</button></form>; }

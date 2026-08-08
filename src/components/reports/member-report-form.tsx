"use client";

import { useState } from "react";

export function MemberReportForm({ listingId }: { listingId: string }) {
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); const data = new FormData(event.currentTarget);
    try { const response = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId, reason: data.get("reason"), details: data.get("details") }) }); const body = await response.json(); setMessage(response.ok ? `Report received. Receipt ${body.receipt}.` : body.error); }
    catch { setMessage("Report could not be sent."); } finally { setPending(false); }
  }
  return <details className="report-panel"><summary>Report a concern</summary><form onSubmit={(event) => void submit(event)}><label>Reason<select name="reason"><option value="fraud">Fraud</option><option value="spam">Spam</option><option value="inaccuracy">Inaccurate</option><option value="expired">Already gone</option><option value="impersonation">Impersonation</option><option value="discrimination">Discrimination</option><option value="privacy">Privacy</option><option value="prohibited-item">Prohibited item</option></select></label><label>What happened?<textarea name="details" minLength={30} maxLength={4000} required /></label><button className="button-secondary" disabled={pending}>{pending ? "Sending…" : "Submit report"}</button>{message ? <p role="status">{message}</p> : null}</form></details>;
}

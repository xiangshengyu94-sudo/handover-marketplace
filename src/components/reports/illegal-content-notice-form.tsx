"use client";

import { useState } from "react";

export function IllegalContentNoticeForm({ listingId }: { listingId?: string }) {
  const [receipt, setReceipt] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); const data = new FormData(event.currentTarget);
    try { const response = await fetch("/api/notices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: listingId ?? null, category: data.get("category"), explanation: data.get("explanation"), goodFaithAttested: data.get("goodFaithAttested") === "on" }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setReceipt(body.receipt); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Notice could not be submitted."); } finally { setPending(false); }
  }
  if (receipt) return <section className="receipt-panel" role="status"><h2>Notice received</h2><p>Keep this receipt: <strong>{receipt}</strong></p><p>A moderator can use it to locate the notice without exposing your identity.</p></section>;
  return <form className="notice-form" onSubmit={(event) => void submit(event)}><label>Category<select name="category"><option value="illegal-content">Illegal content</option><option value="privacy">Privacy</option><option value="unsafe-housing">Unsafe housing</option><option value="prohibited-item">Prohibited item</option><option value="other">Other</option></select></label><label>Detailed explanation<textarea name="explanation" minLength={80} maxLength={5000} rows={10} required /></label><label className="contact-consent"><input type="checkbox" name="goodFaithAttested" required /> I believe in good faith that this notice is accurate and complete.</label>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button-primary" disabled={pending}>{pending ? "Submitting…" : "Submit notice"}</button></form>;
}

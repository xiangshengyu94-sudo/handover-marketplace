"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimReview({ token, listing }: { token: string; listing: { title: string; description: string; kind: string; approximateArea: string; sourceLabel: string; expiresAt: string } }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function resolve(action: "claim" | "reject") {
    if (action === "reject" && !window.confirm("Reject this draft? Its listing content will be removed and this invitation cannot be used again.")) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/assisted-listings/${token}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Invitation could not be resolved.");
      router.replace(body.destination);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Invitation could not be resolved."); setPending(false); }
  }
  return <section className="claim-card" aria-labelledby="claim-title"><div><p className="eyebrow">Private assisted draft</p><h1 id="claim-title">Review before it becomes yours.</h1><p className="lede">Email matching confirms control of the invited address. It does not prove who originally wrote the group post; review every field before claiming.</p></div><dl className="claim-summary"><div><dt>Type</dt><dd>{listing.kind}</dd></div><div><dt>Broad area</dt><dd>{listing.approximateArea}</dd></div><div><dt>Source label</dt><dd>{listing.sourceLabel}</dd></div><div><dt>Invitation expires</dt><dd>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(listing.expiresAt))}</dd></div></dl><article className="claim-preview"><h2>{listing.title}</h2><p>{listing.description}</p></article><aside className="safety-callout"><strong>Nothing is public yet</strong><p>Claiming transfers this private draft to your account. You must edit and publish it through the normal safety checks.</p></aside>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="button-row"><button className="button-primary" disabled={pending} onClick={() => void resolve("claim")}>{pending ? "Resolving…" : "Claim and edit"}</button><button className="button-danger" disabled={pending} onClick={() => void resolve("reject")}>Reject and remove</button></div></section>;
}

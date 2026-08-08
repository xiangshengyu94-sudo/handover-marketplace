"use client";

import { useState } from "react";

export function ShareKit({ listingId, title }: { listingId: string; title: string }) {
  const [message, setMessage] = useState("");
  const path = `/listings/${listingId}`;
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    const text = `${title.trim().slice(0, 120)} — ${url}`;
    const shareMethod = Reflect.get(navigator, "share") as undefined | ((data: ShareData) => Promise<void>);
    if (shareMethod) await shareMethod.call(navigator, { title: "Handover listing", text, url });
    else await navigator.clipboard.writeText(text);
    setMessage(shareMethod ? "Share sheet opened." : "Share text copied.");
  }
  return <aside className="share-kit"><strong>Bridge your groups</strong><p>Share this public listing back to WhatsApp or Facebook without exposing your contact details.</p><button type="button" className="button-secondary" onClick={() => void share()}>Share listing</button><span role="status">{message}</span></aside>;
}

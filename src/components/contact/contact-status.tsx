"use client";

import { useEffect, useState } from "react";

const terminal = new Set(["delivered", "bounced", "suppressed", "failed"]);
const messages: Record<string, string> = {
  queued: "Your message is queued securely.",
  accepted: "The email provider accepted your message. Delivery is not yet confirmed.",
  delayed: "Delivery is delayed. No duplicate message will be sent.",
  delivered: "Delivery was confirmed.",
  bounced: "The owner’s address rejected the message.",
  suppressed: "The provider suppressed this delivery.",
  failed: "The message could not be delivered.",
};

export function ContactStatus({ intentId, initialStatus }: { intentId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  useEffect(() => {
    if (terminal.has(status)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/contact-status/${intentId}`, { cache: "no-store" });
        if (response.ok && !cancelled) setStatus((await response.json()).status);
      } catch { /* Keep the last truthful state and retry after the next render. */ }
    }, 5_000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [intentId, status]);
  return <div className={`contact-status ${status}`} role="status" aria-live="polite"><strong>{status.replaceAll("_", " ")}</strong><p>{messages[status] ?? messages.queued}</p></div>;
}

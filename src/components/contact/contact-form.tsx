"use client";

import Script from "next/script";
import { useRef, useState } from "react";

import { ContactStatus } from "./contact-status";

export function ContactForm({ listingId }: { listingId: string }) {
  const requestKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [queued, setQueued] = useState<{ intentId: string; status: string }>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const formData = new FormData(event.currentTarget);
    const message = String(formData.get("message") ?? "");
    const consent = formData.get("consent") === "on";
    requestKey.current ??= crypto.randomUUID();
    try {
      const intentResponse = await fetch("/api/contact-intents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId, message, consent, requestKey: requestKey.current }) });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) throw new Error(intent.error ?? "Message could not be prepared.");
      const contactResponse = await fetch(`/api/listings/${listingId}/contact`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: intent.token, message, consent, captchaToken: formData.get("cf-turnstile-response") || undefined }) });
      const contact = await contactResponse.json();
      if (!contactResponse.ok) {
        if (contact.captchaRequired) setCaptchaRequired(true);
        throw new Error(contact.error ?? "Message could not be queued.");
      }
      setQueued({ intentId: contact.intentId, status: contact.status });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message could not be queued.");
    } finally { setPending(false); }
  }

  if (queued) return <ContactStatus intentId={queued.intentId} initialStatus={queued.status} />;
  return <form className="contact-form" onSubmit={(event) => void submit(event)}><label htmlFor="contact-message">Message to the owner</label><textarea id="contact-message" name="message" minLength={20} maxLength={2000} rows={7} required placeholder="Introduce yourself, mention when you arrive, and ask the practical questions you need answered." /><label className="contact-consent"><input type="checkbox" name="consent" required /> I agree that my verified email will be used as the reply address for this message.</label>{captchaRequired ? <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer /><div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY} data-action="contact-owner" /></> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button-primary" disabled={pending}>{pending ? "Queuing…" : "Send private message"}</button><p className="form-note">The owner’s email is never shown. Your message status will update here.</p></form>;
}

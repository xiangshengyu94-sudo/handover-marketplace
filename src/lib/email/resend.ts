import "server-only";

import { Resend, type WebhookEventPayload } from "resend";
import { readServerEnv } from "@/lib/env";
import { brandedEmailSender } from "@/lib/email/sender";

export class EmailProviderError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super("Email provider request failed.");
    this.name = "EmailProviderError";
  }
}

export async function sendContactEmail(input: { to: string; replyTo: string; subject: string; text: string; html: string; idempotencyKey: string; outboxId: string }) {
  const environment = readServerEnv();
  const response = await new Resend(environment.resendApiKey).emails.send({
    from: brandedEmailSender(environment.emailFrom), to: input.to, replyTo: input.replyTo,
    subject: input.subject, text: input.text, html: input.html,
    tags: [{ name: "message_type", value: "contact_relay" }, { name: "outbox_id", value: input.outboxId }],
  }, { idempotencyKey: input.idempotencyKey });
  if (response.error) {
    const retryable = response.error.statusCode === 429 || (response.error.statusCode ?? 500) >= 500 || response.error.name === "concurrent_idempotent_requests";
    throw new EmailProviderError(response.error.name, retryable);
  }
  return response.data.id;
}

export function verifyResendWebhook(input: { payload: string; id: string; timestamp: string; signature: string }): WebhookEventPayload {
  const environment = readServerEnv();
  return new Resend(environment.resendApiKey).webhooks.verify({ payload: input.payload, headers: { id: input.id, timestamp: input.timestamp, signature: input.signature }, webhookSecret: environment.resendWebhookSecret });
}

export async function sendOperationalEmail(input: { to: string; subject: string; text: string; idempotencyKey: string; messageType: string; recordId: string }) {
  const environment = readServerEnv();
  const response = await new Resend(environment.resendApiKey).emails.send({
    from: brandedEmailSender(environment.emailFrom), to: input.to, subject: input.subject, text: input.text,
    tags: [{ name: "message_type", value: input.messageType }, { name: "record_id", value: input.recordId }],
  }, { idempotencyKey: input.idempotencyKey });
  if (response.error) {
    const retryable = response.error.statusCode === 429 || (response.error.statusCode ?? 500) >= 500 || response.error.name === "concurrent_idempotent_requests";
    throw new EmailProviderError(response.error.name, retryable);
  }
  return response.data.id;
}

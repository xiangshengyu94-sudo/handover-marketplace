import "server-only";

import { randomUUID } from "node:crypto";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { renderContactEmail } from "./templates/contact";
import { EmailProviderError, sendContactEmail, sendOperationalEmail } from "./resend";

function admin() { return createPrivilegedClient("src/lib/email/dispatcher.ts"); }

export async function dispatchContactBatch(limit = 10) {
  const leaseToken = randomUUID();
  const client = admin();
  const { data, error } = await client.rpc("admin_lease_contact_outbox", { p_limit: limit, p_lease_token: leaseToken });
  if (error) throw new Error("Unable to lease contact messages.");
  const outcomes: { id: string; status: "accepted" | "retrying" | "failed" }[] = [];
  for (const row of data ?? []) {
    try {
      const template = renderContactEmail({ listingTitle: String(row.listing_title), message: String(row.message_body) });
      const providerId = await sendContactEmail({ to: String(row.owner_email), replyTo: String(row.sender_email), ...template, idempotencyKey: String(row.idempotency_key), outboxId: String(row.outbox_id) });
      const completed = await client.rpc("admin_mark_contact_accepted", { p_outbox_id: row.outbox_id, p_lease_token: leaseToken, p_provider_email_id: providerId });
      outcomes.push({ id: String(row.outbox_id), status: !completed.error && completed.data === true ? "accepted" : "failed" });
    } catch (caught) {
      const providerError = caught instanceof EmailProviderError ? caught : new EmailProviderError("provider_unavailable", true);
      await client.rpc("admin_retry_contact_outbox", { p_outbox_id: row.outbox_id, p_lease_token: leaseToken, p_error_code: providerError.code, p_retryable: providerError.retryable });
      outcomes.push({ id: String(row.outbox_id), status: providerError.retryable ? "retrying" : "failed" });
    }
  }
  return outcomes;
}

export async function applyResendEvent(input: { eventId: string; providerEmailId: string; type: string; occurredAt: string }) {
  const supported = ["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.suppressed", "email.failed"];
  if (!supported.includes(input.type)) return false;
  const { data, error } = await admin().rpc("admin_apply_resend_event", { p_event_id: input.eventId, p_provider_email_id: input.providerEmailId, p_event_type: input.type, p_occurred_at: input.occurredAt });
  if (error) throw new Error("Unable to apply email event.");
  if (data !== true) return false;
  const notification = await admin().rpc("admin_apply_notification_event", { p_provider_email_id: input.providerEmailId, p_event_type: input.type });
  if (notification.error) throw new Error("Unable to apply notification event.");
  return data === true || notification.data === true;
}

export async function dispatchNotificationBatch(limit = 10) {
  const leaseToken = randomUUID(); const client = admin();
  const { data, error } = await client.rpc("admin_lease_notification_outbox", { p_limit: limit, p_lease_token: leaseToken });
  if (error) throw new Error("Unable to lease notifications.");
  const outcomes: { id: string; status: "accepted" | "retrying" | "failed" }[] = [];
  for (const row of data ?? []) {
    try {
      const message = renderOperationalNotification(String(row.template_kind), row.payload as Record<string, unknown>);
      const providerId = await sendOperationalEmail({ to: String(row.recipient_email), ...message, idempotencyKey: String(row.idempotency_key), messageType: String(row.template_kind), recordId: String(row.notification_id) });
      const marked = await client.rpc("admin_mark_notification_accepted", { p_id: row.notification_id, p_lease_token: leaseToken, p_provider_email_id: providerId });
      outcomes.push({ id: String(row.notification_id), status: !marked.error && marked.data === true ? "accepted" : "failed" });
    } catch (caught) {
      const providerError = caught instanceof EmailProviderError ? caught : new EmailProviderError("provider_unavailable", true);
      await client.rpc("admin_retry_notification", { p_id: row.notification_id, p_lease_token: leaseToken, p_error_code: providerError.code, p_retryable: providerError.retryable });
      outcomes.push({ id: String(row.notification_id), status: providerError.retryable ? "retrying" : "failed" });
    }
  }
  return outcomes;
}

function renderOperationalNotification(kind: string, payload: Record<string, unknown>) {
  if (kind === "role-changed") return { subject: "Your Handover role changed", text: `Your protected role was ${String(payload.action)}: ${String(payload.role)}. If you did not expect this, contact the service administrator.` };
  const restored = kind === "listing-restored";
  return { subject: restored ? "Your Handover listing was restored" : "Your Handover listing was hidden", text: `Listing ${String(payload.listingId)} was ${restored ? "restored" : "hidden"}. Reason: ${String(payload.reason)}. Keep this message for an appeal or follow-up.` };
}

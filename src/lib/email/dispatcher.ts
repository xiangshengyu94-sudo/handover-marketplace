import "server-only";

import { randomUUID } from "node:crypto";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { renderContactEmail } from "./templates/contact";
import { EmailProviderError, sendContactEmail } from "./resend";

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
  return data === true;
}

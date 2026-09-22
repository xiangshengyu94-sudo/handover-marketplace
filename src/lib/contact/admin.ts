import "server-only";

import { createPrivilegedClient } from "@/lib/supabase/admin";

function admin() {
  return createPrivilegedClient("src/lib/contact/admin.ts");
}

export async function issueContactIntent(input: {
  senderId: string;
  id: string;
  requestKey: string;
  listingId: string;
  tokenHash: string;
  payloadHash: string;
  message: string;
  expiresAt: string;
}) {
  return admin().rpc("admin_issue_contact_intent", {
    p_sender_id: input.senderId,
    p_id: input.id,
    p_request_key: input.requestKey,
    p_listing_id: input.listingId,
    p_token_hash: input.tokenHash,
    p_payload_hash: input.payloadHash,
    p_message_body: input.message,
    p_expires_at: input.expiresAt,
  });
}

export async function consumeContactIntent(input: {
  senderId: string;
  tokenHash: string;
  listingId: string;
  payloadHash: string;
  message: string;
}) {
  return admin().rpc("admin_consume_contact_intent", {
    p_sender_id: input.senderId,
    p_token_hash: input.tokenHash,
    p_listing_id: input.listingId,
    p_payload_hash: input.payloadHash,
    p_message_body: input.message,
  });
}

import "server-only";

import { createPrivilegedClient } from "@/lib/supabase/admin";

function admin() { return createPrivilegedClient("src/lib/moderation/actions.ts"); }

export async function listModerationWork(actorId: string) {
  const client = admin();
  const { data, error } = await client.rpc("admin_list_moderation_work", { p_actor_id: actorId });
  if (error || !data || typeof data !== "object") throw new Error("Moderation queue unavailable");
  return data as { reports: Array<Record<string, unknown>>; notices: Array<Record<string, unknown>> };
}

export async function listTaxonomyRequests(actorId: string) {
  const client = admin();
  const { data, error } = await client.rpc("admin_list_taxonomy_requests", { p_actor_id: actorId });
  if (error) throw new Error("Taxonomy queue unavailable");
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
}

export async function moderateListing(input: { actorId: string; listingId: string; action: "hide" | "restore"; reason: string; reportId?: string }) {
  const { data, error } = await admin().rpc("admin_moderate_listing", { p_actor_id: input.actorId, p_listing_id: input.listingId, p_action: input.action, p_reason: input.reason, p_report_id: input.reportId ?? null });
  if (error || data === null) throw new Error("Moderation action failed");
  return data;
}

export async function reviewTaxonomyRequest(input: { actorId: string; requestId: string; decision: "approve" | "reject"; note: string }) {
  const { data, error } = await admin().rpc("admin_review_taxonomy_request", { p_actor_id: input.actorId, p_request_id: input.requestId, p_decision: input.decision, p_note: input.note });
  if (error || data !== true) throw new Error("Taxonomy review failed");
}

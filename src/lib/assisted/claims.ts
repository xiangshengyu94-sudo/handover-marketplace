import "server-only";

import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import { readServerEnv } from "@/lib/env";
import { createPrivilegedClient } from "@/lib/supabase/admin";

import type { AssistedInput } from "./schema";

function admin() { return createPrivilegedClient("src/lib/assisted/claims.ts"); }

export async function createAssistedDraft(operatorId: string, input: AssistedInput) {
  const token = randomBytes(32).toString("base64url");
  const listingId = randomUUID();
  const claimId = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000).toISOString();
  const listing = input.listing;
  const housing = listing.kind === "housing" ? listing.housing : null;
  const item = listing.kind === "item" ? listing.item : null;
  const { data, error } = await admin().rpc("admin_create_assisted_draft", {
    p_operator_id: operatorId, p_listing_id: listingId, p_claim_id: claimId,
    p_token_hash: hashClaimToken(token), p_author_email_hmac: hmacAuthorEmail(input.authorEmail),
    p_source_label: input.sourceLabel, p_expires_at: expiresAt,
    p_kind: listing.kind, p_city_id: listing.cityId, p_organization_ids: listing.organizationIds,
    p_resource_category_id: listing.resourceCategoryId, p_title: listing.title, p_description: listing.description,
    p_price_amount: listing.priceAmount, p_currency: listing.currency, p_approximate_area: listing.approximateArea,
    p_available_from: listing.availableFrom, p_listing_expires_at: listing.expiresAt,
    p_housing_subtype: housing?.subtype ?? null, p_furnished: housing?.furnished ?? null,
    p_bills_included: housing?.billsIncluded ?? null,
    p_publication_rights_acknowledged: housing?.publicationRightsAcknowledged ?? null,
    p_permission_acknowledged: housing?.permissionAcknowledged ?? null,
    p_safety_warning_acknowledged: housing?.safetyWarningAcknowledged ?? null,
    p_item_condition: item?.condition ?? null, p_quantity: item?.quantity ?? null,
    p_pickup_area: item?.pickupArea ?? null, p_is_giveaway: item?.isGiveaway ?? null,
  });
  if (error || data !== listingId) throw new Error("Unable to create assisted draft.");
  return { listingId, claimId, token, expiresAt };
}

export async function inspectAssistedClaim(input: { token: string; claimantId: string; email: string }) {
  const { data, error } = await admin().rpc("admin_inspect_assisted_claim", { p_token_hash: hashClaimToken(input.token), p_claimant_id: input.claimantId, p_author_email_hmac: hmacAuthorEmail(input.email) });
  if (error) return null;
  const claim = Array.isArray(data) ? data[0] : null;
  return claim ? { claimId: String(claim.claim_id), listingId: String(claim.listing_id), title: String(claim.title), description: String(claim.description), kind: String(claim.kind), approximateArea: String(claim.approximate_area), sourceLabel: String(claim.source_label), expiresAt: String(claim.expires_at) } : null;
}

export async function resolveAssistedClaim(input: { token: string; claimantId: string; email: string; action: "claim" | "reject" }) {
  const { data, error } = await admin().rpc("admin_resolve_assisted_claim", { p_token_hash: hashClaimToken(input.token), p_claimant_id: input.claimantId, p_author_email_hmac: hmacAuthorEmail(input.email), p_action: input.action });
  if (error) return null;
  const result = Array.isArray(data) ? data[0] : null;
  return result ? { listingId: String(result.listing_id), status: String(result.terminal_status) } : null;
}

export function hashClaimToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hmacAuthorEmail(email: string) {
  return createHmac("sha256", readServerEnv().assistedClaimHmacSecret).update(email.trim().toLowerCase(), "utf8").digest("hex");
}

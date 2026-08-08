import "server-only";

import { createHmac } from "node:crypto";

import {
  digest,
  type AuthIntentPurpose,
  type AuthIntentRecord,
  type AuthIntentRepository,
} from "@/lib/auth/intent";
import { readServerEnv } from "@/lib/env";
import { createPrivilegedClient } from "@/lib/supabase/admin";

function createAdminClient() {
  return createPrivilegedClient("src/lib/auth/admin.ts");
}

export function createAuthIntentRepository(): AuthIntentRepository {
  return {
    async supersedeActive(bindingHash, purpose, at) {
      const { error } = await createAdminClient().rpc(
        "admin_supersede_auth_intents",
        {
          p_binding_hash: bindingHash,
          p_purpose: purpose,
          p_at: at.toISOString(),
        },
      );
      if (error) throw new Error("Unable to prepare sign-in.");
    },

    async insert(record) {
      const { error } = await createAdminClient().rpc("admin_create_auth_intent", {
        p_id: record.id,
        p_nonce_hash: record.nonceHash,
        p_binding_hash: record.bindingHash,
        p_purpose: record.purpose,
        p_return_to: record.returnTo,
        p_created_at: record.createdAt.toISOString(),
        p_expires_at: record.expiresAt.toISOString(),
      });
      if (error) throw new Error("Unable to prepare sign-in.");
    },

    async findByNonceHash(nonceHash) {
      const { data, error } = await createAdminClient().rpc(
        "admin_find_auth_intent",
        { p_nonce_hash: nonceHash },
      );
      if (error) throw new Error("Unable to verify sign-in.");
      const row = Array.isArray(data) ? data[0] : null;
      return row ? mapIntent(row as Record<string, unknown>) : null;
    },

    async markConsumed(id, at) {
      const { data, error } = await createAdminClient().rpc(
        "admin_consume_auth_intent",
        { p_id: id, p_at: at.toISOString() },
      );
      if (error) throw new Error("Unable to complete sign-in.");
      return data === true;
    },
  };
}

function mapIntent(row: Record<string, unknown>): AuthIntentRecord {
  return {
    id: String(row.id),
    nonceHash: String(row.nonce_hash),
    bindingHash: String(row.binding_hash),
    purpose: String(row.purpose) as AuthIntentPurpose,
    returnTo: String(row.return_to),
    createdAt: new Date(String(row.created_at)),
    expiresAt: new Date(String(row.expires_at)),
    consumedAt: row.consumed_at
      ? new Date(String(row.consumed_at))
      : undefined,
    supersededAt: row.superseded_at
      ? new Date(String(row.superseded_at))
      : undefined,
  };
}

export type RateLimitResult = {
  allowed: boolean;
  attemptCount: number;
  retryAfterSeconds: number;
};

export async function consumeRateLimit(input: {
  scope: string;
  keyHash: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { data, error } = await createAdminClient().rpc(
    "admin_consume_rate_limit",
    {
      p_scope: input.scope,
      p_key_hash: input.keyHash,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    },
  );
  if (error) throw new Error("Unable to check request limits.");
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new Error("Unable to check request limits.");
  return {
    allowed: Boolean(row.allowed),
    attemptCount: Number(row.attempt_count),
    retryAfterSeconds: Number(row.retry_after_seconds),
  };
}

export function hashAbuseKey(value: string) {
  const { abuseHashSecret } = readServerEnv();
  return createHmac("sha256", abuseHashSecret)
    .update(value, "utf8")
    .digest("hex");
}

export async function consumeCaptchaChallenge(challengeId: string, expiresAt: Date) {
  const { data, error } = await createAdminClient().rpc(
    "admin_consume_captcha_challenge",
    { p_challenge_hash: digest(challengeId), p_expires_at: expiresAt.toISOString() },
  );
  if (error) throw new Error("Unable to record verification.");
  return data === true;
}

export async function cancelPendingEmailChange(userId: string, currentEmail: string) {
  const { data, error } = await createAdminClient().auth.admin.updateUserById(
    userId,
    { email: currentEmail, email_confirm: true },
  );
  if (error || data.user.new_email) {
    throw new Error("Unable to cancel the email change.");
  }
}

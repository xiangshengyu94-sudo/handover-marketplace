import "server-only";

import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { sanitizeReturnTo } from "@/lib/auth/return-to";

export type AuthIntentPurpose = "login" | "email-change";

export type AuthIntentRecord = {
  id: string;
  nonceHash: string;
  bindingHash: string;
  purpose: AuthIntentPurpose;
  returnTo: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
  supersededAt?: Date;
};

export interface AuthIntentRepository {
  supersedeActive(
    bindingHash: string,
    purpose: AuthIntentPurpose,
    at: Date,
  ): Promise<void>;
  insert(record: AuthIntentRecord): Promise<void>;
  findByNonceHash(nonceHash: string): Promise<AuthIntentRecord | null>;
  markConsumed(id: string, at: Date): Promise<boolean>;
}

export type AuthIntentErrorCode =
  | "invalid"
  | "expired"
  | "used"
  | "superseded"
  | "binding_mismatch"
  | "purpose_mismatch";

export class AuthIntentError extends Error {
  constructor(readonly code: AuthIntentErrorCode) {
    super("This sign-in request is no longer valid. Please request a new code.");
    this.name = "AuthIntentError";
  }
}

type CreateAuthIntentInput = {
  repository: AuthIntentRepository;
  browserBinding: string;
  purpose: AuthIntentPurpose;
  returnTo: unknown;
  now?: Date;
  ttlMs?: number;
};

export async function createAuthIntent({
  repository,
  browserBinding,
  purpose,
  returnTo,
  now = new Date(),
  ttlMs = 10 * 60 * 1_000,
}: CreateAuthIntentInput) {
  if (!browserBinding || ttlMs <= 0) {
    throw new AuthIntentError("invalid");
  }

  const nonce = randomBytes(32).toString("base64url");
  const bindingHash = digest(browserBinding);
  const record: AuthIntentRecord = {
    id: randomUUID(),
    nonceHash: digest(nonce),
    bindingHash,
    purpose,
    returnTo: sanitizeReturnTo(returnTo),
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
  };

  await repository.supersedeActive(bindingHash, purpose, now);
  await repository.insert(record);
  return { nonce };
}

type ConsumeAuthIntentInput = {
  repository: AuthIntentRepository;
  browserBinding: string;
  purpose: AuthIntentPurpose;
  nonce: string;
  now?: Date;
};

export async function consumeAuthIntent({
  repository,
  browserBinding,
  purpose,
  nonce,
  now = new Date(),
}: ConsumeAuthIntentInput) {
  const inspected = await inspectAuthIntent({
    repository,
    browserBinding,
    purpose,
    nonce,
    now,
  });
  if (!(await repository.markConsumed(inspected.id, now))) {
    throw new AuthIntentError("used");
  }
  return { returnTo: inspected.returnTo };
}

export async function inspectAuthIntent({
  repository,
  browserBinding,
  purpose,
  nonce,
  now = new Date(),
}: ConsumeAuthIntentInput) {
  if (!nonce || !browserBinding) throw new AuthIntentError("invalid");

  const record = await repository.findByNonceHash(digest(nonce));
  if (!record) throw new AuthIntentError("invalid");
  if (!safeEqual(record.bindingHash, digest(browserBinding))) {
    throw new AuthIntentError("binding_mismatch");
  }
  if (record.purpose !== purpose) {
    throw new AuthIntentError("purpose_mismatch");
  }
  if (record.supersededAt) throw new AuthIntentError("superseded");
  if (record.consumedAt) throw new AuthIntentError("used");
  if (record.expiresAt.getTime() <= now.getTime()) {
    throw new AuthIntentError("expired");
  }

  return { id: record.id, returnTo: sanitizeReturnTo(record.returnTo) };
}

export function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
  );
}

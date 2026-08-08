import "server-only";

import { randomUUID } from "node:crypto";

import {
  completeProviderCleanup,
  type ProviderCleanup,
} from "@/lib/privacy/provider-cleanup";
import { createPrivilegedClient } from "@/lib/supabase/admin";

export type AccountDeletionResult = {
  receipt: string;
  status: "completed" | "partial";
};

export type AccountDeletionErrorCode = "last-admin" | "unavailable";

export class AccountDeletionError extends Error {
  constructor(readonly code: AccountDeletionErrorCode) {
    super(
      code === "last-admin"
        ? "The last administrator cannot delete their account."
        : "Account deletion is temporarily unavailable.",
    );
    this.name = "AccountDeletionError";
  }
}

type BeginDeletionResult = AccountDeletionResult & {
  requestId: string;
  providerCleanup: ProviderCleanup;
  shouldCleanup: boolean;
};

export async function deleteAccount(
  userId: string,
  requestKey: string,
): Promise<AccountDeletionResult> {
  const client = createPrivilegedClient("src/lib/privacy/delete-account.ts");
  let beginResponse;
  try {
    beginResponse = await client.rpc("admin_begin_account_deletion", {
      p_user_id: userId,
      p_request_id: requestKey,
      p_receipt_code: randomUUID(),
    });
  } catch {
    throw new AccountDeletionError("unavailable");
  }

  if (beginResponse.error) {
    if (
      beginResponse.error.code === "23514" &&
      beginResponse.error.message.includes("last administrator")
    ) {
      throw new AccountDeletionError("last-admin");
    }
    throw new AccountDeletionError("unavailable");
  }

  const deletion = parseBeginDeletionResult(beginResponse.data);
  if (!deletion) throw new AccountDeletionError("unavailable");
  if (!deletion.shouldCleanup) {
    return { receipt: deletion.receipt, status: deletion.status };
  }

  const completed = await completeProviderCleanup(
    client,
    deletion.providerCleanup,
  );
  try {
    const { data: finishData, error: finishError } = await client.rpc(
      "admin_finish_privacy_request",
      {
        p_request_id: deletion.requestId,
        p_status: completed ? "completed" : "partial",
        p_error_code: completed ? null : "provider-cleanup-pending",
      },
    );
    if (finishError || finishData !== true) {
      return { receipt: deletion.receipt, status: "partial" };
    }
  } catch {
    return { receipt: deletion.receipt, status: "partial" };
  }

  return {
    receipt: deletion.receipt,
    status: completed ? ("completed" as const) : ("partial" as const),
  };
}

export async function recoverAccountDeletion(
  requestKey: string,
): Promise<AccountDeletionResult | null> {
  const client = createPrivilegedClient("src/lib/privacy/delete-account.ts");
  let response;
  try {
    response = await client.rpc("admin_recover_account_deletion", {
      p_request_id: requestKey,
    });
  } catch {
    throw new AccountDeletionError("unavailable");
  }
  if (response.error) throw new AccountDeletionError("unavailable");
  if (response.data === null) return null;

  const result = parseAccountDeletionResult(response.data);
  if (!result) throw new AccountDeletionError("unavailable");
  return result;
}

function parseBeginDeletionResult(value: unknown): BeginDeletionResult | null {
  const publicResult = parseAccountDeletionResult(value);
  if (!publicResult || !isRecord(value)) return null;
  if (
    typeof value.requestId !== "string" ||
    typeof value.shouldCleanup !== "boolean" ||
    !isRecord(value.providerCleanup)
  ) {
    return null;
  }
  return {
    ...publicResult,
    requestId: value.requestId,
    providerCleanup: value.providerCleanup as ProviderCleanup,
    shouldCleanup: value.shouldCleanup,
  };
}

function parseAccountDeletionResult(value: unknown): AccountDeletionResult | null {
  if (
    !isRecord(value) ||
    typeof value.receipt !== "string" ||
    (value.status !== "completed" && value.status !== "partial")
  ) {
    return null;
  }
  return { receipt: value.receipt, status: value.status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

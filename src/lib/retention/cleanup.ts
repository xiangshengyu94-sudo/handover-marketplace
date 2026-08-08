import "server-only";

import { randomUUID } from "node:crypto";

import {
  drainListingStorageCleanupOutbox,
  StorageCleanupFailure,
} from "@/lib/images/storage-cleanup";
import {
  completeProviderCleanup,
  type ProviderCleanup,
} from "@/lib/privacy/provider-cleanup";
import { createPrivilegedClient } from "@/lib/supabase/admin";

type PrivilegedClient = ReturnType<typeof createPrivilegedClient>;

class RetentionFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function runRetention(now = new Date()) {
  const client = createPrivilegedClient("src/lib/retention/cleanup.ts");
  const startedAt = now.toISOString();

  try {
    const databasePhase = await client.rpc("admin_run_retention", {
      p_now: startedAt,
    });
    if (databasePhase.error || !databasePhase.data) {
      throw new RetentionFailure("database-retention-failed");
    }

    const databaseCounts = retentionDatabaseCounts(databasePhase.data);
    const storageCleanup = await drainListingStorageCleanupOutbox(client);
    const privacyCleanup = await retryPartialPrivacyCleanups(client);
    const result = { ...databaseCounts, storageCleanup, privacyCleanup };
    const finalized = await client.rpc("admin_finish_retention_run", {
      p_started_at: startedAt,
      p_result: result,
    });
    if (finalized.error) {
      throw new RetentionFailure("retention-finalize-rpc-failed");
    }
    if (finalized.data !== true) {
      throw new RetentionFailure("retention-finalize-rejected");
    }
    return result;
  } catch (caught) {
    const errorCode =
      caught instanceof RetentionFailure ||
      caught instanceof StorageCleanupFailure
        ? caught.code
        : "retention-worker-failed";
    await recordFailure(client, errorCode, caught);
    throw new Error("Retention job failed.", { cause: caught });
  }
}

async function recordFailure(
  client: PrivilegedClient,
  errorCode: string,
  cause: unknown,
) {
  try {
    const recorded = await client.rpc(
      "admin_record_retention_cleanup_failure",
      { p_error_code: errorCode },
    );
    if (recorded.error) {
      throw new Error("Retention failure record was rejected.");
    }
  } catch (recordError) {
    throw new Error("Retention failure could not be recorded.", {
      cause: { cause, recordError },
    });
  }
}

async function retryPartialPrivacyCleanups(
  client: PrivilegedClient,
) {
  const leaseToken = randomUUID();
  const { data, error } = await client.rpc("admin_lease_privacy_cleanups", {
    p_limit: 10,
    p_lease_token: leaseToken,
  });
  if (error) {
    throw new RetentionFailure("privacy-cleanup-lease-failed");
  }

  const rows = (data ?? []) as Array<{
    request_id: string;
    provider_cleanup: ProviderCleanup;
  }>;
  let completed = 0;
  let providerFailed = false;
  let leaseLost = false;
  for (let index = 0; index < rows.length; index += 3) {
    const outcomes = await Promise.all(
      rows.slice(index, index + 3).map(async (row) => {
        const succeeded = await completeProviderCleanup(
          client,
          row.provider_cleanup,
        );
        try {
          const finished = await client.rpc(
            "admin_finish_privacy_cleanup_retry",
            {
              p_request_id: row.request_id,
              p_lease_token: leaseToken,
              p_succeeded: succeeded,
              p_error_code: succeeded ? null : "provider-cleanup-pending",
            },
          );
          return {
            succeeded,
            leaseLost: Boolean(finished.error) || finished.data !== true,
          };
        } catch {
          return { succeeded, leaseLost: true };
        }
      }),
    );
    completed += outcomes.filter((outcome) => outcome.succeeded).length;
    providerFailed ||= outcomes.some((outcome) => !outcome.succeeded);
    leaseLost ||= outcomes.some((outcome) => outcome.leaseLost);
  }

  if (leaseLost) {
    throw new RetentionFailure("privacy-cleanup-lease-lost");
  }
  if (providerFailed) {
    throw new RetentionFailure("privacy-cleanup-provider-failed");
  }
  return { leased: rows.length, completed };
}

function retentionDatabaseCounts(value: unknown) {
  const result = isRecord(value) ? value : {};
  return {
    expiredListings: count(result.expiredListings),
    purgedContactBodies: count(result.purgedContactBodies),
    cleanedImages: count(result.cleanedImages),
    expiredAssistedDrafts: count(result.expiredAssistedDrafts),
    hasMore: result.hasMore === true,
  };
}

function count(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

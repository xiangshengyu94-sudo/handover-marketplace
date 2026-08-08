import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type ListingStoragePaths = {
  staging?: string[];
  media?: string[];
};

const DELETE_BATCH_SIZE = 100;
const STORAGE_OPERATION_TIMEOUT_MS = 20_000;

type StorageCleanupRow = {
  cleanup_id: number;
  bucket: "listing-staging" | "listing-media";
  object_path: string;
};

export async function removeListingStorageObjects(
  client: SupabaseClient,
  paths: ListingStoragePaths,
  operationTimeoutMs = STORAGE_OPERATION_TIMEOUT_MS,
) {
  const results = await Promise.all([
    removeBucketPaths(
      client,
      "listing-staging",
      paths.staging ?? [],
      operationTimeoutMs,
    ),
    removeBucketPaths(
      client,
      "listing-media",
      paths.media ?? [],
      operationTimeoutMs,
    ),
  ]);
  return results.every(Boolean);
}

export class StorageCleanupFailure extends Error {
  constructor(
    readonly code:
      | "storage-cleanup-lease-failed"
      | "storage-cleanup-provider-failed"
      | "storage-cleanup-lease-lost",
  ) {
    super(code);
  }
}

export async function drainListingStorageCleanupOutbox(
  client: SupabaseClient,
  limit = DELETE_BATCH_SIZE,
  operationTimeoutMs = STORAGE_OPERATION_TIMEOUT_MS,
) {
  const leaseToken = randomUUID();
  const { data, error } = await client.rpc("admin_lease_storage_cleanup", {
    p_limit: Math.min(Math.max(limit, 1), DELETE_BATCH_SIZE),
    p_lease_token: leaseToken,
  });
  if (error) {
    throw new StorageCleanupFailure("storage-cleanup-lease-failed");
  }

  const rows = (data ?? []) as StorageCleanupRow[];
  const outcomes = await Promise.all(
    (["listing-staging", "listing-media"] as const).map(async (bucket) => {
      const bucketRows = rows.filter((row) => row.bucket === bucket);
      if (!bucketRows.length) {
        return { completed: 0, providerFailed: false, leaseLost: false };
      }

      let succeeded = false;
      try {
        const removal = await withTimeout(
          client.storage
            .from(bucket)
            .remove(bucketRows.map((row) => row.object_path)),
          operationTimeoutMs,
        );
        succeeded = !removal.error;
      } catch {
        succeeded = false;
      }

      const finishes = await Promise.all(
        bucketRows.map(async (row) => {
          try {
            const finish = await withTimeout(
              client.rpc("admin_finish_storage_cleanup", {
                p_cleanup_id: row.cleanup_id,
                p_lease_token: leaseToken,
                p_succeeded: succeeded,
                p_error_code: succeeded
                  ? null
                  : "storage-provider-delete-failed",
              }),
              operationTimeoutMs,
            );
            return !finish.error && finish.data === true;
          } catch {
            return false;
          }
        }),
      );

      return {
        completed: succeeded ? bucketRows.length : 0,
        providerFailed: !succeeded,
        leaseLost: finishes.some((finished) => !finished),
      };
    }),
  );

  if (outcomes.some((outcome) => outcome.leaseLost)) {
    throw new StorageCleanupFailure("storage-cleanup-lease-lost");
  }
  if (outcomes.some((outcome) => outcome.providerFailed)) {
    throw new StorageCleanupFailure("storage-cleanup-provider-failed");
  }
  return {
    leased: rows.length,
    completed: outcomes.reduce(
      (total, outcome) => total + outcome.completed,
      0,
    ),
  };
}

async function removeBucketPaths(
  client: SupabaseClient,
  bucket: "listing-staging" | "listing-media",
  paths: string[],
  operationTimeoutMs: number,
) {
  for (let index = 0; index < paths.length; index += DELETE_BATCH_SIZE) {
    try {
      const { error } = await withTimeout(
        client.storage
          .from(bucket)
          .remove(paths.slice(index, index + DELETE_BATCH_SIZE)),
        operationTimeoutMs,
      );
      if (error) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Storage operation timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

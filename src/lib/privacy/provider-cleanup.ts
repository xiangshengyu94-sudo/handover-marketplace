import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { removeListingStorageObjects } from "@/lib/images/storage-cleanup";

export type ProviderCleanup = {
  staging?: string[];
  media?: string[];
  authUserId?: string;
};

const PROVIDER_OPERATION_TIMEOUT_MS = 20_000;

export async function completeProviderCleanup(
  client: SupabaseClient,
  cleanup: ProviderCleanup,
  operationTimeoutMs = PROVIDER_OPERATION_TIMEOUT_MS,
) {
  try {
    const storageRemoved = await removeListingStorageObjects(
      client,
      cleanup,
      operationTimeoutMs,
    );
    const auth = cleanup.authUserId
      ? await withTimeout(
          client.auth.admin.deleteUser(cleanup.authUserId, true),
          operationTimeoutMs,
        )
      : { error: null };

    return storageRemoved && !auth.error;
  } catch {
    return false;
  }
}

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Provider cleanup timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

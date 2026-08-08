import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { drainListingStorageCleanupOutbox } from "@/lib/images/storage-cleanup";

function clientWith(
  remove: ReturnType<typeof vi.fn>,
  finish: { data: boolean; error: unknown } = { data: true, error: null },
) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "admin_lease_storage_cleanup") {
      return {
        data: [
          {
            cleanup_id: 1,
            bucket: "listing-staging",
            object_path: "private/object.webp",
          },
        ],
        error: null,
      };
    }
    if (name === "admin_finish_storage_cleanup") return finish;
    throw new Error(`Unexpected RPC: ${name}`);
  });
  const client = {
    rpc,
    storage: { from: vi.fn(() => ({ remove })) },
  } as unknown as SupabaseClient;
  return { client, rpc };
}

describe("durable Storage cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bounds a stalled provider call and durably records the failed lease", async () => {
    vi.useFakeTimers();
    const remove = vi.fn(() => new Promise(() => undefined));
    const { client, rpc } = clientWith(remove);

    const cleanup = drainListingStorageCleanupOutbox(client, 100, 5);
    const rejected = expect(cleanup).rejects.toMatchObject({
      code: "storage-cleanup-provider-failed",
    });
    await vi.advanceTimersByTimeAsync(5);

    await rejected;
    expect(rpc).toHaveBeenCalledWith(
      "admin_finish_storage_cleanup",
      expect.objectContaining({
        p_cleanup_id: 1,
        p_succeeded: false,
        p_error_code: "storage-provider-delete-failed",
      }),
    );
  });

  it("fails closed when the finish RPC no longer owns the lease", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const { client } = clientWith(remove, { data: false, error: null });

    await expect(
      drainListingStorageCleanupOutbox(client, 100, 5),
    ).rejects.toMatchObject({ code: "storage-cleanup-lease-lost" });
  });
});

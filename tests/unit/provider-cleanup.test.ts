import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  removeListingStorageObjects: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/lib/images/storage-cleanup", () => ({
  removeListingStorageObjects: dependencies.removeListingStorageObjects,
}));

import { completeProviderCleanup } from "@/lib/privacy/provider-cleanup";

describe("provider privacy cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails within the configured boundary when Auth deletion stalls", async () => {
    vi.useFakeTimers();
    dependencies.removeListingStorageObjects.mockResolvedValue(true);
    const deleteUser = vi.fn(() => new Promise(() => undefined));
    const client = {
      auth: { admin: { deleteUser } },
    } as unknown as SupabaseClient;

    const cleanup = completeProviderCleanup(
      client,
      { authUserId: "private-user" },
      5,
    );
    await vi.advanceTimersByTimeAsync(5);

    await expect(cleanup).resolves.toBe(false);
    expect(dependencies.removeListingStorageObjects).toHaveBeenCalledWith(
      client,
      { authUserId: "private-user" },
      5,
    );
  });
});

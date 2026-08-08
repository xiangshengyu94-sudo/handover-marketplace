import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: unknown };

const dependencies = vi.hoisted(() => {
  class StorageCleanupFailure extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }

  return {
    completeProviderCleanup: vi.fn<() => Promise<boolean>>(),
    createPrivilegedClient: vi.fn(),
    drainListingStorageCleanupOutbox: vi.fn<
      () => Promise<{ leased: number; completed: number }>
    >(),
    rpc: vi.fn<
      (name: string, args?: Record<string, unknown>) => Promise<RpcResult>
    >(),
    StorageCleanupFailure,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createPrivilegedClient: dependencies.createPrivilegedClient,
}));
vi.mock("@/lib/images/storage-cleanup", () => ({
  drainListingStorageCleanupOutbox:
    dependencies.drainListingStorageCleanupOutbox,
  StorageCleanupFailure: dependencies.StorageCleanupFailure,
}));
vi.mock("@/lib/privacy/provider-cleanup", () => ({
  completeProviderCleanup: dependencies.completeProviderCleanup,
}));

import { runRetention } from "@/lib/retention/cleanup";

const startedAt = new Date("2026-08-08T10:00:00.000Z");

describe("retention worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.createPrivilegedClient.mockReturnValue({
      rpc: dependencies.rpc,
    });
    dependencies.drainListingStorageCleanupOutbox.mockResolvedValue({
      leased: 2,
      completed: 2,
    });
    dependencies.completeProviderCleanup.mockResolvedValue(true);
    dependencies.rpc.mockImplementation(async (name) => {
      if (name === "admin_run_retention") {
        return {
          data: {
            expiredListings: 1,
            purgedContactBodies: 2,
            cleanedImages: 3,
            expiredAssistedDrafts: 4,
            hasMore: false,
            paths: { staging: ["private/object.webp"] },
            userId: "private-user",
            providerId: "private-provider",
          },
          error: null,
        };
      }
      if (name === "admin_lease_privacy_cleanups") {
        return { data: [], error: null };
      }
      if (name === "admin_finish_retention_run") {
        return { data: true, error: null };
      }
      if (name === "admin_record_retention_cleanup_failure") {
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
  });

  it("finalizes only after durable Storage and privacy cleanup and returns counts only", async () => {
    await expect(runRetention(startedAt)).resolves.toEqual({
      expiredListings: 1,
      purgedContactBodies: 2,
      cleanedImages: 3,
      expiredAssistedDrafts: 4,
      hasMore: false,
      storageCleanup: { leased: 2, completed: 2 },
      privacyCleanup: { leased: 0, completed: 0 },
    });

    expect(dependencies.drainListingStorageCleanupOutbox).toHaveBeenCalledOnce();
    const finalization = dependencies.rpc.mock.calls.find(
      ([name]) => name === "admin_finish_retention_run",
    );
    expect(finalization?.[1]).toEqual({
      p_started_at: startedAt.toISOString(),
      p_result: {
        expiredListings: 1,
        purgedContactBodies: 2,
        cleanedImages: 3,
        expiredAssistedDrafts: 4,
        hasMore: false,
        storageCleanup: { leased: 2, completed: 2 },
        privacyCleanup: { leased: 0, completed: 0 },
      },
    });
    expect(JSON.stringify(finalization)).not.toMatch(
      /private\/object|private-user|private-provider|paths/i,
    );
  });

  it("records and throws a durable Storage provider failure", async () => {
    dependencies.drainListingStorageCleanupOutbox.mockRejectedValue(
      new dependencies.StorageCleanupFailure(
        "storage-cleanup-provider-failed",
      ),
    );

    await expect(runRetention(startedAt)).rejects.toThrow(
      "Retention job failed.",
    );
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "admin_record_retention_cleanup_failure",
      { p_error_code: "storage-cleanup-provider-failed" },
    );
    expect(dependencies.rpc).not.toHaveBeenCalledWith(
      "admin_finish_retention_run",
      expect.anything(),
    );
  });

  it("records and throws when a privacy provider cleanup fails", async () => {
    dependencies.completeProviderCleanup.mockResolvedValue(false);
    dependencies.rpc.mockImplementation(async (name) => {
      if (name === "admin_run_retention") {
        return { data: {}, error: null };
      }
      if (name === "admin_lease_privacy_cleanups") {
        return {
          data: [
            {
              request_id: "private-request",
              provider_cleanup: { authUserId: "private-user" },
            },
          ],
          error: null,
        };
      }
      if (name === "admin_finish_privacy_cleanup_retry") {
        return { data: true, error: null };
      }
      if (name === "admin_record_retention_cleanup_failure") {
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    await expect(runRetention(startedAt)).rejects.toThrow(
      "Retention job failed.",
    );
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "admin_finish_privacy_cleanup_retry",
      expect.objectContaining({ p_succeeded: false }),
    );
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "admin_record_retention_cleanup_failure",
      { p_error_code: "privacy-cleanup-provider-failed" },
    );
  });

  it("treats a false privacy finish acknowledgement as lease loss", async () => {
    dependencies.rpc.mockImplementation(async (name) => {
      if (name === "admin_run_retention") {
        return { data: {}, error: null };
      }
      if (name === "admin_lease_privacy_cleanups") {
        return {
          data: [
            {
              request_id: "private-request",
              provider_cleanup: { authUserId: "private-user" },
            },
          ],
          error: null,
        };
      }
      if (name === "admin_finish_privacy_cleanup_retry") {
        return { data: false, error: null };
      }
      if (name === "admin_record_retention_cleanup_failure") {
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    await expect(runRetention(startedAt)).rejects.toThrow(
      "Retention job failed.",
    );
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "admin_record_retention_cleanup_failure",
      { p_error_code: "privacy-cleanup-lease-lost" },
    );
  });

  it("records and throws when finalization rejects unfinished cleanup", async () => {
    dependencies.rpc.mockImplementation(async (name) => {
      if (name === "admin_run_retention") {
        return { data: {}, error: null };
      }
      if (name === "admin_lease_privacy_cleanups") {
        return { data: [], error: null };
      }
      if (name === "admin_finish_retention_run") {
        return { data: false, error: null };
      }
      if (name === "admin_record_retention_cleanup_failure") {
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    await expect(runRetention(startedAt)).rejects.toThrow(
      "Retention job failed.",
    );
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "admin_record_retention_cleanup_failure",
      { p_error_code: "retention-finalize-rejected" },
    );
  });
});

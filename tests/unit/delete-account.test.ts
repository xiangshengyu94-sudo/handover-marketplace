import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  completeProviderCleanup: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/privacy/provider-cleanup", () => ({
  completeProviderCleanup: dependencies.completeProviderCleanup,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createPrivilegedClient: vi.fn(() => ({ rpc: dependencies.rpc })),
}));

import {
  AccountDeletionError,
  deleteAccount,
  recoverAccountDeletion,
} from "@/lib/privacy/delete-account";

const requestKey = "11111111-1111-4111-8111-111111111111";

describe("account deletion orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.completeProviderCleanup.mockResolvedValue(true);
  });

  it("reuses an existing request without repeating provider cleanup", async () => {
    dependencies.rpc.mockResolvedValueOnce({
      data: {
        requestId: requestKey,
        receipt: "persisted-receipt",
        status: "completed",
        providerCleanup: {},
        shouldCleanup: false,
      },
      error: null,
    });

    await expect(deleteAccount("user-1", requestKey)).resolves.toEqual({
      receipt: "persisted-receipt",
      status: "completed",
    });
    expect(dependencies.completeProviderCleanup).not.toHaveBeenCalled();
    expect(dependencies.rpc).toHaveBeenCalledTimes(1);
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "admin_begin_account_deletion",
      expect.objectContaining({
        p_user_id: "user-1",
        p_request_id: requestKey,
      }),
    );
  });

  it.each([
    ["returned error", { data: null, error: { message: "database unavailable" } }],
    ["false result", { data: false, error: null }],
  ])("keeps the receipt as partial when finish has a %s", async (_name, finish) => {
    dependencies.rpc
      .mockResolvedValueOnce({
        data: {
          requestId: requestKey,
          receipt: "persisted-receipt",
          status: "partial",
          providerCleanup: { authUserId: "user-1" },
          shouldCleanup: true,
        },
        error: null,
      })
      .mockResolvedValueOnce(finish);

    await expect(deleteAccount("user-1", requestKey)).resolves.toEqual({
      receipt: "persisted-receipt",
      status: "partial",
    });
  });

  it("keeps the receipt as partial when finish rejects", async () => {
    dependencies.rpc
      .mockResolvedValueOnce({
        data: {
          requestId: requestKey,
          receipt: "persisted-receipt",
          status: "partial",
          providerCleanup: { authUserId: "user-1" },
          shouldCleanup: true,
        },
        error: null,
      })
      .mockRejectedValueOnce(new Error("database unavailable"));

    await expect(deleteAccount("user-1", requestKey)).resolves.toEqual({
      receipt: "persisted-receipt",
      status: "partial",
    });
  });

  it("returns completed only after provider cleanup and finish both succeed", async () => {
    dependencies.rpc
      .mockResolvedValueOnce({
        data: {
          requestId: requestKey,
          receipt: "persisted-receipt",
          status: "partial",
          providerCleanup: { authUserId: "user-1" },
          shouldCleanup: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });

    await expect(deleteAccount("user-1", requestKey)).resolves.toEqual({
      receipt: "persisted-receipt",
      status: "completed",
    });
    expect(dependencies.completeProviderCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: dependencies.rpc }),
      { authUserId: "user-1" },
    );
  });

  it("classifies the last-administrator constraint", async () => {
    dependencies.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23514",
        message: "last administrator cannot delete account",
      },
    });

    await expect(deleteAccount("user-1", requestKey)).rejects.toMatchObject({
      name: "AccountDeletionError",
      code: "last-admin",
    } satisfies Partial<AccountDeletionError>);
  });

  it("recovers a narrow public result through the capability request key", async () => {
    dependencies.rpc.mockResolvedValueOnce({
      data: { receipt: "persisted-receipt", status: "partial" },
      error: null,
    });

    await expect(recoverAccountDeletion(requestKey)).resolves.toEqual({
      receipt: "persisted-receipt",
      status: "partial",
    });
    expect(dependencies.rpc).toHaveBeenCalledWith(
      "admin_recover_account_deletion",
      { p_request_id: requestKey },
    );
  });

  it("returns null for an unknown capability and rejects malformed results", async () => {
    dependencies.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(recoverAccountDeletion(requestKey)).resolves.toBeNull();

    dependencies.rpc.mockResolvedValueOnce({
      data: { receipt: "persisted-receipt", status: "failed", userId: "user-1" },
      error: null,
    });
    await expect(recoverAccountDeletion(requestKey)).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});

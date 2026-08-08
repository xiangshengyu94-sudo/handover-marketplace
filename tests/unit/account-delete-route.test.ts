import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  recoverAccountDeletion: vi.fn(),
  requireActiveMember: vi.fn(),
}));

vi.mock("@/lib/auth/require-active-member", () => ({
  requireActiveMember: dependencies.requireActiveMember,
}));
vi.mock("@/lib/privacy/delete-account", () => {
  class AccountDeletionError extends Error {
    constructor(readonly code: "last-admin" | "unavailable") {
      super(code);
      this.name = "AccountDeletionError";
    }
  }
  return {
    AccountDeletionError,
    deleteAccount: dependencies.deleteAccount,
    recoverAccountDeletion: dependencies.recoverAccountDeletion,
  };
});

import { POST } from "@/app/api/account/delete/route";
import { AuthorizationError } from "@/lib/auth/errors";
import { AccountDeletionError } from "@/lib/privacy/delete-account";

const requestKey = "11111111-1111-4111-8111-111111111111";

function request(
  body: unknown = { confirmation: "DELETE", requestKey },
  origin = "https://handover.example",
) {
  return new Request("https://handover.example/api/account/delete", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "handover.example",
      origin,
    },
  });
}

describe("account deletion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireActiveMember.mockResolvedValue({ id: "user-1" });
    dependencies.recoverAccountDeletion.mockResolvedValue(null);
  });

  it("authenticates an active member and returns a completed receipt", async () => {
    dependencies.deleteAccount.mockResolvedValue({
      receipt: "receipt-1",
      status: "completed",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      receipt: "receipt-1",
      status: "completed",
    });
    expect(dependencies.deleteAccount).toHaveBeenCalledWith("user-1", requestKey);
    expect(dependencies.recoverAccountDeletion).not.toHaveBeenCalled();
  });

  it("returns 202 when cleanup is partial", async () => {
    dependencies.deleteAccount.mockResolvedValue({
      receipt: "receipt-1",
      status: "partial",
    });

    const response = await POST(request());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      receipt: "receipt-1",
      status: "partial",
    });
  });

  it.each([
    ["invalid body", { confirmation: "DELETE", requestKey: "predictable" }, "https://handover.example"],
    ["cross-origin request", { confirmation: "DELETE", requestKey }, "https://attacker.example"],
  ])("maps an %s to 400 before authentication", async (_name, body, origin) => {
    const response = await POST(request(body, origin));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Account deletion request is invalid.",
    });
    expect(dependencies.requireActiveMember).not.toHaveBeenCalled();
  });

  it.each([
    [new AuthorizationError("unauthenticated", 401), 401, "Authentication required."],
    [new AuthorizationError("inactive", 403), 403, "Account deletion is not permitted."],
  ])("preserves authentication and authorization status", async (error, status, message) => {
    dependencies.requireActiveMember.mockRejectedValue(error);

    const response = await POST(request());

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(dependencies.recoverAccountDeletion).toHaveBeenCalledWith(requestKey);
    expect(dependencies.deleteAccount).not.toHaveBeenCalled();
  });

  it("recovers only the receipt and status after Auth deletion", async () => {
    dependencies.requireActiveMember.mockRejectedValue(
      new AuthorizationError("unauthenticated", 401),
    );
    dependencies.recoverAccountDeletion.mockResolvedValue({
      receipt: "receipt-1",
      status: "partial",
    });

    const response = await POST(request());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      receipt: "receipt-1",
      status: "partial",
    });
  });

  it.each([
    [new AccountDeletionError("last-admin"), 409],
    [new AccountDeletionError("unavailable"), 503],
    [new Error("provider unavailable"), 503],
  ])("maps service failures to their HTTP contract", async (error, status) => {
    dependencies.deleteAccount.mockRejectedValue(error);

    const response = await POST(request());

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 when receipt recovery itself is unavailable", async () => {
    dependencies.requireActiveMember.mockRejectedValue(
      new AuthorizationError("inactive", 403),
    );
    dependencies.recoverAccountDeletion.mockRejectedValue(
      new AccountDeletionError("unavailable"),
    );

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Account deletion is temporarily unavailable.",
    });
  });
});

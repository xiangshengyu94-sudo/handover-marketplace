import { describe, expect, it } from "vitest";

import {
  AuthIntentError,
  consumeAuthIntent,
  createAuthIntent,
  type AuthIntentRecord,
  type AuthIntentRepository,
} from "@/lib/auth/intent";

class MemoryIntentRepository implements AuthIntentRepository {
  records: AuthIntentRecord[] = [];

  async supersedeActive(
    bindingHash: string,
    purpose: AuthIntentRecord["purpose"],
    at: Date,
  ) {
    for (const record of this.records) {
      if (
        record.bindingHash === bindingHash &&
        record.purpose === purpose &&
        !record.consumedAt &&
        !record.supersededAt
      ) {
        record.supersededAt = at;
      }
    }
  }

  async insert(record: AuthIntentRecord) {
    this.records.push(record);
  }

  async findByNonceHash(nonceHash: string) {
    return this.records.find((record) => record.nonceHash === nonceHash) ?? null;
  }

  async markConsumed(id: string, at: Date) {
    const record = this.records.find((candidate) => candidate.id === id);
    if (!record || record.consumedAt || record.supersededAt) return false;
    record.consumedAt = at;
    return true;
  }
}

describe("auth intents", () => {
  it("consumes a browser-bound intent exactly once", async () => {
    const repository = new MemoryIntentRepository();
    const now = new Date("2026-08-07T10:00:00.000Z");
    const created = await createAuthIntent({
      repository,
      browserBinding: "browser-a",
      purpose: "login",
      returnTo: "/listings/new?kind=housing",
      now,
    });

    await expect(
      consumeAuthIntent({
        repository,
        browserBinding: "browser-a",
        purpose: "login",
        nonce: created.nonce,
        now: new Date("2026-08-07T10:01:00.000Z"),
      }),
    ).resolves.toEqual({ returnTo: "/listings/new?kind=housing" });

    await expect(
      consumeAuthIntent({
        repository,
        browserBinding: "browser-a",
        purpose: "login",
        nonce: created.nonce,
        now: new Date("2026-08-07T10:01:01.000Z"),
      }),
    ).rejects.toMatchObject({ code: "used" });
  });

  it("rejects a stolen nonce in another browser", async () => {
    const repository = new MemoryIntentRepository();
    const created = await createAuthIntent({
      repository,
      browserBinding: "browser-a",
      purpose: "login",
      returnTo: "/account",
      now: new Date("2026-08-07T10:00:00.000Z"),
    });

    await expect(
      consumeAuthIntent({
        repository,
        browserBinding: "browser-b",
        purpose: "login",
        nonce: created.nonce,
        now: new Date("2026-08-07T10:01:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "binding_mismatch" });
  });

  it("supersedes an earlier intent for the same browser and purpose", async () => {
    const repository = new MemoryIntentRepository();
    const first = await createAuthIntent({
      repository,
      browserBinding: "browser-a",
      purpose: "login",
      returnTo: "/first",
      now: new Date("2026-08-07T10:00:00.000Z"),
    });
    await createAuthIntent({
      repository,
      browserBinding: "browser-a",
      purpose: "login",
      returnTo: "/second",
      now: new Date("2026-08-07T10:00:05.000Z"),
    });

    await expect(
      consumeAuthIntent({
        repository,
        browserBinding: "browser-a",
        purpose: "login",
        nonce: first.nonce,
        now: new Date("2026-08-07T10:00:10.000Z"),
      }),
    ).rejects.toMatchObject({ code: "superseded" });
  });

  it("rejects expired and wrong-purpose intents", async () => {
    const repository = new MemoryIntentRepository();
    const created = await createAuthIntent({
      repository,
      browserBinding: "browser-a",
      purpose: "login",
      returnTo: "/account",
      now: new Date("2026-08-07T10:00:00.000Z"),
      ttlMs: 1_000,
    });

    await expect(
      consumeAuthIntent({
        repository,
        browserBinding: "browser-a",
        purpose: "email-change",
        nonce: created.nonce,
        now: new Date("2026-08-07T10:00:00.500Z"),
      }),
    ).rejects.toMatchObject({ code: "purpose_mismatch" });

    await expect(
      consumeAuthIntent({
        repository,
        browserBinding: "browser-a",
        purpose: "login",
        nonce: created.nonce,
        now: new Date("2026-08-07T10:00:01.001Z"),
      }),
    ).rejects.toBeInstanceOf(AuthIntentError);
  });
});

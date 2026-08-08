import { describe, expect, it } from "vitest";

import { hashClaimToken } from "@/lib/assisted/claims";

describe("assisted claim token", () => {
  it("stores only a fixed-length digest and binds every byte", () => {
    expect(hashClaimToken("first-secret-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashClaimToken("first-secret-token")).not.toBe(hashClaimToken("first-secret-tokeN"));
  });
});

import { describe, expect, it } from "vitest";

import { matchesBearerSecret } from "@/lib/http/internal-secret";

function request(authorization?: string) {
  return new Request("https://handover.example/api/internal/test", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("internal endpoint bearer matching", () => {
  it("accepts the complete bearer value case-insensitively", () => {
    expect(matchesBearerSecret(request("bEaReR expected-value"), "expected-value")).toBe(true);
  });

  it("rejects missing, partial, and extra values", () => {
    expect(matchesBearerSecret(request(), "expected-value")).toBe(false);
    expect(matchesBearerSecret(request("Bearer expected"), "expected-value")).toBe(false);
    expect(matchesBearerSecret(request("Bearer expected-value-extra"), "expected-value")).toBe(false);
  });
});

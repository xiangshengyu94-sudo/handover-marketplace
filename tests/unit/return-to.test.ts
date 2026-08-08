import { describe, expect, it } from "vitest";

import { sanitizeReturnTo } from "@/lib/auth/return-to";

describe("sanitizeReturnTo", () => {
  it("keeps an internal path including its query and fragment", () => {
    expect(sanitizeReturnTo("/listings/new?kind=item#details")).toBe(
      "/listings/new?kind=item#details",
    );
  });

  it.each([
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "/\\attacker.example/steal",
    "javascript:alert(1)",
    "/account\nSet-Cookie: stolen=true",
  ])("rejects unsafe return target %s", (target) => {
    expect(sanitizeReturnTo(target)).toBe("/account");
  });

  it.each(["/login", "/login?returnTo=/account", "/auth/confirm"])(
    "does not create an authentication redirect loop for %s",
    (target) => {
      expect(sanitizeReturnTo(target)).toBe("/account");
    },
  );

  it("uses a caller-provided safe fallback for missing input", () => {
    expect(sanitizeReturnTo(undefined, "/listings")).toBe("/listings");
  });
});

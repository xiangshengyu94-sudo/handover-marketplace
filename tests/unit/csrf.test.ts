import { describe, expect, it } from "vitest";

import { assertSameOrigin } from "@/lib/auth/csrf";

describe("assertSameOrigin", () => {
  it("accepts a same-origin POST", () => {
    expect(() =>
      assertSameOrigin({
        origin: "https://handover.example",
        host: "handover.example",
      }),
    ).not.toThrow();
  });

  it.each([
    { origin: undefined, host: "handover.example" },
    { origin: "https://evil.example", host: "handover.example" },
    { origin: "null", host: "handover.example" },
    { origin: "https://handover.example", host: undefined },
    {
      origin: "https://handover.example",
      host: "handover.example, evil.example",
    },
  ])("rejects an unverifiable or cross-origin POST", (input) => {
    expect(() => assertSameOrigin(input)).toThrowError("Request not accepted.");
  });

  it("uses a single forwarded host when deployed behind a trusted proxy", () => {
    expect(() =>
      assertSameOrigin({
        origin: "https://handover.example",
        host: "internal:3000",
        forwardedHost: "handover.example",
      }),
    ).not.toThrow();
  });
});

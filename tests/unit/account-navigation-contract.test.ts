import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const accountPage = readFileSync(
  "src/app/(member)/account/page.tsx",
  "utf8",
);

describe("account navigation contract", () => {
  it("gives a verified member a visible route back to the home page", () => {
    expect(accountPage).toMatch(
      /<Link[^>]+href="\/"[^>]*>\s*Back to home\s*<\/Link>/s,
    );
  });
});

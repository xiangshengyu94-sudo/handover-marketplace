import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("contact identity boundary", () => {
  it("resolves owner addresses only inside the privileged dispatcher", () => {
    const files = [...globSync("src/**/*.ts"), ...globSync("src/**/*.tsx")];
    const ownerEmailReaders = files.filter((file) => readFileSync(file, "utf8").includes("owner_email")).map((file) => file.replaceAll("\\", "/"));
    expect(ownerEmailReaders).toEqual(["src/lib/email/dispatcher.ts"]);
  });

  it("does not serialize owner or sender addresses from browser routes", () => {
    const routeSources = globSync("src/app/api/**/route.ts").map((file) => readFileSync(file, "utf8")).join("\n");
    expect(routeSources).not.toContain("owner_email");
    expect(routeSources).not.toContain("sender_email");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicDetail = readFileSync("src/app/(public)/listings/[id]/page.tsx", "utf8");
const publicQuery = readFileSync("src/lib/listings/queries.ts", "utf8");

describe("public listing projection", () => {
  it("does not select identity, moderation, or private evidence fields", () => {
    for (const forbidden of ["owner_id", "owner_email", "source_evidence", "moderation_reason", "storage_path", "derivative_path"]) {
      expect(publicDetail).not.toContain(forbidden);
      expect(publicQuery).not.toContain(forbidden);
    }
  });

  it("obtains only authorized image identifiers through the public RPC", () => {
    expect(publicDetail).toContain("get_public_listing_images");
    expect(publicDetail).toContain("/api/media/");
  });
});

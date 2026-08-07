import { describe, expect, it } from "vitest";
import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";

import {
  assertPrivilegedImporter,
  PRIVILEGED_IMPORT_ALLOWLIST,
} from "@/lib/supabase/admin";

describe("privileged Supabase boundary", () => {
  it.each(PRIVILEGED_IMPORT_ALLOWLIST)("allows %s", (path) => {
    expect(() => assertPrivilegedImporter(path)).not.toThrow();
  });

  it.each([
    "src/app/api/listings/route.ts",
    "src/app/api/contact-intents/route.ts",
    "src/components/listings/listing-form.tsx",
    "src/lib/listings/queries.ts",
  ])("rejects unrestricted import from %s", (path) => {
    expect(() => assertPrivilegedImporter(path)).toThrow(
      "Privileged Supabase access is not allowed",
    );
  });

  it("keeps every real Admin-client import inside the allowlist", () => {
    const sourceFiles = [
      ...globSync("src/**/*.ts"),
      ...globSync("src/**/*.tsx"),
    ];
    const importers = sourceFiles
      .filter((path) => path !== "src/lib/supabase/admin.ts")
      .filter((path) => /supabase\/admin/.test(readFileSync(path, "utf8")))
      .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"));

    expect(importers).toEqual(
      importers.filter((path) => PRIVILEGED_IMPORT_ALLOWLIST.includes(path as never)),
    );
  });
});

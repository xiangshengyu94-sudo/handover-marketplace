import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const dispatcher = readFileSync("src/lib/email/dispatcher.ts", "utf8");
const storageCleanup = readFileSync(
  "src/lib/images/storage-cleanup.ts",
  "utf8",
);

describe("external dispatch safety contract", () => {
  it("revalidates a contact lease immediately before provider delivery", () => {
    const confirmation = dispatcher.indexOf(
      'client.rpc("admin_confirm_contact_dispatch"',
    );
    const providerSend = dispatcher.indexOf("await sendContactEmail(");

    expect(confirmation).toBeGreaterThan(-1);
    expect(providerSend).toBeGreaterThan(confirmation);
    expect(dispatcher).toContain("confirmation.data !== true");
  });

  it("requires durable Storage cleanup acknowledgements", () => {
    expect(storageCleanup).toContain('"admin_lease_storage_cleanup"');
    expect(storageCleanup).toContain('"admin_finish_storage_cleanup"');
    expect(storageCleanup).toContain("finish.data === true");
    expect(storageCleanup).toContain("withTimeout(");
  });
});

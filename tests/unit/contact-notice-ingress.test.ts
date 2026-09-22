import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(
  "supabase/migrations/202609220002_close_direct_contact_and_notice_ingress.sql",
  "utf8",
);

describe("contact and notice ingress", () => {
  it.each([
    "public.issue_contact_intent(uuid, uuid, uuid, text, text, text, timestamptz)",
    "public.consume_contact_intent(text, uuid, text, text)",
    "public.submit_illegal_content_notice(uuid, text, text, boolean)",
  ])("removes public execution of %s", (signature) => {
    const declaration = `revoke execute on function ${signature}`;
    const start = contract.indexOf(declaration);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(contract.slice(start, start + declaration.length + 50)).toContain(
      "from public, anon, authenticated;",
    );
  });

  it("routes all three operations through named privileged adapters", () => {
    const issue = readFileSync("src/app/api/contact-intents/route.ts", "utf8");
    const consume = readFileSync("src/app/api/listings/[id]/contact/route.ts", "utf8");
    const notice = readFileSync("src/app/api/notices/route.ts", "utf8");
    expect(issue).toContain("issueContactIntent(");
    expect(consume).toContain("consumeContactIntent(");
    expect(notice).toContain("submitIllegalNotice(");
    for (const route of [issue, consume, notice]) {
      expect(route).not.toContain("client.rpc(");
    }
  });

});

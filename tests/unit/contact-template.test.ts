import { describe, expect, it } from "vitest";

import { renderContactEmail } from "@/lib/email/templates/contact";

describe("contact relay email", () => {
  it("escapes user content and keeps reply behavior explicit", () => {
    const rendered = renderContactEmail({ listingTitle: "Desk <special>", message: "Hello <script>alert('x')</script>\nCan I collect this Friday?" });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.text).toContain("Reply to this email");
    expect(rendered.subject).toBe("ReLoop enquiry: Desk <special>");
    expect(rendered.text).toContain("ReLoop never asks you to pay");
  });
});

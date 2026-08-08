import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync("supabase/config.toml", "utf8");
const otpTemplate = readFileSync(
  "supabase/templates/magic-link.html",
  "utf8",
);
const emailChangeTemplate = readFileSync(
  "supabase/templates/email-change.html",
  "utf8",
);

describe("authentication provider contract", () => {
  it("matches the six-digit, ten-minute browser flow", () => {
    expect(config).toContain("otp_length = 6");
    expect(config).toContain("otp_expiry = 600");
    expect(otpTemplate).toContain("{{ .Token }}");
    expect(otpTemplate).not.toContain("{{ .ConfirmationURL }}");
  });

  it("keeps email changes on the provider's confirmation link flow", () => {
    expect(config).toContain("double_confirm_changes = true");
    expect(emailChangeTemplate).toContain("{{ .ConfirmationURL }}");
    expect(config).toContain("[auth.email.notification.email_changed]");
    expect(config).toContain("enabled = true");
  });
});

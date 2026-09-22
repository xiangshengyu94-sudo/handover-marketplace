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
const emailChangedNotification = readFileSync(
  "supabase/templates/email-changed-notification.html",
  "utf8",
);
const loginActions = readFileSync("src/app/(auth)/login/actions.ts", "utf8");

describe("authentication provider contract", () => {
  it("matches the six-digit, ten-minute browser flow", () => {
    expect(config).toContain("otp_length = 6");
    expect(config).toContain("otp_expiry = 600");
    expect(otpTemplate).toContain("{{ .Token }}");
    expect(otpTemplate).not.toContain("{{ .ConfirmationURL }}");
    expect(config).toContain(
      'subject = "{{ .Token }} is your ReLoop sign-in code"',
    );
    expect(otpTemplate).toContain("Your ReLoop sign-in code");
    expect(otpTemplate).not.toContain("Handover");
  });

  it("keeps email changes on the provider's confirmation link flow", () => {
    expect(config).toContain("double_confirm_changes = true");
    expect(emailChangeTemplate).toContain("{{ .ConfirmationURL }}");
    expect(config).toContain("[auth.email.notification.email_changed]");
    expect(config).toContain("enabled = true");
    expect(config).toContain(
      'content_path = "./templates/email-changed-notification.html"',
    );
    expect(emailChangedNotification).toContain("{{ .OldEmail }}");
  });

  it("does not advance to code entry when the OTP provider rejects a request", () => {
    expect(loginActions).toContain("const { error: otpError } = await client.auth.signInWithOtp");
    expect(loginActions).toContain('captureOperationalFailure("otp-delivery-failure-rate")');
    expect(loginActions).toMatch(/if \(otpError\)[\s\S]+step: "email"/);
  });
});

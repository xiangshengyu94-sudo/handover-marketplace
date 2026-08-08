import { describe, expect, it } from "vitest";

import {
  assertEnvironmentIsolation,
  readPublicEnv,
  readServerEnv,
} from "@/lib/env";

const validEnvironment = {
  NEXT_PUBLIC_APP_ENV: "staging",
  NEXT_PUBLIC_APP_URL: "https://staging.handover.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging",
  SUPABASE_SECRET_KEY: "sb_secret_staging_value",
  RESEND_API_KEY: "re_staging_value",
  RESEND_WEBHOOK_SECRET: "whsec_staging_value",
  EMAIL_FROM: "Handover <handover@staging.example>",
  CRON_DISPATCH_SECRET: "cron-staging-value",
  ABUSE_HASH_SECRET: "abuse-staging-value",
  CAPTCHA_SECRET_KEY: "captcha-staging-value",
} as const;

describe("environment contract", () => {
  it("parses the public environment without exposing server secrets", () => {
    const parsed = readPublicEnv(validEnvironment);

    expect(parsed.appEnvironment).toBe("staging");
    expect(parsed.supabaseUrl.hostname).toBe("staging-project.supabase.co");
    expect(JSON.stringify(parsed)).not.toContain(validEnvironment.SUPABASE_SECRET_KEY);
  });

  it.each([
    "NEXT_PUBLIC_APP_ENV",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "EMAIL_FROM",
    "CRON_DISPATCH_SECRET",
    "ABUSE_HASH_SECRET",
    "CAPTCHA_SECRET_KEY",
  ] as const)("names a missing %s without echoing another secret", (name) => {
    const source = { ...validEnvironment } as Record<string, string | undefined>;
    delete source[name];

    expect(() => readServerEnv(source)).toThrow(name);
    expect(() => readServerEnv(source)).not.toThrow(
      validEnvironment.SUPABASE_SECRET_KEY,
    );
  });

  it("rejects a staging deployment wired to a production resource", () => {
    const parsed = readServerEnv({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://handover-production.supabase.co",
    });

    expect(() => assertEnvironmentIsolation(parsed)).toThrow(
      "staging deployment cannot use a production Supabase project",
    );
  });

  it("accepts matching staging resources", () => {
    expect(() =>
      assertEnvironmentIsolation(readServerEnv(validEnvironment)),
    ).not.toThrow();
  });
});

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
      command: "npm.cmd run dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_APP_ENV: "test",
        NEXT_PUBLIC_APP_URL: baseURL,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-placeholder",
        SUPABASE_SECRET_KEY: "e2e-placeholder",
        RESEND_API_KEY: "e2e-placeholder",
        RESEND_WEBHOOK_SECRET: "e2e-placeholder",
        EMAIL_FROM: "Handover <handover@example.test>",
        CRON_DISPATCH_SECRET: "e2e-dispatch-secret",
        CRON_RETENTION_SECRET: "e2e-retention-secret",
        MONITORING_CANARY_SECRET: "e2e-monitoring-secret",
        ASSISTED_CLAIM_HMAC_SECRET: "e2e-claim-secret",
        ABUSE_HASH_SECRET: "e2e-abuse-secret",
        CAPTCHA_SECRET_KEY: "e2e-captcha-secret",
      },
    },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "a11y",
      testMatch: /.*accessibility\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "staging",
      testMatch: /.*staging\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

# Authentication provider setup

This runbook is a launch gate for every environment. Application tests do not replace provider configuration evidence.

## Supabase Auth

- Set the Site URL and redirect allow-list to the exact environment origin. Do not share preview, staging, and production project credentials.
- Enable email sign-up, email confirmation, and secure double-confirm email changes.
- Set email OTP length to `6` and expiry to `600` seconds so the provider matches the browser and intent contract.
- Copy `supabase/templates/magic-link.html` into the hosted **Magic Link / OTP** template. It must render `{{ .Token }}`; a magic-link-only template does not satisfy the product flow.
- Copy the email-change and email-changed-notification templates, and enable the email-changed security notification.
- Confirm that the old and new inbox receive the expected messages during a secure email change.

## Resend SMTP

- Use a separately verified sending domain and API key for each environment.
- Record SPF, DKIM, and DMARC results plus the approved From address.
- Run controlled delivery, reply, bounce, suppression, and provider-outage canaries before launch.
- Treat any default-provider quota or template-customization restriction as a launch blocker; production requires the approved custom SMTP path.

## Cloudflare Turnstile

- Create a separate widget and secret per environment and restrict its allowed hostnames.
- Configure `NEXT_PUBLIC_CAPTCHA_SITE_KEY` for the browser and `CAPTCHA_SECRET_KEY` only on the server.
- Verify that the `request-otp` action is returned by Siteverify, that expired/replayed tokens fail, and that a provider timeout produces a retryable user state without bypassing the challenge.

## Evidence and owners

The infrastructure/email owner records project IDs, origins, redirect URLs, sending domain, template screenshots, provider canary results, and secret-rotation owners. Staging values reaching production, unverified DNS, a mismatched OTP contract, or a CAPTCHA widget that accepts the wrong hostname is a no-go.

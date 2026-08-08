"use client";

import Script from "next/script";
import { useActionState } from "react";

import {
  requestOtpAction,
  verifyOtpAction,
} from "@/app/(auth)/login/actions";
import { initialOtpState } from "@/lib/auth/form-state";

export function OtpForm({ returnTo }: { returnTo: string }) {
  const [requestState, requestAction, requesting] = useActionState(
    requestOtpAction,
    { ...initialOtpState, returnTo },
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyOtpAction,
    { ...initialOtpState, returnTo },
  );

  if (requestState.step === "code" && requestState.email && requestState.intent) {
    const feedback = verifyState.error ?? requestState.message;
    return (
      <div className="auth-stack">
        <form action={verifyAction} className="auth-form">
          <input type="hidden" name="email" value={requestState.email} />
          <input type="hidden" name="intent" value={requestState.intent} />
          <input type="hidden" name="returnTo" value={requestState.returnTo} />
          <p className="form-note">Code sent to {requestState.email}</p>
          <label htmlFor="otp">Six-digit code</label>
          <input
            id="otp"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            autoFocus
          />
          {feedback ? (
            <p className={verifyState.error ? "form-error" : "form-note"} role="status">
              {feedback}
            </p>
          ) : null}
          <button type="submit" disabled={verifying}>
            {verifying ? "Checking..." : "Verify email"}
          </button>
        </form>
        <form action={requestAction} className="inline-form">
          <input type="hidden" name="email" value={requestState.email} />
          <input type="hidden" name="returnTo" value={requestState.returnTo} />
          <button className="button-secondary" type="submit" disabled={requesting}>
            Resend code
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={requestAction} className="auth-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={requestState.email}
        maxLength={254}
        required
        autoFocus
      />
      <p className="form-note">
        Any working email is welcome. Verification means we can reach you; it is not student-status proof.
      </p>
      {requestState.captchaRequired ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div
            className="cf-turnstile"
            data-sitekey={process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY}
            data-action="request-otp"
          />
        </>
      ) : null}
      {requestState.error ? (
        <p className="form-error" role="alert">{requestState.error}</p>
      ) : null}
      <button type="submit" disabled={requesting}>
        {requesting ? "Sending..." : "Email me a code"}
      </button>
    </form>
  );
}

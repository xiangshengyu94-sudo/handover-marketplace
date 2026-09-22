"use client";

import Script from "next/script";
import { useActionState } from "react";

import {
  requestOtpAction,
  verifyOtpAction,
} from "@/app/(auth)/login/actions";
import { initialOtpState } from "@/lib/auth/form-state";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type OtpFormDictionary = Pick<
  Dictionary,
  | "authCodeSentTo"
  | "authSixDigit"
  | "authChecking"
  | "authVerify"
  | "authResend"
  | "authEmail"
  | "authNote"
  | "authSending"
  | "authSendCode"
>;

export function OtpForm({ returnTo, dictionary }: { returnTo: string; dictionary: OtpFormDictionary }) {
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
          <p className="form-note">{dictionary.authCodeSentTo} {requestState.email}</p>
          <label htmlFor="otp">{dictionary.authSixDigit}</label>
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
            {verifying ? dictionary.authChecking : dictionary.authVerify}
          </button>
        </form>
        <form action={requestAction} className="inline-form">
          <input type="hidden" name="email" value={requestState.email} />
          <input type="hidden" name="returnTo" value={requestState.returnTo} />
          <button className="button-secondary" type="submit" disabled={requesting}>
            {dictionary.authResend}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={requestAction} className="auth-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="email">{dictionary.authEmail}</label>
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
        {dictionary.authNote}
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
        {requesting ? dictionary.authSending : dictionary.authSendCode}
      </button>
    </form>
  );
}

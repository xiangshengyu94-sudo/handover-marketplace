import type { Metadata } from "next";

import { OtpForm } from "@/components/auth/otp-form";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = sanitizeReturnTo((await searchParams).returnTo);
  return (
    <main>
      <section className="auth-card" aria-labelledby="sign-in-title">
        <p className="eyebrow">Email verified, community open</p>
        <h1 id="sign-in-title">Sign in without a password.</h1>
        <p className="lede">
          We will send a six-digit one-time code. No university domain is required.
        </p>
        <OtpForm returnTo={returnTo} />
      </section>
    </main>
  );
}

import type { Metadata } from "next";

import { OtpForm } from "@/components/auth/otp-form";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { sanitizeReturnTo } from "@/lib/auth/return-to";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = sanitizeReturnTo((await searchParams).returnTo);
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  return (
    <main>
      <section className="auth-card" aria-labelledby="sign-in-title">
        <LanguageSwitcher locale={locale} label={dictionary.localeLabel} />
        <p className="eyebrow">{dictionary.authEyebrow}</p>
        <h1 id="sign-in-title">{dictionary.authTitle}</h1>
        <p className="lede">{dictionary.authLede}</p>
        <OtpForm returnTo={returnTo} dictionary={dictionary} />
      </section>
    </main>
  );
}

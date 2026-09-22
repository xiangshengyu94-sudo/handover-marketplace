import Link from "next/link";

import { BRAND_NAME } from "@/lib/brand";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import { LanguageSwitcher } from "./language-switcher";

export async function SiteHeader() {
  const client = await createClient();
  const [{ data }, locale] = await Promise.all([client.auth.getClaims(), getLocale()]);
  const dictionary = getDictionary(locale);
  const signedIn = typeof data?.claims.sub === "string";
  const roleResults = signedIn ? await Promise.all(["operator", "moderator", "administrator"].map((role) => client.rpc("current_user_has_role", { p_role: role }))) : [];
  const protectedRole = roleResults.some(({ data, error }) => !error && data === true);
  return <header className="site-header"><Link className="wordmark" href="/">{BRAND_NAME}</Link><nav aria-label={dictionary.navPrimaryLabel}><Link href="/">{dictionary.navBrowse}</Link><Link href="/safety">{dictionary.navSafety}</Link>{signedIn ? <><Link href="/listings/new">{dictionary.navPost}</Link><Link href="/dashboard">{dictionary.navDashboard}</Link>{protectedRole ? <Link href="/admin/reports">{dictionary.navAdmin}</Link> : null}<Link href="/account">{dictionary.navAccount}</Link></> : <Link className="nav-cta" href="/login">{dictionary.navSignIn}</Link>}<LanguageSwitcher locale={locale} label={dictionary.localeLabel} /></nav></header>;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { logoutAction } from "@/app/(auth)/login/actions";
import { EmailChangeForm } from "@/components/account/email-change-form";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect("/login?returnTo=/account");
    }
    throw error;
  }

  return (
    <main>
      <section className="account-card" aria-labelledby="account-title">
        <div>
          <p className="eyebrow">Account</p>
          <h1 id="account-title">Your contactability.</h1>
          <p className="lede">
            Verification confirms a reachable email address, not student status or institutional affiliation.
          </p>
        </div>
        <dl className="account-summary">
          <div><dt>Current email</dt><dd>{user.email}</dd></div>
          <div>
            <dt>Status</dt>
            <dd>{user.newEmail ? "Verification pending" : "Email verified"}</dd>
          </div>
        </dl>
        <Link className="button-link" href="/">Back to home</Link>
        <div className="account-section">
          <h2>Email settings</h2>
          <EmailChangeForm currentEmail={user.email} pendingEmail={user.newEmail} />
        </div>
        <div className="account-section"><h2>Privacy controls</h2><p className="form-note">Download your data or request account deletion with a durable receipt.</p><Link className="button-link button-secondary" href="/account/privacy">Open privacy controls</Link></div>
        <form action={logoutAction}>
          <button className="button-quiet" type="submit">Sign out</button>
        </form>
      </section>
    </main>
  );
}

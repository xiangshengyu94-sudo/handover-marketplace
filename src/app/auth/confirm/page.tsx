import Link from "next/link";

export default function ConfirmPage() {
  return (
    <main>
      <section className="auth-card" aria-labelledby="confirm-title">
        <p className="eyebrow">One-time code</p>
        <h1 id="confirm-title">Finish in the sign-in screen.</h1>
        <p className="lede">
          For your safety, codes are entered in the same browser that requested them. Request a fresh code if the old one expired.
        </p>
        <Link className="button-link" href="/login">Return to sign in</Link>
      </section>
    </main>
  );
}

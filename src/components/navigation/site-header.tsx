import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const client = await createClient();
  const { data } = await client.auth.getClaims();
  const signedIn = typeof data?.claims.sub === "string";
  return <header className="site-header"><Link className="wordmark" href="/">Handover</Link><nav aria-label="Primary navigation"><Link href="/">Browse</Link>{signedIn ? <><Link href="/listings/new">Post</Link><Link href="/dashboard">Dashboard</Link><Link href="/account">Account</Link></> : <Link className="nav-cta" href="/login">Sign in</Link>}</nav></header>;
}

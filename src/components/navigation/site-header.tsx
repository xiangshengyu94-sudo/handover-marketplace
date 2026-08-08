import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const client = await createClient();
  const { data } = await client.auth.getClaims();
  const signedIn = typeof data?.claims.sub === "string";
  const roleResults = signedIn ? await Promise.all(["operator", "moderator", "administrator"].map((role) => client.rpc("current_user_has_role", { p_role: role }))) : [];
  const protectedRole = roleResults.some(({ data, error }) => !error && data === true);
  return <header className="site-header"><Link className="wordmark" href="/">Handover</Link><nav aria-label="Primary navigation"><Link href="/">Browse</Link><Link href="/safety">Safety</Link>{signedIn ? <><Link href="/listings/new">Post</Link><Link href="/dashboard">Dashboard</Link>{protectedRole ? <Link href="/admin/reports">Admin</Link> : null}<Link href="/account">Account</Link></> : <Link className="nav-cta" href="/login">Sign in</Link>}</nav></header>;
}

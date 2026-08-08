import type { Metadata } from "next";

import { manageRoleAction } from "@/app/admin/actions";
import { SiteHeader } from "@/components/navigation/site-header";
import { requireAnyRole } from "@/lib/auth/require-any-role";

export const metadata: Metadata = { title: "Protected roles" };

export default async function RolesAdminPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  await requireAnyRole(["administrator"]); const { result } = await searchParams;
  return <><SiteHeader /><main className="admin-page"><header><p className="eyebrow">Access control</p><h1>Protected roles.</h1><p className="lede">Role changes require a sign-in within the last ten minutes, cannot target yourself, cannot remove the final administrator, and append an audit event.</p></header>{result ? <p className="dashboard-notice">{result === "error" ? "Role action failed or requires recent sign-in." : "Role updated."}</p> : null}<form action={manageRoleAction} className="role-form"><label>Target user ID<input name="targetId" required /></label><label>Role<select name="role"><option value="operator">Operator</option><option value="moderator">Moderator</option><option value="administrator">Administrator</option></select></label><div className="button-row"><button className="button-primary" name="action" value="grant">Grant</button><button className="button-danger" name="action" value="revoke">Revoke</button></div></form></main></>;
}

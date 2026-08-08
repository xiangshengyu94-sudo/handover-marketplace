import { redirect } from "next/navigation";

import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try { await requireActiveMember(); } catch (caught) {
    if (caught instanceof AuthorizationError && caught.status === 401) redirect("/login?returnTo=/admin/reports");
    throw caught;
  }
  return children;
}

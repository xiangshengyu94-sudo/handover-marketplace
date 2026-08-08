import "server-only";

import { createPrivilegedClient } from "@/lib/supabase/admin";

export async function manageProtectedRole(input: { actorId: string; targetId: string; role: "operator" | "moderator" | "administrator"; action: "grant" | "revoke" }) {
  const { data, error } = await createPrivilegedClient("src/lib/roles/manage.ts").rpc("admin_manage_role", { p_actor_id: input.actorId, p_target_id: input.targetId, p_role: input.role, p_action: input.action });
  if (error || data !== true) throw new Error("Role action failed");
}

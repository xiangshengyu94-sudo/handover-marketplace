import "server-only";

import { AuthorizationError } from "./errors";
import { requireActiveMember } from "./require-active-member";
import type { AppRole } from "./require-role";
import { createClient } from "@/lib/supabase/server";

export async function requireAnyRole(roles: readonly AppRole[]) {
  const member = await requireActiveMember();
  const client = await createClient();
  for (const role of roles) {
    const { data, error } = await client.rpc("current_user_has_role", { p_role: role });
    if (!error && data === true) return { ...member, role };
  }
  throw new AuthorizationError("forbidden", 403);
}

import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { AuthorizationError } from "./errors";
import { requireActiveMember } from "./require-active-member";

const appRoleSchema = z.enum(["operator", "moderator", "administrator"]);
export type AppRole = z.infer<typeof appRoleSchema>;

export async function requireRole(role: AppRole) {
  const parsedRole = appRoleSchema.parse(role);
  const member = await requireActiveMember();
  const client = await createClient();
  const { data: hasRole, error } = await client.rpc("current_user_has_role", {
    p_role: parsedRole,
  });

  if (error || hasRole !== true) {
    throw new AuthorizationError("forbidden", 403);
  }
  return member;
}

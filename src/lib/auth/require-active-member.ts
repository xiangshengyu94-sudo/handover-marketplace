import "server-only";

import { createClient } from "@/lib/supabase/server";

import { AuthorizationError } from "./errors";
import { requireUser } from "./require-user";

export type ActiveMember = Awaited<ReturnType<typeof requireUser>> & {
  displayName?: string;
};

export async function requireActiveMember(): Promise<ActiveMember> {
  const user = await requireUser();
  if (user.newEmail) throw new AuthorizationError("unverified", 403);

  const client = await createClient();
  const { data: profile, error } = await client
    .from("profiles")
    .select("account_status, deleted_at, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    profile.account_status !== "active" ||
    profile.deleted_at
  ) {
    throw new AuthorizationError("inactive", 403);
  }

  return {
    ...user,
    displayName:
      typeof profile.display_name === "string"
        ? profile.display_name
        : undefined,
  };
}

import "server-only";

import { createClient } from "@/lib/supabase/server";

import { AuthorizationError } from "./errors";

export type CurrentUser = {
  id: string;
  email: string;
  emailConfirmedAt: string;
  newEmail?: string;
  lastSignInAt?: string;
};

export async function requireUser(): Promise<CurrentUser> {
  const client = await createClient();
  const [claimsResult, userResult] = await Promise.all([
    client.auth.getClaims(),
    client.auth.getUser(),
  ]);
  const subject = claimsResult.data?.claims.sub;
  const user = userResult.data.user;

  if (claimsResult.error || userResult.error || !subject || !user) {
    throw new AuthorizationError("unauthenticated", 401);
  }
  if (subject !== user.id) {
    throw new AuthorizationError("unauthenticated", 401);
  }
  if (!user.email || !user.email_confirmed_at) {
    throw new AuthorizationError("unverified", 403);
  }

  return {
    id: user.id,
    email: user.email,
    emailConfirmedAt: user.email_confirmed_at,
    newEmail: user.new_email,
    lastSignInAt: user.last_sign_in_at,
  };
}

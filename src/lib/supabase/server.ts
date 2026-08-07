import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readPublicEnv } from "@/lib/env";

export async function createClient() {
  const environment = readPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    environment.supabaseUrl.toString(),
    environment.supabasePublishableKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. The proxy refresh path
            // owns that mutation; protected routes still authorize explicitly.
          }
        },
      },
    },
  );
}

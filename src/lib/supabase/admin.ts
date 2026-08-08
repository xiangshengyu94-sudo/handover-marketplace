import "server-only";

import { createClient } from "@supabase/supabase-js";

import { assertEnvironmentIsolation, readServerEnv } from "@/lib/env";

export const PRIVILEGED_IMPORT_ALLOWLIST = [
  "src/lib/auth/admin.ts",
  "src/lib/email/dispatcher.ts",
  "src/lib/images/process.ts",
  "src/lib/assisted/claims.ts",
  "src/lib/moderation/actions.ts",
  "src/lib/roles/manage.ts",
  "src/lib/privacy/delete-account.ts",
  "src/lib/privacy/export.ts",
  "src/lib/retention/cleanup.ts",
] as const;

export function assertPrivilegedImporter(importerPath: string) {
  const normalized = importerPath.replaceAll("\\", "/");
  if (!PRIVILEGED_IMPORT_ALLOWLIST.includes(normalized as never)) {
    throw new Error(
      `Privileged Supabase access is not allowed from ${normalized}.`,
    );
  }
}

export function createPrivilegedClient(importerPath: string) {
  assertPrivilegedImporter(importerPath);
  const environment = readServerEnv();
  assertEnvironmentIsolation(environment);

  return createClient(
    environment.supabaseUrl.toString(),
    environment.supabaseSecretKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

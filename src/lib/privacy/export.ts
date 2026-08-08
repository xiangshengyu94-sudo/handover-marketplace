import "server-only";

import { randomUUID } from "node:crypto";
import { createPrivilegedClient } from "@/lib/supabase/admin";

export async function exportAccountData(userId: string) {
  const requestId = randomUUID();
  const receipt = randomUUID();
  const { data, error } = await createPrivilegedClient(
    "src/lib/privacy/export.ts",
  ).rpc("admin_export_user_data", {
    p_user_id: userId,
    p_request_id: requestId,
    p_receipt_code: receipt,
  });
  if (error || !data) throw new Error("Account export failed.");
  return data;
}

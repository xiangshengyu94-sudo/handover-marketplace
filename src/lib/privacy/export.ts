import "server-only";

import { randomUUID } from "node:crypto";
import { createPrivilegedClient } from "@/lib/supabase/admin";

export async function exportAccountData(userId: string) {
  const requestId = randomUUID();
  const receipt = randomUUID();
  const client = createPrivilegedClient("src/lib/privacy/export.ts");
  const [posts, answers] = await Promise.all([
    loadAuthoredRows(client, "community_posts", "id, type, title, body, city_id, organization_id, related_question_id, created_at, deleted_at", userId),
    loadAuthoredRows(client, "community_answers", "id, question_id, body, created_at, deleted_at", userId),
  ]);
  const { data, error } = await client.rpc("admin_export_user_data", {
    p_user_id: userId,
    p_request_id: requestId,
    p_receipt_code: receipt,
  });
  if (error || !data) throw new Error("Account export failed.");
  return { ...data as Record<string, unknown>, communityPosts: posts, communityAnswers: answers };
}

async function loadAuthoredRows(
  client: ReturnType<typeof createPrivilegedClient>,
  table: "community_posts" | "community_answers",
  columns: string,
  userId: string,
) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  while (true) {
    const { data, count, error } = await client.from(table)
      .select(columns, { count: "exact" })
      .eq("author_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(rows.length, rows.length + pageSize - 1);
    if (error || !data || typeof count !== "number") throw new Error("Account export failed.");
    rows.push(...data as unknown as Record<string, unknown>[]);
    if (rows.length >= count) return rows;
    if (data.length === 0) throw new Error("Account export failed.");
  }
}

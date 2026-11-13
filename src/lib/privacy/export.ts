import "server-only";

import { randomUUID } from "node:crypto";
import { createPrivilegedClient } from "@/lib/supabase/admin";

export async function exportAccountData(userId: string) {
  const requestId = randomUUID();
  const receipt = randomUUID();
  const client = createPrivilegedClient("src/lib/privacy/export.ts");
  const [posts, answers] = await Promise.all([
    client.from("community_posts").select("id, type, title, body, city_id, organization_id, related_question_id, created_at, deleted_at").eq("author_id", userId),
    client.from("community_answers").select("id, question_id, body, created_at, deleted_at").eq("author_id", userId),
  ]);
  if (posts.error || answers.error) throw new Error("Account export failed.");
  const { data, error } = await client.rpc("admin_export_user_data", {
    p_user_id: userId,
    p_request_id: requestId,
    p_receipt_code: receipt,
  });
  if (error || !data) throw new Error("Account export failed.");
  return { ...data as Record<string, unknown>, communityPosts: posts.data ?? [], communityAnswers: answers.data ?? [] };
}

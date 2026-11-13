"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { consumeRateLimit, hashAbuseKey } from "@/lib/auth/admin";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { createClient } from "@/lib/supabase/server";

import { answerInputSchema, postInputSchema } from "./schema";

export type CommunityActionState = { error: "" | "auth" | "invalid" | "limit" | "unavailable" };

export async function createCommunityPost(
  _previous: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  let member;
  try { member = await requireActiveMember(); }
  catch (error) { return { error: error instanceof AuthorizationError ? "auth" : "unavailable" }; }

  const parsed = postInputSchema.safeParse({
    type: formData.get("type"), title: formData.get("title"), body: formData.get("body"),
    cityId: formData.get("cityId"), organizationId: formData.get("organizationId") ?? "",
    relatedQuestionId: formData.get("relatedQuestionId") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const limit = await consumeRateLimit({ scope: "community-post", keyHash: hashAbuseKey(member.id), limit: 5, windowSeconds: 24 * 60 * 60 });
  if (!limit.allowed) return { error: "limit" };

  const client = await createClient();
  const { data, error } = await client.from("community_posts").insert({
    author_id: member.id, type: parsed.data.type, title: parsed.data.title,
    body: parsed.data.body, city_id: parsed.data.cityId,
    organization_id: parsed.data.organizationId,
    related_question_id: parsed.data.relatedQuestionId,
  }).select("id").single();
  if (error || !data) return { error: "unavailable" };
  revalidatePath("/community");
  if (parsed.data.relatedQuestionId) revalidatePath(`/community/${parsed.data.relatedQuestionId}`);
  redirect(`/community/${data.id}`);
}

export async function createCommunityAnswer(
  _previous: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  let member;
  try { member = await requireActiveMember(); }
  catch (error) { return { error: error instanceof AuthorizationError ? "auth" : "unavailable" }; }

  const parsed = answerInputSchema.safeParse({ questionId: formData.get("questionId"), body: formData.get("body") });
  if (!parsed.success) return { error: "invalid" };

  const limit = await consumeRateLimit({ scope: "community-answer", keyHash: hashAbuseKey(member.id), limit: 20, windowSeconds: 24 * 60 * 60 });
  if (!limit.allowed) return { error: "limit" };

  const client = await createClient();
  const { error } = await client.from("community_answers").insert({
    question_id: parsed.data.questionId, author_id: member.id, body: parsed.data.body,
  });
  if (error) return { error: "unavailable" };
  revalidatePath(`/community/${parsed.data.questionId}`);
  redirect(`/community/${parsed.data.questionId}#answers`);
}

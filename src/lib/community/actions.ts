"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { consumeRateLimit, hashAbuseKey } from "@/lib/auth/admin";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";

import { insertCommunityAnswer, insertCommunityPost } from "./admin";
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

  let postId;
  try {
    const limit = await consumeRateLimit({ scope: "community-post", keyHash: hashAbuseKey(member.id), limit: 5, windowSeconds: 24 * 60 * 60 });
    if (!limit.allowed) return { error: "limit" };
    postId = await insertCommunityPost({
      authorId: member.id, type: parsed.data.type, title: parsed.data.title,
      body: parsed.data.body, cityId: parsed.data.cityId,
      organizationId: parsed.data.organizationId,
      relatedQuestionId: parsed.data.relatedQuestionId,
    });
  } catch { return { error: "unavailable" }; }
  if (!postId) return { error: "unavailable" };
  revalidatePath("/community");
  if (parsed.data.relatedQuestionId) revalidatePath(`/community/${parsed.data.relatedQuestionId}`);
  redirect(`/community/${postId}`);
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

  let inserted;
  try {
    const limit = await consumeRateLimit({ scope: "community-answer", keyHash: hashAbuseKey(member.id), limit: 20, windowSeconds: 24 * 60 * 60 });
    if (!limit.allowed) return { error: "limit" };
    inserted = await insertCommunityAnswer({
      questionId: parsed.data.questionId, authorId: member.id, body: parsed.data.body,
    });
  } catch { return { error: "unavailable" }; }
  if (!inserted) return { error: "unavailable" };
  revalidatePath(`/community/${parsed.data.questionId}`);
  redirect(`/community/${parsed.data.questionId}#answers`);
}

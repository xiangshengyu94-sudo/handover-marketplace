import "server-only";

import { createPrivilegedClient } from "@/lib/supabase/admin";

export async function insertCommunityPost(input: {
  authorId: string;
  cityId: string;
  organizationId: string | null;
  type: "question" | "experience";
  title: string;
  body: string;
  relatedQuestionId: string | null;
}) {
  const { data, error } = await createPrivilegedClient("src/lib/community/admin.ts")
    .from("community_posts")
    .insert({
      author_id: input.authorId,
      city_id: input.cityId,
      organization_id: input.organizationId,
      type: input.type,
      title: input.title,
      body: input.body,
      related_question_id: input.relatedQuestionId,
    })
    .select("id")
    .single();
  return error || !data ? null : data.id;
}

export async function insertCommunityAnswer(input: {
  questionId: string;
  authorId: string;
  body: string;
}) {
  const { error } = await createPrivilegedClient("src/lib/community/admin.ts")
    .from("community_answers")
    .insert({ question_id: input.questionId, author_id: input.authorId, body: input.body });
  return !error;
}

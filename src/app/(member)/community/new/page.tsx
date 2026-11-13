import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CommunityPostForm } from "@/components/community/post-form";
import { SiteHeader } from "@/components/navigation/site-header";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { getCommunityCopy } from "@/lib/community/copy";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Share with the community" };

export default async function NewCommunityPostPage({ searchParams }: { searchParams: Promise<{ type?: string; question?: string }> }) {
  const { type, question } = await searchParams;
  const selectedType = type === "experience" ? "experience" : "question";
  const requestedQuestionId = selectedType === "experience" && z.uuid().safeParse(question).success ? question : undefined;
  try { await requireActiveMember(); }
  catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      const destination = `/community/new?type=${selectedType}${requestedQuestionId ? `&question=${requestedQuestionId}` : ""}`;
      redirect(`/login?returnTo=${encodeURIComponent(destination)}`);
    }
    throw error;
  }
  const locale = await getLocale();
  const copy = getCommunityCopy(locale);
  const client = await createClient();
  const [cities, organizations, questions] = await Promise.all([
    client.from("cities").select("id, name").eq("status", "active").order("name"),
    client.from("organizations").select("id, name, city_id").eq("status", "active").order("name"),
    client.from("community_posts").select("id, title, city_id").eq("type", "question").order("created_at", { ascending: false }).limit(100),
  ]);
  if (cities.error || organizations.error || questions.error) throw new Error("Community publishing is unavailable.");
  let availableQuestions = questions.data ?? [];
  if (requestedQuestionId && !availableQuestions.some((entry) => entry.id === requestedQuestionId)) {
    const requested = await client.from("community_posts").select("id, title, city_id").eq("id", requestedQuestionId).eq("type", "question").maybeSingle();
    if (requested.data) availableQuestions = [requested.data, ...availableQuestions];
  }
  return <><SiteHeader /><main className="community-page community-compose"><Link href="/community">← {copy.back}</Link><p className="eyebrow">{copy.nav}</p><h1>{selectedType === "question" ? copy.ask : copy.share}</h1><p className="lede">{copy.browseIntro}</p><CommunityPostForm type={selectedType} cities={cities.data ?? []} organizations={organizations.data ?? []} questions={availableQuestions} initialQuestionId={requestedQuestionId} locale={locale} /></main></>;
}

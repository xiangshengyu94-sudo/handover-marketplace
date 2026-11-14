import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CommunityAnswerForm } from "@/components/community/answer-form";
import { SiteHeader } from "@/components/navigation/site-header";
import { getCommunityCopy } from "@/lib/community/copy";
import { FORMAT_LOCALES } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Community post" };

export default async function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const locale = await getLocale();
  const copy = getCommunityCopy(locale);
  const client = await createClient();
  const { data: post, error } = await client.from("community_posts").select("id, type, title, body, city_id, organization_id, related_question_id, created_at").eq("id", id).maybeSingle();
  if (error || !post) notFound();
  const [city, organization, answers, experiences, related, claims] = await Promise.all([
    client.from("cities").select("name").eq("id", post.city_id).maybeSingle(),
    post.organization_id ? client.from("organizations").select("name").eq("id", post.organization_id).maybeSingle() : Promise.resolve({ data: null }),
    post.type === "question" ? client.from("community_answers").select("id, body, created_at").eq("question_id", id).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
    post.type === "question" ? client.from("community_posts").select("id, title").eq("related_question_id", id).eq("type", "experience").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    post.related_question_id ? client.from("community_posts").select("id, title").eq("id", post.related_question_id).maybeSingle() : Promise.resolve({ data: null }),
    client.auth.getClaims(),
  ]);
  const relatedQueriesFailed = [city, organization, answers, experiences, related]
    .some((result) => "error" in result && Boolean(result.error));
  if (relatedQueriesFailed) {
    return <><SiteHeader /><main className="community-page community-detail"><Link href="/community">← {copy.back}</Link><p className="empty-state">{copy.unavailable}</p></main></>;
  }
  const signedIn = typeof claims.data?.claims.sub === "string";
  const dateFormatter = new Intl.DateTimeFormat(FORMAT_LOCALES[locale], { dateStyle: "medium" });
  const date = (value: string) => dateFormatter.format(new Date(value));

  return <><SiteHeader /><main className="community-page community-detail"><Link href="/community">← {copy.back}</Link><article className="community-article"><div className="card-tags"><span className="tag resource">{post.type === "question" ? copy.question : copy.experience}</span><span className="tag context">{city.data?.name}</span>{organization.data?.name ? <span className="tag context">{organization.data.name}</span> : null}</div><h1>{post.title}</h1><p className="community-date">{date(post.created_at)}</p><p className="community-body">{post.body}</p>{related.data ? <p>{copy.relatedQuestion}: <Link href={`/community/${related.data.id}`}>{related.data.title}</Link></p> : null}</article>{post.type === "question" ? <section className="community-discussion" id="answers"><h2>{copy.answers}</h2>{answers.data?.length ? <div className="answer-list">{answers.data.map((answer) => <article className="answer-card" key={answer.id}><p>{answer.body}</p><small>{date(answer.created_at)}</small></article>)}</div> : <p>{copy.noAnswers}</p>}<h3>{copy.answer}</h3>{signedIn ? <CommunityAnswerForm questionId={id} locale={locale} /> : <p><Link href={`/login?returnTo=/community/${id}`}>{copy.signIn}</Link></p>}<Link className="button-link button-secondary" href={`/community/new?type=experience&question=${id}`}>{copy.share}</Link>{experiences.data?.length ? <div className="linked-experiences"><h3>{copy.linkedExperiences}</h3>{experiences.data.map((experience) => <p key={experience.id}><Link href={`/community/${experience.id}`}>{experience.title}</Link></p>)}</div> : null}</section> : null}</main></>;
}

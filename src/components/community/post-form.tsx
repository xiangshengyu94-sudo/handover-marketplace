"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createCommunityPost, type CommunityActionState } from "@/lib/community/actions";
import { getCommunityCopy } from "@/lib/community/copy";
import type { Locale } from "@/lib/i18n/config";

type Option = { id: string; name: string; city_id?: string | null; title?: string };
type QuestionOption = { id: string; title: string; city_id: string };

export function CommunityPostForm({
  type, cities, organizations, questions, initialQuestionId, locale,
}: {
  type: "question" | "experience";
  cities: Option[];
  organizations: Option[];
  questions: QuestionOption[];
  initialQuestionId?: string;
  locale: Locale;
}) {
  const copy = getCommunityCopy(locale);
  const initialQuestion = questions.find((question) => question.id === initialQuestionId);
  const [cityId, setCityId] = useState(initialQuestion?.city_id ?? "");
  const [state, action, pending] = useActionState(createCommunityPost, { error: "" } as CommunityActionState);
  const error = state.error ? ({ auth: copy.authError, invalid: copy.invalidError, limit: copy.limitError, unavailable: copy.unavailableError } as const)[state.error] : "";

  return <form className="community-form" action={action}>
    <input type="hidden" name="type" value={type} />
    <div className="community-type-tabs">
      <Link className={type === "question" ? "selected" : ""} href="/community/new?type=question">{copy.ask}</Link>
      <Link className={type === "experience" ? "selected" : ""} href="/community/new?type=experience">{copy.share}</Link>
    </div>
    <div className="field"><label htmlFor="community-city">{copy.city}</label><select id="community-city" name="cityId" required value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">{copy.chooseCity}</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></div>
    <div className="field"><label htmlFor="community-organization">{copy.organization} · {copy.optional}</label><select id="community-organization" name="organizationId" key={cityId}><option value="">{copy.chooseOrganization}</option>{organizations.filter((organization) => !organization.city_id || organization.city_id === cityId).map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></div>
    <div className="field"><label htmlFor="community-title">{copy.title}</label><input id="community-title" name="title" minLength={8} maxLength={120} required /></div>
    <div className="field"><label htmlFor="community-body">{copy.body}</label><textarea id="community-body" name="body" minLength={20} maxLength={4000} required /><small>{copy.privacyHint}</small></div>
    {type === "experience" ? <div className="field"><label htmlFor="community-related">{copy.related} · {copy.optional}</label><select id="community-related" name="relatedQuestionId" key={`${cityId}-${initialQuestionId ?? ""}`} defaultValue={initialQuestion?.city_id === cityId ? initialQuestionId : ""}><option value="">{copy.chooseQuestion}</option>{questions.filter((question) => question.city_id === cityId).map((question) => <option key={question.id} value={question.id}>{question.title}</option>)}</select><small>{copy.relatedHint}</small></div> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="button-link" type="submit" disabled={pending}>{pending ? copy.publishing : copy.publish}</button>
  </form>;
}

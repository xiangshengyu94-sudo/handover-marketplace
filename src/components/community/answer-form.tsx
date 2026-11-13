"use client";

import { useActionState } from "react";

import { createCommunityAnswer, type CommunityActionState } from "@/lib/community/actions";
import { getCommunityCopy } from "@/lib/community/copy";
import type { Locale } from "@/lib/i18n/config";

export function CommunityAnswerForm({ questionId, locale }: { questionId: string; locale: Locale }) {
  const copy = getCommunityCopy(locale);
  const [state, action, pending] = useActionState(createCommunityAnswer, { error: "" } as CommunityActionState);
  const error = state.error ? ({ auth: copy.authError, invalid: copy.invalidError, limit: copy.limitError, unavailable: copy.unavailableError } as const)[state.error] : "";
  return <form className="community-form answer-form" action={action}>
    <input type="hidden" name="questionId" value={questionId} />
    <div className="field"><label htmlFor="answer-body">{copy.answerBody}</label><textarea id="answer-body" name="body" minLength={20} maxLength={4000} required /><small>{copy.privacyHint}</small></div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="button-link" type="submit" disabled={pending}>{pending ? copy.posting : copy.postAnswer}</button>
  </form>;
}

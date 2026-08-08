"use client";

import { useActionState } from "react";

import {
  cancelEmailChangeAction,
  requestEmailChangeAction,
  resendEmailChangeAction,
} from "@/app/(member)/account/actions";
import { initialAccountActionState } from "@/lib/auth/form-state";

export function EmailChangeForm({
  currentEmail,
  pendingEmail,
}: {
  currentEmail: string;
  pendingEmail?: string;
}) {
  const [changeState, changeAction, changing] = useActionState(
    requestEmailChangeAction,
    initialAccountActionState,
  );
  const [resendState, resendAction, resending] = useActionState(
    resendEmailChangeAction,
    initialAccountActionState,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelEmailChangeAction,
    initialAccountActionState,
  );

  if (pendingEmail) {
    const state = cancelState.status !== "idle" ? cancelState : resendState;
    return (
      <div className="auth-stack">
        <div className="pending-panel" role="status">
          <strong>Change pending</strong>
          <span>{currentEmail} to {pendingEmail}</span>
          <p>
            Confirm as instructed in both inboxes. Publishing and contact stay paused until the new address is verified.
          </p>
        </div>
        {state.message ? (
          <p className={state.status === "error" ? "form-error" : "form-note"} role="status">
            {state.message}
          </p>
        ) : null}
        <div className="button-row">
          <form action={resendAction}>
            <button className="button-secondary" disabled={resending} type="submit">
              {resending ? "Requesting..." : "Resend confirmations"}
            </button>
          </form>
          <form action={cancelAction}>
            <button className="button-quiet" disabled={cancelling} type="submit">
              {cancelling ? "Cancelling..." : "Cancel change"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={changeAction} className="auth-form">
      <label htmlFor="new-email">New email address</label>
      <input id="new-email" name="email" type="email" autoComplete="email" maxLength={254} required />
      <p className="form-note">
        The current address remains visible only to you. Contact and publishing pause during verification.
      </p>
      {changeState.message ? (
        <p className={changeState.status === "error" ? "form-error" : "form-note"} role="status">
          {changeState.message}
        </p>
      ) : null}
      <button type="submit" disabled={changing}>
        {changing ? "Starting change..." : "Change email"}
      </button>
    </form>
  );
}

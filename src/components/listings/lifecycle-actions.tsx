"use client";

import { useFormStatus } from "react-dom";

import { runLifecycleAction } from "@/app/(member)/dashboard/actions";
import { IsoDateInput } from "@/components/forms/iso-date-input";
import { allowedLifecycleActions, type LifecycleAction } from "@/lib/listings/transitions";

const labels: Record<LifecycleAction, string> = { reserve: "Mark reserved", reopen: "Reopen", complete: "Complete handover", withdraw: "Withdraw", renew: "Renew", delete: "Delete" };

export function LifecycleActions({ listingId, version, status }: { listingId: string; version: number; status: string }) {
  const actions = allowedLifecycleActions(status);
  return <div className="lifecycle-actions">{actions.map((action) => <form action={runLifecycleAction} key={action} onSubmit={(event) => {
    if (["complete", "withdraw", "delete"].includes(action) && !window.confirm(confirmMessage(action))) event.preventDefault();
  }}><input type="hidden" name="listingId" value={listingId} /><input type="hidden" name="version" value={version} /><input type="hidden" name="action" value={action} />{action === "renew" ? <label>New expiry <IsoDateInput name="expiresOn" required /></label> : null}<SubmitButton action={action} /></form>)}</div>;
}

function SubmitButton({ action }: { action: LifecycleAction }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={action === "delete" ? "button-danger" : "button-secondary"} disabled={pending}>{pending ? "Working…" : labels[action]}</button>;
}

function confirmMessage(action: LifecycleAction) {
  if (action === "delete") return "Delete this listing? It will disappear from your dashboard and cannot be restored.";
  if (action === "complete") return "Mark this handover complete? You can no longer reopen it.";
  return "Withdraw this listing from public discovery?";
}

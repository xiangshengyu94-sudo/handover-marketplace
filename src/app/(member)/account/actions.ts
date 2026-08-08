"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  cancelPendingEmailChange,
  consumeRateLimit,
  hashAbuseKey,
} from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { requireUser } from "@/lib/auth/require-user";
import { readPublicEnv } from "@/lib/env";
import type { AccountActionState } from "@/lib/auth/form-state";
import { createClient } from "@/lib/supabase/server";

export async function requestEmailChangeAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  await assertRequestOrigin();
  const member = await requireActiveMember();
  const parsedEmail = z.string().trim().toLowerCase().email().max(254).safeParse(
    formData.get("email"),
  );
  if (!parsedEmail.success || parsedEmail.data === member.email.toLowerCase()) {
    return { status: "error", message: "Enter a different valid email address." };
  }

  const rateLimit = await consumeRateLimit({
    scope: "email-change-user",
    keyHash: hashAbuseKey(member.id),
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });
  if (!rateLimit.allowed) {
    return { status: "error", message: "Too many changes were requested. Try again later." };
  }

  const client = await createClient();
  const confirmationUrl = new URL("/auth/confirm", readPublicEnv().appUrl);
  const { error } = await client.auth.updateUser(
    { email: parsedEmail.data },
    { emailRedirectTo: confirmationUrl.toString() },
  );
  if (error) {
    return { status: "error", message: "The email change could not be started. Try again." };
  }

  revalidatePath("/account");
  return {
    status: "success",
    message:
      "Confirmation messages were requested. Publishing and contact are paused until the change completes.",
  };
}

export async function resendEmailChangeAction(
  previous: AccountActionState,
): Promise<AccountActionState> {
  void previous;
  await assertRequestOrigin();
  const user = await requireUser();
  if (!user.newEmail) {
    return { status: "error", message: "There is no pending email change." };
  }

  const rateLimit = await consumeRateLimit({
    scope: "email-change-resend",
    keyHash: hashAbuseKey(user.id),
    limit: 1,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return { status: "error", message: "A message was sent recently. Check both inboxes first." };
  }

  const client = await createClient();
  const { error } = await client.auth.resend({
    type: "email_change",
    email: user.email,
  });
  return error
    ? { status: "error", message: "Confirmation could not be resent. Try again later." }
    : { status: "success", message: "Confirmation messages were requested again." };
}

export async function cancelEmailChangeAction(
  previous: AccountActionState,
): Promise<AccountActionState> {
  void previous;
  await assertRequestOrigin();
  const user = await requireUser();
  if (!user.newEmail) {
    return { status: "error", message: "There is no pending email change." };
  }

  try {
    await cancelPendingEmailChange(user.id, user.email);
    revalidatePath("/account");
    return { status: "success", message: "The pending email change was cancelled." };
  } catch {
    return { status: "error", message: "The change could not be cancelled. Try again later." };
  }
}

async function assertRequestOrigin() {
  const requestHeaders = await headers();
  assertSameOrigin({
    origin: requestHeaders.get("origin") ?? undefined,
    host: requestHeaders.get("host") ?? undefined,
    forwardedHost: requestHeaders.get("x-forwarded-host") ?? undefined,
  });
}

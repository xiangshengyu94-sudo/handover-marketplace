"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/csrf";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { lifecycleActionSchema, parseRenewalDate } from "@/lib/listings/transitions";
import { createClient } from "@/lib/supabase/server";

export async function runLifecycleAction(formData: FormData) {
  let result = "error";
  try {
    const requestHeaders = await headers();
    assertSameOrigin({ origin: requestHeaders.get("origin") ?? undefined, host: requestHeaders.get("host") ?? undefined, forwardedHost: requestHeaders.get("x-forwarded-host") ?? undefined });
    await requireActiveMember();
    const listingId = z.uuid().parse(formData.get("listingId"));
    const version = z.coerce.number().int().positive().parse(formData.get("version"));
    const action = lifecycleActionSchema.parse(formData.get("action"));
    const expiry = action === "renew" ? parseRenewalDate(formData.get("expiresOn")) : null;
    const client = await createClient();
    const response = await client.rpc("transition_own_listing", { p_listing_id: listingId, p_expected_version: version, p_action: action, p_new_expiry: expiry });
    if (response.error?.code === "40001") result = "stale";
    else if (!response.error) {
      result = action;
      revalidatePath("/");
      revalidatePath(`/listings/${listingId}`);
      revalidatePath("/dashboard");
    }
  } catch {
    result = "error";
  }
  redirect(`/dashboard?result=${encodeURIComponent(result)}`);
}

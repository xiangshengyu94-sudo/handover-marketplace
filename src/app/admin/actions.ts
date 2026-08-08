"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/csrf";
import { requireAnyRole } from "@/lib/auth/require-any-role";
import { moderateListing, reviewTaxonomyRequest } from "@/lib/moderation/actions";
import { manageProtectedRole } from "@/lib/roles/manage";

export async function moderateListingAction(formData: FormData) {
  let result = "error";
  try {
    await verifyOrigin(); const actor = await requireAnyRole(["moderator", "administrator"]);
    const listingId = z.uuid().parse(formData.get("listingId"));
    const reportId = z.uuid().optional().parse(text(formData, "reportId") || undefined);
    const action = z.enum(["hide", "restore"]).parse(formData.get("action"));
    const reason = z.string().trim().min(10).max(1000).parse(formData.get("reason"));
    await moderateListing({ actorId: actor.id, listingId, reportId, action, reason });
    revalidatePath("/"); revalidatePath(`/listings/${listingId}`); result = action;
  } catch { result = "error"; }
  redirect(`/admin/reports?result=${result}`);
}

export async function reviewTaxonomyAction(formData: FormData) {
  let result = "error";
  try {
    await verifyOrigin(); const actor = await requireAnyRole(["operator", "administrator"]);
    await reviewTaxonomyRequest({ actorId: actor.id, requestId: z.uuid().parse(formData.get("requestId")), decision: z.enum(["approve", "reject"]).parse(formData.get("decision")), note: z.string().trim().max(1000).parse(formData.get("note")) });
    revalidatePath("/"); result = "reviewed";
  } catch { result = "error"; }
  redirect(`/admin/taxonomy?result=${result}`);
}

export async function manageRoleAction(formData: FormData) {
  let result = "error";
  let needsRecentSignIn = false;
  try {
    await verifyOrigin(); const actor = await requireAnyRole(["administrator"]);
    if (!actor.lastSignInAt || Date.now() - new Date(actor.lastSignInAt).getTime() > 10 * 60 * 1000) {
      needsRecentSignIn = true;
    } else {
      await manageProtectedRole({ actorId: actor.id, targetId: z.uuid().parse(formData.get("targetId")), role: z.enum(["operator", "moderator", "administrator"]).parse(formData.get("role")), action: z.enum(["grant", "revoke"]).parse(formData.get("action")) });
      result = "updated";
    }
  } catch { result = "error"; }
  if (needsRecentSignIn) redirect("/login?returnTo=/admin/roles");
  redirect(`/admin/roles?result=${result}`);
}

async function verifyOrigin() { const h = await headers(); assertSameOrigin({ origin: h.get("origin") ?? undefined, host: h.get("host") ?? undefined, forwardedHost: h.get("x-forwarded-host") ?? undefined }); }
function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value : ""; }

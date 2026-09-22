"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/csrf";
import { requireActiveMember } from "@/lib/auth/require-active-member";
import { IMAGE_POLICY } from "@/lib/images/policy";
import { deleteStoredImagePaths } from "@/lib/images/process";
import { parseListingFormData } from "@/lib/listings/form-data";
import type {
  ListingActionState,
  StagedImage,
} from "@/lib/listings/form-state";
import { validatePublicListingText } from "@/lib/listings/public-text-policy";
import { createClient } from "@/lib/supabase/server";

const identifierSchema = z.uuid();
const mediaTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export async function saveListingAction(
  _previous: ListingActionState,
  formData: FormData,
): Promise<ListingActionState> {
  try {
    await assertRequestOrigin();
    await requireActiveMember();
    const client = await createClient();
    const { data: categories, error: categoryError } = await client
      .from("resource_categories")
      .select("id, kind")
      .eq("status", "active");
    if (categoryError || !categories) return unavailable();

    const parsed = parseListingFormData(formData, categories);
    if (!parsed.success) {
      return {
        error: "Check the highlighted fields and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const listing = parsed.data;
    const publicText = validatePublicListingText({
      title: listing.title,
      description: listing.description,
      approximateArea: listing.approximateArea,
      pickupArea: listing.kind === "item" ? listing.item.pickupArea : undefined,
    });
    if (publicText.length) {
      return {
        error: "Keep contact details, private links, and exact addresses out of public text.",
        fieldErrors: publicText.reduce<Record<string, string[]>>(
          (errors, issue) => ({
            ...errors,
            [issue.field]: [...(errors[issue.field] ?? []), issue.message],
          }),
          {},
        ),
      };
    }

    const listingId = optionalUuid(formData.get("listingId"));
    const expectedVersion = optionalInteger(formData.get("version"));
    const publish = formData.get("intent") === "publish";
    const housing = listing.kind === "housing" ? listing.housing : null;
    const item = listing.kind === "item" ? listing.item : null;
    const commonParameters = {
      p_listing_id: listingId,
      p_expected_version: expectedVersion,
      p_city_id: listing.cityId,
      p_organization_ids: listing.organizationIds,
      p_resource_category_id: listing.resourceCategoryId,
      p_title: listing.title,
      p_description: listing.description,
      p_price_amount: listing.priceAmount,
      p_currency: listing.currency,
      p_approximate_area: listing.approximateArea,
      p_available_from: listing.availableFrom,
      p_expires_at: listing.expiresAt,
      p_publish: publish,
    };
    const { data, error } = listing.kind === "other"
      ? await client.rpc("save_own_other_listing", commonParameters)
      : await client.rpc("save_own_listing", {
          ...commonParameters,
          p_kind: listing.kind,
          p_housing_subtype: housing?.subtype ?? null,
          p_furnished: housing?.furnished ?? null,
          p_bills_included: housing?.billsIncluded ?? null,
          p_publication_rights_acknowledged:
            housing?.publicationRightsAcknowledged ?? null,
          p_permission_acknowledged: housing?.permissionAcknowledged ?? null,
          p_safety_warning_acknowledged:
            housing?.safetyWarningAcknowledged ?? null,
          p_item_condition: item?.condition ?? null,
          p_quantity: item?.quantity ?? null,
          p_pickup_area: item?.pickupArea ?? null,
          p_is_giveaway: item?.isGiveaway ?? null,
        });
    const saved = Array.isArray(data) ? data[0] : null;
    if (error || !saved) {
      if (error?.code === "40001") {
        return { error: "This listing changed elsewhere. Reload before saving again." };
      }
      return { error: publish && error?.message.includes("images")
        ? "Wait for every image to finish processing before publishing."
        : "The listing could not be saved. Try again." };
    }
    return {
      ok: true,
      listingId: String(saved.listing_id),
      version: Number(saved.listing_version),
      status: saved.listing_status,
    };
  } catch {
    return unavailable();
  }
}

export async function stageListingImageAction(input: {
  listingId: string;
  sortOrder: number;
  mediaType: string;
  byteSize: number;
}): Promise<{ image?: StagedImage; error?: string }> {
  try {
    await assertRequestOrigin();
    await requireActiveMember();
    const parsed = z.object({
      listingId: identifierSchema,
      sortOrder: z.number().int().min(0).max(IMAGE_POLICY.maxImagesPerListing - 1),
      mediaType: mediaTypeSchema,
      byteSize: z.number().int().min(1).max(IMAGE_POLICY.maxFileBytes),
    }).parse(input);
    const client = await createClient();
    const { data, error } = await client.rpc("stage_own_listing_image", {
      p_listing_id: parsed.listingId,
      p_sort_order: parsed.sortOrder,
      p_original_media_type: parsed.mediaType,
      p_byte_size: parsed.byteSize,
    });
    const staged = Array.isArray(data) ? data[0] : null;
    if (error || !staged) return { error: "The image could not be reserved." };
    return { image: {
      imageId: String(staged.image_id),
      storagePath: String(staged.storage_path),
      generation: String(staged.generation),
      status: "staged",
    } };
  } catch {
    return { error: "The image could not be reserved." };
  }
}

export async function removeListingImageAction(input: {
  imageId: string;
  generation: string;
}): Promise<{ ok: boolean }> {
  try {
    await assertRequestOrigin();
    await requireActiveMember();
    const parsed = z.object({ imageId: identifierSchema, generation: identifierSchema }).parse(input);
    const client = await createClient();
    const { data, error } = await client.rpc("remove_own_listing_image", {
      p_image_id: parsed.imageId,
      p_generation: parsed.generation,
    });
    const removed = Array.isArray(data) ? data[0] : null;
    if (error || !removed) return { ok: false };
    await deleteStoredImagePaths({
      stagingPath: removed.staging_path,
      mediaPath: removed.media_path,
    });
    return { ok: true };
  } catch {
    return { ok: false };
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

function optionalUuid(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? identifierSchema.parse(value) : null;
}

function optionalInteger(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  return z.coerce.number().int().nonnegative().parse(value);
}

function unavailable(): ListingActionState {
  return { error: "The listing service is unavailable. Try again." };
}

import "server-only";

import { createHash } from "node:crypto";
import sharp, { type Metadata, type Sharp } from "sharp";
import { z } from "zod";

import { createPrivilegedClient } from "@/lib/supabase/admin";

import {
  IMAGE_POLICY,
  buildDerivativePath,
  validateDecodedImage,
} from "./policy";

export type ImageProcessingErrorCode =
  | "missing"
  | "too-large"
  | "unsupported"
  | "corrupt"
  | "dimensions"
  | "animated"
  | "quota"
  | "stale"
  | "storage";

export class ImageProcessingError extends Error {
  constructor(readonly code: ImageProcessingErrorCode) {
    super("The image could not be processed safely.");
    this.name = "ImageProcessingError";
  }
}

export async function sanitizeImageBuffer(input: Buffer) {
  if (input.byteLength <= 0) throw new ImageProcessingError("missing");
  if (input.byteLength > IMAGE_POLICY.maxFileBytes) {
    throw new ImageProcessingError("too-large");
  }

  let pipeline: Sharp;
  let metadata: Metadata;
  try {
    pipeline = sharp(input, {
      limitInputPixels: IMAGE_POLICY.maxInputPixels,
      limitInputChannels: 4,
      sequentialRead: true,
    });
    metadata = await pipeline.metadata();
  } catch {
    throw new ImageProcessingError("corrupt");
  }

  const issues = validateDecodedImage(metadata);
  if (issues.some(({ code }) => code === "decoded-type")) {
    throw new ImageProcessingError("unsupported");
  }
  if (issues.some(({ code }) => code === "animation")) {
    throw new ImageProcessingError("animated");
  }
  if (issues.length) throw new ImageProcessingError("dimensions");

  try {
    const { data, info } = await pipeline
      .rotate()
      .resize({
        width: IMAGE_POLICY.outputMaxDimension,
        height: IMAGE_POLICY.outputMaxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      digest: createHash("sha256").update(data).digest("hex"),
      width: info.width,
      height: info.height,
      format: "webp" as const,
    };
  } catch {
    throw new ImageProcessingError("corrupt");
  }
}

const processingInputSchema = z.object({
  imageId: z.uuid(),
  listingId: z.uuid(),
  ownerId: z.uuid(),
  generation: z.uuid(),
});

export async function processListingImage(input: {
  imageId: string;
  listingId: string;
  ownerId: string;
  generation: string;
}) {
  const parsed = processingInputSchema.parse(input);
  const client = createAdminClient();
  const { data: claimData, error: claimError } = await client.rpc(
    "admin_claim_listing_image",
    {
      p_image_id: parsed.imageId,
      p_listing_id: parsed.listingId,
      p_owner_id: parsed.ownerId,
      p_generation: parsed.generation,
    },
  );
  if (claimError) throw new ImageProcessingError("storage");
  const claim = Array.isArray(claimData) ? claimData[0] : null;
  if (!claim) return { status: "already-processing" as const };

  let derivativePath: string | undefined;
  try {
    const { data: original, error: downloadError } = await client.storage
      .from("listing-staging")
      .download(String(claim.storage_path), {}, { cache: "no-store" });
    if (downloadError || !original) throw new ImageProcessingError("missing");

    const sanitized = await sanitizeImageBuffer(
      Buffer.from(await original.arrayBuffer()),
    );
    derivativePath = buildDerivativePath({
      user: parsed.ownerId,
      listing: parsed.listingId,
      image: parsed.imageId,
      generation: parsed.generation,
    });

    const { error: uploadError } = await client.storage
      .from("listing-media")
      .upload(derivativePath, sanitized.buffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw new ImageProcessingError("storage");

    const { data: finalized, error: finalizeError } = await client.rpc(
      "admin_mark_listing_image_ready",
      {
        p_image_id: parsed.imageId,
        p_generation: parsed.generation,
        p_derivative_path: derivativePath,
        p_content_digest: sanitized.digest,
        p_width: sanitized.width,
        p_height: sanitized.height,
        p_byte_size: sanitized.buffer.byteLength,
      },
    );
    if (finalizeError) throw new ImageProcessingError("storage");
    if (finalized !== true) {
      await client.storage.from("listing-media").remove([derivativePath]);
      return { status: "stale" as const };
    }

    await client.storage
      .from("listing-staging")
      .remove([String(claim.storage_path)]);
    return { status: "ready" as const, imageId: parsed.imageId };
  } catch (error) {
    if (derivativePath) {
      await client.storage.from("listing-media").remove([derivativePath]);
    }
    const code =
      error instanceof ImageProcessingError ? error.code : ("storage" as const);
    await client.rpc("admin_mark_listing_image_failed", {
      p_image_id: parsed.imageId,
      p_generation: parsed.generation,
      p_error_code: code,
    });
    return { status: "failed" as const, code };
  }
}

export async function getListingImageSignedUrl(
  imageId: string,
  viewerId?: string,
) {
  const parsedImageId = z.uuid().parse(imageId);
  const client = createAdminClient();
  const { data, error } = await client.rpc("admin_get_listing_image_access", {
    p_image_id: parsedImageId,
  });
  if (error) return null;
  const access = Array.isArray(data) ? data[0] : null;
  if (
    !access ||
    (!access.listing_public && String(access.owner_id) !== viewerId)
  ) {
    return null;
  }

  const { data: signed, error: signedError } = await client.storage
    .from("listing-media")
    .createSignedUrl(String(access.derivative_path), 60);
  return signedError ? null : signed.signedUrl;
}

export async function deleteStoredImagePaths(input: {
  stagingPath?: string | null;
  mediaPath?: string | null;
}) {
  const client = createAdminClient();
  await Promise.all([
    input.stagingPath
      ? client.storage.from("listing-staging").remove([input.stagingPath])
      : Promise.resolve(),
    input.mediaPath
      ? client.storage.from("listing-media").remove([input.mediaPath])
      : Promise.resolve(),
  ]);
}

function createAdminClient() {
  return createPrivilegedClient("src/lib/images/process.ts");
}

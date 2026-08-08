import { z } from "zod";

export const IMAGE_POLICY = {
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedDecodedFormats: ["jpeg", "png", "webp"],
  maxFileBytes: 8 * 1024 * 1024,
  maxImagesPerListing: 10,
  maxAccountBytes: 200 * 1024 * 1024,
  maxDimension: 12_000,
  maxInputPixels: 40_000_000,
  outputMaxDimension: 1_600,
} as const;

export type ImagePolicyIssue = {
  code:
    | "type"
    | "size"
    | "count"
    | "quota"
    | "decoded-type"
    | "dimensions"
    | "pixels"
    | "animation";
  message: string;
};

export function validateUploadCandidate(
  file: { type: string; size: number },
  currentListingCount: number,
  currentAccountBytes: number,
): ImagePolicyIssue[] {
  const issues: ImagePolicyIssue[] = [];
  if (!IMAGE_POLICY.allowedMimeTypes.includes(file.type as never)) {
    issues.push({ code: "type", message: "Use a JPEG, PNG, or WebP image." });
  }
  if (file.size <= 0 || file.size > IMAGE_POLICY.maxFileBytes) {
    issues.push({ code: "size", message: "Each image must be 8 MB or smaller." });
  }
  if (currentListingCount >= IMAGE_POLICY.maxImagesPerListing) {
    issues.push({ code: "count", message: "A listing can have up to 10 images." });
  }
  if (currentAccountBytes + file.size > IMAGE_POLICY.maxAccountBytes) {
    issues.push({ code: "quota", message: "Your image storage quota is full." });
  }
  return issues;
}

export function validateDecodedImage(input: {
  format?: string;
  width?: number;
  height?: number;
  pages?: number;
}): ImagePolicyIssue[] {
  const issues: ImagePolicyIssue[] = [];
  if (!IMAGE_POLICY.allowedDecodedFormats.includes(input.format as never)) {
    issues.push({ code: "decoded-type", message: "The decoded image type is not allowed." });
  }
  if (
    !input.width ||
    !input.height ||
    input.width > IMAGE_POLICY.maxDimension ||
    input.height > IMAGE_POLICY.maxDimension
  ) {
    issues.push({ code: "dimensions", message: "The image dimensions are too large." });
  } else if (input.width * input.height > IMAGE_POLICY.maxInputPixels) {
    issues.push({ code: "pixels", message: "The image contains too many pixels." });
  }
  if ((input.pages ?? 1) !== 1) {
    issues.push({ code: "animation", message: "Animated or multi-page images are not allowed." });
  }
  return issues;
}

const pathInputSchema = z.object({
  user: z.uuid(),
  listing: z.uuid(),
  image: z.uuid(),
  generation: z.uuid().optional(),
});

export function buildStagingPath(input: {
  user: string;
  listing: string;
  image: string;
}) {
  const parsed = pathInputSchema.parse(input);
  return `${parsed.user}/${parsed.listing}/${parsed.image}.upload`;
}

export function buildDerivativePath(input: {
  user: string;
  listing: string;
  image: string;
  generation: string;
}) {
  const parsed = pathInputSchema.required({ generation: true }).parse(input);
  return `${parsed.user}/${parsed.listing}/${parsed.image}/${parsed.generation}.webp`;
}

export const imageUiStateSchema = z.enum([
  "queued",
  "uploading",
  "processing",
  "ready",
  "failed",
  "removing",
  "replaced",
  "quota",
]);

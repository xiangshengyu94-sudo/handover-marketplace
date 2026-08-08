import { describe, expect, it } from "vitest";

import {
  IMAGE_POLICY,
  buildDerivativePath,
  buildStagingPath,
  validateDecodedImage,
  validateUploadCandidate,
} from "@/lib/images/policy";

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  listing: "22222222-2222-4222-8222-222222222222",
  image: "33333333-3333-4333-8333-333333333333",
  generation: "44444444-4444-4444-8444-444444444444",
};

describe("image policy", () => {
  it("accepts bounded JPEG, PNG, and WebP uploads", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(
        validateUploadCandidate({ type, size: 2_000_000 }, 2, 20_000_000),
      ).toEqual([]);
    }
  });

  it.each([
    ["image/svg+xml", 100, "type"],
    ["text/html", 100, "type"],
    ["image/jpeg", IMAGE_POLICY.maxFileBytes + 1, "size"],
  ])("rejects unsafe candidate %s", (type, size, code) => {
    expect(validateUploadCandidate({ type, size }, 0, 0)).toContainEqual(
      expect.objectContaining({ code }),
    );
  });

  it("enforces listing count and account quota before upload", () => {
    expect(
      validateUploadCandidate(
        { type: "image/jpeg", size: 100 },
        IMAGE_POLICY.maxImagesPerListing,
        0,
      ),
    ).toContainEqual(expect.objectContaining({ code: "count" }));
    expect(
      validateUploadCandidate(
        { type: "image/jpeg", size: 100 },
        0,
        IMAGE_POLICY.maxAccountBytes,
      ),
    ).toContainEqual(expect.objectContaining({ code: "quota" }));
  });

  it("trusts decoded format and dimensions rather than the claimed MIME", () => {
    expect(
      validateDecodedImage({ format: "jpeg", width: 2400, height: 1600, pages: 1 }),
    ).toEqual([]);
    expect(
      validateDecodedImage({ format: "svg", width: 100, height: 100, pages: 1 }),
    ).toContainEqual(expect.objectContaining({ code: "decoded-type" }));
    expect(
      validateDecodedImage({ format: "gif", width: 100, height: 100, pages: 2 }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "decoded-type" })]),
    );
  });

  it("rejects excessive dimensions, pixels, and animation", () => {
    expect(
      validateDecodedImage({ format: "jpeg", width: 20_000, height: 100, pages: 1 }),
    ).toContainEqual(expect.objectContaining({ code: "dimensions" }));
    expect(
      validateDecodedImage({ format: "jpeg", width: 10_000, height: 5_000, pages: 1 }),
    ).toContainEqual(expect.objectContaining({ code: "pixels" }));
    expect(
      validateDecodedImage({ format: "webp", width: 800, height: 600, pages: 2 }),
    ).toContainEqual(expect.objectContaining({ code: "animation" }));
  });

  it("never includes an original filename in object paths", () => {
    expect(buildStagingPath(ids)).toBe(
      `${ids.user}/${ids.listing}/${ids.image}.upload`,
    );
    expect(buildDerivativePath(ids)).toBe(
      `${ids.user}/${ids.listing}/${ids.image}/${ids.generation}.webp`,
    );
    expect(buildDerivativePath(ids)).not.toMatch(/passport|\.jpg$/i);
  });
});

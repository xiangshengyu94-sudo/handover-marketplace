import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { ImageProcessingError, sanitizeImageBuffer } from "@/lib/images/process";

describe("image sanitization", () => {
  it("rotates, bounds, converts, and strips EXIF metadata", async () => {
    const original = await sharp({
      create: {
        width: 2_400,
        height: 1_200,
        channels: 3,
        background: "#d8eadf",
      },
    })
      .jpeg()
      .withExif({
        IFD0: { Copyright: "private source", Orientation: "6" },
        GPS: { GPSLatitudeRef: "N", GPSLongitudeRef: "W" },
      } as never)
      .toBuffer();

    const result = await sanitizeImageBuffer(original);
    const metadata = await sharp(result.buffer).metadata();

    expect(result.format).toBe("webp");
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1_600);
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
  });

  it("rejects active SVG content even if it claims to be an image", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="20" height="20"/></svg>',
    );
    await expect(sanitizeImageBuffer(svg)).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("maps corrupt input to a bounded public error", async () => {
    await expect(sanitizeImageBuffer(Buffer.from("not an image"))).rejects.toBeInstanceOf(
      ImageProcessingError,
    );
  });
});

import "server-only";

import { timingSafeEqual } from "node:crypto";

export function matchesBearerSecret(request: Request, expected: string) {
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

import "server-only";

import { createHash, createHmac } from "node:crypto";
import { readServerEnv } from "@/lib/env";

export function deriveContactIntentToken(senderId: string, requestKey: string) {
  return createHmac("sha256", readServerEnv().abuseHashSecret).update(`contact-intent:${senderId}:${requestKey}`, "utf8").digest("base64url");
}

export function hashContactIntentToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

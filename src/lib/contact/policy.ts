import { createHash } from "node:crypto";
import { z } from "zod";

export const contactMessageSchema = z.string().trim().min(20).max(2_000);
export const contactRequestSchema = z.object({
  message: contactMessageSchema,
  consent: z.literal(true),
  requestKey: z.uuid(),
  captchaToken: z.string().max(2_048).optional(),
}).strict();

export function digestContactPayload(listingId: string, message: string) {
  return createHash("sha256").update(JSON.stringify({ listingId, message: message.trim() }), "utf8").digest("hex");
}

export function publicDeliveryState(status: string) {
  if (["queued", "sending", "retrying"].includes(status)) return "queued";
  if (["accepted", "delayed", "delivered", "bounced", "suppressed", "failed"].includes(status)) return status;
  return "queued";
}

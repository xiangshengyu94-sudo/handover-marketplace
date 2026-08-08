import { z } from "zod";

export const memberReportSchema = z.object({ listingId: z.uuid(), reason: z.enum(["fraud", "spam", "inaccuracy", "expired", "impersonation", "discrimination", "privacy", "prohibited-item"]), details: z.string().trim().min(30).max(4_000) }).strict();
export const illegalNoticeSchema = z.object({ listingId: z.uuid().nullable(), category: z.enum(["illegal-content", "privacy", "unsafe-housing", "prohibited-item", "other"]), explanation: z.string().trim().min(80).max(5_000), goodFaithAttested: z.literal(true) }).strict();
export const taxonomyRequestSchema = z.discriminatedUnion("entityType", [
  z.object({ entityType: z.literal("city"), payload: z.object({ slug: slug(), name: z.string().trim().min(2).max(120), countryCode: z.string().regex(/^[A-Z]{2}$/), timezone: z.string().min(3).max(80) }).strict() }).strict(),
  z.object({ entityType: z.literal("organization"), payload: z.object({ cityId: z.uuid().nullable(), slug: slug(), name: z.string().trim().min(2).max(160) }).strict() }).strict(),
  z.object({ entityType: z.literal("category"), payload: z.object({ kind: z.enum(["housing", "item"]), slug: slug(), label: z.string().trim().min(2).max(100) }).strict() }).strict(),
]);

function slug() { return z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80); }

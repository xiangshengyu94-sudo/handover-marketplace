import { z } from "zod";

import { createListingInputSchema } from "@/lib/listings/schema";
import type { ListingKind } from "@/lib/taxonomy/schema";

type CategoryReference = { id: string; kind: ListingKind };

export function createAssistedInputSchema(categories: readonly CategoryReference[]) {
  return z.object({
    authorEmail: z.email().trim().toLowerCase().max(254),
    sourceLabel: z.string().trim().min(2).max(120).refine((value) => !/(?:https?:\/\/|www\.|chat\.whatsapp\.com|facebook\.com\/groups)/i.test(value), "Use a short source label, not a group link"),
    authorizationAttested: z.literal(true),
    listing: createListingInputSchema(categories),
  }).strict().refine(({ listing }) => listing.source === "assisted", { path: ["listing", "source"], message: "Assisted intake must use the assisted source" });
}

export type AssistedInput = z.infer<ReturnType<typeof createAssistedInputSchema>>;

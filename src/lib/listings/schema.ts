import { z } from "zod";

import { listingKindSchema, type ListingKind } from "@/lib/taxonomy/schema";

const uuidSchema = z.uuid();

const commonListingFields = {
  title: z.string().trim().min(8).max(120),
  description: z.string().trim().min(20).max(4_000),
  cityId: uuidSchema,
  organizationIds: z
    .array(uuidSchema)
    .max(8)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Organization tags must be unique",
    ),
  resourceCategoryId: uuidSchema,
  priceAmount: z.number().finite().min(0).max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  approximateArea: z.string().trim().min(2).max(120),
  availableFrom: z.iso.date(),
  expiresAt: z.iso.datetime({ offset: true }),
  source: z.enum(["self", "assisted"]),
} as const;

const housingListingSchema = z
  .object({
    ...commonListingFields,
    kind: z.literal("housing"),
    housing: z
      .object({
        furnished: z.boolean(),
        billsIncluded: z.boolean(),
        publicationRightsAcknowledged: z.literal(true),
        permissionAcknowledged: z.literal(true),
        safetyWarningAcknowledged: z.literal(true),
      })
      .strict(),
  })
  .strict();

const itemListingSchema = z
  .object({
    ...commonListingFields,
    kind: z.literal("item"),
    item: z
      .object({
        condition: z.enum(["new", "like-new", "good", "fair", "poor"]),
        quantity: z.number().int().min(1).max(100),
        pickupArea: z.string().trim().min(2).max(120),
        isGiveaway: z.boolean(),
      })
      .strict(),
  })
  .strict();

type CategoryReference = { id: string; kind: ListingKind };

export function createListingInputSchema(categories: readonly CategoryReference[]) {
  const categoryKinds = new Map(categories.map(({ id, kind }) => [id, kind]));

  return z
    .discriminatedUnion("kind", [housingListingSchema, itemListingSchema])
    .superRefine((listing, context) => {
      const categoryKind = categoryKinds.get(listing.resourceCategoryId);
      if (categoryKind !== listing.kind) {
        context.addIssue({
          code: "custom",
          path: ["resourceCategoryId"],
          message: `Selected category does not belong to ${listing.kind}`,
        });
      }

      if (new Date(listing.expiresAt) <= new Date(`${listing.availableFrom}T00:00:00Z`)) {
        context.addIssue({
          code: "custom",
          path: ["expiresAt"],
          message: "Expiry must be after availability begins",
        });
      }

      if (listing.kind === "item") {
        if (listing.item.isGiveaway && listing.priceAmount !== 0) {
          context.addIssue({
            code: "custom",
            path: ["priceAmount"],
            message: "Giveaway items must have a zero price",
          });
        }

        if (!listing.item.isGiveaway && listing.priceAmount === 0) {
          context.addIssue({
            code: "custom",
            path: ["priceAmount"],
            message: "Non-giveaway items must have a positive price",
          });
        }
      }
    });
}

export const listingKindInputSchema = listingKindSchema;
export type ListingInput = z.infer<ReturnType<typeof createListingInputSchema>>;

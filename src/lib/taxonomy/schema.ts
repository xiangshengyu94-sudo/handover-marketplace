import { z } from "zod";

export const taxonomyStatusSchema = z.enum(["active", "retired"]);
export const listingKindSchema = z.enum(["housing", "item", "other"]);

const uuidSchema = z.uuid();
const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}

export const citySchema = z
  .object({
    id: uuidSchema,
    slug: slugSchema,
    name: z.string().trim().min(2).max(120),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    timezone: z.string().refine(isIanaTimezone, "Unknown IANA timezone"),
    status: taxonomyStatusSchema,
  })
  .strict();

export const organizationSchema = z
  .object({
    id: uuidSchema,
    cityId: uuidSchema.nullable(),
    slug: slugSchema,
    name: z.string().trim().min(2).max(160),
    status: taxonomyStatusSchema,
  })
  .strict();

export const resourceCategorySchema = z
  .object({
    id: uuidSchema,
    slug: slugSchema,
    label: z.string().trim().min(2).max(100),
    kind: listingKindSchema,
    status: taxonomyStatusSchema,
  })
  .strict();

export type City = z.infer<typeof citySchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type ResourceCategory = z.infer<typeof resourceCategorySchema>;
export type ListingKind = z.infer<typeof listingKindSchema>;

export function canAssignTaxonomy(value: { status: z.infer<typeof taxonomyStatusSchema> }) {
  return value.status === "active";
}

export function organizationMatchesCity(
  organization: Pick<Organization, "cityId">,
  cityId: string,
) {
  return organization.cityId === null || organization.cityId === cityId;
}

import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
export const listingFilterSchema = z.object({
  city: slug.optional(),
  organization: slug.optional(),
  kind: z.enum(["housing", "item"]).optional(),
  category: slug.optional(),
  maxPrice: z.coerce.number().finite().min(0).max(1_000_000).optional(),
  availableBy: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type ListingFilters = z.infer<typeof listingFilterSchema>;

export function parseListingFilters(input: Record<string, string | string[] | undefined>) {
  const single = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const result = listingFilterSchema.safeParse(single);
  return result.success ? result.data : listingFilterSchema.parse({});
}

export function activeFilterCount(filters: ListingFilters) {
  return [filters.city, filters.organization, filters.kind, filters.category, filters.maxPrice, filters.availableBy].filter((value) => value !== undefined).length;
}

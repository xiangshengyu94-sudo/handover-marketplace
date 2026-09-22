import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const blankToUndefined = (value: unknown) => value === "" ? undefined : value;

export const listingFilterSchema = z.object({
  city: z.preprocess(blankToUndefined, slug.optional()),
  organization: z.preprocess(blankToUndefined, slug.optional()),
  kind: z.preprocess(blankToUndefined, z.enum(["housing", "item", "other"]).optional()),
  category: z.preprocess(blankToUndefined, slug.optional()),
  maxPrice: z.preprocess(blankToUndefined, z.coerce.number().finite().min(0).max(1_000_000).optional()),
  availableBy: z.preprocess(blankToUndefined, z.iso.date().optional()),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
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

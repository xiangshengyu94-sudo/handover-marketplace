import type { ListingKind } from "@/lib/taxonomy/schema";

import { createListingInputSchema } from "./schema";

type CategoryReference = { id: string; kind: ListingKind };

export function parseListingFormData(
  formData: FormData,
  categories: readonly CategoryReference[],
) {
  const kind = formData.get("kind");
  const common = {
    kind,
    title: text(formData, "title"),
    description: text(formData, "description"),
    cityId: text(formData, "cityId"),
    organizationIds: formData.getAll("organizationIds").map(String),
    resourceCategoryId: text(formData, "resourceCategoryId"),
    priceAmount: number(formData, "priceAmount"),
    currency: text(formData, "currency").toUpperCase(),
    approximateArea: text(formData, "approximateArea"),
    availableFrom: text(formData, "availableFrom"),
    expiresAt: expiry(text(formData, "expiresOn")),
    source: "self" as const,
  };

  const candidate = kind === "housing"
    ? {
          ...common,
          kind,
          housing: {
            subtype: text(formData, "housingSubtype"),
            furnished: formData.has("furnished"),
            billsIncluded: formData.has("billsIncluded"),
            publicationRightsAcknowledged: formData.has(
              "publicationRightsAcknowledged",
            ),
            permissionAcknowledged: formData.has("permissionAcknowledged"),
            safetyWarningAcknowledged: formData.has(
              "safetyWarningAcknowledged",
            ),
          },
        }
    : kind === "item"
      ? {
          ...common,
          kind,
          item: {
            condition: text(formData, "condition"),
            quantity: number(formData, "quantity"),
            pickupArea: text(formData, "pickupArea"),
            isGiveaway: formData.has("isGiveaway"),
          },
        }
      : { ...common, kind };

  return createListingInputSchema(categories).safeParse(candidate);
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function number(formData: FormData, name: string) {
  const value = text(formData, name);
  return value.trim() ? Number(value) : Number.NaN;
}

function expiry(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

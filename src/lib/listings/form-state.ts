export type ListingActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  listingId?: string;
  version?: number;
  status?: "draft" | "active" | "reserved";
};

export const initialListingActionState: ListingActionState = {};

export type StagedImage = {
  imageId: string;
  storagePath: string;
  generation: string;
  status: "staged";
};

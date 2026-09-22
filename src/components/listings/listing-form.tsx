"use client";

import { useActionState, useState, type ComponentType } from "react";

import { saveListingAction } from "@/app/(member)/listings/actions";
import { IsoDateInput } from "@/components/forms/iso-date-input";
import { BRAND_NAME } from "@/lib/brand";
import {
  initialListingActionState,
  type ListingActionState,
} from "@/lib/listings/form-state";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { ListingKind } from "@/lib/taxonomy/schema";

import { ImageUploader } from "./image-uploader";
import { ShareKit } from "./share-kit";

type Option = { id: string; name?: string; label?: string; kind?: ListingKind; city_id?: string | null };

type DetailsFieldsProps = {
  initial: ListingFormValue;
  fieldError: (name: string) => string | undefined;
  dictionary: Dictionary;
};

export type ListingFormValue = {
  id?: string;
  version?: number;
  kind?: ListingKind;
  title?: string;
  description?: string;
  cityId?: string;
  organizationIds?: string[];
  resourceCategoryId?: string;
  priceAmount?: number;
  currency?: string;
  approximateArea?: string;
  availableFrom?: string;
  expiresOn?: string;
  housingSubtype?: string;
  furnished?: boolean;
  billsIncluded?: boolean;
  condition?: string;
  quantity?: number;
  pickupArea?: string;
  isGiveaway?: boolean;
};

export function ListingForm({
  cities,
  organizations,
  categories,
  initial = {},
  dictionary,
}: {
  cities: Option[];
  organizations: Option[];
  categories: Option[];
  initial?: ListingFormValue;
  dictionary: Dictionary;
}) {
  const [state, action, pending] = useActionState<ListingActionState, FormData>(
    saveListingAction,
    initialListingActionState,
  );
  const [kind, setKind] = useState<ListingKind>(initial.kind ?? "housing");
  const [cityId, setCityId] = useState(initial.cityId ?? "");
  const listingId = state.listingId ?? initial.id;
  const version = state.version ?? initial.version;
  const kindCopy = {
    housing: {
      detailsTitle: dictionary.listingHousingDetails,
      timingTitle: dictionary.listingPriceTiming,
      priceLabel: dictionary.listingMonthlyPrice,
      availableFromLabel: dictionary.listingAvailableFrom,
    },
    item: {
      detailsTitle: dictionary.listingItemDetails,
      timingTitle: dictionary.listingPriceTiming,
      priceLabel: dictionary.listingPrice,
      availableFromLabel: dictionary.listingAvailableFrom,
    },
    other: {
      detailsTitle: dictionary.listingOtherDetails,
      timingTitle: dictionary.listingInfoTiming,
      priceLabel: dictionary.listingInfoPrice,
      availableFromLabel: dictionary.listingInfoAvailableFrom,
    },
  } satisfies Record<ListingKind, {
    detailsTitle: string;
    timingTitle: string;
    priceLabel: string;
    availableFromLabel: string;
  }>;
  const copy = kindCopy[kind];
  const DetailsFields = DETAILS_FIELDS_BY_KIND[kind];

  const fieldError = (name: string) => state.fieldErrors?.[name]?.join(" ");
  const visibleOrganizations = organizations.filter(
    (organization) => !organization.city_id || organization.city_id === cityId,
  );
  const visibleCategories = categories.filter((category) => category.kind === kind);

  return (
    <form action={action} className="listing-form">
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      <fieldset className="kind-picker">
        <legend>{dictionary.listingQuestion}</legend>
        <label className={kind === "housing" ? "selected" : ""}>
          <input type="radio" name="kind" value="housing" checked={kind === "housing"} onChange={() => setKind("housing")} />
          <span>{dictionary.listingHousing}</span><small>{dictionary.listingHousingHelp}</small>
        </label>
        <label className={kind === "item" ? "selected" : ""}>
          <input type="radio" name="kind" value="item" checked={kind === "item"} onChange={() => setKind("item")} />
          <span>{dictionary.listingItem}</span><small>{dictionary.listingItemHelp}</small>
        </label>
        <label className={kind === "other" ? "selected" : ""}>
          <input type="radio" name="kind" value="other" checked={kind === "other"} onChange={() => setKind("other")} />
          <span>{dictionary.listingCommunityInfo}</span><small>{dictionary.listingOtherHelp}</small>
        </label>
      </fieldset>

      <section className="form-section" aria-labelledby="basics-title">
        <div><p className="section-number">01</p><h2 id="basics-title">{dictionary.listingEssentials}</h2></div>
        <Field label={dictionary.listingFieldTitle} name="title" error={fieldError("title")}>
          <input id="title" name="title" defaultValue={initial.title} minLength={8} maxLength={120} required />
        </Field>
        <Field label={dictionary.listingDescription} name="description" error={fieldError("description")} hint={dictionary.listingDescriptionHint}>
          <textarea id="description" name="description" defaultValue={initial.description} minLength={20} maxLength={4000} rows={6} required />
        </Field>
      </section>

      <section className="form-section" aria-labelledby="context-title">
        <div><p className="section-number">02</p><h2 id="context-title">{dictionary.listingCommunity}</h2></div>
        <div className="field-grid">
          <Field label={dictionary.listingCity} name="cityId" error={fieldError("cityId")}>
            <select id="cityId" name="cityId" value={cityId} onChange={(event) => setCityId(event.target.value)} required>
              <option value="">{dictionary.listingChooseCity}</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </Field>
          <Field label={dictionary.listingCategory} name="resourceCategoryId" error={fieldError("resourceCategoryId")}>
            <select id="resourceCategoryId" name="resourceCategoryId" defaultValue={initial.resourceCategoryId ?? ""} required>
              <option value="">{dictionary.listingChooseCategory}</option>
              {visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </Field>
        </div>
        <fieldset className="check-grid">
          <legend>{dictionary.listingOrganizationTags} <span>({dictionary.listingOptionalTags})</span></legend>
          {visibleOrganizations.length ? visibleOrganizations.map((organization) => (
            <label key={organization.id}>
              <input type="checkbox" name="organizationIds" value={organization.id} defaultChecked={initial.organizationIds?.includes(organization.id)} />
              {organization.name}
            </label>
          )) : <p className="form-note">{dictionary.listingChooseCityOrganizations}</p>}
        </fieldset>
      </section>

      <section className="form-section" aria-labelledby="details-title">
        <div><p className="section-number">03</p><h2 id="details-title">{copy.detailsTitle}</h2></div>
        <DetailsFields initial={initial} fieldError={fieldError} dictionary={dictionary} />
      </section>

      <section className="form-section" aria-labelledby="timing-title">
        <div><p className="section-number">04</p><h2 id="timing-title">{copy.timingTitle}</h2></div>
        <div className="field-grid">
          <Field label={copy.priceLabel} name="priceAmount" error={fieldError("priceAmount")}>
            <input id="priceAmount" name="priceAmount" type="number" min="0" max="1000000" step="0.01" defaultValue={initial.priceAmount ?? 0} required />
          </Field>
          <Field label={dictionary.listingCurrency} name="currency" error={fieldError("currency")}>
            <select id="currency" name="currency" defaultValue={initial.currency ?? "EUR"}><option>EUR</option><option>GBP</option><option>USD</option></select>
          </Field>
          <Field label={copy.availableFromLabel} name="availableFrom" error={fieldError("availableFrom")}>
            <IsoDateInput id="availableFrom" name="availableFrom" defaultValue={initial.availableFrom} required />
          </Field>
          <Field label={dictionary.listingExpires} name="expiresOn" error={fieldError("expiresAt")} hint={dictionary.listingExpiryHint}>
            <IsoDateInput id="expiresOn" name="expiresOn" defaultValue={initial.expiresOn} required />
          </Field>
        </div>
      </section>

      <section className="form-section" aria-labelledby="images-title">
        <div><p className="section-number">05</p><h2 id="images-title">{dictionary.listingPhotos}</h2></div>
        <ImageUploader listingId={listingId} />
      </section>

      <div className="form-actions">
        <p role="status" aria-live="polite" className={state.error ? "form-error" : "form-note"}>
          {state.error ?? (state.ok ? (state.status === "active" ? dictionary.listingPublished : dictionary.listingDraftSaved) : dictionary.listingSaveBeforePhotos)}
        </p>
        <div className="button-row">
          <button className="button-secondary" name="intent" value="draft" disabled={pending}>{dictionary.listingSaveDraft}</button>
          <button className="button-primary" name="intent" value="publish" disabled={pending}>{dictionary.listingPublish}</button>
        </div>
      </div>
      {state.status === "active" && listingId ? <ShareKit listingId={listingId} title={initial.title ?? `${BRAND_NAME} listing`} /> : null}
    </form>
  );
}

function HousingFields({ initial, fieldError, dictionary }: { initial: ListingFormValue; fieldError: (name: string) => string | undefined; dictionary: Dictionary }) {
  return <>
    <div className="field-grid">
      <Field label={dictionary.listingHousingType} name="housingSubtype" error={fieldError("housing") ?? fieldError("housingSubtype")}>
        <select id="housingSubtype" name="housingSubtype" defaultValue={initial.housingSubtype ?? "room"}>
          <option value="room">{dictionary.listingRoom}</option><option value="shared-room">{dictionary.listingSharedRoom}</option><option value="studio">{dictionary.listingStudio}</option><option value="entire-place">{dictionary.listingEntirePlace}</option><option value="sublet">{dictionary.listingSublet}</option><option value="other">{dictionary.listingOther}</option>
        </select>
      </Field>
      <Field label={dictionary.listingArea} name="approximateArea" error={fieldError("approximateArea")}>
        <input id="approximateArea" name="approximateArea" defaultValue={initial.approximateArea} required />
      </Field>
    </div>
    <div className="check-grid">
      <label><input type="checkbox" name="furnished" defaultChecked={initial.furnished} /> {dictionary.listingFurnished}</label>
      <label><input type="checkbox" name="billsIncluded" defaultChecked={initial.billsIncluded} /> {dictionary.listingBillsIncluded}</label>
    </div>
    <aside className="safety-callout"><strong>{dictionary.listingHousingSafety}</strong><p>{dictionary.listingHousingSafetyBody}</p></aside>
    <div className="acknowledgements">
      <label><input type="checkbox" name="publicationRightsAcknowledged" required /> {dictionary.listingRightsAck}</label>
      <label><input type="checkbox" name="permissionAcknowledged" required /> {dictionary.listingPermissionAck}</label>
      <label><input type="checkbox" name="safetyWarningAcknowledged" required /> {dictionary.listingTenancyAck}</label>
    </div>
  </>;
}

function ItemFields({ initial, fieldError, dictionary }: { initial: ListingFormValue; fieldError: (name: string) => string | undefined; dictionary: Dictionary }) {
  return <>
    <div className="field-grid">
      <Field label={dictionary.listingCondition} name="condition" error={fieldError("item") ?? fieldError("condition")}>
        <select id="condition" name="condition" defaultValue={initial.condition ?? "good"}><option value="new">{dictionary.listingNew}</option><option value="like-new">{dictionary.listingLikeNew}</option><option value="good">{dictionary.listingGood}</option><option value="fair">{dictionary.listingFair}</option><option value="poor">{dictionary.listingPoor}</option></select>
      </Field>
      <Field label={dictionary.listingQuantity} name="quantity" error={fieldError("quantity")}><input id="quantity" name="quantity" type="number" min="1" max="100" defaultValue={initial.quantity ?? 1} required /></Field>
      <Field label={dictionary.listingPickupArea} name="pickupArea" error={fieldError("pickupArea")} hint={dictionary.listingPickupHint}><input id="pickupArea" name="pickupArea" defaultValue={initial.pickupArea} required /></Field>
    </div>
    <input type="hidden" name="approximateArea" value={initial.approximateArea ?? "City pickup"} />
    <label className="giveaway"><input type="checkbox" name="isGiveaway" defaultChecked={initial.isGiveaway} /> {dictionary.listingGiveaway}</label>
    <aside className="safety-callout"><strong>{dictionary.listingItemSafety}</strong><p>{dictionary.listingItemSafetyBody}</p></aside>
  </>;
}

function OtherFields({ initial, fieldError, dictionary }: { initial: ListingFormValue; fieldError: (name: string) => string | undefined; dictionary: Dictionary }) {
  return <>
    <Field label={dictionary.listingArea} name="approximateArea" error={fieldError("approximateArea")}>
      <input id="approximateArea" name="approximateArea" defaultValue={initial.approximateArea} required />
    </Field>
    <aside className="safety-callout"><strong>{dictionary.listingOtherSafety}</strong><p>{dictionary.listingOtherSafetyBody}</p></aside>
  </>;
}

const DETAILS_FIELDS_BY_KIND = {
  housing: HousingFields,
  item: ItemFields,
  other: OtherFields,
} satisfies Record<ListingKind, ComponentType<DetailsFieldsProps>>;

function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: React.ReactNode }) {
  const describedBy = [hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;
  return <div className="field"><label htmlFor={name}>{label}</label><div aria-describedby={describedBy}>{children}</div>{hint ? <small id={`${name}-hint`}>{hint}</small> : null}{error ? <p id={`${name}-error`} className="form-error">{error}</p> : null}</div>;
}

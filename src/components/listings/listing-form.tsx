"use client";

import { useActionState, useState } from "react";

import { saveListingAction } from "@/app/(member)/listings/actions";
import {
  initialListingActionState,
  type ListingActionState,
} from "@/lib/listings/form-state";

import { ImageUploader } from "./image-uploader";
import { ShareKit } from "./share-kit";

type Option = { id: string; name?: string; label?: string; kind?: "housing" | "item"; city_id?: string | null };

export type ListingFormValue = {
  id?: string;
  version?: number;
  kind?: "housing" | "item";
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
}: {
  cities: Option[];
  organizations: Option[];
  categories: Option[];
  initial?: ListingFormValue;
}) {
  const [state, action, pending] = useActionState<ListingActionState, FormData>(
    saveListingAction,
    initialListingActionState,
  );
  const [kind, setKind] = useState<"housing" | "item">(initial.kind ?? "housing");
  const [cityId, setCityId] = useState(initial.cityId ?? "");
  const listingId = state.listingId ?? initial.id;
  const version = state.version ?? initial.version;

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
        <legend>What are you handing over?</legend>
        <label className={kind === "housing" ? "selected" : ""}>
          <input type="radio" name="kind" value="housing" checked={kind === "housing"} onChange={() => setKind("housing")} />
          <span>Housing</span><small>A room, studio, or whole place</small>
        </label>
        <label className={kind === "item" ? "selected" : ""}>
          <input type="radio" name="kind" value="item" checked={kind === "item"} onChange={() => setKind("item")} />
          <span>Item</span><small>Furniture, bicycle, or daily essentials</small>
        </label>
      </fieldset>

      <section className="form-section" aria-labelledby="basics-title">
        <div><p className="section-number">01</p><h2 id="basics-title">The essentials</h2></div>
        <Field label="Title" name="title" error={fieldError("title")}>
          <input id="title" name="title" defaultValue={initial.title} minLength={8} maxLength={120} required />
        </Field>
        <Field label="Description" name="description" error={fieldError("description")} hint="Keep email, phone numbers, private-group links, and exact addresses out of public text.">
          <textarea id="description" name="description" defaultValue={initial.description} minLength={20} maxLength={4000} rows={6} required />
        </Field>
      </section>

      <section className="form-section" aria-labelledby="context-title">
        <div><p className="section-number">02</p><h2 id="context-title">City & community</h2></div>
        <div className="field-grid">
          <Field label="City" name="cityId" error={fieldError("cityId")}>
            <select id="cityId" name="cityId" value={cityId} onChange={(event) => setCityId(event.target.value)} required>
              <option value="">Choose a city</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </Field>
          <Field label="Resource category" name="resourceCategoryId" error={fieldError("resourceCategoryId")}>
            <select id="resourceCategoryId" name="resourceCategoryId" defaultValue={initial.resourceCategoryId ?? ""} required>
              <option value="">Choose a category</option>
              {visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </Field>
        </div>
        <fieldset className="check-grid">
          <legend>Organization tags <span>(optional, up to 8)</span></legend>
          {visibleOrganizations.length ? visibleOrganizations.map((organization) => (
            <label key={organization.id}>
              <input type="checkbox" name="organizationIds" value={organization.id} defaultChecked={initial.organizationIds?.includes(organization.id)} />
              {organization.name}
            </label>
          )) : <p className="form-note">Choose a city to see matching organizations.</p>}
        </fieldset>
      </section>

      <section className="form-section" aria-labelledby="details-title">
        <div><p className="section-number">03</p><h2 id="details-title">{kind === "housing" ? "Housing details" : "Item details"}</h2></div>
        {kind === "housing" ? <HousingFields initial={initial} fieldError={fieldError} /> : <ItemFields initial={initial} fieldError={fieldError} />}
      </section>

      <section className="form-section" aria-labelledby="timing-title">
        <div><p className="section-number">04</p><h2 id="timing-title">Price & timing</h2></div>
        <div className="field-grid">
          <Field label={kind === "housing" ? "Monthly price" : "Price"} name="priceAmount" error={fieldError("priceAmount")}>
            <input id="priceAmount" name="priceAmount" type="number" min="0" max="1000000" step="0.01" defaultValue={initial.priceAmount ?? 0} required />
          </Field>
          <Field label="Currency" name="currency" error={fieldError("currency")}>
            <select id="currency" name="currency" defaultValue={initial.currency ?? "EUR"}><option>EUR</option><option>GBP</option><option>USD</option></select>
          </Field>
          <Field label="Available from" name="availableFrom" error={fieldError("availableFrom")}>
            <input id="availableFrom" name="availableFrom" type="date" defaultValue={initial.availableFrom} required />
          </Field>
          <Field label="Listing expires" name="expiresOn" error={fieldError("expiresAt")} hint="Expired listings disappear even if scheduled cleanup is delayed.">
            <input id="expiresOn" name="expiresOn" type="date" defaultValue={initial.expiresOn} required />
          </Field>
        </div>
      </section>

      <section className="form-section" aria-labelledby="images-title">
        <div><p className="section-number">05</p><h2 id="images-title">Photos</h2></div>
        <ImageUploader listingId={listingId} />
      </section>

      <div className="form-actions">
        <p role="status" aria-live="polite" className={state.error ? "form-error" : "form-note"}>
          {state.error ?? (state.ok ? (state.status === "active" ? "Published." : "Draft saved. You can now add photos.") : "Save a draft before uploading photos.")}
        </p>
        <div className="button-row">
          <button className="button-secondary" name="intent" value="draft" disabled={pending}>Save draft</button>
          <button className="button-primary" name="intent" value="publish" disabled={pending}>Publish listing</button>
        </div>
      </div>
      {state.status === "active" && listingId ? <ShareKit listingId={listingId} title={initial.title ?? "Handover listing"} /> : null}
    </form>
  );
}

function HousingFields({ initial, fieldError }: { initial: ListingFormValue; fieldError: (name: string) => string | undefined }) {
  return <>
    <div className="field-grid">
      <Field label="Housing type" name="housingSubtype" error={fieldError("housing") ?? fieldError("housingSubtype")}>
        <select id="housingSubtype" name="housingSubtype" defaultValue={initial.housingSubtype ?? "room"}>
          <option value="room">Room</option><option value="shared-room">Shared room</option><option value="studio">Studio</option><option value="entire-place">Entire place</option><option value="sublet">Sublet</option><option value="other">Other</option>
        </select>
      </Field>
      <Field label="Neighborhood / broad area" name="approximateArea" error={fieldError("approximateArea")}>
        <input id="approximateArea" name="approximateArea" defaultValue={initial.approximateArea} required />
      </Field>
    </div>
    <div className="check-grid">
      <label><input type="checkbox" name="furnished" defaultChecked={initial.furnished} /> Furnished</label>
      <label><input type="checkbox" name="billsIncluded" defaultChecked={initial.billsIncluded} /> Bills included</label>
    </div>
    <aside className="safety-callout"><strong>Housing safety</strong><p>Never send a deposit before independently verifying the place, identity, and authority to offer it.</p></aside>
    <div className="acknowledgements">
      <label><input type="checkbox" name="publicationRightsAcknowledged" required /> I have the right to publish this information.</label>
      <label><input type="checkbox" name="permissionAcknowledged" required /> I have permission to arrange this handover.</label>
      <label><input type="checkbox" name="safetyWarningAcknowledged" required /> I understand this is not a tenancy guarantee.</label>
    </div>
  </>;
}

function ItemFields({ initial, fieldError }: { initial: ListingFormValue; fieldError: (name: string) => string | undefined }) {
  return <>
    <div className="field-grid">
      <Field label="Condition" name="condition" error={fieldError("item") ?? fieldError("condition")}>
        <select id="condition" name="condition" defaultValue={initial.condition ?? "good"}><option value="new">New</option><option value="like-new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></select>
      </Field>
      <Field label="Quantity" name="quantity" error={fieldError("quantity")}><input id="quantity" name="quantity" type="number" min="1" max="100" defaultValue={initial.quantity ?? 1} required /></Field>
      <Field label="Pickup area" name="pickupArea" error={fieldError("pickupArea")} hint="Use a neighborhood or public meeting area, not an exact address."><input id="pickupArea" name="pickupArea" defaultValue={initial.pickupArea} required /></Field>
    </div>
    <input type="hidden" name="approximateArea" value={initial.approximateArea ?? "City pickup"} />
    <label className="giveaway"><input type="checkbox" name="isGiveaway" defaultChecked={initial.isGiveaway} /> This item is free (set price to 0)</label>
    <aside className="safety-callout"><strong>Item safety</strong><p>Meet in a public place when possible. Inspect the item before paying and avoid unusual payment requests.</p></aside>
  </>;
}

function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: React.ReactNode }) {
  const describedBy = [hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined;
  return <div className="field"><label htmlFor={name}>{label}</label><div aria-describedby={describedBy}>{children}</div>{hint ? <small id={`${name}-hint`}>{hint}</small> : null}{error ? <p id={`${name}-error`} className="form-error">{error}</p> : null}</div>;
}

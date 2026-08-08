"use client";

import { useState } from "react";

import { removeListingImageAction, stageListingImageAction } from "@/app/(member)/listings/actions";
import { IMAGE_POLICY, validateUploadCandidate } from "@/lib/images/policy";
import { createClient } from "@/lib/supabase/client";

type Upload = { imageId: string; generation: string; name: string; status: "uploading" | "processing" | "ready" | "failed"; remote: boolean; error?: string };

export function ImageUploader({ listingId }: { listingId?: string }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files || !listingId) return;
    setBusy(true);
    const candidates = Array.from(files).slice(0, IMAGE_POLICY.maxImagesPerListing - uploads.length);
    for (const [offset, file] of candidates.entries()) {
      const [issue] = validateUploadCandidate({ type: file.type, size: file.size }, uploads.length, 0);
      if (issue) {
        setUploads((current) => [...current, { imageId: crypto.randomUUID(), generation: crypto.randomUUID(), name: file.name, status: "failed", remote: false, error: issue.message }]);
        continue;
      }
      const reserved = await stageListingImageAction({ listingId, sortOrder: uploads.length + offset, mediaType: file.type, byteSize: file.size });
      if (!reserved.image) {
        setUploads((current) => [...current, { imageId: crypto.randomUUID(), generation: crypto.randomUUID(), name: file.name, status: "failed", remote: false, error: reserved.error }]);
        continue;
      }
      const image = reserved.image;
      setUploads((current) => [...current, { imageId: image.imageId, generation: image.generation, name: file.name, status: "uploading", remote: true }]);
      const client = createClient();
      const { error } = await client.storage.from("listing-staging").upload(image.storagePath, file, { contentType: file.type, upsert: false });
      if (error) {
        setStatus(image.imageId, "failed", "Upload failed. Remove it and try again.");
        continue;
      }
      setStatus(image.imageId, "processing");
      const response = await fetch(`/api/listings/${listingId}/images/process`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId: image.imageId, generation: image.generation }),
      });
      setStatus(image.imageId, response.ok ? "ready" : "failed", response.ok ? undefined : "Processing failed. Remove it and try again.");
    }
    setBusy(false);
  }

  async function remove(upload: Upload) {
    if (upload.status !== "failed") return;
    if (!upload.remote) {
      setUploads((current) => current.filter(({ imageId }) => imageId !== upload.imageId));
      return;
    }
    if (!listingId) return;
    const result = await removeListingImageAction({ imageId: upload.imageId, generation: upload.generation });
    if (result.ok) setUploads((current) => current.filter(({ imageId }) => imageId !== upload.imageId));
  }

  function setStatus(imageId: string, status: Upload["status"], error?: string) {
    setUploads((current) => current.map((upload) => upload.imageId === imageId ? { ...upload, status, error } : upload));
  }

  return <div className="image-uploader">
    <p className="form-note">Up to 10 JPEG, PNG, or WebP photos, 8 MB each. Originals stay private; public views use sanitized copies.</p>
    <label className={`upload-dropzone ${!listingId ? "disabled" : ""}`}>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!listingId || busy} onChange={(event) => void addFiles(event.target.files)} />
      <strong>{listingId ? "Choose photos" : "Save a draft to add photos"}</strong>
      <span>Metadata and oversized dimensions are removed during processing.</span>
    </label>
    <ul className="upload-list" aria-live="polite">
      {uploads.map((upload) => <li key={upload.imageId}><span>{upload.name}</span><span className={`image-state ${upload.status}`}>{upload.error ?? upload.status}</span>{upload.status === "failed" ? <button type="button" className="button-quiet" onClick={() => void remove(upload)}>Remove</button> : null}</li>)}
    </ul>
  </div>;
}

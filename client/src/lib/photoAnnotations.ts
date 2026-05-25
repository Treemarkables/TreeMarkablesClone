// Client helpers for the photo-annotation API (URL-keyed, no photo.id
// needed — works on every photo in the app regardless of which table its
// URL came from).

import type { AnnotationShape } from "@/components/PhotoAnnotator";

export interface PhotoAnnotationRecord {
  id: string;
  sourceUrl: string;
  annotations: AnnotationShape[];
  annotatedUrl: string | null;
  annotatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Convert a data URL (returned by PhotoAnnotator's onSave) into a Blob the
 *  fetch API can upload. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mimeMatch = /data:([^;]+)/.exec(meta);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function savePhotoAnnotation(params: {
  sourceUrl: string;
  annotations: AnnotationShape[];
  dataUrl: string;
  annotatedBy?: string;
}): Promise<PhotoAnnotationRecord> {
  const fd = new FormData();
  fd.append("sourceUrl", params.sourceUrl);
  fd.append("annotations", JSON.stringify(params.annotations));
  if (params.annotatedBy) fd.append("annotatedBy", params.annotatedBy);
  fd.append("annotated", dataUrlToBlob(params.dataUrl), "annotated.png");

  const res = await fetch("/api/photo-annotations", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Save failed (${res.status})`);
  }
  const json = await res.json();
  return json.annotation;
}

export async function fetchPhotoAnnotation(
  sourceUrl: string,
): Promise<PhotoAnnotationRecord | null> {
  const res = await fetch(
    `/api/photo-annotations?sourceUrl=${encodeURIComponent(sourceUrl)}`,
    { credentials: "include" },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.annotation ?? null;
}

export async function clearPhotoAnnotation(sourceUrl: string): Promise<void> {
  await fetch(
    `/api/photo-annotations?sourceUrl=${encodeURIComponent(sourceUrl)}`,
    { method: "DELETE", credentials: "include" },
  );
}

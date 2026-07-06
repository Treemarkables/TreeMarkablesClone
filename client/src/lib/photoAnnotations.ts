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

export async function savePhotoAnnotation(params: {
  sourceUrl: string;
  annotations: AnnotationShape[];
  annotatedBy?: string;
}): Promise<PhotoAnnotationRecord> {
  // Server bakes the composite PNG from the shape JSON (see
  // server/photoAnnotationRenderer.ts). The client only sends data.
  const res = await fetch("/api/photo-annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      sourceUrl: params.sourceUrl,
      annotations: params.annotations,
      annotatedBy: params.annotatedBy,
    }),
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

// Batch variant: resolve many photos in a single request. Returns a map keyed
// by sourceUrl; URLs with no saved annotation are simply absent from the map.
// Used by thumbnail grids / the diary timeline / proposals so the baked
// annotated PNG shows everywhere, not just in the click-into viewer.
export async function fetchPhotoAnnotationsBatch(
  sourceUrls: string[],
): Promise<Record<string, PhotoAnnotationRecord>> {
  const unique = Array.from(new Set(sourceUrls.filter(Boolean)));
  if (unique.length === 0) return {};
  const res = await fetch("/api/photo-annotations/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sourceUrls: unique }),
  });
  if (!res.ok) return {};
  const json = await res.json();
  return json.annotations ?? {};
}

export async function clearPhotoAnnotation(sourceUrl: string): Promise<void> {
  await fetch(
    `/api/photo-annotations?sourceUrl=${encodeURIComponent(sourceUrl)}`,
    { method: "DELETE", credentials: "include" },
  );
}

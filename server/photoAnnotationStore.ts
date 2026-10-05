// Read/write photo_annotations under tenant RLS.
//
// The request-scoped `db` only sees rows whose business_id matches the
// session. Writes go through withTenant so the insert satisfies WITH CHECK.
// Rows saved before that stamp (business_id null) are claimed for the current
// tenant on the owner connection — they stay invisible otherwise, which is
// the "I saved the marks and they vanished" failure.

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db, ownerDb } from "./db";
import {
  currentAnnotationBusinessId,
  isHiddenAnnotationConflict,
  photoAnnotationWriteValues,
  type PhotoAnnotationWriteInput,
} from "./photoAnnotationWrite";

export type PhotoAnnotationRow = typeof schema.photoAnnotations.$inferSelect;

export async function upsertPhotoAnnotation(
  input: PhotoAnnotationWriteInput,
): Promise<PhotoAnnotationRow> {
  const values = photoAnnotationWriteValues(input);
  try {
    const [row] = await db
      .insert(schema.photoAnnotations)
      .values({
        sourceUrl: values.sourceUrl,
        annotations: values.annotations as PhotoAnnotationRow["annotations"],
        annotatedUrl: values.annotatedUrl,
        annotatedBy: values.annotatedBy,
        ...(values.businessId ? { businessId: values.businessId } : {}),
      })
      .onConflictDoUpdate({
        target: schema.photoAnnotations.sourceUrl,
        set: {
          annotations: values.annotations as PhotoAnnotationRow["annotations"],
          annotatedUrl: values.annotatedUrl,
          annotatedBy: values.annotatedBy,
          updatedAt: new Date(),
          ...(values.businessId ? { businessId: values.businessId } : {}),
        },
      })
      .returning();
    if (!row) throw new Error("Photo annotation save returned no row");
    return row;
  } catch (error) {
    if (!isHiddenAnnotationConflict(error)) throw error;
    const businessId = currentAnnotationBusinessId();
    if (!businessId) throw error;
    const [repaired] = await ownerDb
      .update(schema.photoAnnotations)
      .set({
        annotations: values.annotations as PhotoAnnotationRow["annotations"],
        annotatedUrl: values.annotatedUrl,
        annotatedBy: values.annotatedBy,
        businessId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.photoAnnotations.sourceUrl, input.sourceUrl),
          or(
            isNull(schema.photoAnnotations.businessId),
            eq(schema.photoAnnotations.businessId, businessId),
          ),
        ),
      )
      .returning();
    if (!repaired) throw error;
    return repaired;
  }
}

export async function findPhotoAnnotations(
  sourceUrls: string[],
): Promise<PhotoAnnotationRow[]> {
  const unique = Array.from(new Set(sourceUrls.filter((url) => url.length > 0)));
  if (unique.length === 0) return [];

  const visible = await db
    .select()
    .from(schema.photoAnnotations)
    .where(inArray(schema.photoAnnotations.sourceUrl, unique));

  const found = new Set(visible.map((row) => row.sourceUrl));
  const missing = unique.filter((url) => !found.has(url));
  const businessId = currentAnnotationBusinessId();
  if (!businessId || missing.length === 0) return visible;

  const legacy = await ownerDb
    .select()
    .from(schema.photoAnnotations)
    .where(
      and(
        inArray(schema.photoAnnotations.sourceUrl, missing),
        or(
          isNull(schema.photoAnnotations.businessId),
          eq(schema.photoAnnotations.businessId, businessId),
        ),
      ),
    );

  const unstampedIds = legacy.filter((row) => !row.businessId).map((row) => row.id);
  if (unstampedIds.length > 0) {
    await ownerDb
      .update(schema.photoAnnotations)
      .set({ businessId, updatedAt: new Date() })
      .where(inArray(schema.photoAnnotations.id, unstampedIds));
  }

  return [
    ...visible,
    ...legacy.map((row) => ({
      ...row,
      businessId: row.businessId ?? businessId,
    })),
  ];
}

export async function deletePhotoAnnotation(sourceUrl: string): Promise<void> {
  await db
    .delete(schema.photoAnnotations)
    .where(eq(schema.photoAnnotations.sourceUrl, sourceUrl));

  const businessId = currentAnnotationBusinessId();
  if (!businessId) return;
  await ownerDb
    .delete(schema.photoAnnotations)
    .where(
      and(
        eq(schema.photoAnnotations.sourceUrl, sourceUrl),
        or(
          isNull(schema.photoAnnotations.businessId),
          eq(schema.photoAnnotations.businessId, businessId),
        ),
      ),
    );
}

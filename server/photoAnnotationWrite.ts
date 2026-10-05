// Pure helpers for saving photo annotations.
//
// photo_annotations.business_id is covered by the tenant RLS policy. An insert
// that leaves business_id null fails the WITH CHECK, and a row that was saved
// before the policy (business_id null) is invisible to the tenant connection.
// Either way the editor closes and the photo looks unmarked. Stamping the
// current tenant on the write is what makes the row stick.

import { currentBusinessId, withTenant } from "./tenancy/tenantStore.ts";

export interface PhotoAnnotationWriteInput {
  sourceUrl: string;
  annotations: unknown;
  annotatedUrl: string;
  annotatedBy: string;
}

export function photoAnnotationWriteValues(input: PhotoAnnotationWriteInput) {
  return withTenant({
    sourceUrl: input.sourceUrl,
    annotations: input.annotations,
    annotatedUrl: input.annotatedUrl,
    annotatedBy: input.annotatedBy,
  });
}

export function currentAnnotationBusinessId(): string | undefined {
  return currentBusinessId();
}

function errorParts(error: unknown): { code: string; message: string } {
  const seen = new Set<unknown>();
  let code = "";
  let message = "";
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (!code && "code" in current && typeof current.code === "string") {
      code = current.code;
    }
    if (current instanceof Error && current.message) {
      message = message ? `${message} ${current.message}` : current.message;
    }
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return { code, message };
}

// Unique conflict against a row RLS hides, or a WITH CHECK rejection. The
// caller retries the write on the owner connection and stamps this tenant,
// but only onto a null or same-tenant row.
export function isHiddenAnnotationConflict(error: unknown): boolean {
  const { code, message } = errorParts(error);
  return (
    code === "23505" ||
    code === "42501" ||
    /row-level security/i.test(message) ||
    /duplicate key/i.test(message)
  );
}

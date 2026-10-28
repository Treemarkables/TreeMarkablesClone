/**
 * Edit mode shows job.description in an empty description block so the
 * builder matches the job card. That text is not stored on the proposal
 * until a save. Treating the filled block as the silent autosave baseline
 * marks the draft saved without a PUT, and send-email then rejects it
 * with "proposal has no description text".
 */

export interface LoadedSectionDescription {
  description: string;
  /** True when this block's text came from the job because the saved section was empty. */
  seededFromJob: boolean;
}

export function descriptionForLoadedSection(
  sectionDescription: string | null | undefined,
  blockType: string,
  jobDescription: string | null | undefined,
): LoadedSectionDescription {
  const saved = sectionDescription ?? "";
  const live = jobDescription ?? "";
  // A saved description wins, including one the builder already edited.
  // Only an empty description block is filled from the job, and only when
  // that job text would actually satisfy the send-email check.
  if (blockType === "description" && saved.trim().length === 0 && live.trim().length > 0) {
    return { description: live, seededFromJob: true };
  }
  return { description: saved, seededFromJob: false };
}

/**
 * The silent baseline is for a load that already matches the server.
 * A description seeded from the job still needs one save.
 */
export function shouldTakeSilentEditBaseline(anyDescriptionSeededFromJob: boolean): boolean {
  return !anyDescriptionSeededFromJob;
}

/**
 * Send waits for any queued save, then writes the current payload when
 * the draft is new, the snapshot changed, or the job-description seed
 * has not been persisted yet. An unchanged resend must not rewrite lines.
 */
export function draftNeedsSaveBeforeSend(input: {
  hasDraftId: boolean;
  snapshot: string;
  lastSavedSnapshot: string | null;
  descriptionSeededFromJobUnsaved: boolean;
}): boolean {
  if (!input.hasDraftId) return true;
  if (input.descriptionSeededFromJobUnsaved) return true;
  return input.snapshot !== input.lastSavedSnapshot;
}

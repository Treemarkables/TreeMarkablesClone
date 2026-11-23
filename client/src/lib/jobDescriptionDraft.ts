/**
 * The job card description field (JobDetailsPanel) keeps what the user is
 * typing in its own state and only PUTs on blur. InvoiceBuilder used to read
 * the job form, which stays "" or the last saved value until that PUT comes
 * back. Publishing the field's current text here lets Invoice read it on the
 * same click, including text that has not been saved yet.
 *
 * Keyed by job id so a tab change that unmounts the field does not drop the
 * text before Invoice opens.
 */

const drafts = new Map<string, string>();

export interface JobDescriptionDraft {
  text: string;
}

export function publishJobDescriptionDraft(jobId: string, text: string): void {
  if (!jobId) return;
  drafts.set(jobId, text);
}

export function readJobDescriptionDraft(jobId: string): JobDescriptionDraft | null {
  if (!drafts.has(jobId)) return null;
  return { text: drafts.get(jobId) ?? "" };
}

export function clearJobDescriptionDraft(jobId: string): void {
  drafts.delete(jobId);
}

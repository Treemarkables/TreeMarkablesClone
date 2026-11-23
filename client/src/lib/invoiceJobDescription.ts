import type { JobDescriptionDraft } from "./jobDescriptionDraft";

/**
 * Text to copy onto a new invoice from the job card.
 *
 * `formDescription ?? savedDescription` is wrong here: the form is reset to
 * "" and only catches up after the blur PUT returns, and `??` keeps that
 * empty string. A second paragraph typed after the first save has landed
 * is also missing, because the form still holds the shorter saved value.
 * The live field wins, including "" when the user has cleared it.
 */
export function invoiceJobDescription(input: {
  liveDraft?: string | null;
  hasLiveDraft: boolean;
  formDescription?: string | null;
  savedDescription?: string | null;
}): string {
  if (input.hasLiveDraft) return input.liveDraft ?? "";
  const form = input.formDescription ?? "";
  if (form.length > 0) return form;
  return input.savedDescription ?? "";
}

export function invoiceJobDescriptionFromDraft(
  draft: JobDescriptionDraft | null,
  formDescription: string | null | undefined,
  savedDescription: string | null | undefined,
): string {
  return invoiceJobDescription({
    liveDraft: draft?.text ?? null,
    hasLiveDraft: draft != null,
    formDescription,
    savedDescription,
  });
}

/**
 * Which description the invoice editor shows first.
 * A saved invoice description wins so reopening does not stomp edits made
 * on the invoice. Otherwise the same order InvoiceBuilder already used:
 * proposal introduction, then quote description, then the job description.
 * The job description is returned whole — newlines included — when it is
 * the one that applies.
 */
export function invoiceDescriptionFromSources(input: {
  existingInvoiceDescription?: string | null;
  hasProposal: boolean;
  proposalIntroduction?: string | null;
  hasQuote: boolean;
  quoteDescription?: string | null;
  jobDescription?: string | null;
}): string {
  const existing = input.existingInvoiceDescription ?? "";
  if (existing.trim()) return existing;
  if (input.hasProposal) {
    return input.proposalIntroduction || input.jobDescription || "";
  }
  if (input.hasQuote) {
    return input.quoteDescription || input.jobDescription || "";
  }
  return input.jobDescription || "";
}

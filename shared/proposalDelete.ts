/**
 * Rules for deleting a proposal document.
 *
 * The job and any quotes-table row stay. An accepted proposal (or one that
 * already took a deposit) is kept, because acceptance is the commercial
 * record and may have created a work order or a payment.
 */

const ACCEPTED_STATUSES = new Set(["accepted", "accepted_pending_deposit"]);

export interface ProposalDeletionInput {
  status?: string | null;
  depositPaidAt?: string | Date | null;
  depositAmountPaid?: string | number | null;
  /** Ledger rows pointing at this proposal. Any row blocks deletion. */
  paymentCount?: number;
}

export type ProposalDeletionDecision =
  | { allowed: true }
  | { allowed: false; reason: "accepted" };

export function proposalDeletionDecision(
  input: ProposalDeletionInput,
): ProposalDeletionDecision {
  const status = (input.status ?? "").trim().toLowerCase();
  if (ACCEPTED_STATUSES.has(status)) return { allowed: false, reason: "accepted" };
  if (input.depositPaidAt) return { allowed: false, reason: "accepted" };
  const paid = Number(input.depositAmountPaid ?? 0);
  if (Number.isFinite(paid) && paid > 0) return { allowed: false, reason: "accepted" };
  if ((input.paymentCount ?? 0) > 0) return { allowed: false, reason: "accepted" };
  return { allowed: true };
}

export function isQuoteDocument(templateUsed: string | null | undefined): boolean {
  return templateUsed === "quote";
}

/**
 * A proposal belongs to the signed-in company when its business id matches.
 * Older rows with a blank business id are allowed only when the job itself
 * is stamped to that company. A blank job id is not proof of ownership.
 */
export function proposalOwnedByBusiness(input: {
  proposalBusinessId?: string | null;
  jobBusinessId?: string | null;
  actorBusinessId?: string | null;
}): boolean {
  const actor = input.actorBusinessId?.trim();
  if (!actor) return false;
  const proposalBusiness = input.proposalBusinessId?.trim();
  if (proposalBusiness) return proposalBusiness === actor;
  const jobBusiness = input.jobBusinessId?.trim();
  if (jobBusiness) return jobBusiness === actor;
  return false;
}

export const PROPOSAL_DELETE_ACCEPTED_MESSAGE =
  "This proposal has been accepted, so it can't be deleted. The job and any payment stay as they are.";

export const PROPOSAL_DELETE_QUOTE_MESSAGE =
  "This is a quote, so it was left in place. The job is unchanged.";

export const PROPOSAL_DELETE_CONFIRM_MESSAGE =
  "This removes the proposal from the job diary. If it was already sent, the customer's link will say it is no longer available. The job and its quote stay.";

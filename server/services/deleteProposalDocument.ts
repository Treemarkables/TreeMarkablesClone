/**
 * Remove one proposal document for the signed-in company.
 *
 * The job row, its quote row, its photos, and its videos stay. Sections and
 * line items cascade with the proposal. Diary rows that point at this
 * proposal (the sent email/SMS and the "viewed" note) are removed so the
 * timeline no longer offers a dead "View Proposal" link. The synthetic
 * "Proposal" diary card is not a row — it disappears because the proposal
 * is gone. Waiting follow-up drafts for this proposal are cancelled, and
 * unsent holding messages are rejected so they cannot go out afterwards.
 */
import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  isQuoteDocument,
  proposalDeletionDecision,
  proposalOwnedByBusiness,
  PROPOSAL_DELETE_ACCEPTED_MESSAGE,
  PROPOSAL_DELETE_QUOTE_MESSAGE,
} from "@shared/proposalDelete";
import * as schema from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";

export type DeleteProposalResult =
  | { ok: true; proposalNumber: string; jobId: string | null }
  | { ok: false; status: 400 | 404 | 409; message: string };

function whereAll(parts: Array<SQL | undefined>): SQL {
  const present = parts.filter((part): part is SQL => part != null);
  return and(...present)!;
}

/** This company, or a legacy row that was never stamped. */
function sameCompanyOrLegacy(column: Parameters<typeof eq>[0], actorBusinessId: string): SQL {
  return or(eq(column, actorBusinessId), isNull(column))!;
}

export async function deleteProposalDocument(
  proposalId: string,
  actorBusinessId: string,
  audit?: { employeeId?: string | null; userAgent?: string | null },
): Promise<DeleteProposalResult> {
  const proposal = await storage.getProposal(proposalId);
  if (!proposal) {
    return { ok: false, status: 404, message: "Proposal not found" };
  }

  let jobBusinessId: string | null = null;
  if (!proposal.businessId && proposal.jobId) {
    const job = await storage.getJob(proposal.jobId);
    if (!job) return { ok: false, status: 404, message: "Proposal not found" };
    jobBusinessId = job.businessId ?? null;
  }

  if (!proposalOwnedByBusiness({
    proposalBusinessId: proposal.businessId,
    jobBusinessId,
    actorBusinessId,
  })) {
    return { ok: false, status: 404, message: "Proposal not found" };
  }

  if (isQuoteDocument(proposal.templateUsed)) {
    return { ok: false, status: 400, message: PROPOSAL_DELETE_QUOTE_MESSAGE };
  }

  const payments = await storage.getPaymentsByProposal(proposal.id);
  const decision = proposalDeletionDecision({
    status: proposal.status,
    depositPaidAt: proposal.depositPaidAt,
    depositAmountPaid: proposal.depositAmountPaid,
    paymentCount: payments.length,
  });
  if (!decision.allowed) {
    console.warn(
      `🛑 PROPOSAL_DELETE_REFUSED id=${proposal.id} status=${proposal.status} business=${actorBusinessId} session=${audit?.employeeId ?? "anon"}`,
    );
    return { ok: false, status: 409, message: PROPOSAL_DELETE_ACCEPTED_MESSAGE };
  }

  const sections = await storage.getProposalSectionsByProposal(proposal.id);
  // Forensic snapshot. There is no soft-delete, and the delete cascades to
  // sections and line items, so this log is the only trace. It is written
  // only after the company check, so a guess at another company's id does
  // not land their proposal in this company's logs.
  console.warn(
    `🛑 PROPOSAL_DELETE_AUDIT id=${proposal.id} ts=${new Date().toISOString()} session=${audit?.employeeId ?? "anon"} business=${actorBusinessId} ua=${audit?.userAgent ?? "n/a"} snapshot=${JSON.stringify({
      jobId: proposal.jobId,
      customerId: proposal.customerId,
      businessId: proposal.businessId,
      proposalNumber: proposal.proposalNumber,
      status: proposal.status,
      title: proposal.title,
      totalAmount: proposal.totalAmount,
      sentDate: proposal.sentDate,
      viewedDate: proposal.viewedDate,
      responseDate: proposal.responseDate,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      sectionCount: sections.length,
    })}`,
  );
  const sectionIds = sections.map((section) => section.id);
  if (sectionIds.length > 0) {
    // Photos and videos belong to the job. Drop only the section pointer so
    // the proposal delete is not blocked by the foreign key.
    await db.update(schema.photos)
      .set({ proposalSectionId: null })
      .where(inArray(schema.photos.proposalSectionId, sectionIds));
    await db.update(schema.videos)
      .set({ proposalSectionId: null })
      .where(inArray(schema.videos.proposalSectionId, sectionIds));
  }

  const proposalScope = proposal.businessId
    ? eq(schema.proposals.businessId, actorBusinessId)
    : and(
        isNull(schema.proposals.businessId),
        proposal.jobId
          ? eq(schema.proposals.jobId, proposal.jobId)
          : sql`false`,
      );

  let removed: { id: string }[];
  try {
    removed = await db.delete(schema.proposals)
      .where(and(eq(schema.proposals.id, proposal.id), proposalScope))
      .returning({ id: schema.proposals.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/foreign key|violates/i.test(message)) {
      return { ok: false, status: 409, message: PROPOSAL_DELETE_ACCEPTED_MESSAGE };
    }
    throw error;
  }

  if (removed.length === 0) {
    return { ok: false, status: 404, message: "Proposal not found" };
  }

  try {
    if (proposal.jobId) {
      await db.delete(schema.jobDiaryEntries).where(whereAll([
        eq(schema.jobDiaryEntries.jobId, proposal.jobId),
        sql`${schema.jobDiaryEntries.metadata}->>'proposalId' = ${proposal.id}`,
        sameCompanyOrLegacy(schema.jobDiaryEntries.businessId, actorBusinessId),
      ]));
    }

    await db.update(schema.quoteFollowUps)
      .set({
        status: "cancelled",
        cancelReason: "proposal_deleted",
        updatedAt: new Date(),
      })
      .where(whereAll([
        eq(schema.quoteFollowUps.quoteId, proposal.id),
        eq(schema.quoteFollowUps.sourceType, "proposal"),
        inArray(schema.quoteFollowUps.status, ["draft", "snoozed"]),
        sameCompanyOrLegacy(schema.quoteFollowUps.businessId, actorBusinessId),
      ]));

    await db.update(schema.pendingOutboundMessages)
      .set({ status: "rejected" })
      .where(whereAll([
        eq(schema.pendingOutboundMessages.proposalId, proposal.id),
        eq(schema.pendingOutboundMessages.status, "pending"),
        sameCompanyOrLegacy(schema.pendingOutboundMessages.businessId, actorBusinessId),
      ]));
  } catch (error) {
    // The proposal row is already gone. A follow-up cleanup failure must not
    // tell the user the delete failed and invite a second tap.
    console.error("Proposal deleted but related rows were not fully cleaned up:", error);
  }

  return {
    ok: true,
    proposalNumber: proposal.proposalNumber,
    jobId: proposal.jobId ?? null,
  };
}

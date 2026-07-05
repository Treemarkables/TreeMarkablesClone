// Shared "finalize a proposal acceptance" logic. Used by:
//   • POST /api/proposals/:id/accept              (when no deposit is required)
//   • POST /api/stripe/webhook → checkout.session.completed
//     (when a deposit was required and has just been paid)
//
// Creates the work-order job, notification, pending holding message, and
// diary entry. Optionally records a deposit payment against the new job.

import { storage } from '../storage';
import { onLaneJobEvent } from './laneAutomationService';
import type { Proposal } from '@shared/schema';

export interface FinalizeProposalAcceptanceInput {
  proposal: Proposal;
  updatedTotalAmount: number;
  updatedSubtotal: number;
  // Optional: when called from the Stripe webhook, the deposit just paid.
  // Used to seed jobs.paidAmount + jobs.balanceDue and to record a payment.
  depositPaid?: {
    amount: number;
    provider: 'stripe' | 'manual' | 'bank_transfer';
    providerSessionId?: string;
    providerPaymentId?: string;
  };
}

export interface FinalizeProposalAcceptanceResult {
  job: any;
  jobNumber: string;
  pendingMessageId: string | null;
}

export async function finalizeProposalAcceptance(
  input: FinalizeProposalAcceptanceInput,
): Promise<FinalizeProposalAcceptanceResult> {
  const { proposal, updatedTotalAmount, updatedSubtotal, depositPaid } = input;

  // Quotes share this flow (a quote is a proposal with templateUsed === 'quote');
  // only the customer/owner-facing wording differs.
  const isQuote = proposal.templateUsed === 'quote';
  const docWord = isQuote ? 'Quote' : 'Proposal';
  const docWordLower = isQuote ? 'quote' : 'proposal';

  const depositAmount = depositPaid?.amount || 0;
  const balanceDue = Math.max(0, Math.round((updatedTotalAmount - depositAmount) * 100) / 100);
  const gstAmount = Math.max(0, updatedTotalAmount - updatedSubtotal);

  let job: any;
  let jobNumber: string;

  const baseJobFields = {
    title: `Work Order from ${docWord} #${proposal.proposalNumber}`,
    description: `Work based on accepted ${docWordLower} #${proposal.proposalNumber}`,
    customerId: proposal.customerId,
    quoteId: proposal.quoteId,
    status: 'work_order',
    priority: 'medium',
    totalAmount: String(updatedTotalAmount),
    subtotal: String(updatedSubtotal),
    gstAmount: String(gstAmount),
    paidAmount: String(depositAmount),
    balanceDue: String(balanceDue),
    metricsEligible: true,
    metricsStartDate: new Date(),
  };

  if (proposal.jobId) {
    const existingJob = await storage.getJob(proposal.jobId);
    if (existingJob) {
      job = await storage.updateJob(proposal.jobId, {
        status: 'work_order',
        totalAmount: String(updatedTotalAmount),
        subtotal: String(updatedSubtotal),
        gstAmount: String(gstAmount),
        paidAmount: String(depositAmount),
        balanceDue: String(balanceDue),
      });
      jobNumber = existingJob.jobNumber;
    } else {
      jobNumber = await storage.getNextJobNumber();
      job = await storage.createJob({ ...baseJobFields, jobNumber });
    }
  } else {
    jobNumber = await storage.getNextJobNumber();
    job = await storage.createJob({ ...baseJobFields, jobNumber });
  }

  // Record the deposit payment in the ledger
  if (depositPaid && depositPaid.amount > 0) {
    try {
      await storage.createPayment({
        jobId: job.id,
        proposalId: proposal.id,
        customerId: proposal.customerId,
        amount: String(depositPaid.amount),
        currency: 'NZD',
        provider: depositPaid.provider,
        providerSessionId: depositPaid.providerSessionId ?? null,
        providerPaymentId: depositPaid.providerPaymentId ?? null,
        kind: 'deposit',
        status: 'succeeded',
        paidAt: new Date(),
      });
    } catch (err) {
      // Duplicate sessionId (unique constraint) → webhook retry; not fatal.
      console.warn('Skipping payment insert (possibly duplicate):', err);
    }
  }

  const customer = proposal.customerId ? await storage.getCustomer(proposal.customerId) : null;

  const depositCopy = depositAmount > 0
    ? ` Deposit of ${formatNzd(depositAmount)} paid; balance due ${formatNzd(balanceDue)}.`
    : '';

  await storage.createNotification({
    title: `${docWord} Accepted!`,
    message:
      `${customer?.name || 'Customer'} has accepted ${docWordLower} #${proposal.proposalNumber} ` +
      `for ${formatNzd(updatedTotalAmount)}. Work order #${jobNumber} has been created.${depositCopy}`,
    type: isQuote ? 'quote_accepted' : 'proposal_accepted',
    priority: 'high',
    isRead: false,
    proposalId: proposal.id,
    jobId: job.id,
    customerId: proposal.customerId,
  });

  // Pending holding message draft for owner approval
  const firstName = customer?.name?.split(' ')[0] || 'there';
  const phone = customer?.mobile || customer?.phone;
  const email = customer?.email;
  const channel = phone ? 'sms' : email ? 'email' : 'sms';
  const holdingMsg =
    `Hey ${firstName}, thanks for accepting our ${docWordLower}. ` +
    `We'll be in touch within 24 hours to get your job scheduled.`;

  let pendingMessageId: string | null = null;
  try {
    const pendingMsg = await storage.createPendingOutboundMessage({
      jobId: job.id,
      customerId: proposal.customerId || undefined,
      proposalId: proposal.id,
      proposalNumber: proposal.proposalNumber,
      recipientName: customer?.name || undefined,
      recipientPhone: phone || undefined,
      recipientEmail: email || undefined,
      message: holdingMsg,
      channel,
      status: 'pending',
    });
    pendingMessageId = pendingMsg?.id ?? null;

    await storage.createNotification({
      title: 'Holding message awaiting approval',
      message: `A holding message to ${customer?.name || 'the customer'} is ready to send — tap to review and approve.`,
      type: 'holding_message_pending',
      priority: 'high',
      isRead: false,
      jobId: job.id,
      customerId: proposal.customerId || undefined,
      metadata: { pendingMessageId: pendingMsg.id },
    });
  } catch (err) {
    console.error('Failed to create holding message draft:', err);
  }

  // Diary entry — wrapped because failure must not block downstream success
  if (job?.id) {
    try {
      const depositLine = depositAmount > 0
        ? ` Deposit of ${formatNzd(depositAmount)} paid at acceptance.`
        : '';
      const acceptanceContent =
        `${customer?.name || 'Customer'} accepted ${docWordLower} ${proposal.proposalNumber} ` +
        `for ${formatNzd(updatedTotalAmount)}. Job converted to work order.${depositLine}`;
      await storage.createJobDiaryEntry({
        jobId: job.id,
        entryType: 'system',
        title: `${docWord} Accepted: ${proposal.proposalNumber}`,
        description: acceptanceContent,
        content: acceptanceContent,
        authorName: customer?.name || 'Customer',
        authorRole: 'customer',
        metadata: {
          proposalId: proposal.id,
          proposalNumber: proposal.proposalNumber,
          totalAmount: proposal.totalAmount,
          depositAmount,
          eventType: isQuote ? 'quote_accepted' : 'proposal_accepted',
        },
      });
    } catch (diaryErr) {
      console.error('Failed to log proposal-accepted diary entry:', diaryErr);
    }
  }

  // Lanes: a lane can auto-remove the job from a follow-up bucket (or move it into a "Won" lane)
  // when the quote is accepted. Best-effort; never block acceptance.
  if (job?.id) {
    onLaneJobEvent(job.id, 'quote_accepted').catch(err => console.error('[Lanes] quote-accepted trigger error:', err));
  }

  return { job, jobNumber, pendingMessageId };
}

function formatNzd(n: number): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n || 0);
}

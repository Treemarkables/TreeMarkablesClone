import { storage } from '../storage.js';
import { generateQuoteFollowupDraft } from './quoteFollowupAi.js';
import { getBusinessIdentity } from '../businessIdentity.js';
import * as usageMeter from './usageMeter.js';

// De-duplication helper: check if a reminder of this type for this entity was already sent in the last 24 hours
async function wasReminderSentRecently(type: string, entityId: string, entityField: 'jobId' | 'quoteId'): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentNotifications = await storage.getNotificationsCreatedSince(since);

  return recentNotifications.some(n => {
    if (n.type !== type) return false;
    if (entityField === 'jobId') return n.jobId === entityId;
    if (entityField === 'quoteId') return n.quoteId === entityId;
    return false;
  });
}

// Pick a customer first name from the customer.name "Last, First" / "First Last" / "Business Ltd" mess.
function firstNameFrom(customerName: string | null | undefined): string {
  if (!customerName) return '';
  const trimmed = customerName.trim();
  if (!trimmed) return '';
  if (trimmed.includes(',')) {
    const after = trimmed.split(',')[1]?.trim();
    if (after) return after.split(/\s+/)[0];
  }
  return trimmed.split(/\s+/)[0];
}

// Check 1: Formally sent quotes with no customer response after the configured threshold
async function checkStaleQuotes(): Promise<void> {
  const settings = await storage.getBusinessSettings();
  const thresholdDays = (settings?.autoFollowUpDays && settings.autoFollowUpDays > 0) ? settings.autoFollowUpDays : 3;
  const followupEnabled = !!settings?.autoQuoteFollowupEnabled;
  const followupChannel = (settings?.quoteFollowupChannel === 'email' ? 'email' : 'sms') as 'sms' | 'email';
  const maxAttempts = (settings?.quoteFollowupMaxAttempts && settings.quoteFollowupMaxAttempts > 0) ? settings.quoteFollowupMaxAttempts : 2;

  const thresholdAgo = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
  const allQuotes = await storage.getAllQuotes();

  for (const quote of allQuotes) {
    if (quote.status !== 'sent' || quote.responseDate) continue;
    if (!quote.sentDate || new Date(quote.sentDate) > thresholdAgo) continue;

    // 24-hour cooldown gates BOTH the notification and the AI-drafted follow-up — so we
    // never queue more than one pending draft per quote within a 24h window.
    const alreadySent = await wasReminderSentRecently('reminder_stale_quote', quote.id, 'quoteId');
    if (alreadySent) continue;

    const customer = quote.customerId ? await storage.getCustomer(quote.customerId) : null;
    const customerName = customer?.name || 'Customer';
    const daysSince = Math.floor((Date.now() - new Date(quote.sentDate).getTime()) / (1000 * 60 * 60 * 24));

    // Internal staff notification — always runs, regardless of automation toggle.
    await storage.createNotification({
      title: 'Quote follow-up needed',
      message: `Quote #${quote.quoteNumber} sent to ${customerName} ${daysSince} day${daysSince === 1 ? '' : 's'} ago — no response yet`,
      type: 'reminder_stale_quote',
      priority: 'medium',
      isRead: false,
      quoteId: quote.id,
      jobId: quote.jobId || undefined,
      customerId: quote.customerId || undefined,
      actionUrl: quote.jobId ? `/dispatch?job=${quote.jobId}` : '/dispatch',
      metadata: { quoteNumber: quote.quoteNumber, customerName, daysSince },
    });
    console.log(`[ReminderChecker] Stale quote reminder: Quote #${quote.quoteNumber} (${customerName}, ${daysSince}d)`);

    // AI-drafted customer follow-up — only when the user has opted in.
    if (!followupEnabled) continue;

    const currentAttempts = quote.followUpCount || 0;
    if (currentAttempts >= maxAttempts) {
      console.log(`[ReminderChecker] Quote #${quote.quoteNumber} hit maxAttempts (${maxAttempts}) — skipping draft`);
      continue;
    }

    // Resolve channel — fall back if the requested channel has no recipient on file.
    let channel: 'sms' | 'email' = followupChannel;
    const phone = (customer?.mobile || customer?.phone || '').trim();
    const email = (customer?.email || '').trim();
    if (channel === 'sms' && !phone && email) channel = 'email';
    if (channel === 'email' && !email && phone) channel = 'sms';
    if (channel === 'sms' && !phone) {
      console.log(`[ReminderChecker] Quote #${quote.quoteNumber}: no phone/email on customer — cannot draft followup`);
      continue;
    }
    if (channel === 'email' && !email) {
      console.log(`[ReminderChecker] Quote #${quote.quoteNumber}: no email/phone on customer — cannot draft followup`);
      continue;
    }

    // AI usage cap (cron path — businessId comes off the quote, not request context).
    const fuBusinessId = (quote as any).businessId as string | undefined;
    if (fuBusinessId && !(await usageMeter.guard('ai', fuBusinessId, 'quote_followup'))) {
      console.log(`[ReminderChecker] Quote #${quote.quoteNumber}: monthly AI cap reached — skipping follow-up draft`);
      continue;
    }

    try {
      const identity = getBusinessIdentity(settings);
      const { body } = await generateQuoteFollowupDraft({
        customerFirstName: firstNameFrom(customer?.name),
        jobDescription: null,
        quoteNumber: quote.quoteNumber,
        quoteAmount: (quote as any).total ?? (quote as any).amount ?? null,
        daysSince,
        attemptNumber: currentAttempts + 1,
        channel,
        businessName: identity.name,
        ownerName: identity.ownerName,
        discipline: identity.discipline,
      });

      await storage.createPendingOutboundMessage({
        jobId: quote.jobId || undefined,
        customerId: quote.customerId || undefined,
        proposalId: undefined,
        proposalNumber: quote.quoteNumber ? String(quote.quoteNumber) : undefined,
        recipientName: customer?.name || undefined,
        recipientPhone: channel === 'sms' ? phone : undefined,
        recipientEmail: channel === 'email' ? email : undefined,
        message: body,
        channel,
        status: 'pending',
      });

      await storage.updateQuote(quote.id, {
        followUpCount: currentAttempts + 1,
        lastFollowUpDate: new Date(),
        nextFollowUpDate: new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000),
      } as any);

      if (fuBusinessId) await usageMeter.recordUsage('ai', fuBusinessId, { feature: 'quote_followup', ref: quote.id });
      console.log(`[ReminderChecker] Queued follow-up draft for Quote #${quote.quoteNumber} (${channel}, attempt ${currentAttempts + 1}/${maxAttempts})`);
    } catch (err) {
      console.error(`[ReminderChecker] Failed to draft follow-up for Quote #${quote.quoteNumber}:`, err);
    }
  }
}

// Check 2: Jobs scheduled for tomorrow with no crew assigned
async function checkUnstaffedTomorrowJobs(): Promise<void> {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  // 'scheduled' status retired 2026-05 — tomorrow's bookings are
  // work_orders with a scheduledDate inside tomorrow's window.
  const { jobs } = await storage.getAllJobs({ limit: 999999, status: 'work_order' });

  for (const job of jobs) {
    if (!job.scheduledDate) continue;
    const jobDate = new Date(job.scheduledDate);
    if (jobDate < tomorrow || jobDate >= dayAfterTomorrow) continue;
    if (job.assignedTeam && job.assignedTeam.length > 0) continue;

    const alreadySent = await wasReminderSentRecently('reminder_no_crew', job.id, 'jobId');
    if (alreadySent) continue;

    const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
    const customerName = customer?.name || 'Customer';

    await storage.createNotification({
      title: 'Tomorrow\'s job has no crew',
      message: `Job #${job.jobNumber} (${job.title || customerName}) is scheduled for tomorrow with no crew assigned`,
      type: 'reminder_no_crew',
      priority: 'high',
      isRead: false,
      jobId: job.id,
      customerId: job.customerId || undefined,
      actionUrl: `/dispatch?job=${job.id}`,
      metadata: { jobNumber: job.jobNumber, customerName, jobTitle: job.title },
    });
    console.log(`[ReminderChecker] No-crew reminder: Job #${job.jobNumber} (${customerName})`);
  }
}

// Check 3: Completed jobs with no invoice raised after 7+ days
async function checkUninvoicedCompletedJobs(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const completedJobs = await storage.getJobsByStatus('completed');

  for (const job of completedJobs) {
    if (!job.completedDate || new Date(job.completedDate) > sevenDaysAgo) continue;

    const invoices = await storage.getInvoicesByJob(job.id);
    if (invoices.length > 0) continue;

    const alreadySent = await wasReminderSentRecently('reminder_uninvoiced', job.id, 'jobId');
    if (alreadySent) continue;

    const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
    const customerName = customer?.name || 'Customer';
    const daysSince = Math.floor((Date.now() - new Date(job.completedDate).getTime()) / (1000 * 60 * 60 * 24));

    await storage.createNotification({
      title: 'Completed job not yet invoiced',
      message: `Job #${job.jobNumber} (${customerName}) completed ${daysSince} day${daysSince === 1 ? '' : 's'} ago — no invoice raised`,
      type: 'reminder_uninvoiced',
      priority: 'high',
      isRead: false,
      jobId: job.id,
      customerId: job.customerId || undefined,
      actionUrl: `/dispatch?job=${job.id}`,
      metadata: { jobNumber: job.jobNumber, customerName, daysSince },
    });
    console.log(`[ReminderChecker] Uninvoiced reminder: Job #${job.jobNumber} (${customerName}, ${daysSince}d)`);
  }
}

// Check 4: Leads with no activity for 24+ hours
async function checkStaleLeads(): Promise<void> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const leadJobs = await storage.getJobsByStatus('lead');

  for (const job of leadJobs) {
    const lastActivity = job.lastActivityAt
      ? new Date(job.lastActivityAt)
      : job.createdAt
        ? new Date(job.createdAt)
        : null;

    if (!lastActivity || lastActivity > twentyFourHoursAgo) continue;

    const alreadySent = await wasReminderSentRecently('reminder_stale_lead', job.id, 'jobId');
    if (alreadySent) continue;

    const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
    const customerName = customer?.name || 'New lead';
    const hoursAgo = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60));

    await storage.createNotification({
      title: 'Lead needs follow-up',
      message: `Lead from ${customerName} (Job #${job.jobNumber}) has had no activity for ${hoursAgo} hour${hoursAgo === 1 ? '' : 's'}`,
      type: 'reminder_stale_lead',
      priority: 'medium',
      isRead: false,
      jobId: job.id,
      customerId: job.customerId || undefined,
      actionUrl: `/dispatch?job=${job.id}`,
      metadata: { jobNumber: job.jobNumber, customerName, hoursAgo },
    });
    console.log(`[ReminderChecker] Stale lead reminder: Job #${job.jobNumber} (${customerName}, ${hoursAgo}h)`);
  }
}

// Run all reminder checks — called by AutomatedTriggers every hour
export async function runAllReminderChecks(): Promise<void> {
  console.log('[ReminderChecker] Running proactive business reminder checks...');
  const results = await Promise.allSettled([
    checkStaleQuotes(),
    checkUnstaffedTomorrowJobs(),
    checkUninvoicedCompletedJobs(),
    checkStaleLeads(),
  ]);

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length > 0) {
    errors.forEach(e => console.error('[ReminderChecker] Check failed:', (e as PromiseRejectedResult).reason));
  } else {
    console.log('[ReminderChecker] All checks complete.');
  }
}

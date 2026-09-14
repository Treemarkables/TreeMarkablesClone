import { storage } from '../storage.js';
import { generateQuoteFollowupDraft } from './quoteFollowupAi.js';
import { getBusinessIdentity } from '../businessIdentity.js';
import * as usageMeter from './usageMeter.js';
import * as notificationHelper from './notificationHelper.js';
import { db } from '../db.js';
import * as schema from '../../shared/schema.js';
import { and, eq, inArray } from 'drizzle-orm';
import { getNZDateString, jobRunsOnNZDate } from '../../shared/dateUtils.js';
import { ROLE_LABEL, isRoleKey } from '../../shared/crewRoles.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// De-duplication helper: has a reminder of this type for this entity been sent
// inside the window? ONE indexed existence query. This used to download every
// notification from the last 24h and scan it in JS — per job, per hourly tick,
// on both instances — which was the single biggest source of Neon network
// egress in Aug/Sep 2026 (2.4M calls × ~1 MB).
async function wasReminderSentRecently(
  type: string,
  entityId: string,
  entityField: 'jobId' | 'quoteId',
  windowMs: number = DAY_MS,
): Promise<boolean> {
  return storage.hasNotificationSince({
    type,
    since: new Date(Date.now() - windowMs),
    ...(entityField === 'jobId' ? { jobId: entityId } : { quoteId: entityId }),
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

// Check 3: Completed jobs with no invoice raised after 7+ days.
//
// Scope is deliberately narrow: jobs completed 7–60 days ago, created in this
// app (imported ServiceM8 history has no invoice rows here and is not
// actionable), and nagged at most once a week. The previous version re-notified
// every completed-uninvoiced job in the database daily — ~1,900 notifications a
// day on prod, 148k rows, 95% of the notifications table.
const UNINVOICED_MIN_AGE_DAYS = 7;
const UNINVOICED_MAX_AGE_DAYS = 60;
const UNINVOICED_REMIND_EVERY_DAYS = 7;

async function checkUninvoicedCompletedJobs(): Promise<void> {
  const now = Date.now();
  const candidates = await storage.getUninvoicedCompletedJobs({
    from: new Date(now - UNINVOICED_MAX_AGE_DAYS * DAY_MS),
    to: new Date(now - UNINVOICED_MIN_AGE_DAYS * DAY_MS),
  });

  for (const job of candidates) {
    if (!job.completedDate) continue;

    const alreadySent = await wasReminderSentRecently(
      'reminder_uninvoiced', job.id, 'jobId', UNINVOICED_REMIND_EVERY_DAYS * DAY_MS,
    );
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
// Check 5: role checklist tasks still unticked after the crew clocked off.
//
// The clock-out sheet prompts on the spot, but it's dismissible — and the whole
// reason the reminder exists is the person who taps dismiss and walks away. This is
// the follow-up. It deliberately skips jobs with anyone still on the clock: a crew
// mid-job hasn't failed to do anything yet.
async function checkOutstandingRoleTasks(): Promise<void> {
  const todayNZ = getNZDateString(new Date());
  // addStaffTimeEntry stamps `date` from the UTC calendar day, which runs a day
  // behind NZ for anything worked before ~1pm. Accept both spellings.
  const todayUTC = new Date().toISOString().split('T')[0];

  const roleRows = await db.select().from(schema.jobDayRoles)
    .where(eq(schema.jobDayRoles.nzDate, todayNZ));
  if (roleRows.length === 0) return;
  const roleByEmployee = new Map(roleRows.map(r => [r.employeeId, r.roleKey]));

  const taskRows = await db.select().from(schema.roleChecklistTasks);
  const tasksByRole = new Map<string, Array<{ itemId: string; label: string }>>();
  for (const t of taskRows) {
    if (!t.isEnabled || !isRoleKey(t.roleKey)) continue;
    const list = tasksByRole.get(t.roleKey) ?? [];
    list.push({ itemId: t.itemId, label: t.label });
    tasksByRole.set(t.roleKey, list);
  }
  if (tasksByRole.size === 0) return;

  const { jobs } = await storage.getAllJobs({ limit: 999999, status: 'work_order' });
  const since24h = new Date(Date.now() - DAY_MS);

  for (const job of jobs) {
    if (!jobRunsOnNZDate(job, todayNZ)) continue;

    // Anyone still clocked in means the job isn't over — nothing is late yet.
    const stillRunning = await storage.getActiveTimersForJob(job.id);
    if (stillRunning.length > 0) continue;

    const entries = await storage.getJobStaffTimeEntries(job.id);
    const workedToday = Array.from(new Set(
      entries
        .filter((e: any) => e?.date === todayNZ || e?.date === todayUTC)
        .map((e: any) => e.employeeId)
        .filter(Boolean),
    )) as string[];
    if (workedToday.length === 0) continue;

    const completions = await storage.getJobChecklistCompletions(job.id);
    const done = new Set(completions.map(c => c.itemId));

    for (const employeeId of workedToday) {
      const roleKey = roleByEmployee.get(employeeId);
      if (!roleKey || !isRoleKey(roleKey)) continue;
      const outstanding = (tasksByRole.get(roleKey) ?? []).filter(t => !done.has(t.itemId));
      if (outstanding.length === 0) continue;

      // One nudge per person per job per day — this is a reminder, not a nag.
      const alreadySent = await storage.hasNotificationSince({
        type: 'reminder_role_tasks', since: since24h, jobId: job.id, userId: employeeId,
      });
      if (alreadySent) continue;

      const label = ROLE_LABEL[roleKey];
      await storage.createNotification({
        title: `${outstanding.length} ${label} task${outstanding.length === 1 ? '' : 's'} still unticked`,
        message: `Job #${job.jobNumber}: ${outstanding.map(t => t.label).join(', ')}`,
        type: 'reminder_role_tasks',
        priority: 'medium',
        isRead: false,
        userId: employeeId,
        jobId: job.id,
        actionUrl: `/dispatch?job=${job.id}`,
        metadata: { roleKey, itemIds: outstanding.map(t => t.itemId) },
      });

      await notificationHelper.notifyEmployee(employeeId, {
        title: `${outstanding.length} ${label} task${outstanding.length === 1 ? '' : 's'} still unticked`,
        body: `Job #${job.jobNumber}: ${outstanding.map(t => t.label).join(' · ')}`,
        clickAction: `/dispatch?job=${job.id}`,
        collapseId: `role-tasks-${job.id}-${employeeId}-${todayNZ}`,
      });
      console.log(`[ReminderChecker] Role-task reminder: Job #${job.jobNumber} → ${employeeId} (${label})`);
    }
  }
}

export async function runAllReminderChecks(): Promise<void> {
  console.log('[ReminderChecker] Running proactive business reminder checks...');
  const results = await Promise.allSettled([
    checkStaleQuotes(),
    checkUnstaffedTomorrowJobs(),
    checkUninvoicedCompletedJobs(),
    checkStaleLeads(),
    checkOutstandingRoleTasks(),
  ]);

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length > 0) {
    errors.forEach(e => console.error('[ReminderChecker] Check failed:', (e as PromiseRejectedResult).reason));
  } else {
    console.log('[ReminderChecker] All checks complete.');
  }
}

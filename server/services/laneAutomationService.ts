import { storage } from '../storage.js';
import type { Job, LaneAutomation, InsertJob } from '@shared/schema';
import { runWithBusiness } from '../tenancy/tenantStore.js';
import { smsService } from './smsService.js';
import { emailService } from './emailService.js';
import { notifyEmployees, pushToAdminsWithCustomerMessages } from './notificationHelper.js';
import { generateQuoteFollowupDraft } from './quoteFollowupAi.js';

/**
 * Lane automation engine.
 *
 * Lanes are per-business buckets a job can sit in (orthogonal to status). Each lane carries
 * automations that fire either when a job ENTERS the lane (trigger 'on_enter'), after it has sat
 * there for N days (trigger 'days_in_lane', evaluated by the hourly cron), or when its status
 * changes while in the lane (trigger 'status_changed').
 *
 * Tenancy: the cron runs with NO tenant context, so the global readers return rows across all
 * businesses. Every fire is wrapped in runWithBusiness(job.businessId, …) so notifications, tasks,
 * and the run-ledger insert stamp the correct businessId and sends self-scope.
 *
 * De-dup ("fire once per lane stay"): before firing a days_in_lane automation we check the
 * lane_automation_runs ledger for a row with fired_at >= job.lane_entered_at. Re-entering a lane
 * advances lane_entered_at and re-arms the automations.
 */

interface NudgeConfig {
  channel?: 'sms' | 'email';
  template?: string;
  templateId?: string;
  useAi?: boolean;             // AI-draft the message instead of a template
  requireApproval?: boolean;
  respectQuietHours?: boolean; // hold customer sends until outside the quiet window (default on)
}
interface StaffConfig {
  recipients?: 'owner' | 'assigned' | 'both'; // legacy single field — still honoured
  notifyOwner?: boolean;       // owner / admins
  notifyAssigned?: boolean;    // the crew assigned to the job
  staffIds?: string[];         // specific team members (employee ids)
  emails?: string[];           // typed email recipients (may be people with no app account)
  phones?: string[];           // typed phone recipients (SMS)
  message?: string;
  priority?: 'low' | 'medium' | 'high';
}
interface AutoMoveConfig { targetLaneId?: string }
interface TaskConfig { title?: string; category?: string; assigneeId?: string; dueInDays?: number }
interface ChangeStatusConfig { targetStatus?: string }
interface AddNoteConfig { note?: string }
interface AssignStaffConfig { staffIds?: string[] }

// Per-automation guards shared by every type (stored alongside type-specific config in jsonb).
type Condition = { field: string; op: 'eq' | 'ne' | 'gt' | 'lt' | 'contains'; value: string };
interface GuardConfig { conditions?: Condition[]; maxAttempts?: number }

const QUIET_START = '21:00';
const QUIET_END = '08:00';

// Is `now` inside the customer-contact quiet window for the given timezone? Window may wrap midnight.
function inQuietHours(now: Date, tz = 'Pacific/Auckland'): boolean {
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const hh = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const mm = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  const cur = hh * 60 + mm;
  const [sh, sm] = QUIET_START.split(':').map(Number);
  const [eh, em] = QUIET_END.split(':').map(Number);
  const start = sh * 60 + sm, end = eh * 60 + em;
  return start <= end ? (cur >= start && cur < end) : (cur >= start || cur < end);
}

function jobFieldValue(job: Job, field: string): string | number | null {
  switch (field) {
    case 'status': return job.status ?? null;
    case 'leadSource': return job.leadSource ?? null;
    case 'priority': return job.priority ?? null;
    case 'totalAmount': {
      const v = (job.totalAmount ?? job.totalIncludingGst ?? job.subtotal);
      return v != null ? Number(v) : null;
    }
    case 'amountOwing': return job.balanceDue != null ? Number(job.balanceDue) : null;
    case 'title': return job.title ?? '';
    case 'description': return job.description ?? '';
    default: return null;
  }
}

// All conditions must hold (AND). Empty/absent = always true.
function conditionsMet(job: Job, conditions?: Condition[]): boolean {
  if (!conditions || !conditions.length) return true;
  return conditions.every((c) => {
    const v = jobFieldValue(job, c.field);
    if (c.op === 'gt' || c.op === 'lt') {
      const n = typeof v === 'number' ? v : Number(v);
      const t = Number(c.value);
      if (Number.isNaN(n) || Number.isNaN(t)) return false;
      return c.op === 'gt' ? n > t : n < t;
    }
    const s = (v == null ? '' : String(v)).toLowerCase();
    const t = String(c.value ?? '').toLowerCase();
    if (c.op === 'eq') return s === t;
    if (c.op === 'ne') return s !== t;
    if (c.op === 'contains') return s.includes(t);
    return true;
  });
}

function firstNameFrom(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (trimmed.includes(',')) {
    const after = trimmed.split(',')[1]?.trim();
    if (after) return after.split(/\s+/)[0];
  }
  return trimmed.split(/\s+/)[0];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => (key in vars ? vars[key] : `{${key}}`));
}

/** Resolve the best customer-facing contact for a job, falling back to the customer record. */
async function resolveJobContact(job: Job): Promise<{ name: string; phone: string; email: string }> {
  let name = [job.jobContactFirstName, job.jobContactLastName].filter(Boolean).join(' ').trim();
  let phone = (job.jobContactMobile || job.jobContactPhone || '').trim();
  let email = (job.jobContactEmail || '').trim();
  if (!phone || !email || !name) {
    const customer = job.customerId ? await storage.getCustomer(job.customerId).catch(() => null) : null;
    if (customer) {
      if (!name) name = (customer.name || '').trim();
      if (!phone) phone = (customer.mobile || customer.phone || '').trim();
      if (!email) email = (customer.email || '').trim();
    }
  }
  return { name, phone, email };
}

// Returns false when the send was DEFERRED (quiet hours) so the caller doesn't record a run and the
// nudge is retried on the next tick. Returns true when sent, queued for approval, or genuinely skipped.
async function runCustomerNudge(job: Job, cfg: NudgeConfig): Promise<boolean> {
  const contact = await resolveJobContact(job);

  // Resolve channel; fall back if the requested channel has no recipient on file.
  let channel: 'sms' | 'email' = cfg.channel === 'email' ? 'email' : 'sms';
  if (channel === 'sms' && !contact.phone && contact.email) channel = 'email';
  if (channel === 'email' && !contact.email && contact.phone) channel = 'sms';
  if (channel === 'sms' && !contact.phone) { console.log(`[Lanes] nudge skipped (no phone) job #${job.jobNumber}`); return true; }
  if (channel === 'email' && !contact.email) { console.log(`[Lanes] nudge skipped (no email) job #${job.jobNumber}`); return true; }

  // Quiet hours: hold customer sends until outside the window (default on). Returning false defers.
  if (cfg.respectQuietHours !== false && inQuietHours(new Date())) {
    console.log(`[Lanes] nudge deferred (quiet hours) job #${job.jobNumber}`);
    return false;
  }

  const settings = await storage.getBusinessSettings().catch(() => null);
  const vars: Record<string, string> = {
    firstName: firstNameFrom(contact.name) || 'there',
    name: contact.name || 'there',
    customerName: contact.name || 'there',
    jobNumber: String(job.jobNumber || ''),
    jobTitle: job.title || '',
    address: job.address || '',
    businessName: settings?.businessName || '',
    businessPhone: settings?.businessPhone || '',
  };

  // Message source: a saved Email/SMS template (config.templateId) takes precedence over inline
  // text. Email templates also carry a subject + HTML body. Placeholders use the same single-brace
  // {var} syntax as the rest of the app (see CommunicationTemplates / bookingReminderService).
  let subject = `Following up on your job${job.jobNumber ? ` #${job.jobNumber}` : ''}`;
  let body = cfg.template || 'Hi {firstName}, just following up on your job with us — let us know if you have any questions.';
  let html: string | undefined;

  if (cfg.templateId) {
    if (channel === 'sms') {
      const tpl = await storage.getSmsTemplate(cfg.templateId).catch(() => null);
      if (tpl?.message) body = tpl.message;
    } else {
      const tpl = await storage.getEmailTemplate(cfg.templateId).catch(() => null);
      if (tpl) {
        if (tpl.subject) subject = tpl.subject;
        if (tpl.htmlContent) html = tpl.htmlContent;
        body = tpl.textContent || tpl.htmlContent?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || body;
      }
    }
  }

  // AI draft overrides the template/inline text when enabled.
  if (cfg.useAi) {
    try {
      const enteredAt = job.laneEnteredAt ? new Date(job.laneEnteredAt) : (job.createdAt ? new Date(job.createdAt) : new Date());
      const daysSince = Math.max(0, Math.floor((Date.now() - enteredAt.getTime()) / (24 * 60 * 60 * 1000)));
      const draft = await generateQuoteFollowupDraft({
        customerFirstName: firstNameFrom(contact.name) || 'there',
        jobDescription: job.description || job.title || null,
        quoteNumber: job.jobNumber ?? null,
        quoteAmount: job.totalIncludingGst ?? job.totalAmount ?? null,
        daysSince,
        attemptNumber: 1,
        channel,
        businessName: settings?.businessName || undefined,
      });
      if (draft.body) { body = draft.body; html = undefined; }
    } catch (err) {
      console.error(`[Lanes] AI nudge draft failed job #${job.jobNumber}, using fallback message:`, err);
    }
  }

  const message = fillTemplate(body, vars);
  subject = fillTemplate(subject, vars);
  if (html) html = fillTemplate(html, vars);

  // Default behaviour is to send straight away (decided with the user). A lane can opt into the
  // owner-approval queue per-automation via config.requireApproval.
  if (cfg.requireApproval) {
    await storage.createPendingOutboundMessage({
      jobId: job.id,
      customerId: job.customerId || undefined,
      recipientName: contact.name || undefined,
      recipientPhone: channel === 'sms' ? contact.phone : undefined,
      recipientEmail: channel === 'email' ? contact.email : undefined,
      message,
      channel,
      status: 'pending',
    });
    console.log(`[Lanes] nudge queued for approval (${channel}) job #${job.jobNumber}`);
    return true;
  }

  if (channel === 'sms') {
    await smsService.sendSMS({ to: contact.phone, message });
  } else {
    await emailService.sendEmail({
      to: contact.email,
      fromName: settings?.businessName || undefined, // From shows the tenant's business name; blank → platform default
      subject,
      text: message,
      html,
      jobNumber: job.jobNumber ? String(job.jobNumber) : undefined,
    });
  }
  console.log(`[Lanes] nudge sent (${channel}${cfg.useAi ? ', ai' : cfg.templateId ? ', template' : ''}) job #${job.jobNumber}`);
  return true;
}

async function runStaffReminder(job: Job, cfg: StaffConfig): Promise<void> {
  const customerName = (await resolveJobContact(job)).name || 'Customer';
  const message = cfg.message || `Job #${job.jobNumber} (${job.title || customerName}) needs attention.`;
  const actionUrl = `/dispatch?job=${job.id}`;
  const pushData = { type: 'lane_reminder', jobId: job.id, jobNumber: String(job.jobNumber || '') };

  // Back-compat: the old single `recipients` field maps onto the new flags.
  const wantOwner = cfg.notifyOwner ?? (cfg.recipients === 'owner' || cfg.recipients === 'both');
  const wantAssigned = cfg.notifyAssigned ?? (cfg.recipients === 'assigned' || cfg.recipients === 'both');

  // Bell notification — owner-facing (no userId = visible to admins). Always created so there's an
  // in-app record regardless of which channels are targeted.
  await storage.createNotification({
    title: 'Lane reminder',
    message,
    type: 'lane_reminder',
    priority: cfg.priority || 'medium',
    isRead: false,
    jobId: job.id,
    customerId: job.customerId || undefined,
    actionUrl,
    metadata: { jobNumber: job.jobNumber, laneId: job.laneId },
  });

  // Owner / admins push.
  if (wantOwner) {
    await pushToAdminsWithCustomerMessages({ title: 'Lane reminder', body: message, clickAction: actionUrl, data: pushData });
  }

  // Assigned crew push.
  if (wantAssigned) {
    const assigned = (job.assignedStaffIds && job.assignedStaffIds.length ? job.assignedStaffIds : job.assignedTo) || [];
    if (assigned.length) {
      await notifyEmployees(assigned, { title: 'Lane reminder', body: message, clickAction: actionUrl, data: pushData });
    }
  }

  // Specific team members chosen by id — push to their devices.
  if (cfg.staffIds?.length) {
    await notifyEmployees(cfg.staffIds, { title: 'Lane reminder', body: message, clickAction: actionUrl, data: pushData });
  }

  // Typed email recipients — send a plain email (best-effort; may be someone with no app account).
  for (const email of (cfg.emails || [])) {
    const to = email.trim();
    if (!to) continue;
    await emailService.sendEmail({ to, subject: `Lane reminder — Job #${job.jobNumber}`, text: message })
      .catch(err => console.error(`[Lanes] staff reminder email to ${to} failed:`, err));
  }

  // Typed phone recipients — send an SMS (best-effort).
  for (const phone of (cfg.phones || [])) {
    const to = phone.trim();
    if (!to) continue;
    await smsService.sendSMS({ to, message })
      .catch(err => console.error(`[Lanes] staff reminder SMS to ${to} failed:`, err));
  }

  console.log(`[Lanes] staff reminder fired job #${job.jobNumber}`);
}

async function runAutoMove(job: Job, cfg: AutoMoveConfig): Promise<void> {
  if (!cfg.targetLaneId) { console.log(`[Lanes] auto_move skipped (no targetLaneId) job #${job.jobNumber}`); return; }
  if (cfg.targetLaneId === job.laneId) return; // already there — no-op, avoids a needless re-stamp
  // assignJobToLane re-stamps lane_entered_at (the target lane's clock starts fresh) and naturally
  // re-arms the target lane's automations on the next cron tick. We do NOT cascade on_enter here,
  // so an A→B / B→A pair cannot ping-pong synchronously.
  await storage.assignJobToLane(job.id, cfg.targetLaneId);
  console.log(`[Lanes] auto_move job #${job.jobNumber} → lane ${cfg.targetLaneId}`);
}

async function runCreateTask(job: Job, cfg: TaskConfig): Promise<void> {
  const dueDate = cfg.dueInDays && cfg.dueInDays > 0
    ? new Date(Date.now() + cfg.dueInDays * 24 * 60 * 60 * 1000)
    : null;
  await storage.createTask({
    title: cfg.title || `Follow up on job #${job.jobNumber}`,
    category: cfg.category || undefined,
    status: 'todo',
    assigneeId: cfg.assigneeId || undefined,
    linkedJobId: job.id,
    dueDate,
  });
  console.log(`[Lanes] task created for job #${job.jobNumber}`);
}

async function runChangeStatus(job: Job, cfg: ChangeStatusConfig): Promise<void> {
  if (!cfg.targetStatus || job.status === cfg.targetStatus) return;
  await storage.updateJob(job.id, { status: cfg.targetStatus } as Partial<InsertJob>);
  console.log(`[Lanes] status → ${cfg.targetStatus} job #${job.jobNumber}`);
}

async function runAddNote(job: Job, cfg: AddNoteConfig): Promise<void> {
  await storage.createJobDiaryEntry({
    jobId: job.id,
    entryType: 'note',
    title: 'Lane automation',
    description: cfg.note || 'Automated note.',
    authorName: 'Automation',
    authorRole: 'system',
    tags: ['lane-automation'],
  });
  console.log(`[Lanes] note added job #${job.jobNumber}`);
}

async function runAssignStaff(job: Job, cfg: AssignStaffConfig): Promise<void> {
  if (!cfg.staffIds?.length) return;
  await storage.updateJob(job.id, { assignedStaffIds: cfg.staffIds, assignedTo: cfg.staffIds } as Partial<InsertJob>);
  console.log(`[Lanes] assigned ${cfg.staffIds.length} staff job #${job.jobNumber}`);
}

/**
 * Dispatch a single automation. Returns false only when the action was DEFERRED (quiet hours) so the
 * caller skips recording a run and retries next tick; true when it ran (or was a permanent skip).
 */
async function executeLaneAutomation(job: Job, automation: LaneAutomation): Promise<boolean> {
  const config = (automation.config || {}) as Record<string, unknown>;
  switch (automation.type) {
    case 'customer_nudge': return runCustomerNudge(job, config as NudgeConfig);
    case 'staff_reminder': await runStaffReminder(job, config as StaffConfig); return true;
    case 'auto_move': await runAutoMove(job, config as AutoMoveConfig); return true;
    case 'create_task': await runCreateTask(job, config as TaskConfig); return true;
    case 'change_status': await runChangeStatus(job, config as ChangeStatusConfig); return true;
    case 'add_note': await runAddNote(job, config as AddNoteConfig); return true;
    case 'assign_staff': await runAssignStaff(job, config as AssignStaffConfig); return true;
    default:
      console.warn(`[Lanes] unknown automation type '${automation.type}' (id ${automation.id})`);
      return true;
  }
}

/**
 * Fire a lane's automations for a job under the right tenant. Each automation is gated by its
 * conditions (only fire if the job matches) and max-attempts guard before running, and a run is
 * recorded unless the action deferred itself (e.g. quiet hours).
 */
async function fireAutomations(job: Job, automations: LaneAutomation[]): Promise<void> {
  if (!job.laneId || !automations.length) return;
  const laneId = job.laneId;
  const since = job.laneEnteredAt ? new Date(job.laneEnteredAt) : new Date(0);
  await runWithBusiness(job.businessId ?? undefined, async () => {
    for (const a of automations) {
      try {
        const guard = (a.config || {}) as GuardConfig;
        if (!conditionsMet(job, guard.conditions)) continue;
        if (guard.maxAttempts && guard.maxAttempts > 0) {
          const fired = await storage.countLaneAutomationRunsSince(job.id, a.id, since);
          if (fired >= guard.maxAttempts) continue;
        }
        const recorded = await executeLaneAutomation(job, a);
        if (recorded) await storage.recordLaneAutomationRun({ jobId: job.id, laneId, automationId: a.id });
      } catch (err) {
        console.error(`[Lanes] automation ${a.id} (${a.type}) failed for job ${job.id}:`, err);
      }
    }
  });
}

/** Called synchronously when a job enters a lane (from the assign route). */
export async function runLaneEntryAutomations(job: Job): Promise<void> {
  if (!job.laneId) return;
  const automations = (await storage.getLaneAutomations(job.laneId))
    .filter(a => a.enabled && a.trigger === 'on_enter');
  await fireAutomations(job, automations);
}

/** Called from AutomatedTriggers.onJobStatusChange — runs status_changed automations (e.g. auto_move). */
export async function runLaneStatusChangeAutomations(job: Job): Promise<void> {
  if (!job.laneId) return;
  const automations = (await storage.getLaneAutomations(job.laneId))
    .filter(a => a.enabled && a.trigger === 'status_changed');
  await fireAutomations(job, automations);
}

function configStatus(config: unknown): string | undefined {
  const v = (config as Record<string, unknown> | null)?.status;
  return typeof v === 'string' && v ? v : undefined;
}

/**
 * Move a job into any lane configured to auto-enter on `event`, then fire that lane's on_enter
 * automations (the "days in lane" clock starts now). Tenant-safe in both request and poller contexts
 * because getAutoEntryLanes is filtered by the job's businessId. For 'status_changed', a lane may
 * pin a target status in its config.
 */
export async function runLaneEntryForEvent(job: Job, event: string): Promise<void> {
  try {
    const entries = (await storage.getAutoEntryLanes(event, job.businessId ?? undefined))
      .filter((e) => event !== 'status_changed' || (configStatus(e.config) ?? job.status ?? undefined) === job.status);
    if (!entries.length) return;
    const targetLaneId = entries[0].laneId;
    if (job.laneId === targetLaneId) return;
    const moved = await storage.assignJobToLane(job.id, targetLaneId);
    console.log(`[Lanes] job #${moved.jobNumber} auto-entered lane ${targetLaneId} on ${event}`);
    await runLaneEntryAutomations(moved);
  } catch (err) {
    console.error(`[Lanes] entry-for-event ${event} failed:`, err);
  }
}

/** Remove a job from its lane if that lane is set to auto-exit on `event`. */
export async function runLaneExitForEvent(job: Job, event: string): Promise<void> {
  try {
    if (!job.laneId) return;
    const exits = (await storage.getLaneAutomations(job.laneId)).filter((a) =>
      a.enabled && a.type === 'auto_exit' && a.trigger === event &&
      (event !== 'status_changed' || (configStatus(a.config) ?? job.status ?? undefined) === job.status));
    if (!exits.length) return;
    await storage.assignJobToLane(job.id, null);
    console.log(`[Lanes] job #${job.jobNumber} auto-left its lane on ${event}`);
  } catch (err) {
    console.error(`[Lanes] exit-for-event ${event} failed:`, err);
  }
}

/** Backwards-compatible wrapper for the two proposal-send routes (quote_sent entry). */
export async function onQuoteSentToLane(jobId: string): Promise<void> {
  const job = await storage.getJob(jobId);
  if (job) await runLaneEntryForEvent(job, 'quote_sent');
}

/** Convenience for an arbitrary job event (load job, run exit then entry). Tenant-safe. */
export async function onLaneJobEvent(jobId: string, event: string): Promise<void> {
  const job = await storage.getJob(jobId);
  if (!job) return;
  await runLaneExitForEvent(job, event);
  await runLaneEntryForEvent(job, event);
}

/** Does the job still have an invoice that isn't paid or cancelled? (i.e. still owing). */
async function jobStillOwes(jobId: string): Promise<boolean> {
  const invoices = await storage.getInvoicesByJob(jobId).catch(() => []);
  return invoices.some((inv) => inv.status !== 'paid' && inv.status !== 'cancelled');
}

/**
 * Late-payment scan (runs hourly, just before the day-automation cron). Two halves:
 *  1. ENTRY — any job with an overdue, still-owing invoice is auto-added to a lane configured to
 *     auto-enter on 'invoice_overdue' (only if the job isn't already in a lane, so we never yank it
 *     out of another bucket).
 *  2. EXIT — any job sitting in a lane that auto-exits on 'invoice_paid' is removed once its
 *     invoices are all settled. Running this before the reminder cron means a paid job leaves the
 *     chase lane in the same tick, so no further late-payment reminder fires for it.
 */
export async function runLaneInvoiceChecks(): Promise<void> {
  // 1. Entry: overdue + still owing → chase lane.
  try {
    const overdue = await storage.getOverdueUnpaidInvoicesGlobal();
    const seen = new Set<string>();
    for (const inv of overdue) {
      if (!inv.jobId || seen.has(inv.jobId)) continue;
      seen.add(inv.jobId);
      const job = await storage.getJob(inv.jobId);
      if (!job || job.laneId) continue; // already in a lane — don't move it
      await runLaneEntryForEvent(job, 'invoice_overdue');
    }
  } catch (err) {
    console.error('[Lanes] overdue-invoice entry scan failed:', err);
  }

  // 2. Exit: jobs in an "auto-exit on payment" lane that no longer owe → remove them.
  try {
    const jobs = await storage.getJobsInLanesGlobal();
    for (const job of jobs) {
      if (!job.laneId) continue;
      const lane = await storage.getLaneAutomations(job.laneId);
      const exitsOnPaid = lane.some((a) => a.enabled && a.type === 'auto_exit' && a.trigger === 'invoice_paid');
      if (!exitsOnPaid) continue;
      if (await jobStillOwes(job.id)) continue;
      await storage.assignJobToLane(job.id, null);
      console.log(`[Lanes] job #${job.jobNumber} auto-left its lane (invoice settled)`);
    }
  } catch (err) {
    console.error('[Lanes] paid-invoice exit scan failed:', err);
  }
}

/** Hourly cron entry point — evaluates all days_in_lane automations with fire-once de-dup. */
export async function runLaneAutomationChecks(): Promise<void> {
  console.log('[Lanes] running lane automation checks...');
  const [jobs, automations] = await Promise.all([
    storage.getJobsInLanesGlobal(),
    storage.getActiveLaneAutomationsGlobal(),
  ]);

  // Group day-based automations by lane.
  const byLane = new Map<string, LaneAutomation[]>();
  for (const a of automations) {
    if (a.trigger !== 'days_in_lane') continue;
    const list = byLane.get(a.laneId) ?? [];
    list.push(a);
    byLane.set(a.laneId, list);
  }

  const now = Date.now();
  const results = await Promise.allSettled(jobs.map(async (job) => {
    if (!job.laneId) return;
    const laneAutomations = byLane.get(job.laneId);
    if (!laneAutomations?.length) return;
    if (!job.laneEnteredAt) return; // no clock to measure against (legacy assignment) — skip
    const enteredAt = new Date(job.laneEnteredAt);
    const daysIn = Math.floor((now - enteredAt.getTime()) / (24 * 60 * 60 * 1000));

    const due: LaneAutomation[] = [];
    for (const a of laneAutomations) {
      if (a.triggerDays == null || daysIn < a.triggerDays) continue;
      // Cadence: by default an automation fires once per lane stay (no run since the job entered).
      // If config.repeat is on, it re-fires every config.repeatEveryDays — i.e. fire again only if
      // nothing has fired in that window.
      const cfg = (a.config || {}) as { repeat?: boolean; repeatEveryDays?: number };
      const everyDays = Number(cfg.repeatEveryDays) || 0;
      const since = (cfg.repeat && everyDays > 0)
        ? new Date(now - everyDays * 24 * 60 * 60 * 1000)
        : enteredAt;
      const alreadyFired = await storage.hasLaneAutomationFiredSince(job.id, a.id, since);
      if (alreadyFired) continue;
      due.push(a);
    }
    if (due.length) await fireAutomations(job, due);
  }));

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    errors.forEach(e => console.error('[Lanes] job check failed:', (e as PromiseRejectedResult).reason));
  } else {
    console.log('[Lanes] lane automation checks complete.');
  }
}

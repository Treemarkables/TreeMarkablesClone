import { storage } from '../storage.js';
import type { Job, LaneAutomation } from '@shared/schema';
import { runWithBusiness } from '../tenancy/tenantStore.js';
import { smsService } from './smsService.js';
import { emailService } from './emailService.js';
import { notifyEmployees, pushToAdminsWithCustomerMessages } from './notificationHelper.js';

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

interface NudgeConfig { channel?: 'sms' | 'email'; template?: string; requireApproval?: boolean }
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

async function runCustomerNudge(job: Job, cfg: NudgeConfig): Promise<void> {
  const contact = await resolveJobContact(job);
  const vars = {
    firstName: firstNameFrom(contact.name) || 'there',
    name: contact.name || 'there',
    jobNumber: String(job.jobNumber || ''),
    jobTitle: job.title || '',
  };
  const message = fillTemplate(cfg.template || 'Hi {firstName}, just following up on your job with us — let us know if you have any questions.', vars);

  // Resolve channel; fall back if the requested channel has no recipient on file.
  let channel: 'sms' | 'email' = cfg.channel === 'email' ? 'email' : 'sms';
  if (channel === 'sms' && !contact.phone && contact.email) channel = 'email';
  if (channel === 'email' && !contact.email && contact.phone) channel = 'sms';
  if (channel === 'sms' && !contact.phone) { console.log(`[Lanes] nudge skipped (no phone) job #${job.jobNumber}`); return; }
  if (channel === 'email' && !contact.email) { console.log(`[Lanes] nudge skipped (no email) job #${job.jobNumber}`); return; }

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
    return;
  }

  if (channel === 'sms') {
    await smsService.sendSMS({ to: contact.phone, message });
  } else {
    await emailService.sendEmail({
      to: contact.email,
      subject: `Following up on your job${job.jobNumber ? ` #${job.jobNumber}` : ''}`,
      text: message,
      jobNumber: job.jobNumber ? String(job.jobNumber) : undefined,
    });
  }
  console.log(`[Lanes] nudge sent (${channel}) job #${job.jobNumber}`);
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

/** Dispatch a single automation. Shared by the cron, on-enter, and status-change paths. */
async function executeLaneAutomation(job: Job, automation: LaneAutomation): Promise<void> {
  const config = (automation.config || {}) as Record<string, unknown>;
  switch (automation.type) {
    case 'customer_nudge': return runCustomerNudge(job, config as NudgeConfig);
    case 'staff_reminder': return runStaffReminder(job, config as StaffConfig);
    case 'auto_move': return runAutoMove(job, config as AutoMoveConfig);
    case 'create_task': return runCreateTask(job, config as TaskConfig);
    default:
      console.warn(`[Lanes] unknown automation type '${automation.type}' (id ${automation.id})`);
  }
}

/** Fire a lane's automations for a job under the right tenant, recording each run. */
async function fireAutomations(job: Job, automations: LaneAutomation[]): Promise<void> {
  if (!job.laneId || !automations.length) return;
  const laneId = job.laneId;
  await runWithBusiness(job.businessId ?? undefined, async () => {
    for (const a of automations) {
      try {
        await executeLaneAutomation(job, a);
        await storage.recordLaneAutomationRun({ jobId: job.id, laneId, automationId: a.id });
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

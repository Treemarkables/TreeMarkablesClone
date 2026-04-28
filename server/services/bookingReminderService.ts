import { and, eq, lte, sql as drizzleSql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';
import type { Job, BookingReminder, BookingReminderOffset } from '@shared/schema';
import { storage } from '../storage';
import { emailService } from './emailService';
import { smsService } from './smsService';
import { formatNZTime } from '@shared/dateUtils';

type Channel = 'email' | 'sms' | 'both';

function getChannel(value: unknown, fallback: Channel = 'both'): Channel {
  return value === 'email' || value === 'sms' || value === 'both' ? value : fallback;
}

function pickRecipientEmail(job: Job): string | null {
  return (job.jobContactEmail || job.billingContactEmail || null) as string | null;
}

function pickRecipientPhone(job: Job): string | null {
  return (job.jobContactMobile || job.jobContactPhone || job.billingContactMobile || job.billingContactPhone || null) as string | null;
}

function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template,
  );
}

async function buildReminderContent(
  job: Job,
  channel: Channel,
  offsetLabel: string | null,
): Promise<{ subject: string; emailBody: string; smsBody: string }> {
  const settings = await storage.getBusinessSettings();
  const businessName = settings?.businessName || 'Treemarkables';
  const firstName = job.jobContactFirstName || 'there';
  const scheduledAt = job.scheduledDate ? new Date(job.scheduledDate) : null;
  const dateStr = scheduledAt ? formatNZTime(scheduledAt, 'full') : 'your scheduled time';
  const startTime = job.scheduledStartTime || '';
  const address = job.address || '';
  const jobTitle = job.title || 'tree service';
  const phone = settings?.businessPhone || '';

  const vars: Record<string, string> = {
    firstName,
    customerName: [job.jobContactFirstName, job.jobContactLastName].filter(Boolean).join(' ') || firstName,
    scheduledDate: dateStr,
    scheduledTime: startTime,
    jobAddress: address,
    jobTitle,
    jobNumber: job.jobNumber,
    businessName,
    businessPhone: phone,
    offsetLabel: offsetLabel || '',
  };

  const defaultSubject = `Reminder — your ${jobTitle} booking on ${formatNZTime(scheduledAt || new Date(), 'date')}`;

  let subject = defaultSubject;
  let emailHtml = '';
  let sms = '';

  // Try to load configured templates
  const emailTemplateId = settings?.bookingReminderEmailTemplateId;
  const smsTemplateId = settings?.bookingReminderSmsTemplateId;

  if ((channel === 'email' || channel === 'both') && emailTemplateId) {
    try {
      const [tpl] = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, emailTemplateId)).limit(1);
      if (tpl?.htmlContent) {
        subject = applyTemplateVars(tpl.subject || defaultSubject, vars);
        emailHtml = applyTemplateVars(tpl.htmlContent, vars);
      }
    } catch (err) {
      console.warn('[BookingReminders] Failed to load email template, using default:', err);
    }
  }

  if (!emailHtml) {
    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <p>Hi ${firstName},</p>
        <p>Just a friendly reminder that your booking with ${businessName} is coming up:</p>
        <ul>
          <li><strong>Job:</strong> ${jobTitle}</li>
          <li><strong>When:</strong> ${dateStr}${startTime ? ` at ${startTime}` : ''}</li>
          ${address ? `<li><strong>Where:</strong> ${address}</li>` : ''}
        </ul>
        <p>If you need to reschedule or have any questions${phone ? `, please give us a call on ${phone}` : ''}.</p>
        <p style="margin-top: 24px;">Thanks,<br><strong>${businessName}</strong></p>
      </div>
    `.trim();
  }

  if ((channel === 'sms' || channel === 'both') && smsTemplateId) {
    try {
      const [tpl] = await db.select().from(schema.smsTemplates).where(eq(schema.smsTemplates.id, smsTemplateId)).limit(1);
      if (tpl?.message) {
        sms = applyTemplateVars(tpl.message, vars);
      }
    } catch (err) {
      console.warn('[BookingReminders] Failed to load SMS template, using default:', err);
    }
  }

  if (!sms) {
    sms = `Hi ${firstName}, reminder: your ${jobTitle} booking is on ${dateStr}${startTime ? ` at ${startTime}` : ''}. - ${businessName}`;
  }

  return { subject, emailBody: emailHtml, smsBody: sms };
}

/**
 * Send a single booking reminder row. Updates the row with sent state.
 * Used by both processDueReminders() and the manual "Send reminder now" path.
 */
export async function sendBookingReminderRow(reminderId: string): Promise<{ ok: boolean; error?: string }> {
  const [reminder] = await db.select().from(schema.bookingReminders).where(eq(schema.bookingReminders.id, reminderId)).limit(1);
  if (!reminder) return { ok: false, error: 'Reminder not found' };
  if (reminder.status === 'sent' || reminder.status === 'cancelled') {
    return { ok: false, error: `Reminder is ${reminder.status}` };
  }

  const job = await storage.getJob(reminder.jobId);
  if (!job) {
    await db.update(schema.bookingReminders)
      .set({ status: 'failed', error: 'Job not found', updatedAt: new Date() })
      .where(eq(schema.bookingReminders.id, reminderId));
    return { ok: false, error: 'Job not found' };
  }

  const channel = getChannel(reminder.channel, 'both');
  const recipientEmail = reminder.recipientEmail || pickRecipientEmail(job);
  const recipientPhone = reminder.recipientPhone || pickRecipientPhone(job);

  const { subject, emailBody, smsBody } = await buildReminderContent(job, channel, null);

  let emailSent = false;
  let smsSent = false;
  const errors: string[] = [];

  if ((channel === 'email' || channel === 'both') && recipientEmail) {
    try {
      const result = await emailService.sendEmail({
        to: recipientEmail,
        subject,
        html: emailBody,
        text: emailBody.replace(/<[^>]*>/g, ''),
      });
      emailSent = !!result.success;
      if (!result.success) errors.push(`email: ${result.error || 'failed'}`);
    } catch (err) {
      errors.push(`email: ${(err as Error).message}`);
    }
  } else if (channel !== 'sms' && !recipientEmail) {
    errors.push('email: no recipient address');
  }

  if ((channel === 'sms' || channel === 'both') && recipientPhone) {
    try {
      const ok = await smsService.sendSMS({ to: recipientPhone, message: smsBody });
      smsSent = !!ok;
      if (!ok) errors.push('sms: failed');
    } catch (err) {
      errors.push(`sms: ${(err as Error).message}`);
    }
  } else if (channel !== 'email' && !recipientPhone) {
    errors.push('sms: no recipient phone');
  }

  const anySent = emailSent || smsSent;
  const status: 'sent' | 'failed' = anySent ? 'sent' : 'failed';

  await db.update(schema.bookingReminders)
    .set({
      status,
      emailSent,
      smsSent,
      sentAt: anySent ? new Date() : null,
      error: errors.length ? errors.join('; ') : null,
      subject,
      emailBody: emailSent ? emailBody : reminder.emailBody,
      smsBody: smsSent ? smsBody : reminder.smsBody,
      updatedAt: new Date(),
    })
    .where(eq(schema.bookingReminders.id, reminderId));

  // Audit trail: write a diary entry so the user sees the reminder in the timeline
  try {
    const channelDescription = [emailSent && 'email', smsSent && 'SMS'].filter(Boolean).join(' + ') || 'reminder';
    const targetDescription = [
      emailSent && recipientEmail,
      smsSent && recipientPhone,
    ].filter(Boolean).join(', ');
    await storage.createJobDiaryEntry({
      jobId: job.id,
      entryType: 'communication',
      title: anySent ? `Booking reminder sent (${channelDescription})` : `Booking reminder failed`,
      description: anySent
        ? `Reminder sent to ${targetDescription || 'customer'} for booking on ${formatNZTime(job.scheduledDate || new Date(), 'full')}`
        : `Reminder could not be sent: ${errors.join('; ')}`,
      authorName: 'System',
      metadata: {
        reminderId,
        channel,
        emailSent,
        smsSent,
        manual: reminder.manual,
        offsetHours: reminder.offsetHours,
      } as any,
      isPrivate: false,
    });
  } catch (err) {
    console.error('[BookingReminders] Failed to create diary entry:', err);
  }

  return { ok: anySent, error: anySent ? undefined : errors.join('; ') };
}

/**
 * Schedule one reminder per configured offset for the given job. Cancels
 * any previously-pending automatic reminders for the job first so the rows
 * stay in sync with the latest scheduledDate.
 */
export async function scheduleRemindersForJob(jobId: string): Promise<{ created: number; skipped: number }> {
  const job = await storage.getJob(jobId);
  if (!job || !job.scheduledDate) return { created: 0, skipped: 0 };

  const settings = await storage.getBusinessSettings();
  const offsets = (settings?.bookingReminderOffsets as BookingReminderOffset[] | null) || [];
  const defaultChannel = getChannel(settings?.bookingReminderChannel, 'both');

  // Cancel existing pending non-manual reminders for this job (avoids dupes on reschedule)
  await db.update(schema.bookingReminders)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(
      eq(schema.bookingReminders.jobId, jobId),
      eq(schema.bookingReminders.status, 'pending'),
      eq(schema.bookingReminders.manual, false),
    ));

  const recipientEmail = pickRecipientEmail(job);
  const recipientPhone = pickRecipientPhone(job);
  const scheduledMs = new Date(job.scheduledDate).getTime();
  const now = Date.now();

  let created = 0;
  let skipped = 0;
  for (const offset of offsets) {
    const sendAt = new Date(scheduledMs - offset.hoursBefore * 60 * 60 * 1000);
    // Skip offsets that would land in the past
    if (sendAt.getTime() <= now) {
      skipped += 1;
      continue;
    }
    const channel = getChannel(offset.channel, defaultChannel);
    await db.insert(schema.bookingReminders).values({
      jobId,
      scheduledFor: sendAt,
      channel,
      status: 'pending',
      manual: false,
      offsetHours: offset.hoursBefore,
      recipientEmail,
      recipientPhone,
    });
    created += 1;
  }

  return { created, skipped };
}

/**
 * Cancel all pending reminders for a job (e.g. when the operator turns off
 * the per-job toggle or unschedules the job).
 */
export async function cancelPendingRemindersForJob(jobId: string): Promise<number> {
  const result = await db.update(schema.bookingReminders)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(
      eq(schema.bookingReminders.jobId, jobId),
      eq(schema.bookingReminders.status, 'pending'),
    ))
    .returning({ id: schema.bookingReminders.id });
  return result.length;
}

/**
 * Create a manual reminder row and send it immediately.
 */
export async function createAndSendManualReminder(jobId: string, channelOverride?: Channel): Promise<{ ok: boolean; error?: string; reminderId?: string }> {
  const job = await storage.getJob(jobId);
  if (!job) return { ok: false, error: 'Job not found' };

  const settings = await storage.getBusinessSettings();
  const channel = getChannel(channelOverride ?? settings?.bookingReminderChannel, 'both');

  const [row] = await db.insert(schema.bookingReminders).values({
    jobId,
    scheduledFor: new Date(),
    channel,
    status: 'pending',
    manual: true,
    recipientEmail: pickRecipientEmail(job),
    recipientPhone: pickRecipientPhone(job),
  }).returning();

  const result = await sendBookingReminderRow(row.id);
  return { ok: result.ok, error: result.error, reminderId: row.id };
}

/**
 * Process every pending reminder whose scheduled_for is now-or-earlier.
 * Called from the notification queue worker tick.
 */
export async function processDueReminders(): Promise<void> {
  const now = new Date();
  const due = await db.select().from(schema.bookingReminders)
    .where(and(
      eq(schema.bookingReminders.status, 'pending'),
      lte(schema.bookingReminders.scheduledFor, now),
    ))
    .limit(50);

  if (due.length === 0) return;
  console.log(`[BookingReminders] Processing ${due.length} due reminder(s)`);

  for (const row of due) {
    try {
      await sendBookingReminderRow(row.id);
    } catch (err) {
      console.error(`[BookingReminders] Error processing reminder ${row.id}:`, err);
      await db.update(schema.bookingReminders)
        .set({ status: 'failed', error: (err as Error).message, updatedAt: new Date() })
        .where(eq(schema.bookingReminders.id, row.id));
    }
  }
}

export async function getRemindersForJob(jobId: string): Promise<BookingReminder[]> {
  return await db.select().from(schema.bookingReminders)
    .where(eq(schema.bookingReminders.jobId, jobId))
    .orderBy(drizzleSql`${schema.bookingReminders.scheduledFor} desc`);
}

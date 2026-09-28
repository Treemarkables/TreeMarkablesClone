/**
 * Quote follow-up workflow.
 *
 * quoteFollowUpDetection runs hourly (RUN_CRONS, both app instances). It only
 * inserts drafts. Approve & Send is the only path that talks to a customer,
 * and it refuses unless confirm is the boolean true.
 *
 * Reads and writes go through the owner connection filtered by business id.
 * Callers wrap storage helpers in runWithBusiness so quote numbers, diary
 * rows, and notifications stamp the same tenant.
 */
import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import { ownerDb } from "./db";
import { storage } from "./storage";
import { runWithBusiness, currentBusinessId } from "./tenancy/tenantStore";
import { smsService } from "./services/smsService";
import { emailService } from "./services/emailService";
import { notifyEmployee } from "./services/notificationHelper";
import { getNZDateString, nzTimeToUTC } from "@shared/dateUtils";
import { APP_URL } from "./config/appUrl";
import { commitApprovedSend } from "@shared/quoteFollowUpApproval";
import {
  buildRequoteDraft,
  followUpQueuePath,
  isWaitingFollowUp,
  parseNudgeDays,
  planQuoteFollowUps,
  SENT_LOOKBACK_DAYS,
  withNewQuoteNumber,
  type DiaryReplySignal,
  type FollowUpChannel,
  type PlannedCreate,
  type QuoteSignal,
  type RateCardItem,
} from "@shared/quoteFollowUps";
import * as schema from "@shared/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_QUOTE_STATUSES = ["sent", "viewed", "expired"];

export interface QuoteFollowUpView {
  id: string;
  quoteId: string;
  quoteNumber: string;
  jobId: string | null;
  customerId: string | null;
  customerName: string | null;
  kind: string;
  nudgeStep: number;
  channel: string;
  status: string;
  waiting: boolean;
  subject: string | null;
  message: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  requoteId: string | null;
  requoteNumber: string | null;
  snoozeUntil: string | null;
  daysQuiet: number | null;
  links: {
    queue: string;
    job: string | null;
  };
}

export interface QuoteFollowUpList {
  waiting: number;
  followUps: QuoteFollowUpView[];
  links: { queue: string; settings: string };
}

function requireBusinessId(businessId: string | null | undefined): string {
  if (!businessId) throw new Error("Missing business");
  return businessId;
}

function sessionBusinessId(): string {
  const businessId = currentBusinessId();
  if (!businessId) {
    const error = new Error("Not authenticated");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return businessId;
}

export function httpStatus(error: unknown): number {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" ? status : 500;
}

function appBase(): string {
  return APP_URL.replace(/\/$/, "");
}

function directionOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const direction = (metadata as { direction?: unknown }).direction;
  return typeof direction === "string" ? direction : null;
}

function nzHour(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  const parsed = Number(hour);
  return Number.isFinite(parsed) ? parsed : 12;
}

async function loadViews(businessId: string, base = appBase()): Promise<QuoteFollowUpList> {
  const rows = await ownerDb
    .select()
    .from(schema.quoteFollowUps)
    .where(and(
      eq(schema.quoteFollowUps.businessId, businessId),
      inArray(schema.quoteFollowUps.status, ["draft", "snoozed"]),
    ))
    .orderBy(asc(schema.quoteFollowUps.createdAt))
    .limit(200);

  const quoteIds = Array.from(new Set(rows.flatMap((row) => [row.quoteId, row.requoteId].filter((id): id is string => !!id))));
  const quoteRows = quoteIds.length === 0
    ? []
    : await ownerDb
      .select({
        id: schema.quotes.id,
        quoteNumber: schema.quotes.quoteNumber,
        sentDate: schema.quotes.sentDate,
        updatedAt: schema.quotes.updatedAt,
      })
      .from(schema.quotes)
      .where(and(eq(schema.quotes.businessId, businessId), inArray(schema.quotes.id, quoteIds)));
  const quotesById = new Map(quoteRows.map((row) => [row.id, row]));
  const now = Date.now();

  const followUps: QuoteFollowUpView[] = rows.map((row) => {
    const quote = quotesById.get(row.quoteId);
    const requote = row.requoteId ? quotesById.get(row.requoteId) : undefined;
    const sent = quote?.sentDate ? new Date(quote.sentDate).getTime() : null;
    const updated = quote?.updatedAt ? new Date(quote.updatedAt).getTime() : null;
    const anchor = sent == null ? null : (updated != null && updated > sent + 60_000 ? updated : sent);
    const daysQuiet = anchor == null ? null : Math.max(0, Math.floor((now - anchor) / DAY_MS));
    return {
      id: row.id,
      quoteId: row.quoteId,
      quoteNumber: quote?.quoteNumber || "",
      jobId: row.jobId,
      customerId: row.customerId,
      customerName: row.recipientName,
      kind: row.kind,
      nudgeStep: row.nudgeStep,
      channel: row.channel,
      status: row.status,
      waiting: isWaitingFollowUp(row.status, row.snoozeUntil, now),
      subject: row.subject,
      message: row.message,
      recipientPhone: row.recipientPhone,
      recipientEmail: row.recipientEmail,
      requoteId: row.requoteId,
      requoteNumber: requote?.quoteNumber || null,
      snoozeUntil: row.snoozeUntil ? new Date(row.snoozeUntil).toISOString() : null,
      daysQuiet,
      links: {
        queue: `${base}${followUpQueuePath(row.id)}`,
        job: row.jobId ? `${base}/dispatch?job=${row.jobId}` : null,
      },
    };
  });

  return {
    waiting: followUps.filter((row) => row.waiting).length,
    followUps,
    links: {
      queue: `${base}/quote-follow-ups`,
      settings: `${base}/settings/quote-followup`,
    },
  };
}

export async function listQuoteFollowUpsForSession(): Promise<QuoteFollowUpList> {
  return loadViews(sessionBusinessId());
}

export async function listQuoteFollowUpsForBusiness(businessId: string): Promise<QuoteFollowUpList> {
  return loadViews(requireBusinessId(businessId));
}

export async function countWaitingQuoteFollowUps(): Promise<number> {
  const businessId = currentBusinessId();
  if (!businessId) return 0;
  const list = await loadViews(businessId);
  return list.waiting;
}

async function rowForBusiness(businessId: string, id: string) {
  const [row] = await ownerDb
    .select()
    .from(schema.quoteFollowUps)
    .where(and(eq(schema.quoteFollowUps.id, id), eq(schema.quoteFollowUps.businessId, businessId)))
    .limit(1);
  return row;
}

export async function updateQuoteFollowUpDraft(
  businessId: string,
  id: string,
  patch: { message?: unknown; subject?: unknown; channel?: unknown },
): Promise<QuoteFollowUpView | null> {
  const row = await rowForBusiness(businessId, id);
  if (!row) return null;
  if (row.status !== "draft" && row.status !== "snoozed") {
    const error = new Error("Only a waiting follow-up can be edited.");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
  const updates: Partial<typeof schema.quoteFollowUps.$inferInsert> = { updatedAt: new Date() };
  if (typeof patch.message === "string") {
    if (!patch.message.trim()) {
      const error = new Error("Write a message before saving.");
      (error as Error & { status?: number }).status = 400;
      throw error;
    }
    updates.message = patch.message.trim();
  }
  if (typeof patch.subject === "string") updates.subject = patch.subject.trim() || null;
  if (patch.channel === "sms" || patch.channel === "email") {
    if (patch.channel === "sms" && !row.recipientPhone) {
      const error = new Error("No mobile number on file for SMS.");
      (error as Error & { status?: number }).status = 422;
      throw error;
    }
    if (patch.channel === "email" && !row.recipientEmail) {
      const error = new Error("No email address on file.");
      (error as Error & { status?: number }).status = 422;
      throw error;
    }
    updates.channel = patch.channel;
  }
  await ownerDb.update(schema.quoteFollowUps).set(updates).where(and(
    eq(schema.quoteFollowUps.id, id),
    eq(schema.quoteFollowUps.businessId, businessId),
  ));
  const list = await loadViews(businessId);
  return list.followUps.find((item) => item.id === id) ?? null;
}

export async function snoozeQuoteFollowUp(businessId: string, id: string, days: number): Promise<QuoteFollowUpView | null> {
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    const error = new Error("Pick a snooze of 1 to 30 days.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
  const row = await rowForBusiness(businessId, id);
  if (!row || (row.status !== "draft" && row.status !== "snoozed")) return null;
  const snoozeUntil = new Date(Date.now() + days * DAY_MS);
  await ownerDb.update(schema.quoteFollowUps).set({
    status: "snoozed",
    snoozeUntil,
    updatedAt: new Date(),
  }).where(and(eq(schema.quoteFollowUps.id, id), eq(schema.quoteFollowUps.businessId, businessId)));
  const list = await loadViews(businessId);
  return list.followUps.find((item) => item.id === id) ?? null;
}

export async function dismissQuoteFollowUp(businessId: string, id: string): Promise<boolean> {
  const row = await rowForBusiness(businessId, id);
  if (!row || (row.status !== "draft" && row.status !== "snoozed")) return false;
  await runWithBusiness(businessId, async () => {
    await ownerDb.update(schema.quotes).set({
      status: "rejected",
      rejectionReason: "Marked lost from the follow-up queue",
      responseDate: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(schema.quotes.id, row.quoteId), eq(schema.quotes.businessId, businessId)));
    await ownerDb.update(schema.quoteFollowUps).set({
      status: "dismissed",
      cancelReason: "dismissed",
      updatedAt: new Date(),
    }).where(and(
      eq(schema.quoteFollowUps.businessId, businessId),
      eq(schema.quoteFollowUps.quoteId, row.quoteId),
      inArray(schema.quoteFollowUps.status, ["draft", "snoozed"]),
    ));
  });
  return true;
}

async function deliver(request: { channel: FollowUpChannel; to: string; message: string; subject: string | null }, businessId: string, jobId: string | null): Promise<boolean> {
  if (request.channel === "sms") {
    return smsService.sendSMS({
      to: request.to,
      message: request.message,
      businessId,
      feature: "quote_followup",
    });
  }
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const result = await emailService.sendEmail({
    to: request.to,
    fromName: settings?.businessName || undefined,
    subject: request.subject || "Following up on your quote",
    text: request.message,
    html: `<p>${request.message.replace(/\n/g, "<br>")}</p>`,
    jobNumber: jobId || undefined,
  });
  return result.success;
}

export async function approveQuoteFollowUp(input: {
  businessId: string;
  id: string;
  confirm: unknown;
  authorName: string;
}): Promise<{ status: number; body: { success: boolean; message?: string; data?: QuoteFollowUpView } }> {
  if (input.confirm !== true) {
    return { status: 400, body: { success: false, message: "Sending needs confirm: true. Nothing was sent." } };
  }
  const businessId = requireBusinessId(input.businessId);
  const existing = await rowForBusiness(businessId, input.id);
  if (!existing) return { status: 404, body: { success: false, message: "Follow-up not found." } };
  const staleSending = existing.status === "sending"
    && existing.updatedAt != null
    && Date.now() - new Date(existing.updatedAt).getTime() >= 10 * 60 * 1000;
  if (existing.status !== "draft" && existing.status !== "snoozed" && !staleSending) {
    return { status: 409, body: { success: false, message: "This follow-up is not waiting for approval." } };
  }
  const previousStatus = existing.status === "snoozed" ? "snoozed" : "draft";
  const [claimed] = await ownerDb.update(schema.quoteFollowUps).set({
    status: "sending",
    updatedAt: new Date(),
  }).where(and(
    eq(schema.quoteFollowUps.id, input.id),
    eq(schema.quoteFollowUps.businessId, businessId),
    eq(schema.quoteFollowUps.status, existing.status),
  )).returning();
  if (!claimed) {
    return { status: 409, body: { success: false, message: "This follow-up is not waiting for approval." } };
  }

  try {
    const result = await commitApprovedSend({
      confirm: true,
      status: previousStatus === "snoozed" ? "snoozed" : "draft",
      channel: claimed.channel,
      message: claimed.message,
      subject: claimed.subject,
      phone: claimed.recipientPhone,
      email: claimed.recipientEmail,
    }, (request) => deliver(request, businessId, claimed.jobId));

    if (!result.ok) {
      await ownerDb.update(schema.quoteFollowUps).set({
        status: previousStatus,
        updatedAt: new Date(),
      }).where(and(
        eq(schema.quoteFollowUps.id, claimed.id),
        eq(schema.quoteFollowUps.businessId, businessId),
        eq(schema.quoteFollowUps.status, "sending"),
      ));
      return { status: result.status, body: { success: false, message: result.message } };
    }

    let diaryEntryId: string | undefined;
    if (claimed.jobId) {
      try {
        const entry = await runWithBusiness(businessId, () => storage.createJobDiaryEntry({
          jobId: claimed.jobId!,
          entryType: result.channel === "email" ? "email" : "sms",
          title: claimed.kind === "requote" ? "Re-quote follow-up sent" : "Quote follow-up sent",
          description: result.message,
          content: result.message,
          authorName: input.authorName || "Staff",
          authorRole: "staff",
          metadata: {
            channel: result.channel,
            direction: "outbound",
            quoteFollowUpId: claimed.id,
            quoteId: claimed.quoteId,
            eventType: "quote_follow_up_sent",
            ...(result.channel === "sms" ? { phoneNumber: result.to } : { emailAddress: result.to }),
          },
        }));
        diaryEntryId = entry.id;
      } catch (diaryError) {
        console.error("Quote follow-up sent, but the diary entry failed:", diaryError);
      }
    }

    await ownerDb.update(schema.quoteFollowUps).set({
      status: "sent",
      sentAt: new Date(),
      diaryEntryId: diaryEntryId ?? null,
      message: result.message,
      subject: result.subject,
      channel: result.channel,
      updatedAt: new Date(),
    }).where(and(eq(schema.quoteFollowUps.id, claimed.id), eq(schema.quoteFollowUps.businessId, businessId)));

    return { status: 200, body: { success: true, message: "Follow-up sent." } };
  } catch (error) {
    await ownerDb.update(schema.quoteFollowUps).set({
      status: previousStatus,
      updatedAt: new Date(),
    }).where(and(
      eq(schema.quoteFollowUps.id, claimed.id),
      eq(schema.quoteFollowUps.businessId, businessId),
      eq(schema.quoteFollowUps.status, "sending"),
    ));
    throw error;
  }
}

async function insertPlanRow(
  businessId: string,
  plan: { quoteId: string; jobId: string | null; customerId: string | null; nudgeStep: number; kind: string; channel?: string; subject?: string | null; message?: string; recipientName?: string | null; recipientPhone?: string | null; recipientEmail?: string | null },
  status: "draft" | "skipped",
) {
  const [inserted] = await ownerDb.insert(schema.quoteFollowUps).values({
    businessId,
    quoteId: plan.quoteId,
    jobId: plan.jobId,
    customerId: plan.customerId,
    kind: plan.kind,
    nudgeStep: plan.nudgeStep,
    channel: plan.channel || "sms",
    status,
    subject: plan.subject ?? null,
    message: plan.message ?? "",
    recipientName: plan.recipientName ?? null,
    recipientPhone: plan.recipientPhone ?? null,
    recipientEmail: plan.recipientEmail ?? null,
  }).onConflictDoNothing({
    target: [schema.quoteFollowUps.businessId, schema.quoteFollowUps.quoteId, schema.quoteFollowUps.nudgeStep],
  }).returning();
  return inserted;
}

async function materialiseRequote(businessId: string, plan: PlannedCreate, insertedId: string): Promise<void> {
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const validityDays = settings?.quoteValidityDays && settings.quoteValidityDays > 0 ? settings.quoteValidityDays : 30;
  const services = await ownerDb
    .select({ id: schema.services.id, name: schema.services.name, basePrice: schema.services.basePrice })
    .from(schema.services)
    .where(eq(schema.services.businessId, businessId));
  const rates: RateCardItem[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    basePrice: Number(service.basePrice),
  }));
  try {
    const created = await runWithBusiness(businessId, async () => {
      const quoteNumber = await storage.getNextQuoteNumber();
      const draft = buildRequoteDraft(plan.source, rates, quoteNumber, new Date(Date.now() + validityDays * DAY_MS));
      const inserted = await ownerDb.insert(schema.quotes).values({
        businessId,
        quoteNumber: draft.quoteNumber,
        description: draft.description,
        amount: draft.amount,
        status: "draft",
        validUntil: draft.validUntil,
        terms: draft.terms,
        lineItems: draft.lineItems,
        jobId: draft.jobId,
        customerId: draft.customerId,
        leadId: draft.leadId,
        revisedFromQuoteId: draft.revisedFromQuoteId,
        createdBy: draft.createdBy,
        followUpCount: 0,
      }).returning();
      const created = Array.isArray(inserted) ? inserted[0] : undefined;
      if (!created) throw new Error("Couldn't create the new quote.");
      return created;
    });
    const copy = withNewQuoteNumber(plan.message, plan.subject, created.quoteNumber);
    await ownerDb.update(schema.quoteFollowUps).set({
      requoteId: created.id,
      message: copy.message,
      subject: copy.subject,
      updatedAt: new Date(),
    }).where(and(eq(schema.quoteFollowUps.id, insertedId), eq(schema.quoteFollowUps.businessId, businessId)));
  } catch (error) {
    await ownerDb.delete(schema.quoteFollowUps).where(and(
      eq(schema.quoteFollowUps.id, insertedId),
      eq(schema.quoteFollowUps.businessId, businessId),
      isNull(schema.quoteFollowUps.requoteId),
    ));
    throw error;
  }
}

async function remindIfWaiting(businessId: string, now: Date): Promise<void> {
  const hour = nzHour(now);
  if (hour < 7 || hour >= 18) return;
  const list = await loadViews(businessId);
  if (list.waiting === 0) return;
  const since = nzTimeToUTC(getNZDateString(now), "00:00");
  const [already] = await ownerDb
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(and(
      eq(schema.notifications.businessId, businessId),
      eq(schema.notifications.type, "quote_followup_waiting"),
      gte(schema.notifications.createdAt, since),
    ))
    .limit(1);
  if (already) return;

  const only = list.followUps.filter((row) => row.waiting);
  const path = only.length === 1 ? followUpQueuePath(only[0]?.id) : followUpQueuePath();
  const title = "Quote follow-ups waiting";
  const message = list.waiting === 1
    ? "1 quote follow-up is waiting for you. Nothing has been sent."
    : `${list.waiting} quote follow-ups are waiting for you. Nothing has been sent.`;

  await runWithBusiness(businessId, async () => {
    await storage.createNotification({
      title,
      message,
      type: "quote_followup_waiting",
      priority: "medium",
      isRead: false,
      actionUrl: path,
      quoteId: only.length === 1 ? only[0]?.quoteId : undefined,
      metadata: { waiting: list.waiting },
    });
    const employees = await storage.getAllEmployees();
    const admins = employees.filter((employee) => employee.role === "admin" && employee.isActive !== false);
    for (const admin of admins) {
      await notifyEmployee(admin.id, {
        title,
        body: message,
        clickAction: path,
        collapseId: `quote-followups-${businessId}`,
        data: { type: "quote_followup_waiting" },
      });
    }
  });
}

async function detectForBusiness(businessId: string, now: Date): Promise<void> {
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const lookbackStart = new Date(now.getTime() - SENT_LOOKBACK_DAYS * DAY_MS);
  const quoteRows = await ownerDb
    .select()
    .from(schema.quotes)
    .where(and(
      eq(schema.quotes.businessId, businessId),
      inArray(schema.quotes.status, OPEN_QUOTE_STATUSES),
      gte(schema.quotes.sentDate, lookbackStart),
    ));

  const quotes: QuoteSignal[] = [];
  const jobIds = Array.from(new Set(quoteRows.map((row) => row.jobId).filter((id): id is string => !!id)));
  const customerIds = Array.from(new Set(quoteRows.map((row) => row.customerId).filter((id): id is string => !!id)));
  const jobs = jobIds.length === 0 ? [] : await ownerDb.select({
    id: schema.jobs.id,
    jobContactFirstName: schema.jobs.jobContactFirstName,
    jobContactLastName: schema.jobs.jobContactLastName,
    jobContactEmail: schema.jobs.jobContactEmail,
    jobContactPhone: schema.jobs.jobContactPhone,
    jobContactMobile: schema.jobs.jobContactMobile,
  }).from(schema.jobs).where(and(eq(schema.jobs.businessId, businessId), inArray(schema.jobs.id, jobIds)));
  const customers = customerIds.length === 0 ? [] : await ownerDb.select({
    id: schema.customers.id,
    name: schema.customers.name,
    email: schema.customers.email,
    phone: schema.customers.phone,
    mobile: schema.customers.mobile,
  }).from(schema.customers).where(and(eq(schema.customers.businessId, businessId), inArray(schema.customers.id, customerIds)));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  for (const row of quoteRows) {
    const job = row.jobId ? jobsById.get(row.jobId) : undefined;
    const customer = row.customerId ? customersById.get(row.customerId) : undefined;
    const contactName = [job?.jobContactFirstName, job?.jobContactLastName].filter(Boolean).join(" ").trim();
    quotes.push({
      id: row.id,
      businessId,
      jobId: row.jobId,
      customerId: row.customerId,
      leadId: row.leadId,
      quoteNumber: row.quoteNumber,
      description: row.description,
      terms: row.terms,
      amount: row.amount,
      lineItems: row.lineItems,
      status: row.status,
      sentDate: row.sentDate,
      updatedAt: row.updatedAt,
      validUntil: row.validUntil,
      responseDate: row.responseDate,
      createdBy: row.createdBy,
      customerName: contactName || customer?.name || null,
      phone: job?.jobContactMobile || job?.jobContactPhone || customer?.mobile || customer?.phone || null,
      email: job?.jobContactEmail || customer?.email || null,
    });
  }

  const replyRows = jobIds.length === 0 ? [] : await ownerDb.select({
    jobId: schema.jobDiaryEntries.jobId,
    createdAt: schema.jobDiaryEntries.createdAt,
    authorRole: schema.jobDiaryEntries.authorRole,
    tags: schema.jobDiaryEntries.tags,
    metadata: schema.jobDiaryEntries.metadata,
    entryType: schema.jobDiaryEntries.entryType,
  }).from(schema.jobDiaryEntries).where(and(
    eq(schema.jobDiaryEntries.businessId, businessId),
    inArray(schema.jobDiaryEntries.jobId, jobIds),
    gte(schema.jobDiaryEntries.createdAt, lookbackStart),
  ));
  const replies: DiaryReplySignal[] = replyRows.map((row) => ({
    jobId: row.jobId,
    createdAt: row.createdAt ?? now,
    authorRole: row.authorRole,
    tags: row.tags,
    direction: directionOf(row.metadata),
    entryType: row.entryType,
  }));

  const quoteIdList = quotes.map((quote) => quote.id);
  const existing = quoteIdList.length === 0 ? [] : await ownerDb.select({
    businessId: schema.quoteFollowUps.businessId,
    quoteId: schema.quoteFollowUps.quoteId,
    nudgeStep: schema.quoteFollowUps.nudgeStep,
    status: schema.quoteFollowUps.status,
  }).from(schema.quoteFollowUps).where(and(
    eq(schema.quoteFollowUps.businessId, businessId),
    inArray(schema.quoteFollowUps.quoteId, quoteIdList),
  ));

  const plans = planQuoteFollowUps({
    now: now.getTime(),
    businessId,
    settings: {
      enabled: settings?.quoteFollowupWorkflowEnabled !== false,
      nudgeDays: parseNudgeDays(settings?.quoteFollowupNudgeDays),
      channel: settings?.quoteFollowupChannel === "email" ? "email" : "sms",
      businessName: settings?.businessName?.trim() || "us",
    },
    quotes,
    replies,
    existing: existing.flatMap((row) => row.businessId ? [{
      businessId: row.businessId,
      quoteId: row.quoteId,
      nudgeStep: row.nudgeStep,
      status: row.status,
    }] : []),
  });

  for (const plan of plans) {
    if (plan.action === "cancel") {
      await ownerDb.update(schema.quoteFollowUps).set({
        status: "cancelled",
        cancelReason: plan.reason,
        updatedAt: new Date(),
      }).where(and(
        eq(schema.quoteFollowUps.businessId, businessId),
        eq(schema.quoteFollowUps.quoteId, plan.quoteId),
        inArray(schema.quoteFollowUps.status, ["draft", "snoozed"]),
      ));
      continue;
    }
    if (plan.action === "skip") {
      await insertPlanRow(businessId, plan, "skipped");
      continue;
    }
    const inserted = await insertPlanRow(businessId, plan, "draft");
    if (!inserted) continue;
    if (plan.kind === "requote") {
      await materialiseRequote(businessId, plan, inserted.id);
    }
  }

  if (settings?.quoteFollowupWorkflowEnabled !== false) {
    await remindIfWaiting(businessId, now);
  }
}

export async function runQuoteFollowUpDetection(now = new Date()): Promise<void> {
  const businesses = await storage.listBusinesses();
  for (const business of businesses) {
    try {
      await detectForBusiness(business.id, now);
    } catch (error) {
      console.error(`[quoteFollowUpDetection] ${business.id} failed:`, error);
    }
  }
}

export const QUOTE_FOLLOW_UP_JOB = "quoteFollowUpDetection";

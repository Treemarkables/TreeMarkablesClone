/**
 * Completed jobs that still need an invoice or a send to the customer.
 *
 * jobsNotBilledDetection runs hourly, before invoiceXeroDetection, on the
 * same RUN_CRONS clock. It only inserts or updates drafts. Approve is the
 * only path that creates an invoice or contacts the customer. A sent invoice
 * that is not in Xero is left to the Not in Xero queue.
 */
import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import { ownerDb } from "./db";
import { storage } from "./storage";
import { runWithBusiness, currentBusinessId } from "./tenancy/tenantStore";
import { smsService } from "./services/smsService";
import { emailService } from "./services/emailService";
import { APP_URL } from "./config/appUrl";
import { commitApprovedBillingAction } from "@shared/jobsNotBilledApproval";
import {
  buildDraftInvoice,
  buildInvoiceSendDraft,
  isWaitingNotBilled,
  jobCardPath,
  jobsNotBilledQueuePath,
  planJobsNotBilled,
  type DraftInvoicePreview,
  type NotBilledJob,
  type NotBilledStep,
} from "@shared/jobsNotBilled";
import { DAY_MS, SENT_LOOKBACK_DAYS } from "@shared/quoteFollowUps";
import * as schema from "@shared/schema";

const STALE_MS = 10 * 60 * 1000;

export interface JobNotBilledView {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string | null;
  step: NotBilledStep;
  status: string;
  waiting: boolean;
  channel: string;
  subject: string | null;
  message: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  snoozeUntil: string | null;
  lastError: string | null;
  preview: DraftInvoicePreview | null;
  links: { queue: string; job: string };
}

export interface JobNotBilledList {
  waiting: number;
  jobs: JobNotBilledView[];
  links: { queue: string };
}

function requireBusinessId(businessId: string | null | undefined): string {
  if (!businessId) throw new Error("Missing business");
  return businessId;
}

function appBase(): string {
  return APP_URL.replace(/\/$/, "");
}

function pickChannel(preferred: string | null | undefined, phone: string | null, email: string | null): "sms" | "email" {
  if (preferred === "email" && email) return "email";
  if (preferred !== "email" && phone) return "sms";
  if (email) return "email";
  return "sms";
}

async function rowForBusiness(businessId: string, id: string) {
  const [row] = await ownerDb
    .select()
    .from(schema.jobBillingFollowUps)
    .where(and(eq(schema.jobBillingFollowUps.id, id), eq(schema.jobBillingFollowUps.businessId, businessId)))
    .limit(1);
  return row;
}

async function quotesAndJob(businessId: string, jobId: string) {
  const [job] = await ownerDb.select({
    id: schema.jobs.id,
    jobNumber: schema.jobs.jobNumber,
    title: schema.jobs.title,
    description: schema.jobs.description,
    address: schema.jobs.address,
    customerId: schema.jobs.customerId,
    lineItems: schema.jobs.lineItems,
    totalAmount: schema.jobs.totalAmount,
    jobContactFirstName: schema.jobs.jobContactFirstName,
    jobContactLastName: schema.jobs.jobContactLastName,
  }).from(schema.jobs).where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.businessId, businessId))).limit(1);
  if (!job) return null;
  const quotes = await ownerDb.select({
    id: schema.quotes.id,
    status: schema.quotes.status,
    description: schema.quotes.description,
    amount: schema.quotes.amount,
    lineItems: schema.quotes.lineItems,
  }).from(schema.quotes).where(and(eq(schema.quotes.businessId, businessId), eq(schema.quotes.jobId, jobId)));
  return { job, quotes };
}

async function loadViews(businessId: string, base = appBase()): Promise<JobNotBilledList> {
  const rows = await ownerDb
    .select()
    .from(schema.jobBillingFollowUps)
    .where(and(
      eq(schema.jobBillingFollowUps.businessId, businessId),
      inArray(schema.jobBillingFollowUps.status, ["draft", "snoozed"]),
    ))
    .orderBy(asc(schema.jobBillingFollowUps.createdAt))
    .limit(200);
  const jobIds = rows.map((row) => row.jobId);
  const jobs = jobIds.length === 0 ? [] : await ownerDb.select({
    id: schema.jobs.id,
    jobNumber: schema.jobs.jobNumber,
    title: schema.jobs.title,
    description: schema.jobs.description,
    lineItems: schema.jobs.lineItems,
    totalAmount: schema.jobs.totalAmount,
  }).from(schema.jobs).where(and(eq(schema.jobs.businessId, businessId), inArray(schema.jobs.id, jobIds)));
  const quotes = jobIds.length === 0 ? [] : await ownerDb.select({
    id: schema.quotes.id,
    jobId: schema.quotes.jobId,
    status: schema.quotes.status,
    description: schema.quotes.description,
    amount: schema.quotes.amount,
    lineItems: schema.quotes.lineItems,
  }).from(schema.quotes).where(and(eq(schema.quotes.businessId, businessId), inArray(schema.quotes.jobId, jobIds)));
  const invoiceIds = rows.map((row) => row.invoiceId).filter((id): id is string => !!id);
  const invoices = invoiceIds.length === 0 ? [] : await ownerDb.select({
    id: schema.invoices.id,
    invoiceNumber: schema.invoices.invoiceNumber,
  }).from(schema.invoices).where(and(eq(schema.invoices.businessId, businessId), inArray(schema.invoices.id, invoiceIds)));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const now = Date.now();
  const views: JobNotBilledView[] = rows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    if (!job || (row.step !== "create_invoice" && row.step !== "send_invoice")) return [];
    const preview = row.step === "create_invoice"
      ? buildDraftInvoice({
        jobNumber: job.jobNumber,
        jobTitle: job.title,
        jobDescription: job.description,
        quotes: quotes.filter((quote) => quote.jobId === job.id),
        jobLineItems: job.lineItems,
        jobTotal: job.totalAmount,
      })
      : null;
    const invoice = row.invoiceId ? invoicesById.get(row.invoiceId) : undefined;
    return [{
      id: row.id,
      jobId: row.jobId,
      jobNumber: job.jobNumber,
      customerName: row.recipientName,
      step: row.step,
      status: row.status,
      waiting: isWaitingNotBilled(row.status, row.snoozeUntil, now),
      channel: row.channel,
      subject: row.subject,
      message: row.message,
      recipientPhone: row.recipientPhone,
      recipientEmail: row.recipientEmail,
      invoiceId: row.invoiceId,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      snoozeUntil: row.snoozeUntil ? new Date(row.snoozeUntil).toISOString() : null,
      lastError: row.lastError,
      preview,
      links: {
        queue: `${base}${jobsNotBilledQueuePath(row.id)}`,
        job: `${base}${jobCardPath(row.jobId)}`,
      },
    }];
  });
  return {
    waiting: views.filter((row) => row.waiting).length,
    jobs: views,
    links: { queue: `${base}${jobsNotBilledQueuePath()}` },
  };
}

export async function listJobsNotBilledForSession(): Promise<JobNotBilledList> {
  const businessId = currentBusinessId();
  if (!businessId) {
    const error = new Error("Not authenticated");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return loadViews(businessId);
}

export async function listJobsNotBilledForBusiness(businessId: string): Promise<JobNotBilledList> {
  return loadViews(requireBusinessId(businessId));
}

export async function countWaitingJobsNotBilled(): Promise<{ count: number; jobId: string | null }> {
  const businessId = currentBusinessId();
  if (!businessId) return { count: 0, jobId: null };
  const rows = await ownerDb.select({
    jobId: schema.jobBillingFollowUps.jobId,
    status: schema.jobBillingFollowUps.status,
    snoozeUntil: schema.jobBillingFollowUps.snoozeUntil,
  }).from(schema.jobBillingFollowUps).where(and(
    eq(schema.jobBillingFollowUps.businessId, businessId),
    inArray(schema.jobBillingFollowUps.status, ["draft", "snoozed"]),
  )).limit(200);
  const now = Date.now();
  const waiting = rows.filter((row) => isWaitingNotBilled(row.status, row.snoozeUntil, now));
  return { count: waiting.length, jobId: waiting.length === 1 ? waiting[0]?.jobId ?? null : null };
}

export async function updateJobNotBilledDraft(
  businessId: string,
  id: string,
  patch: { message?: unknown; subject?: unknown; channel?: unknown },
): Promise<JobNotBilledView | null> {
  const row = await rowForBusiness(businessId, id);
  if (!row) return null;
  if (row.status !== "draft" && row.status !== "snoozed") {
    const error = new Error("Only a waiting job can be edited.");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
  if (row.step !== "send_invoice") {
    const error = new Error("Only the send step has a message to edit.");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
  const updates: { updatedAt: Date; message?: string; subject?: string | null; channel?: string } = { updatedAt: new Date() };
  if (typeof patch.message === "string") updates.message = patch.message;
  if (typeof patch.subject === "string") updates.subject = patch.subject;
  if (patch.channel === "sms" || patch.channel === "email") updates.channel = patch.channel;
  await ownerDb.update(schema.jobBillingFollowUps).set(updates).where(and(
    eq(schema.jobBillingFollowUps.id, id),
    eq(schema.jobBillingFollowUps.businessId, businessId),
  ));
  const list = await loadViews(businessId);
  return list.jobs.find((item) => item.id === id) ?? null;
}

export async function snoozeJobNotBilled(businessId: string, id: string, days: number): Promise<JobNotBilledView | null> {
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    const error = new Error("Pick a snooze of 1 to 30 days.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
  const row = await rowForBusiness(businessId, id);
  if (!row || (row.status !== "draft" && row.status !== "snoozed")) return null;
  await ownerDb.update(schema.jobBillingFollowUps).set({
    status: "snoozed",
    snoozeUntil: new Date(Date.now() + days * DAY_MS),
    updatedAt: new Date(),
  }).where(and(eq(schema.jobBillingFollowUps.id, id), eq(schema.jobBillingFollowUps.businessId, businessId)));
  const list = await loadViews(businessId);
  return list.jobs.find((item) => item.id === id) ?? null;
}

export async function dismissJobNotBilled(businessId: string, id: string): Promise<boolean> {
  const row = await rowForBusiness(businessId, id);
  if (!row || (row.status !== "draft" && row.status !== "snoozed")) return false;
  await ownerDb.update(schema.jobBillingFollowUps).set({
    status: "dismissed",
    updatedAt: new Date(),
  }).where(and(eq(schema.jobBillingFollowUps.id, id), eq(schema.jobBillingFollowUps.businessId, businessId)));
  return true;
}

async function writeDiary(businessId: string, entry: {
  jobId: string;
  entryType: string;
  title: string;
  description: string;
  authorName: string;
  metadata: Record<string, string>;
}): Promise<string | undefined> {
  try {
    const created = await runWithBusiness(businessId, () => storage.createJobDiaryEntry({
      jobId: entry.jobId,
      entryType: entry.entryType,
      title: entry.title,
      description: entry.description,
      content: entry.description,
      authorName: entry.authorName || "Staff",
      authorRole: "staff",
      metadata: entry.metadata,
    }));
    return created.id;
  } catch (error) {
    console.error("Job diary entry failed:", error);
    return undefined;
  }
}

export async function approveJobNotBilled(input: {
  businessId: string;
  id: string;
  confirm: unknown;
  authorName: string;
}): Promise<{ status: number; body: { success: boolean; message?: string } }> {
  if (input.confirm !== true) {
    return { status: 400, body: { success: false, message: "This needs confirm: true. Nothing was created or sent." } };
  }
  const businessId = requireBusinessId(input.businessId);
  const existing = await rowForBusiness(businessId, input.id);
  if (!existing) return { status: 404, body: { success: false, message: "Job not found in the queue." } };
  const stale = existing.status === "working"
    && existing.updatedAt != null
    && Date.now() - new Date(existing.updatedAt).getTime() >= STALE_MS;
  if (existing.status !== "draft" && existing.status !== "snoozed" && !stale) {
    return { status: 409, body: { success: false, message: "This job is not waiting for approval." } };
  }
  const previousStatus = existing.status === "snoozed" ? "snoozed" : "draft";
  const loaded = await quotesAndJob(businessId, existing.jobId);
  if (!loaded) return { status: 404, body: { success: false, message: "Job not found." } };

  let blockingReason: string | null = null;
  if (existing.step === "create_invoice") {
    if (!loaded.job.customerId) blockingReason = "This job has no customer, so an invoice can't be created.";
    else {
      const preview = buildDraftInvoice({
        jobNumber: loaded.job.jobNumber,
        jobTitle: loaded.job.title,
        jobDescription: loaded.job.description,
        quotes: loaded.quotes,
        jobLineItems: loaded.job.lineItems,
        jobTotal: loaded.job.totalAmount,
      });
      blockingReason = preview.blockingReason;
    }
  } else if (existing.step === "send_invoice") {
    const channel = existing.channel === "email" ? "email" : "sms";
    const recipient = channel === "email" ? existing.recipientEmail : existing.recipientPhone;
    if (!existing.invoiceId) blockingReason = "Create the invoice before sending it.";
    else if (!existing.message.trim()) blockingReason = "Write a message before sending.";
    else if (!recipient) blockingReason = channel === "email"
      ? "Add an email address before sending."
      : "Add a mobile number before sending.";
  }

  if (blockingReason) {
    await ownerDb.update(schema.jobBillingFollowUps).set({
      lastError: blockingReason,
      updatedAt: new Date(),
    }).where(and(eq(schema.jobBillingFollowUps.id, existing.id), eq(schema.jobBillingFollowUps.businessId, businessId)));
    return { status: 422, body: { success: false, message: blockingReason } };
  }

  const [claimed] = await ownerDb.update(schema.jobBillingFollowUps).set({
    status: "working",
    lastError: null,
    updatedAt: new Date(),
  }).where(and(
    eq(schema.jobBillingFollowUps.id, existing.id),
    eq(schema.jobBillingFollowUps.businessId, businessId),
    eq(schema.jobBillingFollowUps.status, existing.status),
  )).returning();
  if (!claimed) return { status: 409, body: { success: false, message: "This job is not waiting for approval." } };

  const revert = async (message: string) => {
    await ownerDb.update(schema.jobBillingFollowUps).set({
      status: previousStatus,
      lastError: message,
      updatedAt: new Date(),
    }).where(and(
      eq(schema.jobBillingFollowUps.id, claimed.id),
      eq(schema.jobBillingFollowUps.businessId, businessId),
      eq(schema.jobBillingFollowUps.status, "working"),
    ));
  };

  try {
    const result = await commitApprovedBillingAction({
      confirm: true,
      status: previousStatus,
      step: claimed.step,
    }, async () => {
      if (claimed.step === "create_invoice") return createDraftInvoice(businessId, claimed, loaded, input.authorName);
      return sendInvoice(businessId, claimed, input.authorName);
    });
    if (!result.ok) {
      await revert(result.message);
      return { status: result.status, body: { success: false, message: result.message } };
    }
    return { status: 200, body: { success: true, message: result.message } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "That didn't go through. Nothing was marked as done.";
    await revert(message);
    return { status: 502, body: { success: false, message } };
  }
}

async function createDraftInvoice(
  businessId: string,
  claimed: { id: string; jobId: string; customerId: string | null; recipientName: string | null; recipientPhone: string | null; recipientEmail: string | null },
  loaded: NonNullable<Awaited<ReturnType<typeof quotesAndJob>>>,
  authorName: string,
): Promise<{ ok: boolean; message: string }> {
  const preview = buildDraftInvoice({
    jobNumber: loaded.job.jobNumber,
    jobTitle: loaded.job.title,
    jobDescription: loaded.job.description,
    quotes: loaded.quotes,
    jobLineItems: loaded.job.lineItems,
    jobTotal: loaded.job.totalAmount,
  });
  const customerId = loaded.job.customerId;
  if (preview.blockingReason || !customerId) {
    return { ok: false, message: preview.blockingReason || "This job has no customer, so an invoice can't be created." };
  }
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const days = settings?.invoicePaymentDays && settings.invoicePaymentDays > 0 ? settings.invoicePaymentDays : 7;
  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + days * DAY_MS);
  const contact = [loaded.job.jobContactFirstName, loaded.job.jobContactLastName].filter(Boolean).join(" ").trim();
  const inserted = await runWithBusiness(businessId, async () => ownerDb.insert(schema.invoices).values({
    businessId,
    customerId,
    jobId: loaded.job.id,
    invoiceNumber: preview.invoiceNumber,
    jobTitle: loaded.job.title || "Tree service",
    address: loaded.job.address || "",
    contactName: contact || claimed.recipientName,
    issueDate,
    dueDate,
    amount: preview.subtotal.toFixed(2),
    status: "draft",
    items: preview.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      rate: line.rate,
      amount: line.amount,
    })),
    description: preview.description,
    notes: "",
  }).returning());
  const created = Array.isArray(inserted) ? inserted[0] : undefined;
  if (!created) return { ok: false, message: "Couldn't create the draft invoice." };

  const copy = buildInvoiceSendDraft({
    customerName: claimed.recipientName,
    invoiceNumber: created.invoiceNumber,
    invoiceUrl: `${appBase()}/invoice/${created.id}/view`,
    businessName: settings?.businessName?.trim() || "us",
  });
  await ownerDb.update(schema.jobBillingFollowUps).set({
    status: "draft",
    step: "send_invoice",
    invoiceId: created.id,
    subject: copy.subject,
    message: copy.message,
    lastError: null,
    updatedAt: new Date(),
  }).where(and(eq(schema.jobBillingFollowUps.id, claimed.id), eq(schema.jobBillingFollowUps.businessId, businessId)));

  const diaryId = await writeDiary(businessId, {
    jobId: claimed.jobId,
    entryType: "note",
    title: "Invoice created",
    description: `Draft invoice ${created.invoiceNumber} created for $${preview.subtotal.toFixed(2)} exc. GST. It has not been sent.`,
    authorName,
    metadata: { action: "invoice_created", invoiceId: created.id, invoiceNumber: created.invoiceNumber, jobBillingFollowUpId: claimed.id },
  });
  if (diaryId) {
    await ownerDb.update(schema.jobBillingFollowUps).set({ diaryEntryId: diaryId }).where(and(
      eq(schema.jobBillingFollowUps.id, claimed.id),
      eq(schema.jobBillingFollowUps.businessId, businessId),
    ));
  }
  return { ok: true, message: "Draft invoice created. It has not been sent." };
}

async function sendInvoice(
  businessId: string,
  claimed: { id: string; jobId: string; invoiceId: string | null; channel: string; subject: string | null; message: string; recipientPhone: string | null; recipientEmail: string | null },
  authorName: string,
): Promise<{ ok: boolean; message: string }> {
  if (!claimed.invoiceId) return { ok: false, message: "Create the invoice before sending it." };
  const channel = claimed.channel === "email" ? "email" : "sms";
  const to = channel === "email" ? claimed.recipientEmail : claimed.recipientPhone;
  if (!to) return { ok: false, message: "Add a contact before sending." };
  const [invoice] = await ownerDb.select({
    id: schema.invoices.id,
    status: schema.invoices.status,
    sentDate: schema.invoices.sentDate,
    invoiceNumber: schema.invoices.invoiceNumber,
  }).from(schema.invoices).where(and(
    eq(schema.invoices.id, claimed.invoiceId),
    eq(schema.invoices.businessId, businessId),
  )).limit(1);
  if (!invoice) return { ok: false, message: "Invoice not found." };

  let sent = false;
  if (channel === "sms") {
    sent = await smsService.sendSMS({ to, message: claimed.message, businessId, feature: "invoice_send" });
  } else {
    const settings = await storage.getBusinessSettingsForBusiness(businessId);
    const result = await emailService.sendEmail({
      to,
      fromName: settings?.businessName || undefined,
      subject: claimed.subject || `Invoice ${invoice.invoiceNumber}`,
      text: claimed.message,
      html: `<p>${claimed.message.replace(/\n/g, "<br>")}</p>`,
      jobId: claimed.jobId,
    });
    sent = result.success;
  }
  if (!sent) return { ok: false, message: channel === "email" ? "Email didn't send." : "SMS didn't send." };

  const keepStatus = invoice.status === "paid" || invoice.status === "overdue";
  await ownerDb.update(schema.invoices).set({
    ...(keepStatus ? {} : { status: "sent" }),
    sentDate: invoice.sentDate || new Date(),
    updatedAt: new Date(),
  }).where(and(eq(schema.invoices.id, invoice.id), eq(schema.invoices.businessId, businessId)));

  const diaryId = await writeDiary(businessId, {
    jobId: claimed.jobId,
    entryType: channel === "email" ? "email" : "sms",
    title: channel === "email" ? "Invoice emailed" : "Invoice texted",
    description: claimed.message,
    authorName,
    metadata: {
      action: "invoice_sent",
      channel,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      jobBillingFollowUpId: claimed.id,
      ...(channel === "sms" ? { phoneNumber: to } : { emailAddress: to }),
    },
  });
  await ownerDb.update(schema.jobBillingFollowUps).set({
    status: "done",
    completedAt: new Date(),
    lastError: null,
    diaryEntryId: diaryId ?? null,
    updatedAt: new Date(),
  }).where(and(eq(schema.jobBillingFollowUps.id, claimed.id), eq(schema.jobBillingFollowUps.businessId, businessId)));
  return { ok: true, message: "Invoice sent. It has not been synced to Xero." };
}

function sendFields(input: {
  step: NotBilledStep;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  invoiceNumber: string | null;
  invoiceId: string | null;
  preferredChannel: string | null | undefined;
  businessName: string;
}) {
  const channel = pickChannel(input.preferredChannel, input.phone, input.email);
  const copy = input.step === "send_invoice" && input.invoiceNumber && input.invoiceId
    ? buildInvoiceSendDraft({
      customerName: input.customerName,
      invoiceNumber: input.invoiceNumber,
      invoiceUrl: `${appBase()}/invoice/${input.invoiceId}/view`,
      businessName: input.businessName,
    })
    : { subject: null as string | null, message: "" };
  return {
    channel,
    subject: copy.subject,
    message: copy.message,
    recipientName: input.customerName,
    recipientPhone: input.phone,
    recipientEmail: input.email,
  };
}

async function detectForBusiness(businessId: string, now: Date): Promise<void> {
  const lookbackStart = new Date(now.getTime() - SENT_LOOKBACK_DAYS * DAY_MS);
  const completed = await ownerDb.select({ id: schema.jobs.id }).from(schema.jobs).where(and(
    eq(schema.jobs.businessId, businessId),
    eq(schema.jobs.status, "completed"),
    or(gte(schema.jobs.completedDate, lookbackStart), gte(schema.jobs.updatedAt, lookbackStart)),
  )).limit(500);
  const openRows = await ownerDb.select({ jobId: schema.jobBillingFollowUps.jobId }).from(schema.jobBillingFollowUps).where(and(
    eq(schema.jobBillingFollowUps.businessId, businessId),
    inArray(schema.jobBillingFollowUps.status, ["draft", "snoozed", "working"]),
  ));
  const jobIds = Array.from(new Set([...completed.map((row) => row.id), ...openRows.map((row) => row.jobId)]));
  if (jobIds.length === 0) return;

  const jobRows = await ownerDb.select({
    id: schema.jobs.id,
    status: schema.jobs.status,
    completedDate: schema.jobs.completedDate,
    updatedAt: schema.jobs.updatedAt,
    customerId: schema.jobs.customerId,
    jobNumber: schema.jobs.jobNumber,
    xeroInvoiceId: schema.jobs.xeroInvoiceId,
    xeroStatus: schema.jobs.xeroStatus,
    jobContactFirstName: schema.jobs.jobContactFirstName,
    jobContactLastName: schema.jobs.jobContactLastName,
    jobContactEmail: schema.jobs.jobContactEmail,
    jobContactPhone: schema.jobs.jobContactPhone,
    jobContactMobile: schema.jobs.jobContactMobile,
  }).from(schema.jobs).where(and(eq(schema.jobs.businessId, businessId), inArray(schema.jobs.id, jobIds)));
  const invoiceRows = await ownerDb.select({
    id: schema.invoices.id,
    jobId: schema.invoices.jobId,
    status: schema.invoices.status,
    sentDate: schema.invoices.sentDate,
    xeroInvoiceId: schema.invoices.xeroInvoiceId,
    invoiceNumber: schema.invoices.invoiceNumber,
  }).from(schema.invoices).where(and(eq(schema.invoices.businessId, businessId), inArray(schema.invoices.jobId, jobIds)));
  const customerIds = Array.from(new Set(jobRows.map((row) => row.customerId).filter((id): id is string => !!id)));
  const customers = customerIds.length === 0 ? [] : await ownerDb.select({
    id: schema.customers.id,
    name: schema.customers.name,
    email: schema.customers.email,
    phone: schema.customers.phone,
    mobile: schema.customers.mobile,
  }).from(schema.customers).where(and(eq(schema.customers.businessId, businessId), inArray(schema.customers.id, customerIds)));
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const existing = await ownerDb.select({
    businessId: schema.jobBillingFollowUps.businessId,
    jobId: schema.jobBillingFollowUps.jobId,
    status: schema.jobBillingFollowUps.status,
    step: schema.jobBillingFollowUps.step,
  }).from(schema.jobBillingFollowUps).where(and(
    eq(schema.jobBillingFollowUps.businessId, businessId),
    inArray(schema.jobBillingFollowUps.jobId, jobIds),
  ));

  const jobs: NotBilledJob[] = jobRows.map((row) => ({
    id: row.id,
    businessId,
    status: row.status,
    completedDate: row.completedDate,
    updatedAt: row.updatedAt,
    customerId: row.customerId,
    xeroInvoiceId: row.xeroInvoiceId,
    xeroStatus: row.xeroStatus,
    invoices: invoiceRows.filter((invoice) => invoice.jobId === row.id).map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      sentDate: invoice.sentDate,
      xeroInvoiceId: invoice.xeroInvoiceId,
      invoiceNumber: invoice.invoiceNumber,
    })),
  }));
  const plans = planJobsNotBilled({
    now: now.getTime(),
    businessId,
    jobs,
    existing: existing.flatMap((row) => row.businessId ? [{
      businessId: row.businessId,
      jobId: row.jobId,
      status: row.status,
      step: row.step,
    }] : []),
  });
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const businessName = settings?.businessName?.trim() || "us";
  const preferred = settings?.quoteFollowupChannel;

  for (const plan of plans) {
    if (plan.action === "cancel") {
      await ownerDb.update(schema.jobBillingFollowUps).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(and(
        eq(schema.jobBillingFollowUps.businessId, businessId),
        eq(schema.jobBillingFollowUps.jobId, plan.jobId),
        inArray(schema.jobBillingFollowUps.status, ["draft", "snoozed", "working"]),
      ));
      continue;
    }
    const job = jobRows.find((row) => row.id === plan.jobId);
    const customer = job?.customerId ? customersById.get(job.customerId) : undefined;
    const contactName = [job?.jobContactFirstName, job?.jobContactLastName].filter(Boolean).join(" ").trim();
    const invoice = invoiceRows.find((row) => row.id === plan.invoiceId);
    const fields = sendFields({
      step: plan.step,
      customerName: contactName || customer?.name || null,
      phone: job?.jobContactMobile || job?.jobContactPhone || customer?.mobile || customer?.phone || null,
      email: job?.jobContactEmail || customer?.email || null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      invoiceId: plan.invoiceId,
      preferredChannel: preferred,
      businessName,
    });
    if (plan.action === "advance") {
      await ownerDb.update(schema.jobBillingFollowUps).set({
        step: plan.step,
        invoiceId: plan.invoiceId,
        ...fields,
        updatedAt: new Date(),
      }).where(and(
        eq(schema.jobBillingFollowUps.businessId, businessId),
        eq(schema.jobBillingFollowUps.jobId, plan.jobId),
        inArray(schema.jobBillingFollowUps.status, ["draft", "snoozed", "working"]),
      ));
      continue;
    }
    if (plan.action === "reopen") {
      await ownerDb.update(schema.jobBillingFollowUps).set({
        status: "draft",
        step: plan.step,
        customerId: plan.customerId,
        invoiceId: plan.invoiceId,
        lastError: null,
        snoozeUntil: null,
        completedAt: null,
        ...fields,
        updatedAt: new Date(),
      }).where(and(
        eq(schema.jobBillingFollowUps.businessId, businessId),
        eq(schema.jobBillingFollowUps.jobId, plan.jobId),
        inArray(schema.jobBillingFollowUps.status, ["done", "cancelled"]),
      ));
      continue;
    }
    await ownerDb.insert(schema.jobBillingFollowUps).values({
      businessId,
      jobId: plan.jobId,
      customerId: plan.customerId,
      invoiceId: plan.invoiceId,
      step: plan.step,
      status: "draft",
      ...fields,
    }).onConflictDoNothing({
      target: [schema.jobBillingFollowUps.businessId, schema.jobBillingFollowUps.jobId],
    });
  }
}

export async function runJobsNotBilledDetection(now = new Date()): Promise<void> {
  const businesses = await storage.listBusinesses();
  for (const business of businesses) {
    try {
      await detectForBusiness(business.id, now);
    } catch (error) {
      console.error(`[jobsNotBilledDetection] ${business.id} failed:`, error);
    }
  }
}

export const JOBS_NOT_BILLED_JOB = "jobsNotBilledDetection";

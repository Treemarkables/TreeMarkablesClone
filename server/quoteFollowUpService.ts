/**
 * Quote follow-up workflow.
 *
 * quoteFollowUpDetection runs hourly (RUN_CRONS, both app instances). It only
 * inserts follow-up drafts. It reads proposals (the documents customers are
 * emailed or texted), jobs with quote_presented_date, and the quotes table.
 * Approve & Send is the only path that talks to a customer or creates a
 * re-quote, and it refuses unless confirm is the boolean true.
 *
 * Reads and writes go through the owner connection filtered by business id.
 * Callers wrap storage helpers in runWithBusiness so quote numbers, diary
 * rows, and notifications stamp the same tenant.
 */
import { and, asc, eq, gte, inArray, or } from "drizzle-orm";
import { ownerDb } from "./db";
import { storage } from "./storage";
import { runWithBusiness, currentBusinessId } from "./tenancy/tenantStore";
import { smsService } from "./services/smsService";
import { emailService } from "./services/emailService";
import { notifyEmployee } from "./services/notificationHelper";
import { getNZDateString, nzTimeToUTC } from "@shared/dateUtils";
import { APP_URL } from "./config/appUrl";
import { listInvoiceXeroForBusiness } from "./invoiceXeroService";
import { invoiceXeroQueuePath } from "@shared/invoiceXeroFollowUps";
import { listJobsNotBilledForBusiness } from "./jobsNotBilledService";
import { jobCardPath, jobsNotBilledQueuePath } from "@shared/jobsNotBilled";
import { commitApprovedSend } from "@shared/quoteFollowUpApproval";
import {
  buildRequoteDraft,
  collapseFollowUpSources,
  customerFacingQuoteNumber,
  followUpQueuePath,
  isInternalDocumentNumber,
  isWaitingFollowUp,
  parseNudgeDays,
  planQuoteFollowUps,
  previewRequote,
  proposalFollowUpStatus,
  SENT_LOOKBACK_DAYS,
  withNewQuoteNumber,
  type DiaryReplySignal,
  type FollowUpChannel,
  type FollowUpSourceType,
  type QuoteSignal,
  type RateCardItem,
  type RequotePreviewLine,
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
  sourceType: FollowUpSourceType;
  requotePreview: { lines: RequotePreviewLine[]; subtotal: number } | null;
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

  const idsFor = (type: FollowUpSourceType) => rows.filter((row) => (row.sourceType || "quote") === type).map((row) => row.quoteId);
  const quoteIds = Array.from(new Set([
    ...idsFor("quote"),
    ...rows.map((row) => row.requoteId).filter((id): id is string => !!id && rows.some((row) => row.requoteId === id && (row.sourceType || "quote") === "quote")),
  ]));
  const proposalIds = Array.from(new Set([
    ...idsFor("proposal"),
    ...rows.flatMap((row) => (row.sourceType === "proposal" || row.sourceType === "job") && row.requoteId ? [row.requoteId] : []),
  ]));
  const quoteRows = quoteIds.length === 0 ? [] : await ownerDb.select({
    id: schema.quotes.id,
    jobId: schema.quotes.jobId,
    quoteNumber: schema.quotes.quoteNumber,
    sentDate: schema.quotes.sentDate,
    updatedAt: schema.quotes.updatedAt,
    amount: schema.quotes.amount,
    lineItems: schema.quotes.lineItems,
  }).from(schema.quotes).where(and(eq(schema.quotes.businessId, businessId), inArray(schema.quotes.id, quoteIds)));
  const proposalRows = proposalIds.length === 0 ? [] : await ownerDb.select({
    id: schema.proposals.id,
    jobId: schema.proposals.jobId,
    proposalNumber: schema.proposals.proposalNumber,
    sentDate: schema.proposals.sentDate,
    updatedAt: schema.proposals.updatedAt,
    subtotal: schema.proposals.subtotal,
    totalAmount: schema.proposals.totalAmount,
  }).from(schema.proposals).where(and(eq(schema.proposals.businessId, businessId), inArray(schema.proposals.id, proposalIds)));
  const jobIds = Array.from(new Set([
    ...idsFor("job"),
    ...rows.map((row) => row.jobId).filter((id): id is string => !!id),
    ...quoteRows.map((row) => row.jobId).filter((id): id is string => !!id),
    ...proposalRows.map((row) => row.jobId).filter((id): id is string => !!id),
  ]));
  const jobRows = jobIds.length === 0 ? [] : await ownerDb.select({
    id: schema.jobs.id,
    jobNumber: schema.jobs.jobNumber,
    address: schema.jobs.address,
    quotePresentedDate: schema.jobs.quotePresentedDate,
    updatedAt: schema.jobs.updatedAt,
    totalAmount: schema.jobs.totalAmount,
    lineItems: schema.jobs.lineItems,
  }).from(schema.jobs).where(and(eq(schema.jobs.businessId, businessId), inArray(schema.jobs.id, jobIds)));
  const proposalLineRows = proposalIds.length === 0 ? [] : await ownerDb.select({
    proposalId: schema.proposalLineItems.proposalId,
    description: schema.proposalLineItems.description,
    quantity: schema.proposalLineItems.quantity,
    unitPrice: schema.proposalLineItems.unitPrice,
    totalPrice: schema.proposalLineItems.totalPrice,
    sourceId: schema.proposalLineItems.sourceId,
    selected: schema.proposalLineItems.selected,
  }).from(schema.proposalLineItems).where(and(
    eq(schema.proposalLineItems.businessId, businessId),
    inArray(schema.proposalLineItems.proposalId, proposalIds),
  ));
  const quotesById = new Map(quoteRows.map((row) => [row.id, row]));
  const proposalsById = new Map(proposalRows.map((row) => [row.id, row]));
  const jobsById = new Map(jobRows.map((row) => [row.id, row]));
  const linesByProposal = new Map<string, typeof proposalLineRows>();
  for (const line of proposalLineRows) {
    const list = linesByProposal.get(line.proposalId) ?? [];
    list.push(line);
    linesByProposal.set(line.proposalId, list);
  }
  const needsPreview = rows.some((row) => row.kind === "requote" && !row.requoteId);
  const rates = needsPreview ? await rateCard(businessId) : [];
  const now = Date.now();

  const followUps: QuoteFollowUpView[] = rows.map((row) => {
    const sourceType: FollowUpSourceType = row.sourceType === "proposal" || row.sourceType === "job" ? row.sourceType : "quote";
    const quote = sourceType === "quote" ? quotesById.get(row.quoteId) : undefined;
    const proposal = sourceType === "proposal" ? proposalsById.get(row.quoteId) : undefined;
    const job = jobsById.get(row.jobId || "") ?? (sourceType === "job" ? jobsById.get(row.quoteId) : undefined)
      ?? (quote?.jobId ? jobsById.get(quote.jobId) : undefined)
      ?? (proposal?.jobId ? jobsById.get(proposal.jobId) : undefined);
    const documentNumber = sourceType === "quote"
      ? quote?.quoteNumber
      : sourceType === "proposal"
        ? proposal?.proposalNumber
        : job?.jobNumber;
    const quoteNumber = customerFacingQuoteNumber({
      documentNumber,
      jobNumber: job?.jobNumber,
      jobAddress: job?.address,
    });
    const rawRequote = row.requoteId
      ? (sourceType === "quote"
        ? quotesById.get(row.requoteId)?.quoteNumber
        : proposalsById.get(row.requoteId)?.proposalNumber) || null
      : null;
    const requoteNumber = rawRequote
      ? customerFacingQuoteNumber({
        documentNumber: rawRequote,
        jobNumber: job?.jobNumber,
        jobAddress: job?.address,
      })
      : null;
    const sent = quote?.sentDate ?? proposal?.sentDate ?? job?.quotePresentedDate ?? null;
    const updated = quote?.updatedAt ?? proposal?.updatedAt ?? job?.updatedAt ?? null;
    const sentMs = sent ? new Date(sent).getTime() : null;
    const updatedMs = updated ? new Date(updated).getTime() : null;
    const anchor = sentMs == null ? null : (updatedMs != null && updatedMs > sentMs + 60_000 ? updatedMs : sentMs);
    const daysQuiet = anchor == null || !Number.isFinite(anchor) ? null : Math.max(0, Math.floor((now - anchor) / DAY_MS));
    const lineItems = sourceType === "proposal"
      ? (linesByProposal.get(row.quoteId) ?? []).filter((line) => line.selected !== false).map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        total: Number(line.totalPrice),
        itemCode: line.sourceId,
      }))
      : sourceType === "job"
        ? job?.lineItems
        : quote?.lineItems;
    const fallback = sourceType === "proposal"
      ? (proposal?.subtotal || proposal?.totalAmount)
      : sourceType === "job"
        ? job?.totalAmount
        : quote?.amount;
    return {
      id: row.id,
      quoteId: row.quoteId,
      quoteNumber,
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
      requoteNumber,
      sourceType,
      requotePreview: row.kind === "requote" && !row.requoteId ? previewRequote(lineItems, rates, fallback) : null,
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
  let edited = false;
  if (typeof patch.message === "string") {
    if (!patch.message.trim()) {
      const error = new Error("Write a message before saving.");
      (error as Error & { status?: number }).status = 400;
      throw error;
    }
    const nextMessage = patch.message.trim();
    if (nextMessage !== row.message) {
      updates.message = nextMessage;
      edited = true;
    }
  }
  if (typeof patch.subject === "string") {
    const nextSubject = patch.subject.trim() || null;
    if (nextSubject !== (row.subject ?? null)) {
      updates.subject = nextSubject;
      edited = true;
    }
  }
  if (edited) updates.draftEditedAt = new Date();
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
    if (row.sourceType === "proposal") {
      await ownerDb.update(schema.proposals).set({
        status: "rejected",
        responseDate: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(schema.proposals.id, row.quoteId), eq(schema.proposals.businessId, businessId)));
    } else if (row.sourceType === "job") {
      await ownerDb.update(schema.jobs).set({
        status: "unsuccessful",
        unsuccessfulDate: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(schema.jobs.id, row.quoteId), eq(schema.jobs.businessId, businessId)));
    } else {
      await ownerDb.update(schema.quotes).set({
        status: "rejected",
        rejectionReason: "Marked lost from the follow-up queue",
        responseDate: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(schema.quotes.id, row.quoteId), eq(schema.quotes.businessId, businessId)));
    }
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
    let message = claimed.message;
    let subject = claimed.subject;
    if (claimed.kind === "requote" && !claimed.requoteId) {
      const created = await materialiseRequote(businessId, claimed);
      message = created.message;
      subject = created.subject;
    }
    const result = await commitApprovedSend({
      confirm: true,
      status: previousStatus === "snoozed" ? "snoozed" : "draft",
      channel: claimed.channel,
      message,
      subject,
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
  plan: { quoteId: string; jobId: string | null; customerId: string | null; nudgeStep: number; kind: string; channel?: string; subject?: string | null; message?: string; recipientName?: string | null; recipientPhone?: string | null; recipientEmail?: string | null; sourceType?: FollowUpSourceType },
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
    sourceType: plan.sourceType ?? "quote",
  }).onConflictDoNothing({
    target: [schema.quoteFollowUps.businessId, schema.quoteFollowUps.quoteId, schema.quoteFollowUps.nudgeStep],
  }).returning();
  return inserted;
}

async function rateCard(businessId: string): Promise<RateCardItem[]> {
  const services = await ownerDb
    .select({ id: schema.services.id, name: schema.services.name, basePrice: schema.services.basePrice })
    .from(schema.services)
    .where(eq(schema.services.businessId, businessId));
  return services.map((service) => ({
    id: service.id,
    name: service.name,
    basePrice: Number(service.basePrice),
  }));
}

function recordsFromProposalLines(lines: { description: string; quantity: string | number; unitPrice: string | number; totalPrice: string | number; sourceId: string | null; selected: boolean | null }[]): Record<string, unknown>[] {
  return lines.filter((line) => line.selected !== false).map((line) => ({
    description: line.description,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    total: Number(line.totalPrice),
    itemCode: line.sourceId,
  }));
}

/**
 * Creates the fresh draft only after Approve. Detection stores the follow-up
 * and a price preview, and leaves the original quote or proposal untouched.
 */
async function materialiseRequote(
  businessId: string,
  row: { id: string; quoteId: string; jobId: string | null; customerId: string | null; sourceType: string; message: string; subject: string | null },
): Promise<{ message: string; subject: string | null }> {
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const validityDays = settings?.quoteValidityDays && settings.quoteValidityDays > 0 ? settings.quoteValidityDays : 30;
  const rates = await rateCard(businessId);
  const validUntil = new Date(Date.now() + validityDays * DAY_MS);
  const sourceType: FollowUpSourceType = row.sourceType === "proposal" || row.sourceType === "job" ? row.sourceType : "quote";

  const created = await runWithBusiness(businessId, async () => {
    if (sourceType === "quote") {
      const [source] = await ownerDb.select().from(schema.quotes).where(and(
        eq(schema.quotes.id, row.quoteId),
        eq(schema.quotes.businessId, businessId),
      )).limit(1);
      if (!source) throw new Error("Original quote not found.");
      const quoteNumber = await storage.getNextQuoteNumber();
      const signal: QuoteSignal = {
        id: source.id,
        businessId,
        jobId: source.jobId,
        customerId: source.customerId,
        leadId: source.leadId,
        quoteNumber: source.quoteNumber,
        description: source.description,
        terms: source.terms,
        amount: source.amount,
        lineItems: source.lineItems,
        status: source.status,
        sentDate: source.sentDate,
        createdBy: source.createdBy,
      };
      const draft = buildRequoteDraft(signal, rates, quoteNumber, validUntil);
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
      const quote = Array.isArray(inserted) ? inserted[0] : undefined;
      if (!quote) throw new Error("Couldn't create the new quote.");
      return { id: quote.id, number: quote.quoteNumber };
    }

    const proposalSource = sourceType === "proposal"
      ? (await ownerDb.select().from(schema.proposals).where(and(
        eq(schema.proposals.id, row.quoteId),
        eq(schema.proposals.businessId, businessId),
      )).limit(1))[0]
      : undefined;
    const jobSource = sourceType === "job"
      ? (await ownerDb.select().from(schema.jobs).where(and(
        eq(schema.jobs.id, row.quoteId),
        eq(schema.jobs.businessId, businessId),
      )).limit(1))[0]
      : undefined;
    const customerId = proposalSource?.customerId || jobSource?.customerId || row.customerId;
    if (!customerId) throw new Error("This quote has no customer, so a new draft can't be created.");
    const linkedJob = !jobSource && row.jobId
      ? (await ownerDb.select({
        jobNumber: schema.jobs.jobNumber,
        address: schema.jobs.address,
      }).from(schema.jobs).where(and(
        eq(schema.jobs.id, row.jobId),
        eq(schema.jobs.businessId, businessId),
      )).limit(1))[0]
      : undefined;
    const originalNumber = customerFacingQuoteNumber({
      documentNumber: proposalSource?.proposalNumber || jobSource?.jobNumber,
      jobNumber: jobSource?.jobNumber || linkedJob?.jobNumber,
      jobAddress: jobSource?.address || linkedJob?.address,
    });
    const lines = proposalSource
      ? recordsFromProposalLines(await ownerDb.select({
        description: schema.proposalLineItems.description,
        quantity: schema.proposalLineItems.quantity,
        unitPrice: schema.proposalLineItems.unitPrice,
        totalPrice: schema.proposalLineItems.totalPrice,
        sourceId: schema.proposalLineItems.sourceId,
        selected: schema.proposalLineItems.selected,
      }).from(schema.proposalLineItems).where(and(
        eq(schema.proposalLineItems.businessId, businessId),
        eq(schema.proposalLineItems.proposalId, proposalSource.id),
      )))
      : (Array.isArray(jobSource?.lineItems) ? jobSource.lineItems as Record<string, unknown>[] : []);
    const priced = buildRequoteDraft({
      id: row.quoteId,
      businessId,
      jobId: row.jobId,
      customerId,
      quoteNumber: originalNumber,
      description: proposalSource?.introduction || jobSource?.description || null,
      amount: proposalSource?.subtotal || jobSource?.totalAmount || null,
      lineItems: lines,
      status: "sent",
      sentDate: null,
    }, rates, "preview", validUntil);
    const proposalNumber = `Q-DRAFT-${Date.now()}`;
    const subtotal = Number(priced.amount);
    const gst = Math.round(subtotal * 15) / 100;
    const inserted = await ownerDb.insert(schema.proposals).values({
      businessId,
      jobId: row.jobId,
      customerId,
      proposalNumber,
      title: proposalSource?.title || `Re-quote of ${originalNumber}`,
      introduction: proposalSource?.introduction || jobSource?.description || null,
      status: "draft",
      templateUsed: proposalSource?.templateUsed || "quote",
      expiryDate: validUntil,
      subtotal: subtotal.toFixed(2),
      gstAmount: gst.toFixed(2),
      totalAmount: (Math.round((subtotal + gst) * 100) / 100).toFixed(2),
      createdBy: proposalSource?.createdBy || "Follow-up",
    }).returning();
    const proposal = Array.isArray(inserted) ? inserted[0] : undefined;
    if (!proposal) throw new Error("Couldn't create the new quote.");
    const sectionInserted = await ownerDb.insert(schema.proposalSections).values({
      businessId,
      proposalId: proposal.id,
      sectionType: "pricing",
      title: "Pricing",
      content: priced.description,
      sortOrder: 0,
      isVisible: true,
    }).returning();
    const section = Array.isArray(sectionInserted) ? sectionInserted[0] : undefined;
    if (priced.lineItems.length > 0) {
      await ownerDb.insert(schema.proposalLineItems).values(priced.lineItems.map((item, index) => ({
        businessId,
        proposalId: proposal.id,
        sectionId: section?.id ?? null,
        sourceType: "fixed" as const,
        sourceId: typeof item.itemCode === "string" ? item.itemCode : null,
        description: typeof item.description === "string" ? item.description : "Tree service",
        quantity: String(Number(item.quantity) || 1),
        unitPrice: (Number(item.unitPrice) || 0).toFixed(2),
        totalPrice: (Number(item.total) || 0).toFixed(2),
        sortOrder: index,
        selected: true,
      })));
    }
    return { id: proposal.id, number: proposal.proposalNumber };
  });

  const replacement = isInternalDocumentNumber(created.number) ? "the new quote" : created.number.trim();
  const copy = withNewQuoteNumber(row.message, row.subject, replacement);
  await ownerDb.update(schema.quoteFollowUps).set({
    requoteId: created.id,
    message: copy.message,
    subject: copy.subject,
    updatedAt: new Date(),
  }).where(and(eq(schema.quoteFollowUps.id, row.id), eq(schema.quoteFollowUps.businessId, businessId)));
  return copy;
}

async function remindIfWaiting(businessId: string, now: Date): Promise<void> {
  const hour = nzHour(now);
  if (hour < 7 || hour >= 18) return;
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const list = settings?.quoteFollowupWorkflowEnabled === false
    ? { waiting: 0, followUps: [] as QuoteFollowUpView[] }
    : await loadViews(businessId);
  const xero = await listInvoiceXeroForBusiness(businessId);
  const notBilled = await listJobsNotBilledForBusiness(businessId);
  const waiting = list.waiting + xero.waiting + notBilled.waiting;
  if (waiting === 0) return;
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

  const quoteRows = list.followUps.filter((row) => row.waiting);
  const xeroRows = xero.invoices.filter((row) => row.waiting);
  const billedRows = notBilled.jobs.filter((row) => row.waiting);
  const onlyQuotes = xero.waiting === 0 && notBilled.waiting === 0;
  const onlyXero = list.waiting === 0 && notBilled.waiting === 0;
  const onlyBilled = list.waiting === 0 && xero.waiting === 0;
  const path = onlyBilled
    ? (billedRows.length === 1 && billedRows[0] ? jobCardPath(billedRows[0].jobId) : jobsNotBilledQueuePath())
    : (onlyXero
      ? (xeroRows.length === 1 ? invoiceXeroQueuePath(xeroRows[0]?.id) : invoiceXeroQueuePath())
      : (onlyQuotes && quoteRows.length === 1 ? followUpQueuePath(quoteRows[0]?.id) : followUpQueuePath()));
  const title = onlyBilled
    ? "Completed jobs not billed"
    : (onlyXero ? "Invoices not in Xero" : (onlyQuotes ? "Quote follow-ups waiting" : "Follow-ups waiting"));
  const message = onlyBilled
    ? (notBilled.waiting === 1
      ? "1 completed job is not billed yet. Nothing has been created or sent."
      : `${notBilled.waiting} completed jobs are not billed yet. Nothing has been created or sent.`)
    : (onlyXero
      ? (xero.waiting === 1
        ? "1 invoice was sent to the customer and is not in Xero yet. Nothing has been synced."
        : `${xero.waiting} invoices were sent to the customer and are not in Xero yet. Nothing has been synced.`)
      : (onlyQuotes
        ? (list.waiting === 1
          ? `Quote ${quoteRows[0]?.quoteNumber || "follow-up"} is waiting for you. Nothing has been sent.`
          : `${list.waiting} quote follow-ups are waiting for you. Nothing has been sent.`)
        : `${waiting} follow-ups are waiting for you. Nothing has been created, sent, or synced.`));

  await runWithBusiness(businessId, async () => {
    await storage.createNotification({
      title,
      message,
      type: "quote_followup_waiting",
      priority: "medium",
      isRead: false,
      actionUrl: path,
      quoteId: onlyQuotes && quoteRows.length === 1 ? quoteRows[0]?.quoteId : undefined,
      metadata: { waiting, quotes: list.waiting, invoicesNotInXero: xero.waiting, jobsNotBilled: notBilled.waiting },
    });
    const employees = await storage.getAllEmployees();
    const admins = employees.filter((employee) => employee.role === "admin" && employee.isActive !== false);
    for (const admin of admins) {
      await notifyEmployee(admin.id, {
        title,
        body: message,
        clickAction: path,
        collapseId: `follow-ups-${businessId}`,
        data: { type: "quote_followup_waiting" },
      });
    }
  });
}

const PROPOSAL_TRACKED = ["sent", "viewed", "accepted", "accepted_pending_deposit", "rejected", "declined"];

function proposalIdOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const id = (metadata as { proposalId?: unknown }).proposalId;
  return typeof id === "string" && id.trim() ? id : null;
}

function textField(row: unknown, key: string): string | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function contactBits(job: unknown, customer: { name: string | null; email: string | null; phone: string | null; mobile: string | null } | undefined) {
  const contactName = [textField(job, "jobContactFirstName"), textField(job, "jobContactLastName")].filter(Boolean).join(" ").trim();
  return {
    customerName: contactName || customer?.name || null,
    phone: textField(job, "jobContactMobile") || textField(job, "jobContactPhone") || customer?.mobile || customer?.phone || null,
    email: textField(job, "jobContactEmail") || customer?.email || null,
  };
}

async function detectForBusiness(businessId: string, now: Date): Promise<void> {
  const settings = await storage.getBusinessSettingsForBusiness(businessId);
  const lookbackStart = new Date(now.getTime() - SENT_LOOKBACK_DAYS * DAY_MS);
  const quoteRows = await ownerDb.select().from(schema.quotes).where(and(
    eq(schema.quotes.businessId, businessId),
    inArray(schema.quotes.status, OPEN_QUOTE_STATUSES),
    gte(schema.quotes.sentDate, lookbackStart),
  )).limit(1000);
  const proposalRows = await ownerDb.select().from(schema.proposals).where(and(
    eq(schema.proposals.businessId, businessId),
    or(
      gte(schema.proposals.sentDate, lookbackStart),
      and(inArray(schema.proposals.status, PROPOSAL_TRACKED), gte(schema.proposals.updatedAt, lookbackStart)),
    ),
  )).limit(1000);
  const presentedJobs = await ownerDb.select().from(schema.jobs).where(and(
    eq(schema.jobs.businessId, businessId),
    gte(schema.jobs.quotePresentedDate, lookbackStart),
  )).limit(1000);

  const jobIds = Array.from(new Set([
    ...quoteRows.map((row) => row.jobId),
    ...proposalRows.map((row) => row.jobId),
    ...presentedJobs.map((row) => row.id),
  ].filter((id): id is string => !!id)));
  const diaryRows = jobIds.length === 0 ? [] : await ownerDb.select({
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

  const diarySends = new Map<string, Date>();
  for (const row of diaryRows) {
    const proposalId = proposalIdOf(row.metadata);
    if (!proposalId || !row.createdAt) continue;
    const type = (row.entryType ?? "").toLowerCase();
    if (type !== "sms" && type !== "email") continue;
    if ((row.authorRole ?? "").toLowerCase() === "customer") continue;
    const direction = (directionOf(row.metadata) ?? "").toLowerCase();
    if (direction === "inbound" || direction === "incoming") continue;
    const previous = diarySends.get(proposalId);
    if (!previous || row.createdAt < previous) diarySends.set(proposalId, row.createdAt);
  }
  const missingProposalIds = Array.from(diarySends.keys()).filter((id) => !proposalRows.some((row) => row.id === id));
  const extraProposals = missingProposalIds.length === 0 ? [] : await ownerDb.select().from(schema.proposals).where(and(
    eq(schema.proposals.businessId, businessId),
    inArray(schema.proposals.id, missingProposalIds),
  ));
  const proposals = [...proposalRows, ...extraProposals];

  const extraJobIds = Array.from(new Set(proposals.map((row) => row.jobId).filter((id): id is string => !!id && !jobIds.includes(id))));
  const extraJobs = extraJobIds.length === 0 ? [] : await ownerDb.select().from(schema.jobs).where(and(
    eq(schema.jobs.businessId, businessId),
    inArray(schema.jobs.id, extraJobIds),
  ));
  const jobs = [...presentedJobs, ...extraJobs.filter((job) => !presentedJobs.some((row) => row.id === job.id))];
  const quoteJobIds = quoteRows.map((row) => row.jobId).filter((id): id is string => !!id && !jobs.some((job) => job.id === id));
  const quoteJobs = quoteJobIds.length === 0 ? [] : await ownerDb.select().from(schema.jobs).where(and(
    eq(schema.jobs.businessId, businessId),
    inArray(schema.jobs.id, quoteJobIds),
  ));
  const jobsById = new Map([...jobs, ...quoteJobs].map((job) => [job.id, job]));

  const customerIds = Array.from(new Set([
    ...quoteRows.map((row) => row.customerId),
    ...proposals.map((row) => row.customerId),
    ...Array.from(jobsById.values()).map((job) => job.customerId),
  ].filter((id): id is string => !!id)));
  const customers = customerIds.length === 0 ? [] : await ownerDb.select({
    id: schema.customers.id,
    name: schema.customers.name,
    email: schema.customers.email,
    phone: schema.customers.phone,
    mobile: schema.customers.mobile,
  }).from(schema.customers).where(and(eq(schema.customers.businessId, businessId), inArray(schema.customers.id, customerIds)));
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  const signals: QuoteSignal[] = [];
  for (const row of quoteRows) {
    const job = row.jobId ? jobsById.get(row.jobId) : undefined;
    const customer = row.customerId ? customersById.get(row.customerId) : undefined;
    signals.push({
      id: row.id,
      businessId,
      jobId: row.jobId,
      customerId: row.customerId,
      leadId: row.leadId,
      quoteNumber: customerFacingQuoteNumber({
        documentNumber: row.quoteNumber,
        jobNumber: job?.jobNumber,
        jobAddress: job?.address,
      }),
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
      sourceType: "quote",
      jobStatus: job?.status ?? null,
      ...contactBits(job, customer),
    });
  }
  for (const row of proposals) {
    if (!row.jobId) continue;
    const tracked = proposalFollowUpStatus({
      status: row.status,
      sentDate: row.sentDate,
      viewedDate: row.viewedDate,
      updatedAt: row.updatedAt,
      diarySentAt: diarySends.get(row.id) ?? null,
    });
    if (!tracked) continue;
    const status = tracked.status;
    const sentDate = tracked.sentDate;
    const job = jobsById.get(row.jobId);
    const customer = row.customerId ? customersById.get(row.customerId) : undefined;
    signals.push({
      id: row.id,
      businessId,
      jobId: row.jobId,
      customerId: row.customerId,
      quoteNumber: customerFacingQuoteNumber({
        documentNumber: row.proposalNumber,
        jobNumber: job?.jobNumber,
        jobAddress: job?.address,
      }),
      description: row.introduction,
      amount: row.subtotal || row.totalAmount,
      status,
      sentDate,
      updatedAt: row.updatedAt,
      validUntil: row.expiryDate,
      responseDate: row.responseDate,
      createdBy: row.createdBy,
      sourceType: "proposal",
      jobStatus: job?.status ?? null,
      title: row.title,
      ...contactBits(job, customer),
    });
  }
  for (const job of Array.from(jobsById.values())) {
    if (!job.quotePresentedDate) continue;
    const customer = job.customerId ? customersById.get(job.customerId) : undefined;
    signals.push({
      id: job.id,
      businessId,
      jobId: job.id,
      customerId: job.customerId,
      quoteNumber: customerFacingQuoteNumber({
        documentNumber: job.jobNumber,
        jobNumber: job.jobNumber,
        jobAddress: job.address,
      }),
      description: job.description,
      amount: job.totalAmount,
      lineItems: job.lineItems,
      status: "sent",
      sentDate: job.quotePresentedDate,
      updatedAt: job.updatedAt,
      validUntil: null,
      sourceType: "job",
      jobStatus: job.status,
      title: job.title,
      ...contactBits(job, customer),
    });
  }

  const quotes = collapseFollowUpSources(signals);
  const replyJobIds = Array.from(new Set(quotes.map((quote) => quote.jobId).filter((id): id is string => !!id)));
  const replies: DiaryReplySignal[] = diaryRows
    .filter((row) => replyJobIds.includes(row.jobId))
    .map((row) => ({
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
    const sourceType = plan.action === "skip"
      ? plan.sourceType
      : (plan.source.sourceType ?? "quote");
    await insertPlanRow(businessId, { ...plan, sourceType }, plan.action === "skip" ? "skipped" : "draft");
  }

  await remindIfWaiting(businessId, now);
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

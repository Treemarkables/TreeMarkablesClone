/**
 * Quote follow-up detection and draft copy.
 *
 * Pure functions: the hourly job (quoteFollowUpDetection) loads one tenant's
 * quotes, diary replies, and existing rows, then persists whatever this plans.
 * Nothing here sends a message.
 *
 * A follow-up is one row per quote and nudge step. Step 0 is the expiry
 * re-quote. Steps 3, 7 and 14 (or the tenant's own days) are check-ins.
 * Skipped steps are still recorded so a later run cannot draft them again.
 */

export const DEFAULT_NUDGE_DAYS = [3, 7, 14] as const;
export const EXPIRY_NUDGE_STEP = 0;
export const SENT_LOOKBACK_DAYS = 120;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type FollowUpKind = "check_in" | "requote";
export type FollowUpChannel = "sms" | "email";
export type FollowUpSourceType = "quote" | "proposal" | "job";
export type FollowUpStopReason = "accepted" | "declined" | "customer_reply" | "superseded";

export interface QuoteSignal {
  id: string;
  businessId: string;
  jobId: string | null;
  customerId: string | null;
  leadId?: string | null;
  quoteNumber: string;
  description?: string | null;
  terms?: string | null;
  amount?: string | number | null;
  lineItems?: unknown;
  status: string;
  sentDate: string | Date | null;
  updatedAt?: string | Date | null;
  validUntil?: string | Date | null;
  responseDate?: string | Date | null;
  createdBy?: string | null;
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Where this quote lives. Defaults to the quotes table. */
  sourceType?: FollowUpSourceType;
  /** Job status, used to stop when the job has moved on or been lost. */
  jobStatus?: string | null;
  /** Set when a newer document on the same job replaces this one. */
  forceStop?: FollowUpStopReason | null;
  title?: string | null;
}

export interface DiaryReplySignal {
  jobId: string;
  createdAt: string | Date;
  authorRole?: string | null;
  tags?: string[] | null;
  direction?: string | null;
  entryType?: string | null;
}

export interface ExistingFollowUp {
  businessId: string;
  quoteId: string;
  nudgeStep: number;
  status: string;
}

export interface FollowUpSettingsInput {
  enabled: boolean;
  nudgeDays: number[];
  channel: FollowUpChannel;
  businessName: string;
  lookbackDays?: number;
}

export interface PlanQuoteFollowUpsInput {
  now: number;
  businessId: string;
  settings: FollowUpSettingsInput;
  quotes: QuoteSignal[];
  replies: DiaryReplySignal[];
  existing: ExistingFollowUp[];
}

export interface PlannedCreate {
  action: "create";
  businessId: string;
  quoteId: string;
  jobId: string;
  customerId: string | null;
  leadId: string | null;
  quoteNumber: string;
  kind: FollowUpKind;
  nudgeStep: number;
  channel: FollowUpChannel;
  daysQuiet: number;
  subject: string | null;
  message: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  source: QuoteSignal;
}

export interface PlannedSkip {
  action: "skip";
  businessId: string;
  quoteId: string;
  jobId: string | null;
  customerId: string | null;
  nudgeStep: number;
  kind: "check_in";
  sourceType: FollowUpSourceType;
}

export interface PlannedCancel {
  action: "cancel";
  businessId: string;
  quoteId: string;
  reason: FollowUpStopReason;
}

export type FollowUpPlan = PlannedCreate | PlannedSkip | PlannedCancel;

export interface RateCardItem {
  id: string;
  name: string;
  basePrice: number;
}

export interface RequoteDraft {
  quoteNumber: string;
  description: string;
  amount: string;
  status: "draft";
  validUntil: Date;
  terms: string | null;
  lineItems: Record<string, unknown>[];
  jobId: string | null;
  customerId: string | null;
  leadId: string | null;
  revisedFromQuoteId: string;
  createdBy: string | null;
  sentDate: null;
  responseDate: null;
  followUpCount: number;
}

const OPEN_STATUSES = new Set(["sent", "viewed", "expired"]);
const BLOCKING_STATUSES = new Set(["draft", "snoozed"]);
const ACCEPTED_DOC = new Set(["accepted", "accepted_pending_deposit"]);
const DECLINED_DOC = new Set(["rejected", "declined"]);
const WON_JOB = new Set(["work_order", "work order", "scheduled", "completed", "invoiced", "mulch"]);
const LOST_JOB = new Set(["unsuccessful", "cancelled", "canceled", "archived", "lost"]);

function timeOf(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function parseNudgeDays(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : [...DEFAULT_NUDGE_DAYS];
  const days = raw
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 90);
  const unique = Array.from(new Set(days)).sort((a, b) => a - b).slice(0, 5);
  return unique.length > 0 ? unique : [...DEFAULT_NUDGE_DAYS];
}

export function customerFirstName(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.includes(",")) {
    const after = trimmed.split(",")[1]?.trim();
    if (after) return after.split(/\s+/)[0] ?? "";
  }
  const first = trimmed.split(/\s+/)[0] ?? "";
  if (/ltd|limited|trust|council|inc$/i.test(first) && !trimmed.includes(" ")) return "";
  return first;
}

export function quietDaysSince(
  sentDate: string | Date | null,
  updatedAt: string | Date | null | undefined,
  now: number,
): number | null {
  const sent = timeOf(sentDate);
  if (sent == null) return null;
  let anchor = sent;
  const updated = timeOf(updatedAt);
  // A staff edit after the quote was sent resets the quiet clock. The send
  // itself often bumps updatedAt in the same moment, so ignore that.
  if (updated != null && updated > sent + 60_000) anchor = updated;
  if (now < anchor) return 0;
  return Math.floor((now - anchor) / DAY_MS);
}

export function isCustomerDiaryReply(entry: DiaryReplySignal, sentAt: number | null): boolean {
  if (sentAt == null) return false;
  const at = timeOf(entry.createdAt);
  if (at == null || at < sentAt) return false;
  const role = (entry.authorRole ?? "").trim().toLowerCase();
  const direction = (entry.direction ?? "").trim().toLowerCase();
  const tags = entry.tags ?? [];
  if (role === "customer") return true;
  if (direction === "inbound" || direction === "incoming") return true;
  if (tags.some((tag) => tag === "customer-reply")) return true;
  return false;
}

export function resolveFollowUpChannel(
  preferred: FollowUpChannel,
  phone: string | null | undefined,
  email: string | null | undefined,
): FollowUpChannel | null {
  const hasPhone = !!(phone && phone.trim());
  const hasEmail = !!(email && email.trim());
  if (preferred === "sms" && hasPhone) return "sms";
  if (preferred === "email" && hasEmail) return "email";
  if (hasPhone) return "sms";
  if (hasEmail) return "email";
  return null;
}

function greeting(firstName: string): string {
  return firstName ? `Hi ${firstName}` : "Hi";
}

const INTERNAL_NUMBER = /^(?:prop|q-draft|draft)-/i;
const UUID_NUMBER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_DIGITS = /\d{10,}/;
const UNUSABLE_ADDRESS = new Set(["address not specified", "n/a", "na"]);

/**
 * True when a stored document number is an internal id (PROP-<timestamp>,
 * DRAFT-/Q-DRAFT-, a UUID, or any token with a 10+ digit run). Those are not
 * the short number a customer should see in a follow-up.
 */
export function isInternalDocumentNumber(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  if (!text) return true;
  if (/^n\/?a$/i.test(text)) return true;
  if (INTERNAL_NUMBER.test(text)) return true;
  if (UUID_NUMBER.test(text)) return true;
  if (LONG_DIGITS.test(text)) return true;
  return false;
}

/**
 * Number to show after "Quote" / "Proposal" in follow-ups.
 *
 * The proposal screen, PDF, and send email do not share a formatter. Each
 * prints `proposals.proposal_number` directly:
 * - DocumentBlockRenderer header: `{docLabel} #{ctx.invoiceNumber}`
 *   (`buildProposalRenderContext` sets invoiceNumber from proposal.proposalNumber)
 * - ProposalTemplate: `Proposal #{proposal.proposalNumber}`
 * - generateProposalPDFBuffer: `#${proposal.proposalNumber}` beside PROPOSAL/QUOTE
 * - send-email documentLabel: `Proposal #${proposalNumber}` (DRAFT- rewritten to PROP-)
 * Quote rows print `quotes.quote_number` the same way (QuoteTemplate `Quote #{quote.quoteNumber}`,
 * send-quote-email `Quote #${quoteNumber}`).
 *
 * When that rendered value is a short customer number, this returns it. When it
 * is an internal PROP-/UUID/timestamp id, this returns the job number, then the
 * job address. It never returns a PROP- id or a UUID.
 */
export function customerFacingQuoteNumber(input: {
  documentNumber?: string | null;
  jobNumber?: string | number | null;
  jobAddress?: string | null;
}): string {
  const documentNumber = (input.documentNumber ?? "").trim();
  if (documentNumber && !isInternalDocumentNumber(documentNumber)) return documentNumber;
  const jobNumber = input.jobNumber == null ? "" : String(input.jobNumber).trim();
  if (jobNumber && !isInternalDocumentNumber(jobNumber)) return jobNumber;
  const address = (input.jobAddress ?? "").trim();
  if (address && !UNUSABLE_ADDRESS.has(address.toLowerCase())) return address;
  return "your quote";
}

export function draftCheckInMessage(input: {
  firstName: string;
  quoteNumber: string;
  businessName: string;
  channel: FollowUpChannel;
}): { subject: string | null; message: string } {
  const hi = greeting(input.firstName);
  const who = input.businessName.trim() || "us";
  if (input.channel === "sms") {
    return {
      subject: null,
      message: `${hi}, just checking where you're at with quote ${input.quoteNumber}. Happy to answer any questions. Cheers, ${who}`,
    };
  }
  return {
    subject: `Quote ${input.quoteNumber} — just checking in`,
    message: `${hi},\n\nJust checking where you're at with quote ${input.quoteNumber}. Happy to answer any questions, or change it if something's moved.\n\nCheers,\n${who}`,
  };
}

export function draftRequoteMessage(input: {
  firstName: string;
  quoteNumber: string;
  newQuoteNumber: string;
  businessName: string;
  channel: FollowUpChannel;
}): { subject: string | null; message: string } {
  const hi = greeting(input.firstName);
  const who = input.businessName.trim() || "us";
  if (input.channel === "sms") {
    return {
      subject: null,
      message: `${hi}, quote ${input.quoteNumber} has passed its valid date. I've put together a fresh quote (${input.newQuoteNumber}) at today's rates. Happy to talk it through. Cheers, ${who}`,
    };
  }
  return {
    subject: `Fresh quote ${input.newQuoteNumber}`,
    message: `${hi},\n\nQuote ${input.quoteNumber} has passed its valid date, so I've put together a fresh quote (${input.newQuoteNumber}) at today's rates. Have a look when you can, and sing out if you want anything changed.\n\nCheers,\n${who}`,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function asLineItems(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
}

function matchRate(item: Record<string, unknown>, rates: RateCardItem[]): RateCardItem | undefined {
  const code = typeof item.itemCode === "string" ? item.itemCode.trim().toLowerCase() : "";
  const description = typeof item.description === "string" ? item.description.trim().toLowerCase() : "";
  return rates.find((rate) => {
    const id = rate.id.trim().toLowerCase();
    const name = rate.name.trim().toLowerCase();
    if (code && (code === id || code === name)) return true;
    if (description && description === name) return true;
    return false;
  });
}

/**
 * Clone line items onto today's rate card. Unmatched lines keep their price.
 * The input array is not changed.
 */
export function repriceLineItems(
  lineItems: unknown,
  rates: RateCardItem[],
): { lineItems: Record<string, unknown>[]; amount: number; repricedCount: number } {
  let repricedCount = 0;
  const next = asLineItems(lineItems).map((item) => {
    const copy: Record<string, unknown> = { ...item };
    const rate = matchRate(item, rates);
    const quantity = Number(item.quantity);
    const qty = Number.isFinite(quantity) ? quantity : 1;
    if (!rate || !Number.isFinite(rate.basePrice)) {
      const total = Number(item.total);
      copy.total = Number.isFinite(total) ? roundMoney(total) : roundMoney(qty * (Number(item.unitPrice) || 0));
      return copy;
    }
    const unitPrice = roundMoney(rate.basePrice);
    const total = roundMoney(qty * unitPrice);
    copy.unitPrice = unitPrice;
    copy.total = total;
    if ("priceExGst" in item) copy.priceExGst = unitPrice;
    if ("totalExGst" in item) copy.totalExGst = total;
    repricedCount += 1;
    return copy;
  });
  const amount = roundMoney(next.reduce((sum, item) => sum + (Number(item.total) || 0), 0));
  return { lineItems: next, amount, repricedCount };
}

export function buildRequoteDraft(
  source: QuoteSignal,
  rates: RateCardItem[],
  newQuoteNumber: string,
  validUntil: Date,
): RequoteDraft {
  const priced = repriceLineItems(source.lineItems, rates);
  const fallback = Number(source.amount);
  const amount = priced.lineItems.length > 0
    ? priced.amount
    : (Number.isFinite(fallback) ? roundMoney(fallback) : 0);
  return {
    quoteNumber: newQuoteNumber,
    description: source.description?.trim() || `Re-quote of ${source.quoteNumber}`,
    amount: amount.toFixed(2),
    status: "draft",
    validUntil,
    terms: source.terms ?? null,
    lineItems: priced.lineItems,
    jobId: source.jobId,
    customerId: source.customerId,
    leadId: source.leadId ?? null,
    revisedFromQuoteId: source.id,
    createdBy: source.createdBy ?? null,
    sentDate: null,
    responseDate: null,
    followUpCount: 0,
  };
}

function hasStep(existing: ExistingFollowUp[], businessId: string, quoteId: string, step: number): boolean {
  return existing.some((row) => row.businessId === businessId && row.quoteId === quoteId && row.nudgeStep === step);
}

function hasOpenFollowUp(existing: ExistingFollowUp[], businessId: string, quoteId: string): boolean {
  return existing.some(
    (row) => row.businessId === businessId && row.quoteId === quoteId && BLOCKING_STATUSES.has(row.status),
  );
}

function stopReason(quote: QuoteSignal, replies: DiaryReplySignal[]): FollowUpStopReason | null {
  if (quote.forceStop) return quote.forceStop;
  const status = quote.status.trim().toLowerCase();
  if (ACCEPTED_DOC.has(status)) return "accepted";
  if (DECLINED_DOC.has(status)) return "declined";
  const jobStatus = (quote.jobStatus ?? "").trim().toLowerCase();
  if (WON_JOB.has(jobStatus)) return "accepted";
  if (LOST_JOB.has(jobStatus)) return "declined";
  if (quote.responseDate) return "declined";
  const sent = timeOf(quote.sentDate);
  if (quote.jobId && replies.some((reply) => reply.jobId === quote.jobId && isCustomerDiaryReply(reply, sent))) {
    return "customer_reply";
  }
  return null;
}

export function planQuoteFollowUps(input: PlanQuoteFollowUpsInput): FollowUpPlan[] {
  const plans: FollowUpPlan[] = [];
  const lookback = input.settings.lookbackDays ?? SENT_LOOKBACK_DAYS;
  const nudgeDays = parseNudgeDays(input.settings.nudgeDays);
  const preferred = input.settings.channel === "email" ? "email" : "sms";

  for (const quote of input.quotes) {
    if (quote.businessId !== input.businessId) continue;

    const reason = stopReason(quote, input.replies);
    if (reason) {
      if (hasOpenFollowUp(input.existing, input.businessId, quote.id)) {
        plans.push({
          action: "cancel",
          businessId: input.businessId,
          quoteId: quote.id,
          reason,
        });
      }
      continue;
    }

    if (!input.settings.enabled) continue;
    const status = quote.status.trim().toLowerCase();
    if (!OPEN_STATUSES.has(status)) continue;
    if (!quote.jobId) continue;

    const sent = timeOf(quote.sentDate);
    if (sent == null) continue;
    const ageDays = Math.floor((input.now - sent) / DAY_MS);
    if (ageDays > lookback) continue;

    const daysQuiet = quietDaysSince(quote.sentDate, quote.updatedAt, input.now);
    if (daysQuiet == null) continue;

    const validUntil = timeOf(quote.validUntil);
    const expired = status === "expired" || (validUntil != null && validUntil < input.now);
    const channel = resolveFollowUpChannel(preferred, quote.phone, quote.email);
    if (!channel) continue;

    const firstName = customerFirstName(quote.customerName);
    const base = {
      businessId: input.businessId,
      quoteId: quote.id,
      jobId: quote.jobId,
      customerId: quote.customerId,
      leadId: quote.leadId ?? null,
      quoteNumber: quote.quoteNumber,
      channel,
      daysQuiet,
      recipientName: quote.customerName?.trim() || null,
      recipientPhone: quote.phone?.trim() || null,
      recipientEmail: quote.email?.trim() || null,
      source: quote,
    };

    if (expired) {
      if (!hasStep(input.existing, input.businessId, quote.id, EXPIRY_NUDGE_STEP)) {
        const copy = draftRequoteMessage({
          firstName,
          quoteNumber: quote.quoteNumber,
          newQuoteNumber: "the new quote",
          businessName: input.settings.businessName,
          channel,
        });
        plans.push({
          action: "create",
          ...base,
          kind: "requote",
          nudgeStep: EXPIRY_NUDGE_STEP,
          subject: copy.subject,
          message: copy.message,
        });
      }
      continue;
    }

    const due = nudgeDays.filter((day) => daysQuiet >= day);
    if (due.length === 0) continue;
    const missing = due.filter((day) => !hasStep(input.existing, input.businessId, quote.id, day));
    if (missing.length === 0) continue;
    if (hasOpenFollowUp(input.existing, input.businessId, quote.id)) continue;

    const latest = missing[missing.length - 1]!;
    for (const step of missing) {
      if (step !== latest) {
        plans.push({
          action: "skip",
          businessId: input.businessId,
          quoteId: quote.id,
          jobId: quote.jobId,
          customerId: quote.customerId,
          nudgeStep: step,
          kind: "check_in",
          sourceType: quote.sourceType ?? "quote",
        });
        continue;
      }
      const copy = draftCheckInMessage({
        firstName,
        quoteNumber: quote.quoteNumber,
        businessName: input.settings.businessName,
        channel,
      });
      plans.push({
        action: "create",
        ...base,
        kind: "check_in",
        nudgeStep: step,
        subject: copy.subject,
        message: copy.message,
      });
    }
  }

  return plans;
}

const TERMINAL_DOC = new Set(["accepted", "accepted_pending_deposit", "rejected", "declined"]);

/**
 * A proposal counts as sent when email stamped it, or when an outbound diary
 * SMS/email recorded the send (older texts left the row as draft).
 * Returns null when it was never sent and is not already accepted or declined.
 */
export function proposalFollowUpStatus(input: {
  status: string;
  sentDate?: string | Date | null;
  viewedDate?: string | Date | null;
  updatedAt?: string | Date | null;
  diarySentAt?: string | Date | null;
}): { status: string; sentDate: string | Date | null } | null {
  const status = input.status.trim().toLowerCase();
  const terminal = TERMINAL_DOC.has(status);
  let nextStatus = input.status;
  let sentDate = input.sentDate ?? input.diarySentAt ?? null;
  if (!terminal && !input.sentDate && input.diarySentAt) nextStatus = "sent";
  if (!sentDate && (nextStatus === "sent" || nextStatus === "viewed")) {
    sentDate = input.viewedDate ?? input.updatedAt ?? null;
  }
  if (!sentDate && !terminal) return null;
  return { status: nextStatus, sentDate };
}

function sourceRank(sourceType: FollowUpSourceType | undefined): number {
  if (sourceType === "proposal") return 3;
  if (sourceType === "job") return 1;
  return 2;
}

/**
 * One follow-up per job. A sent proposal beats a quotes-table row, which beats
 * a job that only has quote_presented_date. A won, lost, or accepted job
 * stops every document on that job.
 */
export function collapseFollowUpSources(signals: QuoteSignal[]): QuoteSignal[] {
  const loose: QuoteSignal[] = [];
  const byJob = new Map<string, QuoteSignal[]>();
  for (const signal of signals) {
    if (!signal.jobId) {
      loose.push(signal);
      continue;
    }
    const list = byJob.get(signal.jobId) ?? [];
    list.push(signal);
    byJob.set(signal.jobId, list);
  }
  const out = [...loose];
  for (const group of Array.from(byJob.values())) {
    const jobStatus = (group.find((signal) => signal.jobStatus)?.jobStatus ?? "").trim().toLowerCase();
    const won = WON_JOB.has(jobStatus);
    const lost = LOST_JOB.has(jobStatus);
    const accepted = group.some((signal) => ACCEPTED_DOC.has(signal.status.trim().toLowerCase()));
    if (won || lost || accepted) {
      const reason: FollowUpStopReason = lost && !won && !accepted ? "declined" : "accepted";
      for (const signal of group) out.push({ ...signal, forceStop: reason });
      continue;
    }
    const open = group.filter((signal) => {
      const status = signal.status.trim().toLowerCase();
      return !DECLINED_DOC.has(status) && !signal.responseDate;
    });
    for (const signal of group) {
      if (!open.includes(signal)) out.push({ ...signal, forceStop: "declined" });
    }
    if (open.length === 0) continue;
    const winner = [...open].sort((a, b) => {
      const rank = sourceRank(b.sourceType) - sourceRank(a.sourceType);
      if (rank !== 0) return rank;
      return (timeOf(b.sentDate) ?? 0) - (timeOf(a.sentDate) ?? 0);
    })[0]!;
    out.push(winner);
    for (const signal of open) {
      if (signal.id !== winner.id) out.push({ ...signal, forceStop: "superseded" });
    }
  }
  return out;
}

export interface RequotePreviewLine {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/** Today's prices for a re-quote. Does not create a quote or use a number. */
export function previewRequote(
  lineItems: unknown,
  rates: RateCardItem[],
  fallbackAmount?: string | number | null,
): { lines: RequotePreviewLine[]; subtotal: number } {
  const priced = repriceLineItems(lineItems, rates);
  if (priced.lineItems.length === 0) {
    const amount = Number(fallbackAmount);
    if (!Number.isFinite(amount) || amount <= 0) return { lines: [], subtotal: 0 };
    const rounded = roundMoney(amount);
    return {
      lines: [{ description: "Quote", quantity: 1, rate: rounded, amount: rounded }],
      subtotal: rounded,
    };
  }
  return {
    lines: priced.lineItems.map((item) => {
      const quantity = Number(item.quantity);
      const qty = Number.isFinite(quantity) ? quantity : 1;
      const rate = roundMoney(Number(item.unitPrice) || 0);
      const amount = roundMoney(Number(item.total) || qty * rate);
      const description = typeof item.description === "string" && item.description.trim()
        ? item.description.trim()
        : "Tree service";
      return { description, quantity: qty, rate, amount };
    }),
    subtotal: priced.amount,
  };
}

export function isWaitingFollowUp(
  status: string,
  snoozeUntil: string | Date | null | undefined,
  now: number,
): boolean {
  if (status === "draft") return true;
  if (status === "snoozed") {
    const until = timeOf(snoozeUntil);
    return until == null || until <= now;
  }
  return false;
}

export function followUpQueuePath(followUpId?: string | null): string {
  if (!followUpId) return "/quote-follow-ups";
  return `/quote-follow-ups?id=${encodeURIComponent(followUpId)}`;
}

/** Swap the placeholder quote number once the new draft quote exists. */
export function withNewQuoteNumber(message: string, subject: string | null, newQuoteNumber: string): {
  message: string;
  subject: string | null;
} {
  return {
    message: message.replaceAll("the new quote", newQuoteNumber),
    subject: subject ? subject.replaceAll("the new quote", newQuoteNumber) : null,
  };
}

export interface UntouchedDraftInput {
  status: string;
  draftEditedAt?: string | Date | null;
  kind: string;
  channel: string;
  message: string;
  subject: string | null;
  recipientName?: string | null;
  businessName: string;
  documentNumber?: string | null;
  jobNumber?: string | number | null;
  jobAddress?: string | null;
  newDocumentNumber?: string | null;
}

export type UntouchedDraftPlan =
  | { action: "keep" }
  | { action: "mark_edited" }
  | { action: "rewrite"; message: string; subject: string | null };

function sameDraft(copy: { message: string; subject: string | null }, message: string, subject: string | null): boolean {
  return copy.message === message && (copy.subject ?? "") === (subject ?? "");
}

function internalTokens(text: string): string[] {
  const found = text.match(/\b(?:PROP|Q-DRAFT|DRAFT)-\d+\b|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  return found ?? [];
}

/**
 * Pending drafts that still equal a generated default are rewritten onto the
 * short customer number. A draft the user has saved (draftEditedAt, or text
 * that does not match any generated default) is left as-is. Sent and other
 * finished rows are never rewritten. Calling this again on the rewritten
 * text returns keep.
 */
export function planUntouchedDraftRefresh(input: UntouchedDraftInput): UntouchedDraftPlan {
  const status = input.status.trim().toLowerCase();
  if (status !== "draft" && status !== "snoozed") return { action: "keep" };
  if (input.draftEditedAt) return { action: "keep" };

  const channel: FollowUpChannel = input.channel === "email" ? "email" : "sms";
  const kind: FollowUpKind = input.kind === "requote" ? "requote" : "check_in";
  const firstName = customerFirstName(input.recipientName);
  const shown = customerFacingQuoteNumber(input);
  const signed = input.message.match(/Cheers,\s*([^\n]+)\s*$/)?.[1]?.trim() ?? "";
  const businessName = input.businessName.trim() || signed || "us";
  const newRaw = (input.newDocumentNumber ?? "").trim();
  const newShown = newRaw && !isInternalDocumentNumber(newRaw) ? newRaw : "the new quote";
  const names = Array.from(new Set([businessName, signed, "us"].filter((value) => value.length > 0)));
  const numbers = Array.from(new Set([
    (input.documentNumber ?? "").trim(),
    shown,
    ...internalTokens(`${input.message}\n${input.subject ?? ""}`),
  ].filter((value) => value.length > 0)));
  const newNumbers = Array.from(new Set(["the new quote", newShown, newRaw, ...internalTokens(input.message)].filter((value) => value.length > 0)));

  const rewrite = (name: string) => kind === "requote"
    ? draftRequoteMessage({ firstName, quoteNumber: shown, newQuoteNumber: newShown, businessName: name, channel })
    : draftCheckInMessage({ firstName, quoteNumber: shown, businessName: name, channel });

  for (const name of names) {
    for (const number of numbers) {
      if (kind === "requote") {
        for (const next of newNumbers) {
          const copy = draftRequoteMessage({ firstName, quoteNumber: number, newQuoteNumber: next, businessName: name, channel });
          if (!sameDraft(copy, input.message, input.subject)) continue;
          const desired = rewrite(name);
          if (sameDraft(desired, input.message, input.subject)) return { action: "keep" };
          return { action: "rewrite", message: desired.message, subject: desired.subject };
        }
      } else {
        const copy = draftCheckInMessage({ firstName, quoteNumber: number, businessName: name, channel });
        if (!sameDraft(copy, input.message, input.subject)) continue;
        const desired = rewrite(name);
        if (sameDraft(desired, input.message, input.subject)) return { action: "keep" };
        return { action: "rewrite", message: desired.message, subject: desired.subject };
      }
    }
  }
  return { action: "mark_edited" };
}

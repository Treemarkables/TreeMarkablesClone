/**
 * Invoices that were sent to the customer and are not in Xero.
 *
 * invoiceXeroDetection runs hourly on the same clock as quoteFollowUpDetection
 * (RUN_CRONS, both app instances). It only inserts drafts. Approve & Sync is
 * the only path that calls Xero, and it calls the same push as the Invoices page.
 *
 * Reads are owner-connection queries filtered by business id. The Xero push
 * runs inside that tenant's database context.
 */
import { and, asc, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import { ownerDb, acquireTenantDb } from "./db";
import { storage } from "./storage";
import { currentBusinessId, currentTenantDb, runWithBusiness, runWithTenant } from "./tenancy/tenantStore";
import { pushJobInvoiceToXero } from "./xeroRoutes";
import { commitApprovedXeroSync } from "@shared/invoiceXeroApproval";
import {
  buildXeroSyncPreview,
  invoiceXeroQueuePath,
  isWaitingInvoiceXero,
  planInvoiceXeroFollowUps,
  type InvoiceXeroSignal,
  type XeroSyncPreview,
} from "@shared/invoiceXeroFollowUps";
import { DAY_MS, SENT_LOOKBACK_DAYS } from "@shared/quoteFollowUps";
import { APP_URL } from "./config/appUrl";
import * as schema from "@shared/schema";

const RLS_ENABLED = process.env.TENANT_RLS_ENABLED === "true";
const STALE_SYNC_MS = 10 * 60 * 1000;

export interface InvoiceXeroView {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  jobId: string | null;
  customerName: string | null;
  status: string;
  waiting: boolean;
  snoozeUntil: string | null;
  lastError: string | null;
  preview: XeroSyncPreview;
  links: { queue: string; job: string | null };
}

export interface InvoiceXeroList {
  waiting: number;
  invoices: InvoiceXeroView[];
  links: { queue: string };
}

function requireBusinessId(businessId: string | null | undefined): string {
  if (!businessId) throw new Error("Missing business");
  return businessId;
}

function appBase(): string {
  return APP_URL.replace(/\/$/, "");
}

async function withTenantFor<T>(businessId: string, fn: () => Promise<T>): Promise<T> {
  if (currentBusinessId() === businessId && currentTenantDb()) return fn();
  if (RLS_ENABLED) {
    const conn = await acquireTenantDb(businessId);
    try {
      return await runWithTenant({ businessId, tenantDb: conn.tenantDb }, fn);
    } finally {
      await conn.release();
    }
  }
  return runWithBusiness(businessId, fn);
}

async function accountDefaults(businessId: string): Promise<{ accountCode: string; taxType: string }> {
  const settings = await withTenantFor(businessId, () => storage.getXeroSettings());
  return {
    accountCode: settings?.salesAccountCode?.trim() || "200",
    taxType: settings?.taxType?.trim() || "OUTPUT2",
  };
}

async function signalsForInvoices(businessId: string, invoiceIds: string[]): Promise<InvoiceXeroSignal[]> {
  if (invoiceIds.length === 0) return [];
  const invoiceRows = await ownerDb
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.businessId, businessId), inArray(schema.invoices.id, invoiceIds)));
  const jobIds = Array.from(new Set(invoiceRows.map((row) => row.jobId).filter((id): id is string => !!id)));
  const customerIds = Array.from(new Set(invoiceRows.map((row) => row.customerId).filter((id): id is string => !!id)));
  const jobs = jobIds.length === 0 ? [] : await ownerDb.select({
    id: schema.jobs.id,
    jobNumber: schema.jobs.jobNumber,
    title: schema.jobs.title,
    xeroInvoiceId: schema.jobs.xeroInvoiceId,
    xeroStatus: schema.jobs.xeroStatus,
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
  return invoiceRows.map((row) => {
    const job = row.jobId ? jobsById.get(row.jobId) : undefined;
    const customer = row.customerId ? customersById.get(row.customerId) : undefined;
    const contact = row.contactName?.trim() || "";
    const customerName = contact || customer?.name?.trim() || "";
    return {
      id: row.id,
      businessId,
      jobId: row.jobId,
      customerId: row.customerId,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      sentDate: row.sentDate,
      updatedAt: row.updatedAt,
      amount: row.amount,
      description: row.description,
      dueDate: row.dueDate,
      address: row.address,
      items: row.items,
      xeroInvoiceId: row.xeroInvoiceId,
      jobXeroInvoiceId: job?.xeroInvoiceId ?? null,
      xeroStatus: job?.xeroStatus ?? null,
      customerName: customerName.length > 0 ? customerName : null,
      customerEmail: customer?.email || null,
      customerPhone: customer?.mobile || customer?.phone || null,
      jobNumber: job?.jobNumber ?? null,
      jobTitle: row.jobTitle || job?.title || null,
    };
  });
}

async function candidateInvoiceIds(businessId: string, now: Date): Promise<string[]> {
  const lookbackStart = new Date(now.getTime() - SENT_LOOKBACK_DAYS * DAY_MS);
  const sentRows = await ownerDb
    .select({ id: schema.invoices.id })
    .from(schema.invoices)
    .where(and(
      eq(schema.invoices.businessId, businessId),
      or(
        and(isNotNull(schema.invoices.sentDate), gte(schema.invoices.sentDate, lookbackStart)),
        and(eq(schema.invoices.status, "sent"), gte(schema.invoices.updatedAt, lookbackStart)),
      ),
    ))
    .limit(500);
  const openRows = await ownerDb
    .select({ invoiceId: schema.invoiceXeroFollowUps.invoiceId })
    .from(schema.invoiceXeroFollowUps)
    .where(and(
      eq(schema.invoiceXeroFollowUps.businessId, businessId),
      inArray(schema.invoiceXeroFollowUps.status, ["draft", "snoozed", "syncing"]),
    ));
  return Array.from(new Set([
    ...sentRows.map((row) => row.id),
    ...openRows.map((row) => row.invoiceId),
  ]));
}

async function loadViews(businessId: string, base = appBase()): Promise<InvoiceXeroList> {
  const rows = await ownerDb
    .select()
    .from(schema.invoiceXeroFollowUps)
    .where(and(
      eq(schema.invoiceXeroFollowUps.businessId, businessId),
      inArray(schema.invoiceXeroFollowUps.status, ["draft", "snoozed"]),
    ))
    .orderBy(asc(schema.invoiceXeroFollowUps.createdAt))
    .limit(200);
  const signals = await signalsForInvoices(businessId, rows.map((row) => row.invoiceId));
  const byInvoice = new Map(signals.map((signal) => [signal.id, signal]));
  const defaults = rows.length === 0 ? { accountCode: "200", taxType: "OUTPUT2" } : await accountDefaults(businessId);
  const now = Date.now();
  const invoices: InvoiceXeroView[] = rows.flatMap((row) => {
    const signal = byInvoice.get(row.invoiceId);
    if (!signal) return [];
    const preview = buildXeroSyncPreview({ invoice: signal, ...defaults });
    return [{
      id: row.id,
      invoiceId: row.invoiceId,
      invoiceNumber: signal.invoiceNumber,
      jobId: row.jobId,
      customerName: signal.customerName ?? null,
      status: row.status,
      waiting: isWaitingInvoiceXero(row.status, row.snoozeUntil, now),
      snoozeUntil: row.snoozeUntil ? new Date(row.snoozeUntil).toISOString() : null,
      lastError: row.lastError,
      preview,
      links: {
        queue: `${base}${invoiceXeroQueuePath(row.id)}`,
        job: row.jobId ? `${base}/dispatch?job=${row.jobId}` : null,
      },
    }];
  });
  return {
    waiting: invoices.filter((row) => row.waiting).length,
    invoices,
    links: { queue: `${base}${invoiceXeroQueuePath()}` },
  };
}

export async function listInvoiceXeroForSession(): Promise<InvoiceXeroList> {
  const businessId = currentBusinessId();
  if (!businessId) {
    const error = new Error("Not authenticated");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return loadViews(businessId);
}

export async function listInvoiceXeroForBusiness(businessId: string): Promise<InvoiceXeroList> {
  return loadViews(requireBusinessId(businessId));
}

export async function countWaitingInvoiceXeroFollowUps(): Promise<number> {
  const businessId = currentBusinessId();
  if (!businessId) return 0;
  const rows = await ownerDb
    .select({
      status: schema.invoiceXeroFollowUps.status,
      snoozeUntil: schema.invoiceXeroFollowUps.snoozeUntil,
    })
    .from(schema.invoiceXeroFollowUps)
    .where(and(
      eq(schema.invoiceXeroFollowUps.businessId, businessId),
      inArray(schema.invoiceXeroFollowUps.status, ["draft", "snoozed"]),
    ))
    .limit(200);
  const now = Date.now();
  return rows.filter((row) => isWaitingInvoiceXero(row.status, row.snoozeUntil, now)).length;
}

async function rowForBusiness(businessId: string, id: string) {
  const [row] = await ownerDb
    .select()
    .from(schema.invoiceXeroFollowUps)
    .where(and(eq(schema.invoiceXeroFollowUps.id, id), eq(schema.invoiceXeroFollowUps.businessId, businessId)))
    .limit(1);
  return row;
}

export async function snoozeInvoiceXeroFollowUp(businessId: string, id: string, days: number): Promise<InvoiceXeroView | null> {
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    const error = new Error("Pick a snooze of 1 to 30 days.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
  const row = await rowForBusiness(businessId, id);
  if (!row || (row.status !== "draft" && row.status !== "snoozed")) return null;
  await ownerDb.update(schema.invoiceXeroFollowUps).set({
    status: "snoozed",
    snoozeUntil: new Date(Date.now() + days * DAY_MS),
    updatedAt: new Date(),
  }).where(and(eq(schema.invoiceXeroFollowUps.id, id), eq(schema.invoiceXeroFollowUps.businessId, businessId)));
  const list = await loadViews(businessId);
  return list.invoices.find((item) => item.id === id) ?? null;
}

export async function dismissInvoiceXeroFollowUp(businessId: string, id: string): Promise<boolean> {
  const row = await rowForBusiness(businessId, id);
  if (!row || (row.status !== "draft" && row.status !== "snoozed")) return false;
  await ownerDb.update(schema.invoiceXeroFollowUps).set({
    status: "dismissed",
    updatedAt: new Date(),
  }).where(and(eq(schema.invoiceXeroFollowUps.id, id), eq(schema.invoiceXeroFollowUps.businessId, businessId)));
  return true;
}

export async function approveInvoiceXeroFollowUp(input: {
  businessId: string;
  id: string;
  confirm: unknown;
}): Promise<{ status: number; body: { success: boolean; message?: string } }> {
  if (input.confirm !== true) {
    return { status: 400, body: { success: false, message: "Syncing needs confirm: true. Nothing was sent to Xero." } };
  }
  const businessId = requireBusinessId(input.businessId);
  const existing = await rowForBusiness(businessId, input.id);
  if (!existing) return { status: 404, body: { success: false, message: "Invoice not found in the queue." } };
  const staleSyncing = existing.status === "syncing"
    && existing.updatedAt != null
    && Date.now() - new Date(existing.updatedAt).getTime() >= STALE_SYNC_MS;
  if (existing.status !== "draft" && existing.status !== "snoozed" && !staleSyncing) {
    return { status: 409, body: { success: false, message: "This invoice is not waiting for approval." } };
  }
  const [signal] = await signalsForInvoices(businessId, [existing.invoiceId]);
  const jobId = signal?.jobId;
  if (!signal || !jobId) {
    return { status: 422, body: { success: false, message: "This invoice is not on a job, so it can't be synced from here." } };
  }
  const defaults = await accountDefaults(businessId);
  const preview = buildXeroSyncPreview({ invoice: signal, ...defaults });
  if (preview.blockingReason) {
    await ownerDb.update(schema.invoiceXeroFollowUps).set({
      lastError: preview.blockingReason,
      updatedAt: new Date(),
    }).where(and(eq(schema.invoiceXeroFollowUps.id, existing.id), eq(schema.invoiceXeroFollowUps.businessId, businessId)));
    return { status: 422, body: { success: false, message: preview.blockingReason } };
  }

  const previousStatus = existing.status === "snoozed" ? "snoozed" : "draft";
  const [claimed] = await ownerDb.update(schema.invoiceXeroFollowUps).set({
    status: "syncing",
    lastError: null,
    updatedAt: new Date(),
  }).where(and(
    eq(schema.invoiceXeroFollowUps.id, existing.id),
    eq(schema.invoiceXeroFollowUps.businessId, businessId),
    eq(schema.invoiceXeroFollowUps.status, existing.status),
  )).returning();
  if (!claimed) {
    return { status: 409, body: { success: false, message: "This invoice is not waiting for approval." } };
  }

  const revert = async (message: string) => {
    await ownerDb.update(schema.invoiceXeroFollowUps).set({
      status: previousStatus,
      lastError: message,
      updatedAt: new Date(),
    }).where(and(
      eq(schema.invoiceXeroFollowUps.id, claimed.id),
      eq(schema.invoiceXeroFollowUps.businessId, businessId),
      eq(schema.invoiceXeroFollowUps.status, "syncing"),
    ));
  };

  try {
    const result = await commitApprovedXeroSync({
      confirm: true,
      status: previousStatus,
      preview,
    }, async () => {
      const pushed = await withTenantFor(businessId, () => pushJobInvoiceToXero(jobId));
      const ok = pushed.status < 400 && pushed.body.success === true;
      return { ok, message: pushed.body.message };
    });
    if (!result.ok) {
      await revert(result.message);
      return { status: result.status, body: { success: false, message: result.message } };
    }
    await ownerDb.update(schema.invoiceXeroFollowUps).set({
      status: "synced",
      syncedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    }).where(and(eq(schema.invoiceXeroFollowUps.id, claimed.id), eq(schema.invoiceXeroFollowUps.businessId, businessId)));
    return { status: 200, body: { success: true, message: result.message } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xero didn't accept the invoice. Nothing was marked as synced.";
    await revert(message);
    return { status: 502, body: { success: false, message } };
  }
}

async function detectForBusiness(businessId: string, now: Date): Promise<void> {
  const invoiceIds = await candidateInvoiceIds(businessId, now);
  const invoices = await signalsForInvoices(businessId, invoiceIds);
  const existing = invoiceIds.length === 0 ? [] : await ownerDb.select({
    businessId: schema.invoiceXeroFollowUps.businessId,
    invoiceId: schema.invoiceXeroFollowUps.invoiceId,
    status: schema.invoiceXeroFollowUps.status,
  }).from(schema.invoiceXeroFollowUps).where(and(
    eq(schema.invoiceXeroFollowUps.businessId, businessId),
    inArray(schema.invoiceXeroFollowUps.invoiceId, invoiceIds),
  ));
  const plans = planInvoiceXeroFollowUps({
    now: now.getTime(),
    businessId,
    invoices,
    existing: existing.flatMap((row) => row.businessId ? [{
      businessId: row.businessId,
      invoiceId: row.invoiceId,
      status: row.status,
    }] : []),
  });
  for (const plan of plans) {
    if (plan.action === "cancel") {
      await ownerDb.update(schema.invoiceXeroFollowUps).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(and(
        eq(schema.invoiceXeroFollowUps.businessId, businessId),
        eq(schema.invoiceXeroFollowUps.invoiceId, plan.invoiceId),
        inArray(schema.invoiceXeroFollowUps.status, ["draft", "snoozed", "syncing"]),
      ));
      continue;
    }
    if (plan.action === "reopen") {
      await ownerDb.update(schema.invoiceXeroFollowUps).set({
        status: "draft",
        jobId: plan.jobId,
        customerId: plan.customerId,
        lastError: null,
        snoozeUntil: null,
        updatedAt: new Date(),
      }).where(and(
        eq(schema.invoiceXeroFollowUps.businessId, businessId),
        eq(schema.invoiceXeroFollowUps.invoiceId, plan.invoiceId),
        inArray(schema.invoiceXeroFollowUps.status, ["synced", "cancelled"]),
      ));
      continue;
    }
    await ownerDb.insert(schema.invoiceXeroFollowUps).values({
      businessId,
      invoiceId: plan.invoiceId,
      jobId: plan.jobId,
      customerId: plan.customerId,
      status: "draft",
    }).onConflictDoNothing({
      target: [schema.invoiceXeroFollowUps.businessId, schema.invoiceXeroFollowUps.invoiceId],
    });
  }
}

export async function runInvoiceXeroDetection(now = new Date()): Promise<void> {
  const businesses = await storage.listBusinesses();
  for (const business of businesses) {
    try {
      await detectForBusiness(business.id, now);
    } catch (error) {
      console.error(`[invoiceXeroDetection] ${business.id} failed:`, error);
    }
  }
}

export const INVOICE_XERO_JOB = "invoiceXeroDetection";

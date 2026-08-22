/**
 * Supplier-invoice ingestion (Phase 1).
 *
 * Suppliers email invoices to a per-supplier Inflow address
 *   inv-{tenantSlug}-{token}@<INBOUND_EMAIL_DOMAIN>
 * or the tenant catch-all
 *   bills-{tenantSlug}@<INBOUND_EMAIL_DOMAIN>
 * Resend receives them and fires `email.received` at
 * POST /api/webhooks/inbound-invoice (routes.ts). The webhook does NO parsing:
 * it resolves the supplier connection from the token (never from the From
 * address), records an inbound_documents row, applies the sender-domain
 * policy, and hands off to processInboundDocument() which fetches the
 * attachments, stores them, extracts the fields with the model, validates the
 * arithmetic IN CODE, and lands a `needs_review` supplier_invoices row in the
 * triage queue. Nothing enters a job's cost ledger until a human assigns it.
 *
 * Tenancy: every function here runs session-less (webhook / background), so
 * reads go through ownerDb with EXPLICIT business_id filters and writes stamp
 * business_id explicitly. The `db` RLS proxy is not used on purpose.
 */
import { createHash, randomBytes } from "crypto";
import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import OpenAI from "openai";
import * as schema from "@shared/schema";
import { ownerDb, pool } from "../db";
import { storage } from "../storage";
import { PhotoStorageService } from "../photoStorage";
import { getUncachableResendClient } from "../resendClient";
import { runWithBusiness } from "../tenancy/tenantStore";
import * as usageMeter from "./usageMeter";

// ────────────────────────────────────────────────────────────────────────────
// Addresses
// ────────────────────────────────────────────────────────────────────────────

export function getInboundDomain(): string {
  return (process.env.INBOUND_EMAIL_DOMAIN || "bills.inflowapp.co.nz").trim().toLowerCase();
}

// 12 chars from an unambiguous lowercase alphabet (no 0/o/1/l/i). ~57 bits.
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function generateInboundToken(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "biz";
}

export function buildSupplierAddress(tenantSlug: string, token: string): string {
  return `inv-${tenantSlug}-${token}@${getInboundDomain()}`;
}
export function buildCatchAllAddress(tenantSlug: string): string {
  return `bills-${tenantSlug}@${getInboundDomain()}`;
}

/** "Name <a@b>" | "a@b" → "a@b" (lowercased). */
export function extractEmailAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}
export function senderDomainOf(from: string | null | undefined): string {
  const addr = extractEmailAddress(from);
  const at = addr.lastIndexOf("@");
  return at >= 0 ? addr.slice(at + 1) : "";
}

export type ParsedRecipient =
  | { kind: "supplier"; token: string; address: string }
  | { kind: "catchall"; slug: string; address: string };

/**
 * Find the recipient on our inbound domain and decode it. The token is the
 * LAST dash-segment of the local part (slugs can contain dashes, tokens can't).
 */
export function parseInboundRecipient(addresses: Array<string | null | undefined>): ParsedRecipient | null {
  const domain = getInboundDomain();
  for (const raw of addresses) {
    const addr = extractEmailAddress(raw);
    if (!addr.endsWith(`@${domain}`)) continue;
    const local = addr.slice(0, addr.length - domain.length - 1);
    if (local.startsWith("inv-")) {
      const lastDash = local.lastIndexOf("-");
      if (lastDash > 4) return { kind: "supplier", token: local.slice(lastDash + 1), address: addr };
    }
    if (local.startsWith("bills-")) {
      return { kind: "catchall", slug: local.slice(6), address: addr };
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Connections
// ────────────────────────────────────────────────────────────────────────────

export async function getBusinessSlug(businessId: string): Promise<string> {
  const [b] = await ownerDb
    .select({ slug: schema.businesses.slug, name: schema.businesses.name })
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .limit(1);
  if (!b) throw new Error("Business not found");
  if (b.slug) return b.slug;
  // Slug is normally set at signup; backfill from the name if it's missing so
  // the generated addresses are readable.
  const slug = slugify(b.name || businessId.slice(0, 8));
  await ownerDb.update(schema.businesses).set({ slug }).where(eq(schema.businesses.id, businessId));
  return slug;
}

export async function createSupplierConnection(businessId: string, supplierName: string) {
  const slug = await getBusinessSlug(businessId);
  // Retry on the (astronomically unlikely) token collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateInboundToken();
    const address = buildSupplierAddress(slug, token);
    try {
      const [row] = await ownerDb
        .insert(schema.supplierConnections)
        .values({ businessId, supplierName: supplierName.trim(), inboundToken: token, inboundAddress: address, status: "pending_first_email" })
        .returning();
      return row;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "23505") throw err;
    }
  }
  throw new Error("Could not allocate a unique inbound address");
}

export async function listSupplierConnections(businessId: string) {
  const rows = await ownerDb
    .select()
    .from(schema.supplierConnections)
    .where(eq(schema.supplierConnections.businessId, businessId))
    .orderBy(schema.supplierConnections.createdAt);
  const slug = await getBusinessSlug(businessId);
  return { connections: rows, catchAllAddress: buildCatchAllAddress(slug) };
}

async function findConnectionByToken(token: string) {
  const [row] = await ownerDb
    .select()
    .from(schema.supplierConnections)
    .where(eq(schema.supplierConnections.inboundToken, token))
    .limit(1);
  return row;
}

async function findBusinessIdBySlug(slug: string): Promise<string | undefined> {
  const [row] = await ownerDb
    .select({ id: schema.businesses.id })
    .from(schema.businesses)
    .where(eq(schema.businesses.slug, slug))
    .limit(1);
  return row?.id;
}

/**
 * "Confirm this sender": add the pending domain to the allow-list, activate the
 * connection, and release every quarantined-for-unconfirmed-sender document on
 * it back into processing.
 */
export async function confirmConnectionSender(businessId: string, connectionId: string) {
  const [conn] = await ownerDb
    .select()
    .from(schema.supplierConnections)
    .where(and(eq(schema.supplierConnections.id, connectionId), eq(schema.supplierConnections.businessId, businessId)))
    .limit(1);
  if (!conn) return null;
  const domain = conn.pendingSenderDomain;
  const allowed = new Set(conn.allowedSenderDomains || []);
  if (domain) allowed.add(domain);
  const [updated] = await ownerDb
    .update(schema.supplierConnections)
    .set({ allowedSenderDomains: Array.from(allowed), pendingSenderDomain: null, status: "active", updatedAt: new Date() })
    .where(eq(schema.supplierConnections.id, connectionId))
    .returning();

  // Release docs quarantined for sender reasons whose sender now matches.
  const quarantined = await ownerDb
    .select()
    .from(schema.inboundDocuments)
    .where(and(
      eq(schema.inboundDocuments.supplierConnectionId, connectionId),
      eq(schema.inboundDocuments.status, "quarantined"),
      inArray(schema.inboundDocuments.failureReason, ["unconfirmed_sender", "unknown_sender"]),
    ));
  let released = 0;
  for (const doc of quarantined) {
    if (!allowed.has(senderDomainOf(doc.fromAddress))) continue;
    await ownerDb
      .update(schema.inboundDocuments)
      .set({ status: "received", failureReason: null, updatedAt: new Date() })
      .where(eq(schema.inboundDocuments.id, doc.id));
    enqueueProcessing(doc.id);
    released++;
  }
  return { connection: updated, released };
}

// ────────────────────────────────────────────────────────────────────────────
// Webhook receipt (no parsing here — must be fast)
// ────────────────────────────────────────────────────────────────────────────

export interface InboundEmailEvent {
  email_id: string;
  from: string;
  to: string[];
  subject?: string;
}

export type ReceiveOutcome =
  | { action: "dropped"; reason: string }
  | { action: "duplicate"; documentId: string }
  | { action: "quarantined"; documentId: string; reason: string }
  | { action: "queued"; documentId: string };

export async function receiveInboundEmail(ev: InboundEmailEvent): Promise<ReceiveOutcome> {
  const recipient = parseInboundRecipient(ev.to || []);
  if (!recipient) return { action: "dropped", reason: "no_inbound_recipient" };

  let businessId: string | undefined;
  let connection: schema.SupplierConnection | undefined;
  if (recipient.kind === "supplier") {
    connection = await findConnectionByToken(recipient.token);
    if (!connection) return { action: "dropped", reason: "unknown_token" };
    businessId = connection.businessId;
  } else {
    businessId = await findBusinessIdBySlug(recipient.slug);
    if (!businessId) return { action: "dropped", reason: "unknown_tenant" };
  }

  // Sender policy (supplier addresses only — the catch-all exists precisely so
  // a tradie forwarding from Gmail isn't blocked by the supplier allow-list).
  let quarantineReason: string | null = null;
  const domain = senderDomainOf(ev.from);
  if (connection) {
    if (connection.status === "paused") {
      quarantineReason = "connection_paused";
    } else if (connection.status === "pending_first_email") {
      quarantineReason = "unconfirmed_sender";
    } else if (!(connection.allowedSenderDomains || []).includes(domain)) {
      quarantineReason = "unknown_sender";
    }
  }

  // Upsert on resendEmailId — Resend retries webhooks; never double-process.
  const inserted = await ownerDb
    .insert(schema.inboundDocuments)
    .values({
      businessId,
      supplierConnectionId: connection?.id ?? null,
      resendEmailId: ev.email_id,
      fromAddress: ev.from || null,
      toAddress: recipient.address,
      subject: ev.subject || null,
      status: quarantineReason ? "quarantined" : "received",
      failureReason: quarantineReason,
    })
    .onConflictDoNothing({ target: schema.inboundDocuments.resendEmailId })
    .returning({ id: schema.inboundDocuments.id });
  if (inserted.length === 0) {
    const [existing] = await ownerDb
      .select({ id: schema.inboundDocuments.id })
      .from(schema.inboundDocuments)
      .where(eq(schema.inboundDocuments.resendEmailId, ev.email_id))
      .limit(1);
    return { action: "duplicate", documentId: existing?.id || "" };
  }
  const documentId = inserted[0].id;

  if (connection && quarantineReason === "unconfirmed_sender" && domain) {
    await ownerDb
      .update(schema.supplierConnections)
      .set({ pendingSenderDomain: domain, updatedAt: new Date() })
      .where(eq(schema.supplierConnections.id, connection.id));
  }

  if (quarantineReason) return { action: "quarantined", documentId, reason: quarantineReason };
  enqueueProcessing(documentId);
  return { action: "queued", documentId };
}

/**
 * In-process hand-off. The claim inside processInboundDocument() is an atomic
 * status transition, so if both app instances (or a webhook retry) race, only
 * one does the work. A document left in `received` (e.g. the instance died
 * mid-flight) is picked up by sweepStaleInboundDocuments() on the next boot.
 */
export function enqueueProcessing(documentId: string): void {
  setImmediate(() => {
    processInboundDocument(documentId).catch((err) => {
      console.error(`🧾 inbound-invoice: processing ${documentId} crashed:`, err);
    });
  });
}

export async function sweepStaleInboundDocuments(): Promise<number> {
  try {
    const rows = await ownerDb
      .select({ id: schema.inboundDocuments.id })
      .from(schema.inboundDocuments)
      .where(and(
        inArray(schema.inboundDocuments.status, ["received", "fetching", "parsing"]),
        lt(schema.inboundDocuments.updatedAt, new Date(Date.now() - 10 * 60 * 1000)),
      ))
      .limit(50);
    for (const r of rows) {
      // Reset a stuck claim so the atomic claim below can take it again.
      await ownerDb.update(schema.inboundDocuments).set({ status: "received", updatedAt: new Date() }).where(eq(schema.inboundDocuments.id, r.id));
      enqueueProcessing(r.id);
    }
    return rows.length;
  } catch (err) {
    // Table may not exist yet during rollout — never block boot.
    console.warn("🧾 inbound-invoice: stale sweep skipped:", err instanceof Error ? err.message : err);
    return 0;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Processing job
// ────────────────────────────────────────────────────────────────────────────

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_BYTES = 10 * 1024; // anything smaller is a signature logo / inline icon
const DOCUMENT_MIMES = new Set(["application/pdf"]);
const STRUCTURED_MIMES = new Set(["text/csv", "application/csv", "application/xml", "text/xml"]);
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

interface AttachmentRef { filename: string; mimeType: string; size: number; url: string | null; kind: "pdf" | "image" | "structured"; }

function parseAuthResults(headers: Record<string, string> | null | undefined): { spf: boolean | null; dkim: boolean | null } {
  if (!headers) return { spf: null, dkim: null };
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v);
  const auth = lower["authentication-results"] || lower["arc-authentication-results"] || "";
  const receivedSpf = lower["received-spf"] || "";
  let spf: boolean | null = null;
  let dkim: boolean | null = null;
  const spfM = auth.match(/\bspf=(pass|fail|softfail|neutral|none|temperror|permerror)/i) || receivedSpf.match(/^(pass|fail|softfail|neutral|none|temperror|permerror)/i);
  if (spfM) {
    const v = spfM[1].toLowerCase();
    spf = v === "pass" ? true : v === "fail" || v === "softfail" || v === "permerror" ? false : null;
  }
  const dkimM = auth.match(/\bdkim=(pass|fail|none|policy|neutral|temperror|permerror)/i);
  if (dkimM) {
    const v = dkimM[1].toLowerCase();
    dkim = v === "pass" ? true : v === "fail" || v === "permerror" ? false : null;
  }
  return { spf, dkim };
}

async function setDocStatus(id: string, status: string, failureReason: string | null = null, extra: Partial<schema.InboundDocument> = {}) {
  await ownerDb
    .update(schema.inboundDocuments)
    .set({ status, failureReason, updatedAt: new Date(), ...extra })
    .where(eq(schema.inboundDocuments.id, id));
}

export async function processInboundDocument(documentId: string): Promise<void> {
  // Atomic claim — only one worker proceeds.
  const claimed = await ownerDb
    .update(schema.inboundDocuments)
    .set({ status: "fetching", updatedAt: new Date() })
    .where(and(eq(schema.inboundDocuments.id, documentId), eq(schema.inboundDocuments.status, "received")))
    .returning();
  if (claimed.length === 0) return;
  const doc = claimed[0];
  const businessId = doc.businessId;
  const log = (msg: string) => console.log(`🧾 inbound-invoice[${documentId.slice(0, 8)}]: ${msg}`);

  try {
    const { client } = await getUncachableResendClient();

    // 1. Full email (headers for SPF/DKIM, body for "download link" detection).
    const emailResp = await client.emails.receiving.get(doc.resendEmailId);
    if (emailResp.error || !emailResp.data) {
      throw new Error(`Resend receiving.get failed: ${emailResp.error?.message || "no data"}`);
    }
    const email = emailResp.data;
    const { spf, dkim } = parseAuthResults(email.headers);
    await ownerDb.update(schema.inboundDocuments).set({ spfPass: spf, dkimPass: dkim, updatedAt: new Date() }).where(eq(schema.inboundDocuments.id, documentId));
    if (spf === false || dkim === false) {
      log(`auth failed (spf=${spf} dkim=${dkim}) → quarantined`);
      await setDocStatus(documentId, "quarantined", "auth_failed");
      return;
    }

    // 2. Attachment metadata + signed download URLs.
    const attResp = await client.emails.receiving.attachments.list({ emailId: doc.resendEmailId });
    if (attResp.error) throw new Error(`Resend attachments.list failed: ${attResp.error.message}`);
    const all = attResp.data?.data || [];
    const usable = all.filter((a) => {
      const mime = (a.content_type || "").toLowerCase().split(";")[0].trim();
      if (DOCUMENT_MIMES.has(mime) || STRUCTURED_MIMES.has(mime)) return true;
      if (IMAGE_MIMES.has(mime)) return (a.size || 0) >= MIN_IMAGE_BYTES && a.content_disposition !== "inline";
      return false;
    });

    if (usable.length === 0) {
      // Some merchants email a download link instead of a file — keep it so a
      // manual-fetch path can use it later.
      const body = `${email.text || ""}\n${email.html || ""}`;
      const link = body.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
      await setDocStatus(documentId, "failed", link ? `no_attachment; link: ${link.slice(0, 500)}` : "no_attachment");
      log(`no usable attachment (${all.length} total)`);
      return;
    }

    // 3. Stream each attachment into object storage.
    const photoStorage = new PhotoStorageService();
    const refs: AttachmentRef[] = [];
    const buffers: Array<{ ref: AttachmentRef; buffer: Buffer }> = [];
    for (const a of usable) {
      const mime = (a.content_type || "application/octet-stream").toLowerCase().split(";")[0].trim();
      const filename = a.filename || `attachment-${a.id}`;
      const kind: AttachmentRef["kind"] = DOCUMENT_MIMES.has(mime) ? "pdf" : IMAGE_MIMES.has(mime) ? "image" : "structured";
      if ((a.size || 0) > MAX_ATTACHMENT_BYTES) {
        refs.push({ filename, mimeType: mime, size: a.size || 0, url: null, kind });
        log(`skipping ${filename}: ${a.size} bytes > 10MB cap`);
        continue;
      }
      const resp = await fetch(a.download_url);
      if (!resp.ok) throw new Error(`attachment download ${resp.status} for ${filename}`);
      const ab = await resp.arrayBuffer();
      if (ab.byteLength > MAX_ATTACHMENT_BYTES) {
        refs.push({ filename, mimeType: mime, size: ab.byteLength, url: null, kind });
        continue;
      }
      const buffer = Buffer.from(ab);
      let url: string | null = null;
      try {
        if (kind === "image") {
          url = (await photoStorage.uploadPhoto(buffer, filename, mime)).url;
        } else {
          url = (await photoStorage.uploadDocument(buffer, filename, mime)).url;
        }
      } catch (storeErr) {
        // Storage outage must not lose the read — continue without a stored copy.
        console.error("🧾 inbound-invoice: attachment storage failed (continuing):", storeErr);
      }
      const ref: AttachmentRef = { filename, mimeType: mime, size: buffer.length, url, kind };
      refs.push(ref);
      buffers.push({ ref, buffer });
    }
    await setDocStatus(documentId, "parsing", null, { attachmentRefs: refs });

    // 4. Route by type.
    const parseable = buffers.filter((b) => b.ref.kind !== "structured");
    if (parseable.length === 0) {
      const tooLarge = refs.length > 0 && refs.every((r) => r.url === null && r.size > MAX_ATTACHMENT_BYTES);
      await setDocStatus(documentId, "failed", tooLarge ? "attachment_too_large" : "structured_format_unsupported");
      return;
    }

    // AI usage gate — per tenant, same meter as the manual extract route.
    const allowed = await usageMeter.guard("ai", businessId, "supplier_invoice_inbound");
    if (!allowed) {
      await setDocStatus(documentId, "failed", "ai_limit_reached");
      return;
    }

    const connection = doc.supplierConnectionId
      ? (await ownerDb.select().from(schema.supplierConnections).where(eq(schema.supplierConnections.id, doc.supplierConnectionId)).limit(1))[0]
      : undefined;

    const outcomes: string[] = [];
    let created = 0;
    for (const { ref, buffer } of parseable) {
      const { extracted, raw, provider } = await extractInvoiceFields(buffer, ref.mimeType, connection?.extractionHint || null);
      await usageMeter.recordUsage("ai", businessId, { feature: "supplier_invoice_inbound", ref: provider });
      const outcome = await persistExtractedInvoice({ businessId, doc, connection, ref, extracted, raw });
      outcomes.push(outcome);
      if (outcome === "needs_review" || outcome === "quarantined") created++;
    }

    const dup = outcomes.find((o) => o.startsWith("duplicate:"));
    const quarantined = outcomes.includes("quarantined");
    if (created === 0 && dup) {
      await setDocStatus(documentId, "failed", dup);
    } else if (created > 0 && quarantined && !outcomes.includes("needs_review")) {
      // Every extracted document was a statement / credit note.
      await setDocStatus(documentId, "quarantined", "document_type");
    } else {
      await setDocStatus(documentId, "parsed", null);
    }
    log(`done → ${outcomes.join(", ")}`);

    if (outcomes.includes("needs_review")) {
      try {
        await runWithBusiness(businessId, async () => {
          await storage.createNotification({
            title: `Supplier invoice received${connection ? ` — ${connection.supplierName}` : ""}`,
            message: `A new supplier invoice is waiting to be assigned to a job.`,
            type: "supplier_invoice",
            priority: "medium",
            isRead: false,
            actionUrl: `/supplier-invoices`,
            metadata: { inboundDocumentId: documentId },
          } as schema.InsertNotification);
        });
      } catch (notifErr) {
        console.error("🧾 inbound-invoice: notification failed:", notifErr);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`🧾 inbound-invoice[${documentId.slice(0, 8)}] failed:`, message);
    await setDocStatus(documentId, "failed", `error: ${message.slice(0, 500)}`).catch(() => {});
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Model extraction
// ────────────────────────────────────────────────────────────────────────────

export interface ExtractedLine {
  description: string;
  sku: string | null;
  quantity: number;
  unit: string | null;
  unitCostExGst: number;
  lineTotalExGst: number;
}
export interface ExtractedInvoice {
  documentType: "invoice" | "credit_note" | "statement" | "unknown";
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  customerAccountRef: string | null;
  poOrJobReference: string | null;
  branch: string | null;
  subtotalExGst: number | null;
  gstAmount: number | null;
  totalIncGst: number | null;
  costCategory: "materials" | "subcontractor" | "equipment" | "disposal" | "other" | null;
  lineItems: ExtractedLine[];
}

const EXTRACTION_SYSTEM = `You are extracting data from a New Zealand trade supplier invoice (a bill a tradesperson received from a merchant, subcontractor or hire company). Return only JSON matching the schema. Use null for any field not present on the document. Never infer or calculate a value that is not printed on the page — if the document shows no GST amount, return null, do not compute it. Amounts are NZD numbers (not strings). Dates are YYYY-MM-DD. documentType is "statement" for a monthly/account statement listing several invoices, "credit_note" for a credit/refund, "invoice" for a single tax invoice, otherwise "unknown". costCategory classifies the overall spend: materials, subcontractor, equipment (hire/plant), disposal, or other.`;

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: { type: "string", enum: ["invoice", "credit_note", "statement", "unknown"] },
    supplierName: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    invoiceDate: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"] },
    customerAccountRef: { type: ["string", "null"] },
    poOrJobReference: { type: ["string", "null"] },
    branch: { type: ["string", "null"] },
    subtotalExGst: { type: ["number", "null"] },
    gstAmount: { type: ["number", "null"] },
    totalIncGst: { type: ["number", "null"] },
    costCategory: { type: ["string", "null"], enum: ["materials", "subcontractor", "equipment", "disposal", "other", null] },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          sku: { type: ["string", "null"] },
          quantity: { type: "number" },
          unit: { type: ["string", "null"] },
          unitCostExGst: { type: "number" },
          lineTotalExGst: { type: "number" },
        },
        required: ["description", "sku", "quantity", "unit", "unitCostExGst", "lineTotalExGst"],
      },
    },
  },
  required: [
    "documentType", "supplierName", "invoiceNumber", "invoiceDate", "dueDate", "customerAccountRef",
    "poOrJobReference", "branch", "subtotalExGst", "gstAmount", "totalIncGst", "costCategory", "lineItems",
  ],
} as const;

const EXTRACTION_USER_TEXT = `Extract this supplier document into the JSON schema. Keep line items in the order they appear on the page, one entry per priced line (skip headings, subtotals, freight-free notes and page totals). Quantities and unit costs exactly as printed — unit cost may carry more than two decimal places.`;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function normaliseExtraction(rawObj: unknown): ExtractedInvoice {
  const o = (rawObj && typeof rawObj === "object" ? rawObj : {}) as Record<string, unknown>;
  const dt = String(o.documentType || "unknown").toLowerCase();
  const documentType = (["invoice", "credit_note", "statement", "unknown"].includes(dt) ? dt : "unknown") as ExtractedInvoice["documentType"];
  const cc = o.costCategory ? String(o.costCategory).toLowerCase() : null;
  const costCategory = (cc && ["materials", "subcontractor", "equipment", "disposal", "other"].includes(cc) ? cc : null) as ExtractedInvoice["costCategory"];
  const linesIn = Array.isArray(o.lineItems) ? o.lineItems : [];
  const lineItems: ExtractedLine[] = linesIn.map((l: unknown) => {
    const li = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    const quantity = num(li.quantity) ?? 1;
    const lineTotal = num(li.lineTotalExGst) ?? num(li.totalCost) ?? 0;
    const unitCost = num(li.unitCostExGst) ?? num(li.unitCost) ?? (quantity ? lineTotal / quantity : lineTotal);
    return {
      description: String(li.description || "").trim(),
      sku: str(li.sku),
      quantity,
      unit: str(li.unit),
      unitCostExGst: unitCost,
      lineTotalExGst: lineTotal,
    };
  });
  return {
    documentType,
    supplierName: str(o.supplierName),
    invoiceNumber: str(o.invoiceNumber),
    invoiceDate: str(o.invoiceDate),
    dueDate: str(o.dueDate),
    customerAccountRef: str(o.customerAccountRef),
    poOrJobReference: str(o.poOrJobReference),
    branch: str(o.branch),
    subtotalExGst: num(o.subtotalExGst) ?? num(o.subtotal),
    gstAmount: num(o.gstAmount) ?? num(o.gst),
    totalIncGst: num(o.totalIncGst) ?? num(o.total),
    costCategory,
    lineItems,
  };
}

function parseJsonLoose(text: string): unknown {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fall through */ } }
  const start = text.indexOf("{"); const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ } }
  return {};
}

/**
 * Anthropic Messages API (raw HTTP — the SDK isn't a dependency of this repo
 * yet; swap to @anthropic-ai/sdk once it's installed). PDF goes in as a base64
 * `document` block, images as `image` blocks, with a JSON-schema structured
 * output. No `temperature`: sampling params are rejected on Opus 5.
 */
async function extractWithAnthropic(buffer: Buffer, mimeType: string, hint: string | null): Promise<{ extracted: ExtractedInvoice; raw: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_EXTRACTION_MODEL || "claude-opus-5";
  const data = buffer.toString("base64");
  const isPdf = mimeType === "application/pdf";
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data } };
  const userText = hint ? `${EXTRACTION_USER_TEXT}\n\nSupplier-specific note: ${hint}` : EXTRACTION_USER_TEXT;

  const call = async (withFormat: boolean) => {
    const body: Record<string, unknown> = {
      model,
      max_tokens: 16000,
      system: EXTRACTION_SYSTEM,
      output_config: withFormat
        ? { effort: "medium", format: { type: "json_schema", schema: EXTRACTION_SCHEMA } }
        : { effort: "medium" },
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: userText }] }],
    };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 180_000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      return { status: resp.status, json };
    } finally {
      clearTimeout(timer);
    }
  };

  let { status, json } = await call(true);
  if (status === 400 && /output_config|format|json_schema/i.test(JSON.stringify(json))) {
    // Structured-output shape rejected (schema constraint) — fall back to plain JSON.
    ({ status, json } = await call(false));
  }
  if (status !== 200) {
    const errMsg = (json as { error?: { message?: string } })?.error?.message || `HTTP ${status}`;
    throw new Error(`Anthropic extraction failed: ${errMsg}`);
  }
  if (json.stop_reason === "refusal") {
    throw new Error("Anthropic extraction refused the document");
  }
  const content = (json.content as Array<{ type: string; text?: string }>) || [];
  const text = content.filter((b) => b.type === "text").map((b) => b.text || "").join("\n");
  return { extracted: normaliseExtraction(parseJsonLoose(text)), raw: text };
}

// Existing-prod fallback: the same GPT-5 vision path the manual "snap a bill"
// route uses, so the pipeline works before ANTHROPIC_API_KEY is set on DO.
async function extractWithOpenAI(buffer: Buffer, mimeType: string, hint: string | null): Promise<{ extracted: ExtractedInvoice; raw: string }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const base64 = buffer.toString("base64");
  const isPdf = mimeType === "application/pdf";
  const instruction = `${EXTRACTION_SYSTEM}\n\nJSON schema:\n${JSON.stringify(EXTRACTION_SCHEMA)}\n\n${EXTRACTION_USER_TEXT}${hint ? `\n\nSupplier-specific note: ${hint}` : ""}`;
  // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
  const resp = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: instruction },
        isPdf
          ? ({ type: "file", file: { filename: "invoice.pdf", file_data: `data:application/pdf;base64,${base64}` } } as unknown as { type: "text"; text: string })
          : ({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } } as unknown as { type: "text"; text: string }),
      ],
    }],
    response_format: { type: "json_object" },
    max_completion_tokens: 6000,
  });
  const raw = resp.choices[0]?.message?.content || "{}";
  return { extracted: normaliseExtraction(parseJsonLoose(raw)), raw };
}

export async function extractInvoiceFields(buffer: Buffer, mimeType: string, hint: string | null): Promise<{ extracted: ExtractedInvoice; raw: string; provider: "anthropic" | "openai" }> {
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await extractWithAnthropic(buffer, mimeType, hint);
    return { ...r, provider: "anthropic" };
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("No extraction provider configured (set ANTHROPIC_API_KEY)");
  console.warn("🧾 inbound-invoice: ANTHROPIC_API_KEY unset — falling back to the GPT-5 extractor");
  const r = await extractWithOpenAI(buffer, mimeType, hint);
  return { ...r, provider: "openai" };
}

// ────────────────────────────────────────────────────────────────────────────
// Validation — in code, never in the model
// ────────────────────────────────────────────────────────────────────────────

export interface ValidationResult { arithmeticValid: boolean; confidence: number; issues: string[]; }

const GST_RATE = 0.15;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function validateExtraction(e: ExtractedInvoice, now: Date = new Date()): ValidationResult {
  const issues: string[] = [];
  let checks = 0, passed = 0;
  const check = (ok: boolean, issue: string) => { checks++; if (ok) passed++; else issues.push(issue); };

  const linesSum = e.lineItems.reduce((s, l) => s + (l.lineTotalExGst || 0), 0);
  if (e.subtotalExGst === null) {
    check(false, "Subtotal (ex GST) not found on the document");
  } else {
    check(Math.abs(linesSum - e.subtotalExGst) <= 0.02, `Line items sum to $${round2(linesSum).toFixed(2)} but subtotal reads $${e.subtotalExGst.toFixed(2)}`);
  }

  const badLines = e.lineItems
    .map((l, i) => ({ i, diff: Math.abs((l.quantity || 0) * (l.unitCostExGst || 0) - (l.lineTotalExGst || 0)) }))
    .filter((x) => x.diff > 0.02);
  check(badLines.length === 0, `${badLines.length} line${badLines.length === 1 ? "" : "s"} where quantity × unit cost ≠ line total (lines ${badLines.slice(0, 5).map((x) => x.i + 1).join(", ")})`);

  if (e.subtotalExGst === null || e.gstAmount === null) {
    check(false, "GST amount not found on the document");
  } else {
    check(Math.abs(e.gstAmount - e.subtotalExGst * GST_RATE) <= 0.05, `GST $${e.gstAmount.toFixed(2)} is not 15% of subtotal $${e.subtotalExGst.toFixed(2)}`);
  }

  if (e.subtotalExGst === null || e.gstAmount === null || e.totalIncGst === null) {
    check(false, "Total (inc GST) not found on the document");
  } else {
    check(Math.abs(e.subtotalExGst + e.gstAmount - e.totalIncGst) <= 0.02, `Subtotal + GST = $${round2(e.subtotalExGst + e.gstAmount).toFixed(2)} but total reads $${e.totalIncGst.toFixed(2)}`);
  }

  const d = e.invoiceDate ? new Date(`${e.invoiceDate}T12:00:00+12:00`) : null;
  if (!d || isNaN(d.getTime())) {
    check(false, "Invoice date missing or unreadable");
  } else {
    const tooNew = d.getTime() > now.getTime() + 36 * 3600 * 1000; // a day of timezone slack
    const tooOld = d.getTime() < now.getTime() - 3 * 366 * 24 * 3600 * 1000;
    check(!tooNew && !tooOld, tooNew ? `Invoice date ${e.invoiceDate} is in the future` : `Invoice date ${e.invoiceDate} is more than 3 years old`);
  }

  check(!!e.invoiceNumber, "Invoice number not found");

  const arithmeticValid = issues.length === 0;
  const confidence = arithmeticValid ? 1 : Math.round((passed / checks) * 100) / 100;
  return { arithmeticValid, confidence, issues };
}

export function computeDedupeHash(supplierConnectionId: string | null, invoiceNumber: string | null, totalIncGst: number | null): string | null {
  if (!invoiceNumber) return null;
  const norm = invoiceNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!norm) return null;
  const total = totalIncGst === null ? "" : round2(totalIncGst).toFixed(2);
  return createHash("sha256").update(`${supplierConnectionId || "catchall"}|${norm}|${total}`).digest("hex");
}

// ────────────────────────────────────────────────────────────────────────────
// Persist
// ────────────────────────────────────────────────────────────────────────────

type PersistOutcome = "needs_review" | "quarantined" | `duplicate:${string}`;

async function persistExtractedInvoice(args: {
  businessId: string;
  doc: schema.InboundDocument;
  connection: schema.SupplierConnection | undefined;
  ref: AttachmentRef;
  extracted: ExtractedInvoice;
  raw: string;
}): Promise<PersistOutcome> {
  const { businessId, doc, connection, ref, extracted: e, raw } = args;
  const validation = validateExtraction(e);
  const dedupeHash = computeDedupeHash(connection?.id ?? null, e.invoiceNumber, e.totalIncGst);

  // Statements look exactly like invoices and would double-count every cost on
  // them; credit notes must not enter cost data as positive amounts.
  const quarantine = e.documentType === "statement" || e.documentType === "credit_note";
  const issues = quarantine
    ? [e.documentType === "statement" ? "Looks like an account statement, not an invoice — not counted" : "Credit note — not counted as a cost in Phase 1", ...validation.issues]
    : validation.issues;

  if (dedupeHash && !quarantine) {
    const [dupe] = await ownerDb
      .select({ id: schema.supplierInvoices.id, invoiceNumber: schema.supplierInvoices.invoiceNumber })
      .from(schema.supplierInvoices)
      .where(and(
        eq(schema.supplierInvoices.businessId, businessId),
        eq(schema.supplierInvoices.dedupeHash, dedupeHash),
        ne(schema.supplierInvoices.status, "rejected"),
      ))
      .limit(1);
    if (dupe) return `duplicate:${dupe.id}`;
  }

  const supplierName = connection?.supplierName || e.supplierName || "Unknown supplier";
  const toDate = (s: string | null) => { if (!s) return null; const d = new Date(`${s}T12:00:00+12:00`); return isNaN(d.getTime()) ? null : d; };
  const lineItemsMirror = e.lineItems.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitCost: l.unitCostExGst,
    totalCost: l.lineTotalExGst,
    rebill: false,
  }));

  try {
    const [inv] = await ownerDb
      .insert(schema.supplierInvoices)
      .values({
        businessId,
        jobId: null,
        supplierName,
        invoiceNumber: e.invoiceNumber,
        invoiceDate: toDate(e.invoiceDate),
        dueDate: toDate(e.dueDate),
        subtotal: e.subtotalExGst === null ? null : e.subtotalExGst.toFixed(2),
        gst: e.gstAmount === null ? null : e.gstAmount.toFixed(2),
        total: (e.totalIncGst ?? 0).toFixed(2),
        currency: "NZD",
        costCategory: e.costCategory || "materials",
        documentUrl: ref.url,
        thumbnailUrl: null,
        originalFilename: ref.filename,
        mimeType: ref.mimeType,
        fileSize: ref.size,
        lineItems: lineItemsMirror,
        status: quarantine ? "quarantined" : "needs_review",
        rawExtraction: { provider: "inbound", raw },
        source: "inbound",
        inboundDocumentId: doc.id,
        supplierConnectionId: connection?.id ?? null,
        documentType: e.documentType,
        customerAccountRef: e.customerAccountRef,
        poOrJobReference: e.poOrJobReference,
        branch: e.branch,
        arithmeticValid: validation.arithmeticValid,
        confidence: validation.confidence.toFixed(2),
        validationIssues: issues,
        dedupeHash: quarantine ? null : dedupeHash,
      })
      .returning({ id: schema.supplierInvoices.id });

    if (e.lineItems.length > 0) {
      await ownerDb.insert(schema.supplierInvoiceLines).values(
        e.lineItems.map((l, i) => ({
          businessId,
          supplierInvoiceId: inv.id,
          lineNumber: i + 1,
          description: l.description,
          sku: l.sku,
          quantity: String(l.quantity),
          unit: l.unit,
          unitCostExGst: l.unitCostExGst.toFixed(4),
          lineTotalExGst: l.lineTotalExGst.toFixed(2),
          gstRate: "0.150",
        })),
      );
    }
    return quarantine ? "quarantined" : "needs_review";
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "23505" && dedupeHash) {
      // Lost a race with a concurrent identical bill — surface as duplicate.
      const [dupe] = await ownerDb
        .select({ id: schema.supplierInvoices.id })
        .from(schema.supplierInvoices)
        .where(and(eq(schema.supplierInvoices.businessId, businessId), eq(schema.supplierInvoices.dedupeHash, dedupeHash)))
        .limit(1);
      return `duplicate:${dupe?.id || "unknown"}`;
    }
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Triage queue API helpers (session-authed routes pass businessId explicitly)
// ────────────────────────────────────────────────────────────────────────────

export async function listTriageInvoices(businessId: string, opts: { status?: string; cursor?: string; limit?: number }) {
  const limit = Math.min(Math.max(opts.limit || 50, 1), 200);
  const statuses = (opts.status || "needs_review").split(",").map((s) => s.trim()).filter(Boolean);
  const conds = [eq(schema.supplierInvoices.businessId, businessId), eq(schema.supplierInvoices.source, "inbound")];
  if (statuses.length) conds.push(inArray(schema.supplierInvoices.status, statuses));
  if (opts.cursor) {
    const c = new Date(opts.cursor);
    if (!isNaN(c.getTime())) conds.push(lt(schema.supplierInvoices.createdAt, c));
  }
  const rows = await ownerDb
    .select({
      id: schema.supplierInvoices.id,
      supplierName: schema.supplierInvoices.supplierName,
      invoiceNumber: schema.supplierInvoices.invoiceNumber,
      invoiceDate: schema.supplierInvoices.invoiceDate,
      dueDate: schema.supplierInvoices.dueDate,
      subtotal: schema.supplierInvoices.subtotal,
      gst: schema.supplierInvoices.gst,
      total: schema.supplierInvoices.total,
      status: schema.supplierInvoices.status,
      documentType: schema.supplierInvoices.documentType,
      arithmeticValid: schema.supplierInvoices.arithmeticValid,
      confidence: schema.supplierInvoices.confidence,
      validationIssues: schema.supplierInvoices.validationIssues,
      costCategory: schema.supplierInvoices.costCategory,
      poOrJobReference: schema.supplierInvoices.poOrJobReference,
      jobId: schema.supplierInvoices.jobId,
      assignedAt: schema.supplierInvoices.assignedAt,
      documentUrl: schema.supplierInvoices.documentUrl,
      mimeType: schema.supplierInvoices.mimeType,
      createdAt: schema.supplierInvoices.createdAt,
      supplierConnectionId: schema.supplierInvoices.supplierConnectionId,
    })
    .from(schema.supplierInvoices)
    .where(and(...conds))
    .orderBy(desc(schema.supplierInvoices.createdAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].createdAt?.toISOString() ?? null : null;
  return { rows: page, nextCursor };
}

export async function getInvoiceDetail(businessId: string, id: string) {
  const [inv] = await ownerDb
    .select()
    .from(schema.supplierInvoices)
    .where(and(eq(schema.supplierInvoices.id, id), eq(schema.supplierInvoices.businessId, businessId)))
    .limit(1);
  if (!inv) return null;
  const lines = await ownerDb
    .select()
    .from(schema.supplierInvoiceLines)
    .where(eq(schema.supplierInvoiceLines.supplierInvoiceId, id))
    .orderBy(schema.supplierInvoiceLines.lineNumber);
  const inbound = inv.inboundDocumentId
    ? (await ownerDb.select().from(schema.inboundDocuments).where(eq(schema.inboundDocuments.id, inv.inboundDocumentId)).limit(1))[0] ?? null
    : null;
  let job: { id: string; jobNumber: string | null; title: string | null } | null = null;
  if (inv.jobId) {
    const [j] = await ownerDb.select({ id: schema.jobs.id, jobNumber: schema.jobs.jobNumber, title: schema.jobs.title }).from(schema.jobs).where(eq(schema.jobs.id, inv.jobId)).limit(1);
    job = j ?? null;
  }
  return { invoice: inv, lines, inbound, job };
}

export async function listInboundDocuments(businessId: string, opts: { status?: string; limit?: number }) {
  const statuses = (opts.status || "failed,quarantined").split(",").map((s) => s.trim()).filter(Boolean);
  const rows = await ownerDb
    .select({
      doc: schema.inboundDocuments,
      supplierName: schema.supplierConnections.supplierName,
      connectionStatus: schema.supplierConnections.status,
      pendingSenderDomain: schema.supplierConnections.pendingSenderDomain,
    })
    .from(schema.inboundDocuments)
    .leftJoin(schema.supplierConnections, eq(schema.inboundDocuments.supplierConnectionId, schema.supplierConnections.id))
    .where(and(eq(schema.inboundDocuments.businessId, businessId), inArray(schema.inboundDocuments.status, statuses)))
    .orderBy(desc(schema.inboundDocuments.createdAt))
    .limit(Math.min(opts.limit || 100, 500));
  return rows.map((r) => ({ ...r.doc, supplierName: r.supplierName, connectionStatus: r.connectionStatus, pendingSenderDomain: r.pendingSenderDomain }));
}

/**
 * Assignment is a transaction: header status + every line allocated at full
 * value to the job, so Phase 2 splitting edits allocations instead of
 * backfilling them.
 */
export async function assignInvoiceToJob(args: { businessId: string; invoiceId: string; jobId: string; userId: string | null }) {
  const { businessId, invoiceId, jobId, userId } = args;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inv = await client.query(
      `SELECT id, status, source FROM supplier_invoices WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [invoiceId, businessId],
    );
    if (inv.rowCount === 0) { await client.query("ROLLBACK"); return { error: "not_found" as const }; }
    const status = inv.rows[0].status as string;
    if (!["needs_review", "assigned", "pending_review", "confirmed"].includes(status)) {
      await client.query("ROLLBACK"); return { error: "bad_status" as const, status };
    }
    const job = await client.query(`SELECT id FROM jobs WHERE id = $1 AND business_id = $2`, [jobId, businessId]);
    if (job.rowCount === 0) { await client.query("ROLLBACK"); return { error: "job_not_found" as const }; }

    const newStatus = inv.rows[0].source === "inbound" ? "assigned" : "confirmed";
    await client.query(
      `UPDATE supplier_invoices
         SET job_id = $1, status = $2, assigned_by_user_id = $3, assigned_at = now(), updated_at = now()
       WHERE id = $4`,
      [jobId, newStatus, userId, invoiceId],
    );
    await client.query(
      `DELETE FROM invoice_job_allocations
        WHERE supplier_invoice_line_id IN (SELECT id FROM supplier_invoice_lines WHERE supplier_invoice_id = $1)`,
      [invoiceId],
    );
    await client.query(
      `INSERT INTO invoice_job_allocations (business_id, supplier_invoice_line_id, job_id, allocated_amount_ex_gst)
       SELECT business_id, id, $2, line_total_ex_gst FROM supplier_invoice_lines WHERE supplier_invoice_id = $1`,
      [invoiceId, jobId],
    );
    await client.query("COMMIT");
    return { ok: true as const, status: newStatus };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectInvoice(businessId: string, invoiceId: string, reason: string | null) {
  const [row] = await ownerDb
    .update(schema.supplierInvoices)
    .set({ status: "rejected", jobId: null, notes: reason ? `Rejected: ${reason}` : "Rejected", updatedAt: new Date() })
    .where(and(eq(schema.supplierInvoices.id, invoiceId), eq(schema.supplierInvoices.businessId, businessId)))
    .returning({ id: schema.supplierInvoices.id });
  if (row) {
    // Drop any allocations so nothing lingers against a job.
    await ownerDb.execute(sql`DELETE FROM invoice_job_allocations WHERE supplier_invoice_line_id IN (SELECT id FROM supplier_invoice_lines WHERE supplier_invoice_id = ${invoiceId})`);
  }
  return row ?? null;
}

export interface InvoiceCorrections {
  supplierName?: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  customerAccountRef?: string | null;
  poOrJobReference?: string | null;
  branch?: string | null;
  costCategory?: string;
  documentType?: string;
  subtotalExGst?: number | null;
  gstAmount?: number | null;
  totalIncGst?: number | null;
  lines?: Array<{ description: string; sku?: string | null; quantity: number; unit?: string | null; unitCostExGst: number; lineTotalExGst: number }>;
}

/**
 * Inline corrections from the review pane. Replaces the lines when provided,
 * then re-runs the arithmetic validation + dedupe hash so the row's
 * confidence reflects what the human actually saved. Does not change status
 * (assignment is a separate, explicit action).
 */
export async function applyInvoiceCorrections(businessId: string, invoiceId: string, patch: InvoiceCorrections) {
  const detail = await getInvoiceDetail(businessId, invoiceId);
  if (!detail) return null;
  const inv = detail.invoice;
  const toDate = (s: string | null | undefined) => { if (!s) return null; const d = new Date(`${s}T12:00:00+12:00`); return isNaN(d.getTime()) ? null : d; };
  const dateStr = (d: Date | null) => d ? new Date(d.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10) : null;

  const lines: ExtractedLine[] = patch.lines
    ? patch.lines.map((l) => ({
        description: String(l.description || "").trim(),
        sku: l.sku ?? null,
        quantity: Number(l.quantity) || 0,
        unit: l.unit ?? null,
        unitCostExGst: Number(l.unitCostExGst) || 0,
        lineTotalExGst: Number(l.lineTotalExGst) || 0,
      }))
    : detail.lines.map((l) => ({
        description: l.description,
        sku: l.sku,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitCostExGst: Number(l.unitCostExGst),
        lineTotalExGst: Number(l.lineTotalExGst),
      }));

  const merged: ExtractedInvoice = {
    documentType: (patch.documentType as ExtractedInvoice["documentType"]) || (inv.documentType as ExtractedInvoice["documentType"]) || "invoice",
    supplierName: patch.supplierName ?? inv.supplierName,
    invoiceNumber: patch.invoiceNumber !== undefined ? patch.invoiceNumber : inv.invoiceNumber,
    invoiceDate: patch.invoiceDate !== undefined ? patch.invoiceDate : dateStr(inv.invoiceDate),
    dueDate: patch.dueDate !== undefined ? patch.dueDate : dateStr(inv.dueDate),
    customerAccountRef: patch.customerAccountRef !== undefined ? patch.customerAccountRef : inv.customerAccountRef,
    poOrJobReference: patch.poOrJobReference !== undefined ? patch.poOrJobReference : inv.poOrJobReference,
    branch: patch.branch !== undefined ? patch.branch : inv.branch,
    subtotalExGst: patch.subtotalExGst !== undefined ? patch.subtotalExGst : (inv.subtotal === null ? null : Number(inv.subtotal)),
    gstAmount: patch.gstAmount !== undefined ? patch.gstAmount : (inv.gst === null ? null : Number(inv.gst)),
    totalIncGst: patch.totalIncGst !== undefined ? patch.totalIncGst : Number(inv.total),
    costCategory: (patch.costCategory as ExtractedInvoice["costCategory"]) || (inv.costCategory as ExtractedInvoice["costCategory"]),
    lineItems: lines,
  };
  const validation = validateExtraction(merged);
  const dedupeHash = computeDedupeHash(inv.supplierConnectionId, merged.invoiceNumber, merged.totalIncGst);

  // Dedupe collision on the corrected number/total → refuse rather than 500.
  if (dedupeHash && inv.status !== "rejected") {
    const [dupe] = await ownerDb
      .select({ id: schema.supplierInvoices.id })
      .from(schema.supplierInvoices)
      .where(and(
        eq(schema.supplierInvoices.businessId, businessId),
        eq(schema.supplierInvoices.dedupeHash, dedupeHash),
        ne(schema.supplierInvoices.status, "rejected"),
        ne(schema.supplierInvoices.id, invoiceId),
      ))
      .limit(1);
    if (dupe) return { error: "duplicate" as const, duplicateId: dupe.id };
  }

  await ownerDb
    .update(schema.supplierInvoices)
    .set({
      supplierName: merged.supplierName || inv.supplierName,
      invoiceNumber: merged.invoiceNumber,
      invoiceDate: toDate(merged.invoiceDate),
      dueDate: toDate(merged.dueDate),
      customerAccountRef: merged.customerAccountRef,
      poOrJobReference: merged.poOrJobReference,
      branch: merged.branch,
      costCategory: merged.costCategory || inv.costCategory,
      documentType: merged.documentType,
      subtotal: merged.subtotalExGst === null ? null : merged.subtotalExGst.toFixed(2),
      gst: merged.gstAmount === null ? null : merged.gstAmount.toFixed(2),
      total: (merged.totalIncGst ?? 0).toFixed(2),
      lineItems: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitCost: l.unitCostExGst, totalCost: l.lineTotalExGst, rebill: false })),
      arithmeticValid: validation.arithmeticValid,
      confidence: validation.confidence.toFixed(2),
      validationIssues: validation.issues,
      dedupeHash: inv.status === "quarantined" ? null : dedupeHash,
      updatedAt: new Date(),
    })
    .where(eq(schema.supplierInvoices.id, invoiceId));

  if (patch.lines) {
    await ownerDb.delete(schema.supplierInvoiceLines).where(eq(schema.supplierInvoiceLines.supplierInvoiceId, invoiceId));
    if (lines.length > 0) {
      await ownerDb.insert(schema.supplierInvoiceLines).values(lines.map((l, i) => ({
        businessId,
        supplierInvoiceId: invoiceId,
        lineNumber: i + 1,
        description: l.description,
        sku: l.sku,
        quantity: String(l.quantity),
        unit: l.unit,
        unitCostExGst: l.unitCostExGst.toFixed(4),
        lineTotalExGst: l.lineTotalExGst.toFixed(2),
        gstRate: "0.150",
      })));
      // Keep allocations in step if the invoice is already on a job.
      if (inv.jobId && inv.status === "assigned") {
        await assignInvoiceToJob({ businessId, invoiceId, jobId: inv.jobId, userId: inv.assignedByUserId });
      }
    }
  }
  return { ok: true as const, validation };
}

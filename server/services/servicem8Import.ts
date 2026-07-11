// ============================================================================
// ServiceM8 → Inflow migration (per-tenant, API-key based).
//
// One-shot importer a subscriber runs from Settings → Import & Migration:
// pulls their ServiceM8 clients (+ contacts) and jobs through the ServiceM8
// REST API and creates them in THEIR tenant. Dedup is idempotent — re-running
// skips anything already imported (customers via customers.servicem8_uuid,
// jobs via jobs.external_id) — so a partial import can simply be re-run.
//
// Called from session routes only: storage reads/writes are ALS/RLS-scoped to
// the caller's tenant, and creates stamp business_id via withTenant. Replaces
// the dead single-tenant `/api/servicem8/*` routes (servicem8Service was
// referenced but never defined — every call 500'd).
//
// Auth: ServiceM8 private-application API keys. Depending on account vintage
// the key is accepted as an `X-Api-Key` header or as HTTP Basic (key as
// username, "x" as password) — probe both once, then stick with what worked.
// ============================================================================
import { storage } from "../storage";
import { db } from "../db";
import * as schema from "@shared/schema";
import { isNotNull } from "drizzle-orm";

const BASE = "https://api.servicem8.com/api_1.0";
const PAGE_SIZE = 500;
const MAX_RECORDS = 20000; // hard safety cap per object type
const MAX_ERRORS = 25; // stop collecting error detail past this

type AuthMethod = "header" | "basic";

interface SM8Company {
  uuid: string;
  name?: string;
  address?: string;
  billing_address?: string;
  active?: number | string;
}

interface SM8Contact {
  uuid: string;
  company_uuid?: string;
  first?: string;
  last?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  is_primary_contact?: number | string;
  active?: number | string;
}

interface SM8Job {
  uuid: string;
  company_uuid?: string;
  status?: string; // Quote | Work Order | Completed | Unsuccessful
  job_address?: string;
  job_description?: string;
  generated_job_id?: string | number;
  date?: string;
  completion_date?: string;
  total_invoice_amount?: string | number;
  active?: number | string;
}

export interface SM8ImportSummary {
  customers: { imported: number; skipped: number };
  jobs: { imported: number; skipped: number; noCustomer: number };
  errors: string[];
}

function authHeaders(apiKey: string, method: AuthMethod): Record<string, string> {
  if (method === "header") return { "X-Api-Key": apiKey, Accept: "application/json" };
  const basic = Buffer.from(`${apiKey}:x`).toString("base64");
  return { Authorization: `Basic ${basic}`, Accept: "application/json" };
}

/** Probe which auth style this account's key accepts. */
export async function testServiceM8Connection(
  apiKey: string,
): Promise<{ ok: boolean; method?: AuthMethod; message: string }> {
  let lastStatus = 0;
  for (const method of ["header", "basic"] as AuthMethod[]) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/company.json?%24top=1`, { headers: authHeaders(apiKey, method) });
    } catch (e) {
      return { ok: false, message: `Could not reach ServiceM8: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (res.ok) return { ok: true, method, message: "Connected to ServiceM8." };
    lastStatus = res.status;
    if (res.status !== 401 && res.status !== 403) {
      return { ok: false, message: `ServiceM8 responded with HTTP ${res.status}.` };
    }
  }
  return {
    ok: false,
    message: `ServiceM8 rejected the API key (HTTP ${lastStatus}). Check the key and that the API is enabled on your ServiceM8 account.`,
  };
}

/** Page through a ServiceM8 object listing ($top/$skip windowing). */
async function fetchAll<T>(apiKey: string, method: AuthMethod, object: string): Promise<T[]> {
  const all: T[] = [];
  for (let skip = 0; skip < MAX_RECORDS; skip += PAGE_SIZE) {
    const url = `${BASE}/${object}.json?%24top=${PAGE_SIZE}&%24skip=${skip}`;
    const res = await fetch(url, { headers: authHeaders(apiKey, method) });
    if (!res.ok) throw new Error(`ServiceM8 ${object} fetch failed (HTTP ${res.status})`);
    const page = (await res.json()) as T[];
    if (!Array.isArray(page)) throw new Error(`ServiceM8 ${object} returned an unexpected payload`);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

const isActive = (r: { active?: number | string }) => String(r.active ?? "1") !== "0";

/** ServiceM8 timestamps are "YYYY-MM-DD HH:MM:SS" (account-local). "0000-00-00 ..." means unset. */
function parseSM8Date(s: string | undefined): Date | null {
  if (!s || s.startsWith("0000")) return null;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

const STATUS_MAP: Record<string, string> = {
  Quote: "quote",
  "Work Order": "work_order",
  Completed: "completed",
  Unsuccessful: "unsuccessful",
};

/**
 * Import the tenant's ServiceM8 clients + jobs. MUST run inside a session
 * request (ALS tenant context set) — all reads/writes scope to the caller.
 */
export async function runServiceM8Import(apiKey: string): Promise<SM8ImportSummary> {
  const probe = await testServiceM8Connection(apiKey);
  if (!probe.ok || !probe.method) throw new Error(probe.message);
  const method = probe.method;

  const [companies, contacts, sm8Jobs] = [
    await fetchAll<SM8Company>(apiKey, method, "company"),
    await fetchAll<SM8Contact>(apiKey, method, "companycontact"),
    await fetchAll<SM8Job>(apiKey, method, "job"),
  ];

  const summary: SM8ImportSummary = {
    customers: { imported: 0, skipped: 0 },
    jobs: { imported: 0, skipped: 0, noCustomer: 0 },
    errors: [],
  };
  const addError = (msg: string) => {
    if (summary.errors.length < MAX_ERRORS) summary.errors.push(msg);
  };

  // Primary contact per company (fall back to any contact).
  const contactByCompany = new Map<string, SM8Contact>();
  for (const c of contacts.filter(isActive)) {
    if (!c.company_uuid) continue;
    const existing = contactByCompany.get(c.company_uuid);
    if (!existing || String(c.is_primary_contact ?? "0") === "1") {
      if (!existing || String(existing.is_primary_contact ?? "0") !== "1") {
        contactByCompany.set(c.company_uuid, c);
      }
    }
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  const existingCustomers = await storage.getAllCustomers();
  const customerIdBySm8 = new Map<string, string>();
  for (const c of existingCustomers) {
    if (c.servicem8Uuid) customerIdBySm8.set(c.servicem8Uuid, c.id);
  }

  for (const company of companies.filter(isActive)) {
    if (customerIdBySm8.has(company.uuid)) {
      summary.customers.skipped++;
      continue;
    }
    const name = (company.name ?? "").trim();
    if (!name) {
      summary.customers.skipped++;
      continue;
    }
    const contact = contactByCompany.get(company.uuid);
    try {
      const created = await storage.createCustomer({
        name,
        email: contact?.email?.trim() || null,
        phone: contact?.phone?.trim() || null,
        mobile: contact?.mobile?.trim() || null,
        address: (company.address || company.billing_address || "").trim() || null,
        servicem8Uuid: company.uuid,
        importSource: "servicem8_import",
      });
      customerIdBySm8.set(company.uuid, created.id);
      summary.customers.imported++;
    } catch (e) {
      addError(`Customer "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const existingExternalIds = new Set(
    (
      await db
        .select({ externalId: schema.jobs.externalId })
        .from(schema.jobs)
        .where(isNotNull(schema.jobs.externalId))
    ).map((r) => r.externalId),
  );

  for (const job of sm8Jobs.filter(isActive)) {
    if (existingExternalIds.has(job.uuid)) {
      summary.jobs.skipped++;
      continue;
    }
    const customerId = job.company_uuid ? customerIdBySm8.get(job.company_uuid) : undefined;
    if (!customerId) summary.jobs.noCustomer++;

    const description = (job.job_description ?? "").trim();
    const sm8Number = job.generated_job_id ? String(job.generated_job_id) : null;
    const status = STATUS_MAP[job.status ?? ""] ?? "quote";
    try {
      const jobNumber = await storage.getNextJobNumber();
      await storage.createJob({
        jobNumber,
        customerId: customerId ?? null,
        title: description ? description.split("\n")[0].slice(0, 120) : sm8Number ? `ServiceM8 job ${sm8Number}` : "Imported job",
        description: sm8Number ? `${description}\n\n[Imported from ServiceM8 — job #${sm8Number}]`.trim() : description || null,
        address: (job.job_address ?? "").trim() || "Address not specified",
        status,
        completedDate: status === "completed" ? parseSM8Date(job.completion_date) : null,
        totalAmount:
          job.total_invoice_amount != null && String(job.total_invoice_amount).trim() !== "" && Number(job.total_invoice_amount) > 0
            ? String(job.total_invoice_amount)
            : null,
        externalId: job.uuid,
        importSource: "servicem8_import",
      });
      summary.jobs.imported++;
    } catch (e) {
      addError(`Job ${sm8Number ?? job.uuid}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return summary;
}

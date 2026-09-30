/**
 * Plan a Treemarkables job the same way the job card does, without writing.
 *
 * The write itself is POST /api/jobs (the handler ServiceJobForm and
 * GlobalJobCard already call). This module only decides whether that call is
 * allowed, and builds the body that call receives.
 *
 * Auth secret: environment variable INFLOW_ASSISTANT_JOB_SECRET.
 * The value is never stored in the repo. If the variable is unset, the
 * action refuses every request.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { bearerToken } from "./opsAccess";

export const TREEMARKABLES_BUSINESS_ID = "a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2";

/** Env var name only. Set the value on the server, not in the repo. */
export const ASSISTANT_JOB_SECRET_ENV = "INFLOW_ASSISTANT_JOB_SECRET";

const GST_NUMERATOR = 15;
const GST_DENOMINATOR = 100;
const MAX_TEXT = 4000;

export interface AssistantCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
}

export interface AssistantJobReadback {
  customer: {
    id: string | null;
    name: string;
    existing: boolean;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  address: string;
  description: string;
  price: string;
  currency: "NZD";
  gstLabel: "exc. GST";
}

export interface ParsedAssistantJob {
  confirm: boolean;
  newCustomer: boolean;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  address: string;
  description: string;
  price: string;
  exGstCents: number;
  gstCents: number;
  incGstCents: number;
}

export type AssistantJobRefusal = {
  type: "refuse";
  status: number;
  body: Record<string, unknown>;
};

export type AssistantJobPlan =
  | AssistantJobRefusal
  | {
      type: "readback";
      body: Record<string, unknown>;
    }
  | {
      type: "create";
      customer:
        | { mode: "existing"; id: string }
        | {
            mode: "new";
            name: string;
            email?: string;
            phone?: string;
            address: string;
          };
      jobBody: Record<string, unknown>;
      readback: AssistantJobReadback;
    };

export function normalizeCustomerName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function phoneDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function assistantJobAuth(
  authorizationHeader: string | undefined,
  secret: string | undefined,
): { ok: true } | { ok: false; status: 401 | 503; message: string } {
  if (typeof secret !== "string" || secret.trim() === "") {
    return {
      ok: false,
      status: 503,
      message: `${ASSISTANT_JOB_SECRET_ENV} is not set`,
    };
  }
  const token = bearerToken(authorizationHeader);
  if (!token || !secretMatches(token, secret)) {
    return { ok: false, status: 401, message: "Authentication required" };
  }
  return { ok: true };
}

function centsToDecimal(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function parseExGstPrice(
  value: unknown,
): { ok: true; exGstCents: number; gstCents: number; incGstCents: number; price: string } | { ok: false; message: string } {
  if (typeof value === "boolean" || value == null) {
    return { ok: false, message: "price is required" };
  }
  const raw = typeof value === "number"
    ? (Number.isFinite(value) ? String(value) : "")
    : typeof value === "string"
      ? value.trim()
      : "";
  if (!raw) return { ok: false, message: "price is required" };
  const cleaned = raw.replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, message: "price must be a NZD amount with at most two decimal places" };
  }
  const [dollars, fraction = ""] = cleaned.split(".");
  const exGstCents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(exGstCents) || exGstCents <= 0 || exGstCents >= 10_000_000_00) {
    return { ok: false, message: "price must be greater than zero" };
  }
  const gstCents = Math.round((exGstCents * GST_NUMERATOR) / GST_DENOMINATOR);
  return {
    ok: true,
    exGstCents,
    gstCents,
    incGstCents: exGstCents + gstCents,
    price: centsToDecimal(exGstCents),
  };
}

function asExactText(value: unknown, field: string): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof value !== "string") {
    return { ok: false, message: `${field} is required` };
  }
  if (value.trim() === "") {
    return { ok: false, message: `${field} is required` };
  }
  if (value.length > MAX_TEXT) {
    return { ok: false, message: `${field} is too long` };
  }
  return { ok: true, value };
}

export function parseAssistantJobBody(body: unknown): { ok: true; value: ParsedAssistantJob } | { ok: false; status: number; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, message: "JSON object is required" };
  }
  const record = body as Record<string, unknown>;
  if ("businessId" in record && record.businessId != null && record.businessId !== TREEMARKABLES_BUSINESS_ID) {
    return { ok: false, status: 403, message: "This action only creates Treemarkables jobs" };
  }

  const address = asExactText(record.address, "address");
  if (!address.ok) return { ok: false, status: 400, message: address.message };
  const description = asExactText(record.description, "description");
  if (!description.ok) return { ok: false, status: 400, message: description.message };
  const price = parseExGstPrice(record.price);
  if (!price.ok) return { ok: false, status: 400, message: price.message };

  const customerId = record.customerId;
  const customerName = record.customerName;
  let id: string | undefined;
  let name: string | undefined;
  if (customerId != null && customerId !== "") {
    if (typeof customerId !== "string" || customerId.trim() === "") {
      return { ok: false, status: 400, message: "customerId must be a string" };
    }
    id = customerId;
  }
  if (customerName != null && customerName !== "") {
    const parsedName = asExactText(customerName, "customerName");
    if (!parsedName.ok) return { ok: false, status: 400, message: parsedName.message };
    name = parsedName.value;
  }
  if (!id && !name) {
    return { ok: false, status: 400, message: "customerName or customerId is required" };
  }

  let email: string | undefined;
  if (record.customerEmail != null && record.customerEmail !== "") {
    if (typeof record.customerEmail !== "string") {
      return { ok: false, status: 400, message: "customerEmail must be a string" };
    }
    email = record.customerEmail;
  }
  let phone: string | undefined;
  if (record.customerPhone != null && record.customerPhone !== "") {
    if (typeof record.customerPhone !== "string") {
      return { ok: false, status: 400, message: "customerPhone must be a string" };
    }
    phone = record.customerPhone;
  }

  const newCustomer = record.newCustomer === true;
  return {
    ok: true,
    value: {
      confirm: record.confirm === true,
      newCustomer,
      customerId: id,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      address: address.value,
      description: description.value,
      price: price.price,
      exGstCents: price.exGstCents,
      gstCents: price.gstCents,
      incGstCents: price.incGstCents,
    },
  };
}

export function customersMatching(
  customers: readonly AssistantCustomer[],
  query: { name?: string; email?: string; phone?: string },
): AssistantCustomer[] {
  const nameKey = query.name ? normalizeCustomerName(query.name) : "";
  const emailKey = query.email?.trim().toLowerCase() ?? "";
  const phoneKey = phoneDigits(query.phone);
  const seen = new Set<string>();
  const matches: AssistantCustomer[] = [];
  for (const customer of customers) {
    if (seen.has(customer.id)) continue;
    const nameHit = nameKey !== "" && normalizeCustomerName(customer.name) === nameKey;
    const emailHit = emailKey !== "" && (customer.email ?? "").trim().toLowerCase() === emailKey;
    const customerPhones = [phoneDigits(customer.phone), phoneDigits(customer.mobile)].filter(Boolean);
    const phoneHit = phoneKey !== "" && customerPhones.includes(phoneKey);
    if (nameHit || emailHit || phoneHit) {
      seen.add(customer.id);
      matches.push(customer);
    }
  }
  return matches;
}

function publicCustomer(customer: AssistantCustomer): Record<string, unknown> {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    mobile: customer.mobile,
    address: customer.address,
  };
}

function readbackFor(input: {
  customer: AssistantJobReadback["customer"];
  address: string;
  description: string;
  price: string;
}): AssistantJobReadback {
  return {
    customer: input.customer,
    address: input.address,
    description: input.description,
    price: input.price,
    currency: "NZD",
    gstLabel: "exc. GST",
  };
}

export function jobBodyForCreate(input: {
  customerId: string;
  address: string;
  description: string;
  exGstCents: number;
  gstCents: number;
  incGstCents: number;
  lineItemId: string;
}): Record<string, unknown> {
  const exGst = centsToDecimal(input.exGstCents);
  const gst = centsToDecimal(input.gstCents);
  const inc = centsToDecimal(input.incGstCents);
  return {
    customerId: input.customerId,
    description: input.description,
    address: input.address,
    status: "quote",
    priority: "medium",
    taxMode: "tax_exclusive",
    taxRate: "15.00",
    lineItems: [
      {
        id: input.lineItemId,
        description: input.description,
        quantity: 1,
        unitPrice: input.exGstCents / 100,
        total: input.exGstCents / 100,
        unitCost: 0,
        totalCost: 0,
        priceExGst: input.exGstCents / 100,
        totalExGst: input.exGstCents / 100,
        taxRate: 15,
        priceIncludesTax: false,
      },
    ],
    subtotal: exGst,
    gstAmount: gst,
    totalIncludingGst: inc,
    totalAmount: inc,
  };
}

function confirmMessage(parsed: ParsedAssistantJob): string {
  if (parsed.confirm) return "Ready to create.";
  return "Nothing was saved. Send the same fields again with confirm set to the boolean true.";
}

export function planAssistantJob(input: {
  parsed: ParsedAssistantJob;
  matches: readonly AssistantCustomer[];
  customerById?: AssistantCustomer;
  lineItemId: string;
}): AssistantJobPlan {
  const { parsed } = input;

  if (parsed.customerId) {
    const customer = input.customerById;
    if (!customer || customer.id !== parsed.customerId) {
      return {
        type: "refuse",
        status: 404,
        body: {
          success: false,
          wrote: false,
          businessId: TREEMARKABLES_BUSINESS_ID,
          message: "No customer with that id in this business. Nothing was saved.",
        },
      };
    }
    return finishPlan(parsed, {
      id: customer.id,
      name: customer.name,
      existing: true,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    }, { mode: "existing", id: customer.id }, input.lineItemId);
  }

  const matches = customersMatching(input.matches, {
    name: parsed.customerName,
    email: parsed.customerEmail,
    phone: parsed.customerPhone,
  });

  if (matches.length > 1 || (parsed.newCustomer && matches.length > 0)) {
    return {
      type: "refuse",
      status: 409,
      body: {
        success: false,
        wrote: false,
        businessId: TREEMARKABLES_BUSINESS_ID,
        message: matches.length > 1
          ? "Several customers match. Nothing was saved. Pass customerId for one of them."
          : "An existing customer matches. Nothing was saved. Pass customerId to use them, or change the name, phone, or email to create someone new.",
        matches: matches.map(publicCustomer),
      },
    };
  }

  if (matches.length === 1) {
    const customer = matches[0];
    const spelled = parsed.customerName ? normalizeCustomerName(parsed.customerName) : "";
    const sameName = spelled !== "" && normalizeCustomerName(customer.name) === spelled;
    if (!sameName) {
      return {
        type: "refuse",
        status: 409,
        body: {
          success: false,
          wrote: false,
          businessId: TREEMARKABLES_BUSINESS_ID,
          message: "That phone or email belongs to a customer with a different name. Nothing was saved. Pass customerId to use them, or drop the phone and email to store this name as a new customer.",
          matches: [publicCustomer(customer)],
        },
      };
    }
    return finishPlan(parsed, {
      id: customer.id,
      name: customer.name,
      existing: true,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    }, { mode: "existing", id: customer.id }, input.lineItemId);
  }

  const name = parsed.customerName ?? "";
  return finishPlan(parsed, {
    id: null,
    name,
    existing: false,
    email: parsed.customerEmail ?? null,
    phone: parsed.customerPhone ?? null,
    address: parsed.address,
  }, {
    mode: "new",
    name,
    email: parsed.customerEmail,
    phone: parsed.customerPhone,
    address: parsed.address,
  }, input.lineItemId);
}

function finishPlan(
  parsed: ParsedAssistantJob,
  customer: AssistantJobReadback["customer"],
  resolved: Extract<AssistantJobPlan, { type: "create" }>["customer"],
  lineItemId: string,
): AssistantJobPlan {
  const readback = readbackFor({
    customer,
    address: parsed.address,
    description: parsed.description,
    price: parsed.price,
  });
  if (!parsed.confirm) {
    return {
      type: "readback",
      body: {
        success: true,
        wrote: false,
        businessId: TREEMARKABLES_BUSINESS_ID,
        message: confirmMessage(parsed),
        readback,
      },
    };
  }
  if (resolved.mode === "new" && resolved.name.trim() === "") {
    return {
      type: "refuse",
      status: 400,
      body: {
        success: false,
        wrote: false,
        businessId: TREEMARKABLES_BUSINESS_ID,
        message: "customerName is required",
      },
    };
  }
  const customerId = resolved.mode === "existing" ? resolved.id : "pending";
  return {
    type: "create",
    customer: resolved,
    readback,
    jobBody: jobBodyForCreate({
      customerId,
      address: parsed.address,
      description: parsed.description,
      exGstCents: parsed.exGstCents,
      gstCents: parsed.gstCents,
      incGstCents: parsed.incGstCents,
      lineItemId,
    }),
  };
}

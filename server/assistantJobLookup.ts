/**
 * Customer lookup for the assistant job action. Every query filters to the
 * Treemarkables business id on the owner connection. The caller never picks
 * the business.
 */
import { and, eq, or, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { ownerDb } from "./db";
import { storage } from "./storage";
import {
  TREEMARKABLES_BUSINESS_ID,
  normalizeCustomerName,
  phoneDigits,
  type AssistantCustomer,
} from "./assistantJobCreate";

const columns = {
  id: schema.customers.id,
  name: schema.customers.name,
  email: schema.customers.email,
  phone: schema.customers.phone,
  mobile: schema.customers.mobile,
  address: schema.customers.address,
};

function rowToCustomer(row: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
}): AssistantCustomer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    address: row.address,
  };
}

export async function getTreemarkablesCustomer(id: string): Promise<AssistantCustomer | undefined> {
  const [row] = await ownerDb
    .select(columns)
    .from(schema.customers)
    .where(and(
      eq(schema.customers.businessId, TREEMARKABLES_BUSINESS_ID),
      eq(schema.customers.id, id),
    ))
    .limit(1);
  return row ? rowToCustomer(row) : undefined;
}

export async function findTreemarkablesCustomerMatches(query: {
  name?: string;
  email?: string;
  phone?: string;
}): Promise<AssistantCustomer[]> {
  const nameKey = query.name ? normalizeCustomerName(query.name) : "";
  const emailKey = query.email?.trim().toLowerCase() ?? "";
  const phoneKey = phoneDigits(query.phone);
  const clauses = [];
  if (nameKey) {
    clauses.push(sql`TRIM(LOWER(REGEXP_REPLACE(${schema.customers.name}, '\\s+', ' ', 'g'))) = ${nameKey}`);
  }
  if (emailKey) {
    clauses.push(sql`LOWER(${schema.customers.email}) = ${emailKey}`);
  }
  if (phoneKey) {
    clauses.push(sql`(
      ${schema.customers.normalizedPhone} = ${phoneKey}
      OR regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g') = ${phoneKey}
      OR regexp_replace(coalesce(${schema.customers.mobile}, ''), '[^0-9]', '', 'g') = ${phoneKey}
    )`);
  }
  if (clauses.length === 0) return [];
  const rows = await ownerDb
    .select(columns)
    .from(schema.customers)
    .where(and(
      eq(schema.customers.businessId, TREEMARKABLES_BUSINESS_ID),
      or(...clauses),
    ));
  return rows.map(rowToCustomer);
}

export async function createTreemarkablesCustomer(input: {
  name: string;
  email?: string;
  phone?: string;
  address: string;
}): Promise<AssistantCustomer> {
  const created = await storage.createCustomer({
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    source: "job_creation",
  });
  return {
    id: created.id,
    name: created.name,
    email: created.email,
    phone: created.phone,
    mobile: created.mobile,
    address: created.address,
  };
}

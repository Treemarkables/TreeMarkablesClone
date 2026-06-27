/**
 * Inflow — tenant onboarding (self-serve signup + concierge).
 *
 * Creates a new tenant: business + settings + admin employee (bcrypt) + a Freemium
 * subscription. Runs as the DB owner (signup has no tenant context yet), so every insert
 * sets `business_id` explicitly — the column default is Treemarkables and would be wrong.
 */
import { db } from "./db";
import { businesses, businessSettings, employees, subscriptions, subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface CreateTenantInput {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  position?: string;
}

export interface CreateTenantResult {
  businessId: string;
  employeeId: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  const email = input.email.toLowerCase().trim();
  const slug = slugify(input.businessName);
  if (!slug) throw new Error("Please enter a valid business name.");

  const [dupEmail] = await db.select({ id: employees.id }).from(employees).where(eq(employees.email, email)).limit(1);
  if (dupEmail) throw new Error("An account with that email already exists.");
  const [dupSlug] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (dupSlug) throw new Error("A business with that name already exists — try a more specific name.");

  const hash = await bcrypt.hash(input.password, 10);

  // neon-http has no transactions, so create the business first then compensate (delete the
  // partial tenant) if any later step fails — keeps signup atomic, no orphaned rows.
  const [biz] = await db.insert(businesses).values({ name: input.businessName, slug }).returning();
  try {
    await db.insert(businessSettings).values({ businessId: biz.id, businessName: input.businessName });
    const [emp] = await db.insert(employees).values({
      businessId: biz.id,
      firstName: input.firstName,
      lastName: input.lastName,
      position: input.position ?? "Owner",
      email,
      password: hash,
      role: "admin",
      status: "active",
      isActive: true,
    }).returning();

    // Start every new tenant on Freemium.
    const [freemium] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.key, "freemium")).limit(1);
    if (freemium) {
      await db.insert(subscriptions).values({ businessId: biz.id, planId: freemium.id, status: "active" });
    }

    return { businessId: biz.id, employeeId: emp.id };
  } catch (err) {
    // Compensating rollback — undo the partial tenant.
    await db.delete(subscriptions).where(eq(subscriptions.businessId, biz.id)).catch(() => {});
    await db.delete(employees).where(eq(employees.businessId, biz.id)).catch(() => {});
    await db.delete(businessSettings).where(eq(businessSettings.businessId, biz.id)).catch(() => {});
    await db.delete(businesses).where(eq(businesses.id, biz.id)).catch(() => {});
    throw err;
  }
}

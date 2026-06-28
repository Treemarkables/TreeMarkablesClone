/**
 * Inflow — tenant onboarding (self-serve signup + concierge).
 *
 * Creates a new tenant: business + settings + admin employee (bcrypt) + a Freemium
 * subscription. Runs as the DB owner (signup has no tenant context yet), so every insert
 * sets `business_id` explicitly — the column default is Treemarkables and would be wrong.
 */
import { db, ownerDb } from "./db";
import { businesses, businessSettings, employees, subscriptions, subscriptionPlans, documentTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// The default document templates every tenant gets (one per document type).
const DEFAULT_DOC_TEMPLATES: Array<{ type: string; name: string }> = [
  { type: "quote", name: "Standard Quote" },
  { type: "proposal", name: "Standard Proposal" },
  { type: "invoice", name: "Tax Invoice" },
];

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

    // Seed the tenant's OWN default PDF/document templates (quote, proposal, invoice).
    // Without these, the session-less document viewers fall back to an arbitrary
    // (Treemarkables) default template — a cross-tenant branding leak. The company
    // identity fields MUST be set explicitly: the column defaults are Treemarkables'
    // (companyName/address/email/phone/GST), so an unset insert would re-introduce
    // the very leak this closes. Address/phone are unknown at signup → blank (the
    // renderers hide empty fields); the owner fills them later in Company Info.
    await db.insert(documentTemplates).values(
      DEFAULT_DOC_TEMPLATES.map((d) => ({
        businessId: biz.id,
        name: d.name,
        type: d.type,
        isDefault: true,
        isActive: true,
        companyName: input.businessName,
        companyEmail: email,
        companyAddress: "",
        companyPhone: "",
        gstNumber: "",
      })),
    );

    return { businessId: biz.id, employeeId: emp.id };
  } catch (err) {
    // Compensating rollback — undo the partial tenant.
    await db.delete(documentTemplates).where(eq(documentTemplates.businessId, biz.id)).catch(() => {});
    await db.delete(subscriptions).where(eq(subscriptions.businessId, biz.id)).catch(() => {});
    await db.delete(employees).where(eq(employees.businessId, biz.id)).catch(() => {});
    await db.delete(businessSettings).where(eq(businessSettings.businessId, biz.id)).catch(() => {});
    await db.delete(businesses).where(eq(businesses.id, biz.id)).catch(() => {});
    throw err;
  }
}

/**
 * One-off, idempotent backfill: seed the default document templates for any existing
 * business that has NONE. Tenants created before per-tenant template seeding (PR #276)
 * — e.g. the demo tenant — otherwise fall back to an arbitrary (Treemarkables) default
 * on their public proposal/quote/invoice views, leaking TM's name/contact/GST.
 *
 * Identity is taken from the business's own settings (blank where unset — never
 * Treemarkables'). Runs on the owner connection at boot; businesses that already have
 * templates are skipped, so it's safe to run on every deploy. Returns the count seeded.
 */
export async function backfillMissingDocumentTemplates(): Promise<number> {
  const allBiz = await ownerDb.select({ id: businesses.id, name: businesses.name }).from(businesses);
  let seeded = 0;
  for (const biz of allBiz) {
    const [hasTpl] = await ownerDb
      .select({ id: documentTemplates.id })
      .from(documentTemplates)
      .where(eq(documentTemplates.businessId, biz.id))
      .limit(1);
    if (hasTpl) continue; // already has templates — skip (incl. Treemarkables)

    const [settings] = await ownerDb
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.businessId, biz.id))
      .limit(1);

    await ownerDb.insert(documentTemplates).values(
      DEFAULT_DOC_TEMPLATES.map((d) => ({
        businessId: biz.id,
        name: d.name,
        type: d.type,
        isDefault: true,
        isActive: true,
        // Explicit identity from the business's own settings; blank (NOT the TM
        // column defaults) where unset, so a leak can never be re-introduced.
        companyName: settings?.businessName || biz.name || "",
        companyEmail: settings?.businessEmail || "",
        companyPhone: settings?.businessPhone || "",
        companyAddress: settings?.businessAddress || "",
        gstNumber: settings?.businessGstNumber || "",
      })),
    );
    seeded++;
    console.log(`[DOC_TEMPLATE_BACKFILL] seeded default templates for business ${biz.id} (${biz.name})`);
  }
  if (seeded > 0) console.log(`[DOC_TEMPLATE_BACKFILL] complete — seeded ${seeded} business(es)`);
  return seeded;
}

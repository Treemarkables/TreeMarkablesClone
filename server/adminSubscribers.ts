/**
 * Platform-admin subscriber directory (owner connection).
 *
 * GET /api/admin/subscribers used to map `listBusinesses()` through
 * `buildOnboardingChecklist`. That helper read tenantChannels/customers via
 * the request-scoped `db` proxy. Under TENANT_RLS_ENABLED the operator is
 * pinned to Treemarkables, so a single checklist throw 500'd the whole list
 * and the UI treated it as "restricted". Successful signups then looked
 * missing even though the `businesses` row existed.
 *
 * This loader reads businesses + admin employees + subscriptions on ownerDb
 * and fail-opens checklist progress so one bad tenant cannot hide the rest.
 */
import { ownerDb } from "./db";
import {
  businesses,
  businessSettings,
  employees,
  subscriptions,
  subscriptionPlans,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  checklistProgressOrEmpty,
  compareSubscribersNewestFirst,
  pickOwnerContact,
  type SubscriberChecklistProgress,
  type SubscriberOwnerContact,
  type SubscriberSummary,
} from "./adminSubscriberDirectory";

export type {
  SubscriberChecklistProgress,
  SubscriberOwnerContact,
  SubscriberSummary,
} from "./adminSubscriberDirectory";
export { pickOwnerContact, compareSubscribersNewestFirst, checklistProgressOrEmpty } from "./adminSubscriberDirectory";

export async function getSubscriberOwnerContact(businessId: string): Promise<SubscriberOwnerContact> {
  const [settings] = await ownerDb
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, businessId))
    .limit(1);
  const admins = await ownerDb
    .select({
      email: employees.email,
      firstName: employees.firstName,
      lastName: employees.lastName,
      createdAt: employees.createdAt,
    })
    .from(employees)
    .where(and(eq(employees.businessId, businessId), eq(employees.role, "admin")));
  return pickOwnerContact({ settings: settings ?? null, admins });
}

export async function listSubscriberSummaries(
  loadChecklist: (businessId: string) => Promise<SubscriberChecklistProgress>,
): Promise<SubscriberSummary[]> {
  const [bizRows, settingsRows, adminRows, subRows, planRows] = await Promise.all([
    ownerDb.select().from(businesses).orderBy(desc(businesses.createdAt)),
    ownerDb.select().from(businessSettings),
    ownerDb
      .select({
        businessId: employees.businessId,
        email: employees.email,
        firstName: employees.firstName,
        lastName: employees.lastName,
        createdAt: employees.createdAt,
      })
      .from(employees)
      .where(eq(employees.role, "admin")),
    ownerDb.select().from(subscriptions),
    ownerDb.select().from(subscriptionPlans),
  ]);

  const settingsByBiz = new Map<string, (typeof settingsRows)[number]>();
  for (const row of settingsRows) {
    if (row.businessId && !settingsByBiz.has(row.businessId)) {
      settingsByBiz.set(row.businessId, row);
    }
  }

  const adminsByBiz = new Map<string, typeof adminRows>();
  for (const row of adminRows) {
    if (!row.businessId) continue;
    const list = adminsByBiz.get(row.businessId) ?? [];
    list.push(row);
    adminsByBiz.set(row.businessId, list);
  }

  const subByBiz = new Map<string, (typeof subRows)[number]>();
  for (const row of subRows) {
    if (row.businessId && !subByBiz.has(row.businessId)) {
      subByBiz.set(row.businessId, row);
    }
  }

  const planById = new Map(planRows.map((p) => [p.id, p]));

  const summaries = await Promise.all(
    bizRows.map(async (b) => {
      const progress = await checklistProgressOrEmpty(() => loadChecklist(b.id));
      const contact = pickOwnerContact({
        settings: settingsByBiz.get(b.id) ?? null,
        admins: adminsByBiz.get(b.id) ?? [],
      });
      const sub = subByBiz.get(b.id);
      const plan = sub?.planId ? planById.get(sub.planId) : undefined;
      return {
        id: b.id,
        name: b.name,
        slug: b.slug ?? null,
        status: b.status,
        comped: !!b.compedAt,
        createdAt: b.createdAt ?? null,
        requiredDone: progress.requiredDone,
        requiredTotal: progress.requiredTotal,
        ownerEmail: contact.ownerEmail,
        ownerName: contact.ownerName,
        planKey: plan?.key ?? null,
        planName: plan?.name ?? null,
        subscriptionStatus: sub?.status ?? null,
      };
    }),
  );

  return summaries.sort(compareSubscribersNewestFirst);
}

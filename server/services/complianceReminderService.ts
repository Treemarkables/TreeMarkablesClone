import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';
import { getNZDateString } from '@shared/dateUtils';
import { notifyEmployee } from './notificationHelper';

// Default lead times (whole days before expiry) if a business hasn't customised them.
const DEFAULT_OFFSETS = [30, 7];

const KIND_LABELS: Record<string, string> = {
  rego: 'Registration (rego)',
  cof: 'Certificate of Fitness',
  service: 'Scheduled service',
};

// Day-granular reminders — running at most hourly is plenty and keeps the cost
// of the full equipment scan trivial. The dedupe table makes re-runs harmless,
// so a missed hour (or a restart) never double-sends or drops a reminder.
let lastScanAt = 0;
const HOUR_MS = 60 * 60 * 1000;

interface Cfg { enabled: boolean; offsets: number[] }

/**
 * Scan every active vehicle/equipment across all businesses and notify that
 * business's admins when a rego / CoF / scheduled-service date crosses one of
 * the configured lead times (and again once it's overdue). Runs from the cron
 * tick in server/index.ts, so there is no request/tenant context — every write
 * carries an explicit businessId.
 */
export async function runComplianceReminderScan(): Promise<void> {
  if (Date.now() - lastScanAt < HOUR_MS) return;
  lastScanAt = Date.now();

  const todayMs = new Date(`${getNZDateString(new Date())}T00:00:00Z`).getTime();
  const MS_PER_DAY = 86400000;
  const daysUntil = (d: Date) =>
    Math.round((new Date(`${getNZDateString(d)}T00:00:00Z`).getTime() - todayMs) / MS_PER_DAY);

  const allEquipment = await db.select().from(schema.equipment);
  const settingsCache = new Map<string, Cfg>();
  const adminsCache = new Map<string, string[]>();

  for (const e of allEquipment) {
    if (e.isActive === false || e.status === 'retired' || !e.businessId) continue;

    const cfg = await getConfig(e.businessId, settingsCache);
    if (!cfg.enabled) continue;

    const checks: Array<{ kind: string; date: Date | string | null }> = [
      { kind: 'rego', date: e.registrationExpiryDate },
      { kind: 'cof', date: e.cofExpiryDate },
      { kind: 'service', date: e.nextMaintenanceDate },
    ];

    for (const c of checks) {
      if (!c.date) continue;
      const d = new Date(c.date);
      if (isNaN(d.getTime())) continue;

      const dleft = daysUntil(d);
      const expiryStr = getNZDateString(d);

      // Configured lead times plus an implicit 0 = "on/after expiry" alert.
      const thresholds = Array.from(new Set([...cfg.offsets, 0]));
      for (const off of thresholds) {
        const crossed = off === 0 ? dleft <= 0 : dleft > 0 && dleft <= off;
        if (!crossed) continue;

        const isNew = await recordReminderOnce(e.businessId, e.id, c.kind, expiryStr, off);
        if (!isNew) continue; // already sent for this exact (vehicle, kind, expiry, lead time)

        await sendReminder(e, c.kind, dleft, off, adminsCache);
      }
    }
  }
}

async function getConfig(businessId: string, cache: Map<string, Cfg>): Promise<Cfg> {
  const hit = cache.get(businessId);
  if (hit) return hit;

  const [row] = await db
    .select()
    .from(schema.businessSettings)
    .where(eq(schema.businessSettings.businessId, businessId))
    .limit(1);

  const offsets = Array.isArray(row?.complianceReminderOffsets) && row!.complianceReminderOffsets.length
    ? (row!.complianceReminderOffsets as number[])
    : DEFAULT_OFFSETS;
  const cfg: Cfg = { enabled: row ? row.complianceRemindersEnabled !== false : true, offsets };
  cache.set(businessId, cfg);
  return cfg;
}

// Returns true if this is the first time we've recorded this exact reminder.
// Relies on the unique (equipment_id, kind, expiry_date, offset_days) index.
async function recordReminderOnce(
  businessId: string,
  equipmentId: string,
  kind: string,
  expiryDate: string,
  offsetDays: number,
): Promise<boolean> {
  const inserted = await db
    .insert(schema.equipmentComplianceReminders)
    .values({ businessId, equipmentId, kind, expiryDate, offsetDays })
    .onConflictDoNothing()
    .returning({ id: schema.equipmentComplianceReminders.id });
  return inserted.length > 0;
}

async function sendReminder(
  equipment: typeof schema.equipment.$inferSelect,
  kind: string,
  dleft: number,
  offsetDays: number,
  adminsCache: Map<string, string[]>,
): Promise<void> {
  const businessId = equipment.businessId as string;
  const label = KIND_LABELS[kind] ?? kind;
  const name = equipment.registrationNumber
    ? `${equipment.name} (${equipment.registrationNumber})`
    : equipment.name;

  const when =
    dleft < 0 ? `expired ${Math.abs(dleft)} day${Math.abs(dleft) === 1 ? '' : 's'} ago`
      : dleft === 0 ? 'expires today'
      : `expires in ${dleft} day${dleft === 1 ? '' : 's'}`;
  const title = dleft <= 0 ? `${label} overdue` : `${label} due soon`;
  const message = `${name}: ${label} ${when}.`;
  const priority = dleft <= 0 ? 'urgent' : offsetDays <= 7 ? 'high' : 'medium';

  // In-app notification — explicit businessId since the cron has no tenant context.
  await db.insert(schema.notifications).values({
    businessId,
    type: 'system_alert',
    priority,
    title,
    message,
    actionUrl: '/today',
    metadata: {
      kind: 'compliance_reminder',
      complianceKind: kind,
      equipmentId: equipment.id,
      daysUntil: dleft,
      offsetDays,
    },
  });

  // Push to this business's admins.
  let admins = adminsCache.get(businessId);
  if (!admins) {
    const emps = await db
      .select()
      .from(schema.employees)
      .where(and(eq(schema.employees.businessId, businessId), eq(schema.employees.role, 'admin')));
    admins = emps.map((emp) => emp.id);
    adminsCache.set(businessId, admins);
  }
  for (const employeeId of admins) {
    await notifyEmployee(employeeId, {
      title,
      body: message,
      clickAction: '/today',
      data: { kind: 'compliance_reminder', equipmentId: equipment.id },
    }).catch(() => undefined);
  }
}

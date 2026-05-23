// ============================================================================
// Permissions catalog — single source of truth for backend + frontend.
//
// Adding a permission:
// 1. Add an entry under the appropriate category in PERMISSIONS below.
// 2. Use it on the backend with `requirePermission('your.key')`.
// 3. Use it on the frontend with `hasPermission('your.key')`.
// 4. (Optional) Add the key to the seed tier presets in `defaultTiers`.
// ============================================================================

export interface PermissionDef {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionCategory {
  id: string;
  label: string;
  description?: string;
  permissions: PermissionDef[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'jobs',
    label: 'Jobs & Dispatch',
    description: 'Quotes, work orders, scheduled jobs and dispatch board',
    permissions: [
      { key: 'jobs.view', label: 'View jobs' },
      { key: 'jobs.create', label: 'Create jobs' },
      { key: 'jobs.edit', label: 'Edit jobs' },
      { key: 'jobs.delete', label: 'Delete jobs' },
      { key: 'jobs.assign', label: 'Assign staff and equipment' },
      { key: 'jobs.schedule', label: 'Schedule and reschedule jobs' },
      { key: 'jobs.complete', label: 'Mark jobs complete' },
      { key: 'dispatch.view', label: 'View dispatch board' },
      { key: 'dispatch.manage', label: 'Manage dispatch board' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers & Leads',
    description: 'Customer database, contacts and pipeline',
    permissions: [
      { key: 'customers.view', label: 'View customers' },
      { key: 'customers.create', label: 'Create customers' },
      { key: 'customers.edit', label: 'Edit customers' },
      { key: 'customers.delete', label: 'Delete customers' },
      { key: 'customers.merge', label: 'Merge / dedupe customers' },
      { key: 'leads.view', label: 'View pipeline and leads' },
      { key: 'leads.manage', label: 'Move leads through pipeline' },
    ],
  },
  {
    id: 'quoting',
    label: 'Quoting & Proposals',
    description: 'Quote builder, proposals and send to customer',
    permissions: [
      { key: 'quotes.view', label: 'View quotes' },
      { key: 'quotes.create', label: 'Create quotes' },
      { key: 'quotes.send', label: 'Send quotes to customers' },
      { key: 'proposals.view', label: 'View proposals' },
      { key: 'proposals.create', label: 'Create proposals' },
      { key: 'proposals.send', label: 'Send proposals to customers' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Invoicing',
    description: 'Invoices, payments, reconciliation and pricing',
    permissions: [
      { key: 'invoices.view', label: 'View invoices' },
      { key: 'invoices.create', label: 'Create invoices' },
      { key: 'invoices.send', label: 'Send invoices to customers' },
      { key: 'invoices.delete', label: 'Delete invoices' },
      { key: 'payments.view', label: 'View payments' },
      { key: 'payments.record', label: 'Record payments' },
      { key: 'reconciliation.view', label: 'View reconciliation' },
      { key: 'reconciliation.manage', label: 'Reconcile with Xero' },
      { key: 'pricing.view', label: 'View cost / charge-out rates' },
      { key: 'pricing.edit', label: 'Edit cost / charge-out rates' },
      { key: 'profitability.view', label: 'View profitability reports' },
    ],
  },
  {
    id: 'staff',
    label: 'Staff & Scheduling',
    description: 'Team members, schedules and time tracking',
    permissions: [
      { key: 'staff.view', label: 'View staff list' },
      { key: 'staff.create', label: 'Add staff members' },
      { key: 'staff.edit', label: 'Edit staff details' },
      { key: 'staff.delete', label: 'Delete staff members' },
      { key: 'staff.set_password', label: 'Set / reset staff passwords' },
      { key: 'staff.manage_permissions', label: 'Manage roles and permissions' },
      { key: 'schedule.view', label: 'View team schedule' },
      { key: 'schedule.manage', label: 'Manage team schedule' },
      { key: 'timetracking.view_own', label: 'View own timesheet' },
      { key: 'timetracking.view_all', label: 'View all timesheets' },
      { key: 'timetracking.edit', label: 'Edit timesheets' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety & Compliance',
    description: 'JHAs, near-miss reporting, inductions, vehicle inspections',
    permissions: [
      { key: 'safety.jha.view', label: 'View JHAs' },
      { key: 'safety.jha.create', label: 'Create JHAs' },
      { key: 'safety.jha.manage_templates', label: 'Manage JHA templates' },
      { key: 'safety.nearmiss.view', label: 'View near-miss reports' },
      { key: 'safety.nearmiss.report', label: 'Submit near-miss reports' },
      { key: 'safety.inductions.view', label: 'View inductions' },
      { key: 'safety.inductions.manage', label: 'Manage inductions' },
      { key: 'safety.inspections.view', label: 'View vehicle / equipment inspections' },
      { key: 'safety.inspections.create', label: 'Complete inspections' },
      { key: 'safety.inspections.manage_templates', label: 'Manage inspection templates' },
    ],
  },
  {
    id: 'communications',
    label: 'Communications',
    description: 'Inbox, SMS, calls, reviews and templates',
    permissions: [
      { key: 'inbox.view', label: 'View inbox' },
      { key: 'inbox.send', label: 'Send messages' },
      { key: 'calls.view', label: 'View call history' },
      { key: 'calls.make', label: 'Make outbound calls' },
      { key: 'sms.send', label: 'Send SMS' },
      { key: 'reviews.view', label: 'View reviews and reputation' },
      { key: 'reviews.respond', label: 'Respond to reviews' },
      { key: 'templates.manage', label: 'Manage email / SMS templates' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Equipment',
    description: 'Materials, services catalog and equipment register',
    permissions: [
      { key: 'materials.view', label: 'View materials and services' },
      { key: 'materials.manage', label: 'Manage materials and services' },
      { key: 'equipment.view', label: 'View equipment' },
      { key: 'equipment.manage', label: 'Manage equipment register' },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting & Analytics',
    description: 'Dashboards, metrics and activity reports',
    permissions: [
      { key: 'reporting.dashboard', label: 'View activity dashboard' },
      { key: 'reporting.metrics', label: 'View metrics dashboard' },
      { key: 'reporting.export', label: 'Export reports' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings & Admin',
    description: 'Company settings, integrations and admin actions',
    permissions: [
      { key: 'settings.view', label: 'Open settings area' },
      { key: 'settings.company', label: 'Edit company info and branding' },
      { key: 'settings.integrations', label: 'Manage integrations (Xero, Google, etc.)' },
      { key: 'settings.security', label: 'Manage API keys and security' },
      { key: 'settings.templates', label: 'Manage document and process templates' },
      { key: 'admin.tools', label: 'Use admin maintenance tools' },
    ],
  },
];

// Flat list of every permission key — used for the "select all" UI and validation
export const ALL_PERMISSIONS: PermissionDef[] = PERMISSION_CATEGORIES.flatMap(
  (cat) => cat.permissions,
);

export const ALL_PERMISSION_KEYS: string[] = ALL_PERMISSIONS.map((p) => p.key);

export function isValidPermissionKey(key: string): boolean {
  return ALL_PERMISSION_KEYS.includes(key);
}

// ============================================================================
// Default tier presets — seeded on first boot if no tiers exist yet.
// ============================================================================

export interface DefaultTierSeed {
  key: string;                // stable identifier used to find/upsert
  name: string;
  description: string;
  permissions: string[];      // '*' = all permissions
  isSystem: boolean;
  isDefault?: boolean;        // assigned to new staff when no tier is selected
}

// Convenience: every key in a category
function cat(id: string): string[] {
  const c = PERMISSION_CATEGORIES.find((x) => x.id === id);
  return c ? c.permissions.map((p) => p.key) : [];
}

export const DEFAULT_TIER_SEEDS: DefaultTierSeed[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access to everything in the app',
    permissions: ['*'],
    isSystem: true,
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Day-to-day management — all jobs, customers, finance and staff scheduling',
    permissions: [
      ...cat('jobs'),
      ...cat('customers'),
      ...cat('quoting'),
      ...cat('finance').filter((k) => k !== 'invoices.delete'),
      'staff.view', 'staff.edit', 'schedule.view', 'schedule.manage',
      'timetracking.view_all', 'timetracking.edit',
      ...cat('safety'),
      ...cat('communications'),
      ...cat('inventory'),
      ...cat('reporting'),
      'settings.view', 'settings.templates',
    ],
    isSystem: true,
  },
  {
    key: 'foreman',
    name: 'Foreman',
    description: 'Crew leader — runs jobs on site, completes JHAs, manages own crew',
    permissions: [
      'jobs.view', 'jobs.edit', 'jobs.assign', 'jobs.complete',
      'dispatch.view',
      'customers.view', 'customers.edit',
      'quotes.view', 'quotes.create',
      'invoices.view',
      'staff.view', 'schedule.view',
      'timetracking.view_own', 'timetracking.view_all', 'timetracking.edit',
      ...cat('safety'),
      'inbox.view', 'inbox.send', 'calls.view', 'calls.make', 'sms.send',
      'materials.view', 'equipment.view',
      'reporting.dashboard',
    ],
    isSystem: true,
  },
  {
    key: 'crew',
    name: 'Crew',
    description: 'On-the-ground worker — sees assigned jobs and completes safety checks',
    permissions: [
      'jobs.view', 'jobs.complete',
      'dispatch.view',
      'customers.view',
      'safety.jha.view', 'safety.jha.create',
      'safety.nearmiss.view', 'safety.nearmiss.report',
      'safety.inductions.view',
      'safety.inspections.view', 'safety.inspections.create',
      'timetracking.view_own',
      'materials.view', 'equipment.view',
    ],
    isSystem: true,
    isDefault: true,
  },
  {
    key: 'readonly',
    name: 'Read-only',
    description: 'View-only access across the app — no edits anywhere',
    permissions: ALL_PERMISSIONS
      .filter((p) =>
        p.key.endsWith('.view') ||
        p.key === 'reporting.dashboard' ||
        p.key === 'reporting.metrics' ||
        p.key === 'dispatch.view' ||
        p.key === 'timetracking.view_own',
      )
      .map((p) => p.key),
    isSystem: true,
  },
];

// ============================================================================
// Permission resolution — used by both backend middleware and frontend gates.
// ============================================================================

export interface PermissionOverrides {
  grant?: string[];
  deny?: string[];
}

export interface ResolveInput {
  legacyRole?: string | null;          // 'admin' | 'crew' — pre-tier fallback
  tierPermissions?: string[] | null;   // resolved tier.permissions
  overrides?: PermissionOverrides | null;
}

/**
 * Compute the effective permission set for an employee.
 *
 * Order of precedence (highest first):
 *   1. Per-staff `deny` overrides    — always remove the key
 *   2. Per-staff `grant` overrides   — add the key
 *   3. Tier permissions              — base set, '*' = everything
 *   4. Legacy `role` field           — admin = '*', crew = nothing
 *      (used only when no tier is assigned, for backwards compatibility)
 */
export function resolvePermissions(input: ResolveInput): Set<string> {
  const granted = new Set<string>();

  const tierPerms = input.tierPermissions ?? null;
  const hasTier = tierPerms !== null && tierPerms !== undefined;

  if (hasTier) {
    if (tierPerms!.includes('*')) {
      ALL_PERMISSION_KEYS.forEach((k) => granted.add(k));
    } else {
      tierPerms!.forEach((k) => granted.add(k));
    }
  } else if (input.legacyRole === 'admin') {
    ALL_PERMISSION_KEYS.forEach((k) => granted.add(k));
  }
  // legacy 'crew' with no tier => empty set (will fall back to default tier on the server)

  const overrides = input.overrides ?? {};
  (overrides.grant ?? []).forEach((k) => granted.add(k));
  (overrides.deny ?? []).forEach((k) => granted.delete(k));

  return granted;
}

export function hasPermissionIn(set: Set<string> | string[], key: string): boolean {
  if (Array.isArray(set)) return set.includes(key);
  return set.has(key);
}

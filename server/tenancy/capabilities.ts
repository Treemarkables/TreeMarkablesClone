/**
 * Inflow — Capability catalog (Phase 3 RBAC), FIRST CUT.
 *
 * The single code-defined registry of every grantable capability (SAAS plan §RBAC:
 * "Code, not DB, is the source of truth"). Roles store arrays of these `key`s in
 * `roles.grantedCaps`; per-employee overrides allow/deny individual keys; effective
 * permissions are then intersected with the business's subscription entitlements.
 *
 * STATUS: dormant — imported nowhere yet. Derived 2026-06-03 by walking
 * client/src/components/AppSidebar.tsx + the 94 pages in client/src/pages/ + the
 * feature→tier mapping in INFLOW_SAAS_PLAN.md. This is a starting point to refine in
 * Phase 3, not a final contract.
 *
 * RULES (from the plan):
 *  - `key` is STABLE and append-only. Never rename a shipped key (orphans role grants).
 *  - `kind: "view"`  → drives nav + UI visibility ("can see").
 *    `kind: "action"`→ drives whether an action is permitted ("can do"). Enforced
 *    server-side via requireCapability(); frontend <Can> hiding is cosmetic.
 *  - `requires` gates a capability behind an entitlement (tier or add-on). null = available
 *    on every tier incl. Freemium. The RBAC UI shows gated caps as locked upsells until the
 *    business's plan/add-ons unlock them. Values: "plan:crew" | "plan:business" |
 *    "addon:call_recording" | "addon:ai" | "addon:sms" | "addon:voice_agent".
 */

export type CapabilityKind = "view" | "action";
export type Entitlement =
  | "plan:crew"
  | "plan:business"
  | "addon:call_recording"
  | "addon:ai"
  | "addon:sms"
  | "addon:voice_agent";

export interface Capability {
  key: string;
  module: string;
  label: string;
  kind: CapabilityKind;
  requires: Entitlement | null;
}

export const CAPABILITY_CATALOG: Capability[] = [
  // ── Jobs & Dispatch ────────────────────────────────────────────────
  { key: "jobs.view", module: "Jobs", label: "View jobs", kind: "view", requires: null },
  { key: "jobs.create", module: "Jobs", label: "Create jobs", kind: "action", requires: null },
  { key: "jobs.edit", module: "Jobs", label: "Edit jobs", kind: "action", requires: null },
  { key: "jobs.delete", module: "Jobs", label: "Delete jobs", kind: "action", requires: null },
  { key: "jobs.assign", module: "Jobs", label: "Assign staff to jobs", kind: "action", requires: null },
  { key: "tasks.view", module: "Jobs", label: "View tasks / Kanban", kind: "view", requires: null },
  { key: "tasks.manage", module: "Jobs", label: "Create & edit tasks", kind: "action", requires: null },
  { key: "dispatch.view", module: "Jobs", label: "View dispatch board", kind: "view", requires: "plan:crew" },
  { key: "dispatch.manage", module: "Jobs", label: "Reassign dispatch", kind: "action", requires: "plan:crew" },
  { key: "jobTemplates.manage", module: "Jobs", label: "Manage job templates", kind: "action", requires: "plan:crew" },
  { key: "dailyBriefing.view", module: "Jobs", label: "View daily briefing", kind: "view", requires: null },

  // ── Quoting & Proposals ────────────────────────────────────────────
  { key: "quotes.view", module: "Quoting", label: "View quotes", kind: "view", requires: null },
  { key: "quotes.create", module: "Quoting", label: "Create quotes", kind: "action", requires: null },
  { key: "quotes.edit", module: "Quoting", label: "Edit quotes", kind: "action", requires: null },
  { key: "quotes.send", module: "Quoting", label: "Send quotes to customers", kind: "action", requires: null },
  { key: "proposals.view", module: "Quoting", label: "View proposals", kind: "view", requires: null },
  { key: "proposals.manage", module: "Quoting", label: "Build & edit proposals", kind: "action", requires: null },
  { key: "followups.view", module: "Quoting", label: "View follow-up queue", kind: "view", requires: "plan:crew" },
  { key: "followups.manage", module: "Quoting", label: "Manage quote follow-ups", kind: "action", requires: "plan:crew" },
  { key: "speechToQuote.use", module: "Quoting", label: "Speech-to-Quote (AI)", kind: "action", requires: "addon:ai" },

  // ── Invoicing & Finance ────────────────────────────────────────────
  { key: "invoices.view", module: "Finance", label: "View invoices", kind: "view", requires: null },
  { key: "invoices.create", module: "Finance", label: "Create invoices", kind: "action", requires: null },
  { key: "invoices.edit", module: "Finance", label: "Edit invoices", kind: "action", requires: null },
  { key: "invoices.send", module: "Finance", label: "Send invoices", kind: "action", requires: null },
  { key: "payments.record", module: "Finance", label: "Record / manage payments", kind: "action", requires: null },
  { key: "reconciliation.view", module: "Finance", label: "View reconciliation", kind: "view", requires: "plan:crew" },
  { key: "reconciliation.manage", module: "Finance", label: "Reconcile transactions", kind: "action", requires: "plan:crew" },
  { key: "profitability.view", module: "Finance", label: "View profitability calculator", kind: "view", requires: "plan:crew" },

  // ── Scheduling ─────────────────────────────────────────────────────
  { key: "calendar.view", module: "Scheduling", label: "View calendar", kind: "view", requires: null },
  { key: "calendar.manage", module: "Scheduling", label: "Create & edit schedule events", kind: "action", requires: null },
  { key: "staffSchedule.view", module: "Scheduling", label: "View staff schedule", kind: "view", requires: "plan:crew" },
  { key: "staffSchedule.manage", module: "Scheduling", label: "Manage staff schedule", kind: "action", requires: "plan:crew" },

  // ── Photos & media ─────────────────────────────────────────────────
  { key: "photos.view", module: "Photos", label: "View photos", kind: "view", requires: null },
  { key: "photos.upload", module: "Photos", label: "Upload & annotate photos", kind: "action", requires: null },
  { key: "photos.captions", module: "Photos", label: "Voice captions", kind: "action", requires: "plan:crew" },
  { key: "photos.timeline", module: "Photos", label: "Public timeline links", kind: "action", requires: "plan:crew" },
  { key: "videos.view", module: "Videos", label: "View videos", kind: "view", requires: "plan:crew" },
  { key: "videos.upload", module: "Videos", label: "Upload videos", kind: "action", requires: "plan:crew" },
  { key: "videos.transcribe", module: "Videos", label: "Video transcription (AI)", kind: "action", requires: "addon:ai" },

  // ── Safety & compliance ────────────────────────────────────────────
  { key: "safety.view", module: "Safety", label: "View safety hub", kind: "view", requires: "plan:crew" },
  { key: "toolboxTalks.manage", module: "Safety", label: "Run & record toolbox talks", kind: "action", requires: "plan:crew" },
  { key: "swms.manage", module: "Safety", label: "Create & edit SWMS", kind: "action", requires: "plan:crew" },
  { key: "jha.manage", module: "Safety", label: "Create JHA assessments", kind: "action", requires: "plan:crew" },
  { key: "prestart.manage", module: "Safety", label: "Manage pre-start checklists", kind: "action", requires: "plan:crew" },
  { key: "nearMiss.report", module: "Safety", label: "File near-miss / notifiable events", kind: "action", requires: "plan:crew" },
  { key: "competency.manage", module: "Safety", label: "Manage competency register", kind: "action", requires: "plan:crew" },
  { key: "safety.analytics", module: "Safety", label: "Safety analytics", kind: "view", requires: "plan:business" },

  // ── Equipment ──────────────────────────────────────────────────────
  { key: "equipment.view", module: "Equipment", label: "View equipment register", kind: "view", requires: "plan:crew" },
  { key: "equipment.manage", module: "Equipment", label: "Manage equipment & maintenance", kind: "action", requires: "plan:crew" },
  { key: "equipment.checkout", module: "Equipment", label: "Check equipment in/out", kind: "action", requires: "plan:crew" },
  { key: "inspections.manage", module: "Equipment", label: "Vehicle & asset inspections", kind: "action", requires: "plan:crew" },
  { key: "inductions.manage", module: "Equipment", label: "Manage equipment inductions", kind: "action", requires: "plan:crew" },

  // ── Staff & permissions ────────────────────────────────────────────
  { key: "staff.view", module: "Staff", label: "View staff", kind: "view", requires: null },
  { key: "staff.manage", module: "Staff", label: "Add & edit staff", kind: "action", requires: "plan:crew" },
  { key: "timeTracking.view", module: "Staff", label: "View time tracking", kind: "view", requires: "plan:crew" },
  { key: "timeTracking.manage", module: "Staff", label: "Edit timesheets", kind: "action", requires: "plan:crew" },
  { key: "permissions.manage", module: "Staff", label: "Manage roles & permissions", kind: "action", requires: "plan:crew" },

  // ── Communications ─────────────────────────────────────────────────
  { key: "inbox.view", module: "Communications", label: "View unified inbox", kind: "view", requires: "plan:crew" },
  { key: "inbox.reply", module: "Communications", label: "Reply to conversations", kind: "action", requires: "plan:crew" },
  { key: "sms.send", module: "Communications", label: "Send SMS", kind: "action", requires: "addon:sms" },
  { key: "commTemplates.manage", module: "Communications", label: "Manage comms templates", kind: "action", requires: "plan:crew" },
  { key: "bookingReminders.manage", module: "Communications", label: "Manage booking reminders", kind: "action", requires: "plan:crew" },

  // ── Calls / voice (add-on, any tier) ───────────────────────────────
  { key: "calls.view", module: "Calls", label: "View call records", kind: "view", requires: "addon:call_recording" },
  { key: "calls.record", module: "Calls", label: "Record calls", kind: "action", requires: "addon:call_recording" },
  { key: "calls.playback", module: "Calls", label: "Play call recordings", kind: "action", requires: "addon:call_recording" },
  { key: "voiceAgent.use", module: "Calls", label: "AI voice agent (inbound quote triage)", kind: "action", requires: "addon:voice_agent" },
  { key: "voiceAgent.settings", module: "Calls", label: "Configure AI voice agent", kind: "view", requires: "addon:voice_agent" },

  // ── Marketing & reputation (Business tier) ─────────────────────────
  { key: "marketing.view", module: "Marketing", label: "View marketing planner", kind: "view", requires: "plan:business" },
  { key: "marketing.manage", module: "Marketing", label: "Manage campaigns & social plans", kind: "action", requires: "plan:business" },
  { key: "reputation.view", module: "Marketing", label: "View reputation dashboard", kind: "view", requires: "plan:business" },
  { key: "reviews.manage", module: "Marketing", label: "Manage review requests", kind: "action", requires: "plan:business" },
  { key: "priceRules.manage", module: "Marketing", label: "Manage price rules", kind: "action", requires: "plan:business" },
  { key: "blog.manage", module: "Marketing", label: "Manage blog / SEO", kind: "action", requires: "plan:business" },

  // ── Documents ──────────────────────────────────────────────────────
  { key: "documents.view", module: "Documents", label: "View generated documents", kind: "view", requires: "plan:crew" },
  { key: "documents.build", module: "Documents", label: "Build documents & templates", kind: "action", requires: "plan:crew" },

  // ── Analytics ──────────────────────────────────────────────────────
  { key: "analytics.basic", module: "Analytics", label: "View dashboard stats", kind: "view", requires: null },
  { key: "analytics.advanced", module: "Analytics", label: "Advanced analytics & job costing", kind: "view", requires: "plan:business" },

  // ── Workflows / automation (Business tier) ─────────────────────────
  { key: "workflows.view", module: "Workflows", label: "View workflow rules", kind: "view", requires: "plan:business" },
  { key: "workflows.manage", module: "Workflows", label: "Manage automation rules", kind: "action", requires: "plan:business" },

  // ── Integrations ───────────────────────────────────────────────────
  { key: "integrations.view", module: "Integrations", label: "View integrations", kind: "view", requires: "plan:crew" },
  { key: "integrations.xero", module: "Integrations", label: "Manage Xero connection", kind: "action", requires: "plan:crew" },
  { key: "integrations.google", module: "Integrations", label: "Manage Google Calendar / Gmail", kind: "action", requires: "plan:crew" },

  // ── Customers ──────────────────────────────────────────────────────
  { key: "customers.view", module: "Customers", label: "View customers", kind: "view", requires: null },
  { key: "customers.manage", module: "Customers", label: "Add & edit customers", kind: "action", requires: null },
  { key: "leads.view", module: "Customers", label: "View leads / pipeline", kind: "view", requires: null },
  { key: "leads.manage", module: "Customers", label: "Manage leads", kind: "action", requires: null },

  // ── Help centre ────────────────────────────────────────────────────
  { key: "help.view", module: "Help", label: "Access help centre", kind: "view", requires: null },
  { key: "help.edit", module: "Help", label: "Author help articles", kind: "action", requires: null }, // owner-gated for v1; see INFLOW_HELP_PLAN.md

  // ── Business settings ──────────────────────────────────────────────
  { key: "settings.view", module: "Settings", label: "View business settings", kind: "view", requires: null },
  { key: "settings.manage", module: "Settings", label: "Edit business settings", kind: "action", requires: null },
  { key: "materials.manage", module: "Settings", label: "Manage materials & services", kind: "action", requires: "plan:crew" },
  { key: "billing.manage", module: "Settings", label: "Manage subscription & billing", kind: "action", requires: null },
];

/** Default seed roles every new business gets (SAAS plan §RBAC). Admin = all; Crew = field subset. */
export const SYSTEM_ROLE_SEEDS = {
  Admin: CAPABILITY_CATALOG.map((c) => c.key), // all capabilities
  Crew: [
    "jobs.view", "jobs.edit", "tasks.view", "tasks.manage", "dailyBriefing.view",
    "quotes.view", "proposals.view", "calendar.view", "photos.view", "photos.upload",
    "videos.view", "safety.view", "toolboxTalks.manage", "jha.manage", "prestart.manage",
    "nearMiss.report", "equipment.view", "equipment.checkout", "inspections.manage",
    "customers.view", "help.view", "analytics.basic",
  ],
} as const;

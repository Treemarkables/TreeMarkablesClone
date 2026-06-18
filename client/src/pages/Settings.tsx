import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import {
  Users,
  Bell,
  Shield,
  Package,
  FolderOpen,
  Building2,
  ListChecks,
  FileText,
  CheckSquare,
  Sliders,
  Mail,
  MessageSquare,
  ClipboardCheck,
  GraduationCap,
  AlertTriangle,
  ShieldCheck,
  Wrench,
  LayoutTemplate,
  Clock,
  Plug,
  Banknote,
  PhoneOff,
  Receipt,
  FileStack,
  CreditCard,
  Search,
  ChevronRight,
} from "lucide-react";
import { useRoleChecklistFeature } from "@/hooks/useRoleChecklistFeature";

// Sections give the 30 settings a scannable structure instead of one flat grid.
// Render order is driven by SECTION_ORDER below.
const SECTION_ORDER = [
  "Jobs & quoting",
  "Customers & comms",
  "Pricing & invoicing",
  "Team & access",
  "Vehicles & safety",
  "Operations & business",
] as const;

type Section = (typeof SECTION_ORDER)[number];

interface SettingOption {
  id: string;
  title: string;
  description: string;
  icon: typeof Users;
  path: string;
  section: Section;
}

const settingsOptions: SettingOption[] = [
  // Jobs & quoting
  { id: "checklist-template", title: "Default Job Checklist", description: "Tasks that auto-load into every new job card", icon: CheckSquare, path: "/settings/checklist-template", section: "Jobs & quoting" },
  { id: "role-checklist-tasks", title: "Role Checklist Tasks", description: "Customise tasks for Kaitiaki, Kaiwhangai and Kaitirotiro", icon: ListChecks, path: "/settings/role-checklist-tasks", section: "Jobs & quoting" },
  { id: "quoting-process", title: "On-site Quoting Process", description: "Steps shown on the Quoting tab of every lead and quote job", icon: ClipboardCheck, path: "/settings/quoting-process", section: "Jobs & quoting" },
  { id: "categories", title: "Job Categories", description: "Organise work types and service categories", icon: FolderOpen, path: "/settings/categories", section: "Jobs & quoting" },
  { id: "forms", title: "Job Templates", description: "Create and manage job templates and forms", icon: FileText, path: "/settings/forms", section: "Jobs & quoting" },

  // Customers & comms
  { id: "notifications", title: "Notifications", description: "Email alerts, SMS settings and reminders", icon: Bell, path: "/settings/notifications", section: "Customers & comms" },
  { id: "inquiry-auto-reply", title: "Inquiry Auto-Reply", description: "Confirmation message sent when a customer submits a website quote form", icon: Mail, path: "/settings/inquiry-auto-reply", section: "Customers & comms" },
  { id: "quote-followup", title: "Quote Follow-up Automation", description: "Auto-draft follow-ups for unanswered quotes, you approve before send", icon: Mail, path: "/settings/quote-followup", section: "Customers & comms" },
  { id: "booking-reminders", title: "Booking Reminders", description: "Customer email and SMS reminders before scheduled jobs", icon: Bell, path: "/settings/booking-reminders", section: "Customers & comms" },
  { id: "email-templates", title: "Email Templates", description: "Email templates for customer messages", icon: Mail, path: "/settings/templates", section: "Customers & comms" },
  { id: "sms-templates", title: "SMS Templates", description: "Create and manage SMS message templates", icon: MessageSquare, path: "/settings/sms-templates", section: "Customers & comms" },

  // Pricing & invoicing
  { id: "materials", title: "Materials & Services", description: "Manage inventory, equipment and service items", icon: Package, path: "/materials-services", section: "Pricing & invoicing" },
  { id: "proposal-builder", title: "Proposal Builder", description: "Drag-and-drop visual proposal layout builder", icon: LayoutTemplate, path: "/settings/proposal-builder", section: "Pricing & invoicing" },
  { id: "invoice-builder", title: "Invoice Builder", description: "Drag-and-drop visual invoice layout builder", icon: LayoutTemplate, path: "/settings/invoice-builder", section: "Pricing & invoicing" },
  { id: "invoices", title: "Invoices", description: "View and manage all customer invoices", icon: Receipt, path: "/invoices", section: "Pricing & invoicing" },
  { id: "document-templates", title: "Document Templates", description: "Manage document, quote and proposal templates", icon: FileStack, path: "/templates", section: "Pricing & invoicing" },
  { id: "xero-reconciliation", title: "Xero Reconciliation", description: "Match invoices and payments with your Xero account", icon: Banknote, path: "/reconciliation", section: "Pricing & invoicing" },

  // Team & access
  { id: "staff", title: "Staff", description: "Manage team members, roles and permissions", icon: Users, path: "/settings/staff", section: "Team & access" },
  { id: "permissions", title: "Roles & Permissions", description: "Define role tiers and customise what each staff member can do", icon: Shield, path: "/settings/permissions", section: "Team & access" },
  { id: "security", title: "Security & API", description: "Password settings, API keys and access control", icon: Shield, path: "/settings/security", section: "Team & access" },

  // Vehicles & safety
  { id: "vehicle-inspections", title: "Vehicle Inspections", description: "Pre-start inspection templates, checklists and expiry reminders", icon: ClipboardCheck, path: "/settings/vehicle-inspections", section: "Vehicles & safety" },
  { id: "equipment-inductions", title: "Equipment Inductions", description: "Induction checklists for each piece of equipment", icon: GraduationCap, path: "/settings/equipment-inductions", section: "Vehicles & safety" },
  { id: "equipment-register", title: "Equipment Register", description: "Assign licence requirements to equipment for AI Smart Dispatch", icon: Wrench, path: "/settings/equipment-register", section: "Vehicles & safety" },
  { id: "jha-templates", title: "JHA Templates", description: "Hazard templates and control measures for safety assessments", icon: AlertTriangle, path: "/settings/jha-templates", section: "Vehicles & safety" },
  { id: "jha-risk-controls", title: "Risk Control Templates", description: "Manage risk control hierarchy options for job hazard analysis", icon: ShieldCheck, path: "/settings/jha-risk-controls", section: "Vehicles & safety" },

  // Operations & business
  { id: "time-tracking", title: "Time Tracking", description: "Track hours, timesheets and crew time on jobs", icon: Clock, path: "/time-tracking", section: "Operations & business" },
  { id: "unlinked-calls", title: "Unlinked Calls", description: "Review inbound calls not yet attached to a job or customer", icon: PhoneOff, path: "/unlinked-calls", section: "Operations & business" },
  { id: "integrations", title: "Integrations", description: "Connect Xero, Google and other third-party services", icon: Plug, path: "/integrations", section: "Operations & business" },
  { id: "preferences", title: "Preferences", description: "Time zones, currency, date formats and defaults", icon: Sliders, path: "/settings/preferences", section: "Operations & business" },
  { id: "company", title: "Company Info", description: "Business details, contact information and branding", icon: Building2, path: "/settings/company", section: "Operations & business" },
  { id: "billing", title: "Billing & Plan", description: "Your subscription, plan and payment method", icon: CreditCard, path: "/settings/billing", section: "Operations & business" },
];

export default function Settings() {
  // Role checklist tasks (Kaitiaki / Kaiwhangai / Kaitirotiro) are Treemarkables-only.
  const roleChecklistEnabled = useRoleChecklistFeature();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = (s: SettingOption) =>
    !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);

  const visible = settingsOptions.filter(
    (s) => (s.id !== "role-checklist-tasks" || roleChecklistEnabled) && matches(s),
  );

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your account and how your business runs.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              className="pl-9"
              data-testid="input-settings-search"
            />
          </div>
        </div>

        {/* Grouped sections */}
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No settings match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="space-y-8">
            {SECTION_ORDER.map((section) => {
              const items = visible.filter((s) => s.section === section);
              if (items.length === 0) return null;
              return (
                <section key={section}>
                  <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {section}
                  </h2>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((setting) => {
                      const Icon = setting.icon;
                      return (
                        <Link
                          key={setting.path}
                          href={setting.path}
                          className="group flex items-start gap-3 rounded-lg border border-card-border bg-card p-3.5 hover-elevate"
                          data-testid={`card-setting-${setting.id}`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className="block text-sm font-medium text-foreground"
                              data-testid={`text-setting-title-${setting.id}`}
                            >
                              {setting.title}
                            </span>
                            <span
                              className="mt-0.5 block text-xs leading-snug text-muted-foreground"
                              data-testid={`text-setting-desc-${setting.id}`}
                            >
                              {setting.description}
                            </span>
                          </span>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

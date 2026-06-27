import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserCog,
  UserCheck,
  Bell,
  Shield,
  KeyRound,
  Package,
  Tags,
  Building2,
  ListChecks,
  ClipboardList,
  FileText,
  Sliders,
  LayoutGrid,
  Mail,
  Reply,
  Send,
  MessageSquare,
  CalendarClock,
  ClipboardCheck,
  Truck,
  GraduationCap,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  LayoutTemplate,
  PencilRuler,
  Plug,
  Banknote,
  PhoneMissed,
  Receipt,
  FileStack,
  CreditCard,
  Search,
  type LucideIcon
} from "lucide-react";
import { Link } from "wouter";
import { useRoleChecklistFeature } from "@/hooks/useRoleChecklistFeature";

type SettingOption = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
};

type SettingSection = {
  id: string;
  label: string;
  // One strong, saturated accent per section instead of a different colour per card.
  // `chip` is the solid icon tile (white glyph); `dot` is the section-header marker.
  chip: string;
  dot: string;
  options: SettingOption[];
};

const settingsSections: SettingSection[] = [
  {
    id: "business",
    label: "Business & account",
    chip: "bg-blue-50",
    dot: "bg-blue-600",
    options: [
      {
        id: "company",
        title: "Company Info",
        description: "Business details, contact information and branding",
        icon: Building2,
        path: "/settings/company"
      },
      {
        id: "billing",
        title: "Billing & Plan",
        description: "Your subscription, plan and payment method",
        icon: CreditCard,
        path: "/settings/billing"
      },
      {
        id: "account",
        title: "Account",
        description: "Your sign-in details and account deletion",
        icon: UserCog,
        path: "/settings/account"
      },
      {
        id: "security",
        title: "Security & API",
        description: "Password settings, API keys and access control",
        icon: KeyRound,
        path: "/settings/security"
      },
      {
        id: "notifications",
        title: "Notifications",
        description: "Email alerts, SMS settings and reminders",
        icon: Bell,
        path: "/settings/notifications"
      },
      {
        id: "preferences",
        title: "Preferences",
        description: "Time zones, currency, date formats and defaults",
        icon: Sliders,
        path: "/settings/preferences"
      }
    ]
  },
  {
    id: "team",
    label: "Team & roles",
    chip: "bg-amber-50",
    dot: "bg-amber-600",
    options: [
      {
        id: "staff",
        title: "Staff",
        description: "Manage team members, roles and permissions",
        icon: Users,
        path: "/settings/staff"
      },
      {
        id: "permissions",
        title: "Roles & Permissions",
        description: "Define role tiers and customise what each staff member can do",
        icon: UserCheck,
        path: "/settings/permissions"
      }
    ]
  },
  {
    id: "jobs",
    label: "Jobs & workflow",
    chip: "bg-emerald-50",
    dot: "bg-emerald-600",
    options: [
      {
        id: "checklist-template",
        title: "Default Job Checklist",
        description: "Tasks that auto-load into every new job card",
        icon: ListChecks,
        path: "/settings/checklist-template"
      },
      {
        id: "role-checklist-tasks",
        title: "Role Checklist Tasks",
        description: "Customise tasks for Kaitiaki, Kaiwhangai and Kaitirotiro",
        icon: ClipboardList,
        path: "/settings/role-checklist-tasks"
      },
      {
        id: "quoting-process",
        title: "On-site Quoting Process",
        description: "Steps shown on the Quoting tab of every lead and quote job",
        icon: ClipboardCheck,
        path: "/settings/quoting-process"
      },
      {
        id: "lanes",
        title: "Lanes",
        description: "Custom job buckets with automations — e.g. nudge after N days",
        icon: LayoutGrid,
        path: "/settings/lanes"
      },
      {
        id: "forms",
        title: "Job Templates",
        description: "Create and manage job templates and forms",
        icon: FileText,
        path: "/settings/forms"
      },
      {
        id: "materials",
        title: "Materials & Services",
        description: "Manage inventory, equipment and service items",
        icon: Package,
        path: "/materials-services"
      },
      {
        id: "categories",
        title: "Job Categories",
        description: "Organize work types and service categories",
        icon: Tags,
        path: "/settings/categories"
      },
      {
        id: "equipment-register",
        title: "Equipment Register",
        description: "Assign licence requirements to equipment for AI Smart Dispatch",
        icon: Wrench,
        path: "/settings/equipment-register"
      }
    ]
  },
  {
    id: "documents",
    label: "Documents & templates",
    chip: "bg-violet-50",
    dot: "bg-violet-600",
    options: [
      {
        id: "invoice-builder",
        title: "Invoice Builder",
        description: "Drag-and-drop visual invoice layout builder",
        icon: LayoutTemplate,
        path: "/settings/invoice-builder"
      },
      {
        id: "proposal-builder",
        title: "Proposal Builder",
        description: "Drag-and-drop visual proposal layout builder",
        icon: PencilRuler,
        path: "/settings/proposal-builder"
      },
      {
        id: "templates",
        title: "Email Templates",
        description: "Email templates for customer messages",
        icon: Mail,
        path: "/settings/templates"
      },
      {
        id: "sms-templates",
        title: "SMS Templates",
        description: "Create and manage SMS message templates",
        icon: MessageSquare,
        path: "/settings/sms-templates"
      },
      {
        id: "doc-templates",
        title: "Document Templates",
        description: "Manage document, quote and proposal templates",
        icon: FileStack,
        path: "/templates"
      }
    ]
  },
  {
    id: "comms",
    label: "Customer communications",
    chip: "bg-cyan-50",
    dot: "bg-cyan-600",
    options: [
      {
        id: "inquiry-auto-reply",
        title: "Inquiry Auto-Reply",
        description: "Confirmation message sent when a customer submits a website quote form",
        icon: Reply,
        path: "/settings/inquiry-auto-reply"
      },
      {
        id: "quote-followup",
        title: "Quote Follow-up Automation",
        description: "Auto-draft follow-ups for unanswered quotes — you approve before send",
        icon: Send,
        path: "/settings/quote-followup"
      },
      {
        id: "booking-reminders",
        title: "Booking Reminders",
        description: "Customer email/SMS reminders before scheduled jobs",
        icon: CalendarClock,
        path: "/settings/booking-reminders"
      }
    ]
  },
  {
    id: "safety",
    label: "Safety & compliance",
    chip: "bg-rose-50",
    dot: "bg-rose-600",
    options: [
      {
        id: "vehicle-inspections",
        title: "Vehicle Inspections",
        description: "Pre-start inspection templates and checklists",
        icon: Truck,
        path: "/settings/vehicle-inspections"
      },
      {
        id: "equipment-inductions",
        title: "Equipment Inductions",
        description: "Induction checklists for each piece of equipment",
        icon: GraduationCap,
        path: "/settings/equipment-inductions"
      },
      {
        id: "jha-templates",
        title: "JHA Templates",
        description: "Create and manage hazard templates and control measures for safety assessments",
        icon: AlertTriangle,
        path: "/settings/jha-templates"
      },
      {
        id: "jha-risk-controls",
        title: "Risk Control Templates",
        description: "Manage risk control hierarchy options for job hazard analysis",
        icon: ShieldAlert,
        path: "/settings/jha-risk-controls"
      }
    ]
  },
  {
    id: "finance",
    label: "Finance & integrations",
    chip: "bg-slate-100",
    dot: "bg-slate-600",
    options: [
      {
        id: "integrations",
        title: "Integrations",
        description: "Connect Xero, Google and other third-party services",
        icon: Plug,
        path: "/integrations"
      },
      {
        id: "xero-reconciliation",
        title: "Xero Reconciliation",
        description: "Match invoices and payments with your Xero account",
        icon: Banknote,
        path: "/reconciliation"
      },
      {
        id: "invoices",
        title: "Invoices",
        description: "View and manage all customer invoices",
        icon: Receipt,
        path: "/invoices"
      },
      {
        id: "unlinked-calls",
        title: "Unlinked Calls",
        description: "Review inbound calls not yet attached to a job or customer",
        icon: PhoneMissed,
        path: "/unlinked-calls"
      }
    ]
  }
];

// Maps each setting to its 3D illustration in client/public/settings-icons/.
// Kept separate from the option id so several settings can share an illustration.
const SETTING_IMAGES: Record<string, string> = {
  company: "company",
  billing: "billing",
  account: "account",
  security: "security",
  notifications: "notifications",
  preferences: "preferences",
  staff: "staff",
  permissions: "permissions",
  "checklist-template": "checklist",
  "role-checklist-tasks": "checklist",
  "quoting-process": "quoting",
  lanes: "lanes",
  forms: "forms",
  materials: "materials",
  categories: "categories",
  "equipment-register": "equipment",
  "invoice-builder": "invoice-builder",
  "proposal-builder": "proposal-builder",
  templates: "email-templates",
  "sms-templates": "sms-templates",
  "doc-templates": "doc-templates",
  "inquiry-auto-reply": "inquiry",
  "quote-followup": "followup",
  "booking-reminders": "booking",
  "vehicle-inspections": "vehicle",
  "equipment-inductions": "inductions",
  "jha-templates": "jha",
  "jha-risk-controls": "risk",
  integrations: "integrations",
  "xero-reconciliation": "xero",
  invoices: "invoices",
  "unlinked-calls": "calls"
};

export default function Settings() {
  // Role checklist tasks (Kaitiaki / Kaiwhangai / Kaitirotiro) are Treemarkables-only.
  const roleChecklistEnabled = useRoleChecklistFeature();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return settingsSections
      .map((section) => ({
        ...section,
        options: section.options.filter((option) => {
          if (option.id === "role-checklist-tasks" && !roleChecklistEnabled) return false;
          if (!q) return true;
          return (
            option.title.toLowerCase().includes(q) ||
            option.description.toLowerCase().includes(q)
          );
        })
      }))
      .filter((section) => section.options.length > 0);
  }, [query, roleChecklistEnabled]);

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and business settings</p>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            className="pl-9"
            data-testid="input-settings-search"
          />
        </div>
      </div>

      {/* Sectioned settings */}
      {sections.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="text-settings-empty">
          No settings match "{query}".
        </p>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${section.dot}`} />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {section.label}
                </h2>
                <span className="text-xs text-gray-400">{section.options.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.options.map((option) => {
                  const image = SETTING_IMAGES[option.id] ?? option.id;
                  return (
                    <Link key={option.id} href={option.path} className="block">
                      <Card
                        className="hover-elevate cursor-pointer h-full transition-all duration-200"
                        data-testid={`card-setting-${option.id}`}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div
                            className={`flex-none w-20 h-20 rounded-full flex items-center justify-center ${section.chip}`}
                          >
                            <img
                              src={`/settings-icons/${image}.png`}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              className="w-14 h-14 object-contain"
                            />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h3
                              className="font-semibold text-gray-900 leading-snug"
                              data-testid={`text-setting-title-${option.id}`}
                            >
                              {option.title}
                            </h3>
                            <p
                              className="text-sm text-gray-600 leading-snug"
                              data-testid={`text-setting-desc-${option.id}`}
                            >
                              {option.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/materials-services" className="block">
              <Button variant="outline" className="w-full justify-start" data-testid="button-quick-materials">
                <Package className="w-4 h-4 mr-2" />
                Add Materials
              </Button>
            </Link>

            <Link href="/settings/staff" className="block">
              <Button variant="outline" className="w-full justify-start" data-testid="button-quick-staff">
                <Users className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </Link>

            <Button variant="outline" className="w-full justify-start" data-testid="button-quick-security">
              <Shield className="w-4 h-4 mr-2" />
              Generate API Key
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

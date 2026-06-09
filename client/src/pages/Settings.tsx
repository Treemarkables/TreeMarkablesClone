import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings2,
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
  PhoneCall
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useRoleChecklistFeature } from "@/hooks/useRoleChecklistFeature";

// Settings sections data - simplified without complex features
const settingsOptions = [
  {
    id: "checklist-template",
    title: "Default Job Checklist",
    description: "Tasks that auto-load into every new job card",
    icon: CheckSquare,
    color: "bg-green-100 text-green-600",
    path: "/settings/checklist-template"
  },
  {
    id: "role-checklist-tasks",
    title: "Role Checklist Tasks",
    description: "Customise tasks for Kaitiaki, Kaiwhangai and Kaitirotiro",
    icon: ListChecks,
    color: "bg-green-100 text-green-600",
    path: "/settings/role-checklist-tasks"
  },
  {
    id: "quoting-process",
    title: "On-site Quoting Process",
    description: "Steps shown on the Quoting tab of every lead and quote job",
    icon: ClipboardCheck,
    color: "bg-green-100 text-green-600",
    path: "/settings/quoting-process"
  },
  {
    id: "staff",
    title: "Staff",
    description: "Manage team members, roles and permissions",
    icon: Users,
    color: "bg-orange-100 text-orange-600",
    path: "/settings/staff"
  },
  {
    id: "permissions",
    title: "Roles & Permissions",
    description: "Define role tiers and customise what each staff member can do",
    icon: Shield,
    color: "bg-red-100 text-red-600",
    path: "/settings/permissions"
  },
  {
    id: "materials",
    title: "Materials & Services",
    description: "Manage inventory, equipment and service items",
    icon: Package,
    color: "bg-blue-100 text-blue-600",
    path: "/materials-services"
  },
  {
    id: "categories",
    title: "Job Categories",
    description: "Organize work types and service categories",
    icon: FolderOpen,
    color: "bg-green-100 text-green-600",
    path: "/settings/categories"
  },
  {
    id: "company",
    title: "Company Info",
    description: "Business details, contact information and branding",
    icon: Building2,
    color: "bg-purple-100 text-purple-600",
    path: "/settings/company"
  },
  {
    id: "billing",
    title: "Billing & Plan",
    description: "Your subscription, plan and payment method",
    icon: CreditCard,
    color: "bg-green-100 text-green-600",
    path: "/settings/billing"
  },
  {
    id: "security",
    title: "Security & API",
    description: "Password settings, API keys and access control",
    icon: Shield,
    color: "bg-red-100 text-red-600",
    path: "/settings/security"
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Email alerts, SMS settings and reminders",
    icon: Bell,
    color: "bg-yellow-100 text-yellow-600",
    path: "/settings/notifications"
  },
  {
    id: "inquiry-auto-reply",
    title: "Inquiry Auto-Reply",
    description: "Confirmation message sent when a customer submits a website quote form",
    icon: Mail,
    color: "bg-orange-100 text-orange-600",
    path: "/settings/inquiry-auto-reply"
  },
  {
    id: "voice-agent",
    title: "AI Phone Assistant",
    description: "Inbound call menu — callers can get a quick quote with the AI assistant",
    icon: PhoneCall,
    color: "bg-indigo-100 text-indigo-600",
    path: "/settings/voice-agent"
  },
  {
    id: "quote-followup",
    title: "Quote Follow-up Automation",
    description: "Auto-draft follow-ups for unanswered quotes — you approve before send",
    icon: Mail,
    color: "bg-green-100 text-green-600",
    path: "/settings/quote-followup"
  },
  {
    id: "booking-reminders",
    title: "Booking Reminders",
    description: "Customer email/SMS reminders before scheduled jobs",
    icon: Bell,
    color: "bg-emerald-100 text-emerald-600",
    path: "/settings/booking-reminders"
  },
  {
    id: "forms",
    title: "Job Templates",
    description: "Create and manage job templates and forms",
    icon: FileText,
    color: "bg-cyan-100 text-cyan-600",
    path: "/settings/forms"
  },
  {
    id: "templates",
    title: "Email Templates",
    description: "Email templates for customer messages",
    icon: Mail,
    color: "bg-pink-100 text-pink-600",
    path: "/settings/templates"
  },
  {
    id: "sms-templates",
    title: "SMS Templates",
    description: "Create and manage SMS message templates",
    icon: MessageSquare,
    color: "bg-violet-100 text-violet-600",
    path: "/settings/sms-templates"
  },
  {
    id: "preferences",
    title: "Preferences",
    description: "Time zones, currency, date formats and defaults",
    icon: Sliders,
    color: "bg-indigo-100 text-indigo-600",
    path: "/settings/preferences"
  },
  {
    id: "vehicle-inspections",
    title: "Vehicle Inspections",
    description: "Pre-start inspection templates and checklists",
    icon: ClipboardCheck,
    color: "bg-teal-100 text-teal-600",
    path: "/settings/vehicle-inspections"
  },
  {
    id: "equipment-inductions",
    title: "Equipment Inductions",
    description: "Induction checklists for each piece of equipment",
    icon: GraduationCap,
    color: "bg-teal-100 text-teal-600",
    path: "/settings/equipment-inductions"
  },
  {
    id: "jha-templates",
    title: "JHA Templates",
    description: "Create and manage hazard templates and control measures for safety assessments",
    icon: AlertTriangle,
    color: "bg-amber-100 text-amber-600",
    path: "/settings/jha-templates"
  },
  {
    id: "jha-risk-controls",
    title: "Risk Control Templates",
    description: "Manage risk control hierarchy options for job hazard analysis",
    icon: ShieldCheck,
    color: "bg-emerald-100 text-emerald-600",
    path: "/settings/jha-risk-controls"
  },
  {
    id: "equipment-register",
    title: "Equipment Register",
    description: "Assign licence requirements to equipment for AI Smart Dispatch",
    icon: Wrench,
    color: "bg-orange-100 text-orange-600",
    path: "/settings/equipment-register"
  },
  {
    id: "invoice-builder",
    title: "Invoice Builder",
    description: "Drag-and-drop visual invoice layout builder",
    icon: LayoutTemplate,
    color: "bg-orange-100 text-orange-600",
    path: "/settings/invoice-builder"
  },
  {
    id: "proposal-builder",
    title: "Proposal Builder",
    description: "Drag-and-drop visual proposal layout builder",
    icon: LayoutTemplate,
    color: "bg-orange-100 text-orange-600",
    path: "/settings/proposal-builder"
  },
  {
    id: "time-tracking",
    title: "Time Tracking",
    description: "Track hours, timesheets and crew time on jobs",
    icon: Clock,
    color: "bg-sky-100 text-sky-600",
    path: "/time-tracking"
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect Xero, Google and other third-party services",
    icon: Plug,
    color: "bg-lime-100 text-lime-600",
    path: "/integrations"
  },
  {
    id: "xero-reconciliation",
    title: "Xero Reconciliation",
    description: "Match invoices and payments with your Xero account",
    icon: Banknote,
    color: "bg-emerald-100 text-emerald-600",
    path: "/reconciliation"
  },
  {
    id: "unlinked-calls",
    title: "Unlinked Calls",
    description: "Review inbound calls not yet attached to a job or customer",
    icon: PhoneOff,
    color: "bg-rose-100 text-rose-600",
    path: "/unlinked-calls"
  },
  {
    id: "invoices",
    title: "Invoices",
    description: "View and manage all customer invoices",
    icon: Receipt,
    color: "bg-amber-100 text-amber-600",
    path: "/invoices"
  },
  {
    id: "templates",
    title: "Templates",
    description: "Manage document, quote and proposal templates",
    icon: FileStack,
    color: "bg-fuchsia-100 text-fuchsia-600",
    path: "/templates"
  }
];

export default function Settings() {
  // Role checklist tasks (Kaitiaki / Kaiwhangai / Kaitirotiro) are Treemarkables-only.
  const roleChecklistEnabled = useRoleChecklistFeature();
  const visibleSettings = settingsOptions.filter(
    (s) => s.id !== "role-checklist-tasks" || roleChecklistEnabled,
  );
  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and business settings</p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {visibleSettings.map((setting) => {
          const IconComponent = setting.icon;
          
          return (
            <Link key={setting.id} href={setting.path} className="block">
              <Card className="hover-elevate cursor-pointer h-full transition-all duration-200" data-testid={`card-setting-${setting.id}`}>
                <CardContent className="p-6 text-center space-y-4">
                  <div className={`w-16 h-16 mx-auto rounded-lg flex items-center justify-center ${setting.color}`}>
                    <IconComponent className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900" data-testid={`text-setting-title-${setting.id}`}>
                      {setting.title}
                    </h3>
                    <p className="text-sm text-gray-600" data-testid={`text-setting-desc-${setting.id}`}>
                      {setting.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
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
    </div>
  );
}
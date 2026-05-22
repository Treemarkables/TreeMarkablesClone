import { Link } from "wouter";
import {
  Users,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  GraduationCap,
  AlertTriangle,
  ShieldAlert,
  History,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SafetyReporting } from "@/components/SafetyReporting";

interface ModuleCard {
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
  iconClass: string;
}

const PLANNING: ModuleCard[] = [
  {
    title: "Toolbox Talks",
    description: "Run daily crew briefings from the talk library and capture attendance.",
    href: "/safety/toolbox-talks",
    icon: Users,
    iconClass: "bg-blue-100 text-blue-600",
  },
  {
    title: "SWMS",
    description: "Build safe work method statements from arborist task templates.",
    href: "/safety/swms",
    icon: FileText,
    iconClass: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "JHA Assessment",
    description: "Job hazard analysis for the work in front of you.",
    href: "/jha-assessment",
    icon: ShieldAlert,
    iconClass: "bg-amber-100 text-amber-600",
  },
  {
    title: "JHA History",
    description: "Review completed job hazard analyses.",
    href: "/jha-history",
    icon: History,
    iconClass: "bg-amber-100 text-amber-600",
  },
];

const CHECKS: ModuleCard[] = [
  {
    title: "Pre-start Checklists",
    description: "Daily equipment checks: chainsaw, chipper, stump grinder, EWP, rigging, vehicle.",
    href: "/safety/prestart-checklists",
    icon: ClipboardCheck,
    iconClass: "bg-blue-100 text-blue-600",
  },
  {
    title: "Equipment Inspection Register",
    description: "Track PPE and gear inspections with due-date reminders.",
    href: "/safety/equipment-register",
    icon: ShieldCheck,
    iconClass: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "Training & Competency",
    description: "Worker tickets and certifications with expiry tracking.",
    href: "/safety/competency-register",
    icon: GraduationCap,
    iconClass: "bg-purple-100 text-purple-600",
  },
];

const INCIDENTS: ModuleCard[] = [
  {
    title: "Near Miss Report",
    description: "Capture a near miss before it becomes an incident.",
    href: "/near-miss-report",
    icon: ClipboardList,
    iconClass: "bg-orange-100 text-orange-600",
  },
  {
    title: "Near Miss History",
    description: "Review and action reported near misses.",
    href: "/near-miss-history",
    icon: History,
    iconClass: "bg-orange-100 text-orange-600",
  },
  {
    title: "Notifiable Events",
    description: "Classify events and manage the 48-hour WorkSafe notification.",
    href: "/safety/notifiable-events",
    icon: AlertTriangle,
    iconClass: "bg-red-100 text-red-600",
  },
];

function ModuleGrid({ title, cards }: { title: string; cards: ModuleCard[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} data-testid={`link-safety-${c.href.split("/").pop()}`}>
              <Card className="bg-card border border-border rounded-lg h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-4 flex gap-3 items-start">
                  <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${c.iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <div className="font-semibold leading-tight">{c.title}</div>
                    <p className="text-sm text-muted-foreground leading-snug">{c.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function SafetyHub() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Safety</h1>
        <p className="text-muted-foreground">Health &amp; safety tools for the crew — plan the work, check the gear, and manage incidents.</p>
      </div>

      <ModuleGrid title="Plan the work" cards={PLANNING} />
      <ModuleGrid title="Check the gear & crew" cards={CHECKS} />
      <ModuleGrid title="Incidents & reporting" cards={INCIDENTS} />

      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Safety dashboard</h2>
        <SafetyReporting />
      </div>
    </div>
  );
}

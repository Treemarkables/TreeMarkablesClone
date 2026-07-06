import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Wrench,
  Calendar,
  AlertTriangle,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

interface FleetItem {
  equipmentId: string;
  name: string;
  type: string | null;
  registrationNumber: string | null;
  kind: "rego" | "cof" | "service";
  label: string;
  dueDate: string;
  daysUntil: number;
  severity: "overdue" | "critical" | "warning" | "info";
}

interface JobToday {
  id: string;
  title: string;
  status: string;
  scheduledStartTime: string | null;
  customerName: string | null;
  address: string | null;
}

interface TodayOverview {
  date: string;
  fleet: FleetItem[];
  jobsToday: JobToday[];
  counts: { needsAttention: number; dueSoon: number; jobsToday: number };
}

// Phrase a whole-day countdown the way someone reading it at 7am would say it.
function dueLabel(days: number): string {
  if (days < 0) return days === -1 ? "Expired yesterday" : `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

// Map severity to a Shadcn Badge variant. destructive carries the urgent tone;
// outline stays quiet for the further-out items.
function severityVariant(severity: FleetItem["severity"]): "destructive" | "secondary" | "outline" {
  if (severity === "overdue" || severity === "critical") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
}

function fleetIcon(kind: FleetItem["kind"]) {
  return kind === "service" ? (
    <Wrench className="h-5 w-5 text-muted-foreground shrink-0" />
  ) : (
    <Truck className="h-5 w-5 text-muted-foreground shrink-0" />
  );
}

export default function TodayDashboard() {
  const { data, isLoading } = useQuery<{ success: boolean; data: TodayOverview }>({
    queryKey: ["/api/today-overview"],
  });

  const overview = data?.data;
  const fleet = overview?.fleet ?? [];
  const jobsToday = overview?.jobsToday ?? [];
  const counts = overview?.counts ?? { needsAttention: 0, dueSoon: 0, jobsToday: 0 };

  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Pacific/Auckland",
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          live
        </span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card className={counts.needsAttention > 0 ? "border-destructive/40" : ""}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Needs attention</p>
            <p
              className={`text-2xl font-semibold mt-1 ${
                counts.needsAttention > 0 ? "text-destructive" : ""
              }`}
            >
              {counts.needsAttention}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Due soon</p>
            <p className="text-2xl font-semibold mt-1">{counts.dueSoon}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Jobs today</p>
            <p className="text-2xl font-semibold mt-1">{counts.jobsToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Fleet compliance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Fleet compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : fleet.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">
              Nothing due in the next 30 days. Add registration, CoF and service
              dates on the{" "}
              <Link href="/equipment" className="underline">
                equipment register
              </Link>{" "}
              to track them here.
            </p>
          ) : (
            <ul className="divide-y">
              {fleet.map((item) => (
                <li
                  key={`${item.equipmentId}-${item.kind}`}
                  className="flex items-center gap-3 px-6 py-3"
                >
                  {fleetIcon(item.kind)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.name}
                      {item.registrationNumber ? ` — ${item.registrationNumber}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                  <Badge variant={severityVariant(item.severity)}>
                    {dueLabel(item.daysUntil)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Today's schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Today's schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : jobsToday.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              No jobs scheduled for today.
            </p>
          ) : (
            <ul className="divide-y">
              {jobsToday.map((job) => (
                <li key={job.id} className="flex items-center gap-3 px-6 py-3">
                  <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">
                    {job.scheduledStartTime || "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[job.customerName, job.address].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

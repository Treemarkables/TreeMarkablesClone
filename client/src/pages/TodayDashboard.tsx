import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import {
  Truck,
  Wrench,
  Calendar,
  AlertTriangle,
  ClipboardCheck,
  RefreshCw,
  LocateFixed,
  Loader2,
  StickyNote,
  TrendingUp,
  Flag,
  Cloud,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Circle,
  Clock,
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

interface ActivityItem {
  id: string;
  type: string;
  timestamp: string;
  actorName: string;
  title: string;
  summary: string | null;
  photos: string[];
  timeSpent: number | null;
}

interface LiveTimer {
  employeeId: string;
  employeeName: string;
  startedAt: string;
}

interface JobToday {
  id: string;
  title: string;
  status: string;
  scheduledStartTime: string | null;
  customerName: string | null;
  address: string | null;
  activity: ActivityItem[];
  liveTimers: LiveTimer[];
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

// Diary entryType → timeline icon.
function ActivityIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 text-muted-foreground shrink-0 mt-0.5";
  switch (type) {
    case "note": return <StickyNote className={cls} />;
    case "progress": return <TrendingUp className={cls} />;
    case "issue": return <AlertTriangle className={cls} />;
    case "milestone": return <Flag className={cls} />;
    case "weather": return <Cloud className={cls} />;
    case "equipment": return <Wrench className={cls} />;
    case "safety": return <ShieldCheck className={cls} />;
    case "completion": return <CheckCircle2 className={cls} />;
    case "email": return <Mail className={cls} />;
    default: return <Circle className={cls} />;
  }
}

// ISO timestamp → "9:14 am" in NZ time.
function nzTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-NZ", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Pacific/Auckland",
    })
    .toLowerCase();
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "in_progress") return "default";
  if (status === "completed" || status === "invoice" || status === "invoiced") return "secondary";
  return "outline";
}

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const MAX_TIMELINE_ITEMS = 6;
const MAX_PHOTO_THUMBS = 8;

function TodayJobCard({
  job,
  onOpen,
  distanceKm,
  nearest,
}: {
  job: JobToday;
  onOpen: (jobId: string) => void;
  distanceKm?: number;
  nearest?: boolean;
}) {
  const photos = Array.from(new Set(job.activity.flatMap((a) => a.photos)));
  const timeline = job.activity.slice(0, MAX_TIMELINE_ITEMS);
  const hiddenCount = job.activity.length - timeline.length;

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        data-testid={`today-job-${job.id}`}
        onClick={() => onOpen(job.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(job.id);
          }
        }}
        className="px-6 py-4 cursor-pointer hover-elevate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">
            {job.scheduledStartTime || "—"}
          </span>
          <p className="text-sm font-medium truncate flex-1 min-w-0">{job.title}</p>
          {distanceKm !== undefined && (
            <Badge variant={nearest ? "default" : "outline"} className="shrink-0">
              {distanceKm < 0.15 ? "You're here" : `${distanceKm} km`}
            </Badge>
          )}
          <Badge variant={statusVariant(job.status)}>{statusLabel(job.status)}</Badge>
          {job.liveTimers.map((t) => (
            <Badge
              key={t.employeeId}
              variant="outline"
              className="text-green-700 dark:text-green-400 border-green-600/40 gap-1"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              {t.employeeName} on site — since {nzTime(t.startedAt)}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5 pl-[4.75rem]">
          {[job.customerName, job.address].filter(Boolean).join(" · ")}
        </p>

        {photos.length > 0 && (
          <div className="flex gap-2 mt-3 pl-[4.75rem] flex-wrap">
            {photos.slice(0, MAX_PHOTO_THUMBS).map((url) => (
              <img
                key={url}
                src={url}
                alt="Job photo from today"
                loading="lazy"
                className="h-14 w-14 rounded-md object-cover border"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ))}
            {photos.length > MAX_PHOTO_THUMBS && (
              <div className="h-14 w-14 rounded-md border flex items-center justify-center text-xs text-muted-foreground">
                +{photos.length - MAX_PHOTO_THUMBS}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 pl-[4.75rem] space-y-2">
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity yet today.</p>
          ) : (
            timeline.map((item) => (
              <div key={item.id} className="flex items-start gap-2">
                <ActivityIcon type={item.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-medium">{item.actorName}</span>{" "}
                    <span className="text-muted-foreground">
                      — {item.title}
                      {item.timeSpent ? ` (${item.timeSpent} min)` : ""}
                    </span>{" "}
                    <span className="text-muted-foreground/70">· {nzTime(item.timestamp)}</span>
                  </p>
                  {item.summary && (
                    <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground">+{hiddenCount} more today</p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function TodayDashboard() {
  const { data, isLoading } = useQuery<{ success: boolean; data: TodayOverview }>({
    queryKey: ["/api/today-overview"],
    refetchInterval: 60_000,
  });
  const { toast } = useToast();

  // "Near me" — geolocate, then sort today's schedule by distance. Distances
  // come from /api/near-me/jobs (server geocodes today's job addresses).
  const [distances, setDistances] = useState<Map<string, number> | null>(null);
  const [locating, setLocating] = useState(false);

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location unavailable",
        description: "This device doesn't support location.",
        variant: "destructive",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/near-me/jobs?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
            { credentials: "include" },
          );
          if (!res.ok) throw new Error("near-me failed");
          const body = await res.json();
          const map = new Map<string, number>();
          for (const j of body?.data ?? []) map.set(j.id, j.distanceKm);
          setDistances(map);
        } catch {
          toast({
            title: "Couldn't sort by distance",
            description: "Please try again.",
            variant: "destructive",
          });
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast({
          title: "Location permission needed",
          description: "Allow location access to sort jobs by distance.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isJobCardOpen, setIsJobCardOpen] = useState(false);
  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsJobCardOpen(true);
  };
  const handleCloseJobCard = () => setIsJobCardOpen(false);

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
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today's schedule
            </span>
            {jobsToday.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNearMe}
                disabled={locating}
                data-testid="button-near-me"
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <LocateFixed className="h-4 w-4 mr-1.5" />
                    {distances ? "Re-sort" : "Near me"}
                  </>
                )}
              </Button>
            )}
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
              {(distances
                ? [...jobsToday].sort(
                    (a, b) =>
                      (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity),
                  )
                : jobsToday
              ).map((job, index) => {
                const km = distances?.get(job.id);
                return (
                  <TodayJobCard
                    key={job.id}
                    job={job}
                    onOpen={handleJobClick}
                    distanceKm={km}
                    nearest={!!distances && index === 0 && km !== undefined}
                  />
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedJobId && (
        <GlobalJobCard
          isOpen={isJobCardOpen}
          onClose={handleCloseJobCard}
          mode="edit"
          jobId={selectedJobId}
        />
      )}
    </div>
  );
}

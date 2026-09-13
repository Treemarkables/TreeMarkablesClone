import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bug, Image as ImageIcon, Loader2, Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  bugReportSeverities,
  bugReportStatuses,
  type BugReport,
  type BugReportAttachment,
  type BugReportSeverity,
  type BugReportStatus,
} from "@shared/schema";

// Platform-operator triage view for in-app bug reports (cross-tenant; the
// server gates every route with requirePlatformAdmin). Deep-linkable via
// /admin/bug-reports?id=<reportId> — the alert email points here.

interface ReportRow extends BugReport {
  businessName: string | null;
  reporterName: string;
  reporterEmail: string | null;
  attachmentCount?: number;
}

interface ReportDetail extends ReportRow {
  attachments: BugReportAttachment[];
}

const STATUS_LABEL: Record<BugReportStatus, string> = {
  draft: "Draft",
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const SEVERITY_LABEL: Record<BugReportSeverity, string> = {
  blocker: "Blocker",
  major: "Major",
  minor: "Minor",
  idea: "Idea",
};

function severityVariant(s: string): "destructive" | "default" | "secondary" | "outline" {
  if (s === "blocker") return "destructive";
  if (s === "major") return "default";
  if (s === "idea") return "outline";
  return "secondary";
}

function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "";
  return new Date(v).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", dateStyle: "medium", timeStyle: "short" });
}

function useReportIdParam(): [string | null, (id: string | null) => void] {
  const [, setLocation] = useLocation();
  const read = () => new URLSearchParams(window.location.search).get("id");
  const [id, setId] = useState<string | null>(read);
  useEffect(() => {
    const onPop = () => setId(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const set = (next: string | null) => {
    setId(next);
    setLocation(next ? `/admin/bug-reports?id=${next}` : "/admin/bug-reports");
  };
  return [id, set];
}

function AttachmentView({ a }: { a: BugReportAttachment }) {
  if (a.kind === "photo") {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border" data-testid={`bug-attachment-photo-${a.id}`}>
        <img src={a.thumbnailUrl || a.url} alt={a.originalName || "Photo"} className="aspect-square w-full object-cover" loading="lazy" />
      </a>
    );
  }
  if (a.kind === "video") {
    return (
      <div className="col-span-2 sm:col-span-4 overflow-hidden rounded-md border border-border bg-black" data-testid={`bug-attachment-video-${a.id}`}>
        <video controls playsInline preload="metadata" src={a.url} className="max-h-[420px] w-full" />
      </div>
    );
  }
  return (
    <div className="col-span-2 sm:col-span-4 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2" data-testid={`bug-attachment-audio-${a.id}`}>
      <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
      <audio controls preload="metadata" src={a.url} className="h-9 min-w-0 flex-1" />
    </div>
  );
}

function ReportDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ success: boolean; data: ReportDetail }>({
    queryKey: [`/api/admin/bug-reports/${id}`],
  });
  const report = data?.data;
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setNotes(report?.operatorNotes ?? "");
  }, [report?.id, report?.operatorNotes]);

  const update = useMutation({
    mutationFn: async (patch: { status?: BugReportStatus; severity?: BugReportSeverity; operatorNotes?: string }) => {
      const r = await apiRequest("PATCH", `/api/admin/bug-reports/${id}`, patch);
      if (!r.ok) throw new Error("update failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/bug-reports/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bug-reports"] });
    },
    onError: () => toast({ variant: "destructive", title: "Couldn't update the report" }),
  });

  if (isLoading || !report) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const extra = (report.extraContext ?? {}) as { recentErrors?: { at: string; message: string }[]; language?: string; online?: boolean };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-bug-admin-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> All reports
        </Button>
        <div className="flex-1" />
        <Select value={report.severity} onValueChange={(v) => update.mutate({ severity: v as BugReportSeverity })}>
          <SelectTrigger className="w-[130px]" data-testid="select-bug-severity"><SelectValue /></SelectTrigger>
          <SelectContent>
            {bugReportSeverities.map((s) => <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={report.status} onValueChange={(v) => update.mutate({ status: v as BugReportStatus })}>
          <SelectTrigger className="w-[150px]" data-testid="select-bug-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {bugReportStatuses.filter((s) => s !== "draft").map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-xl font-semibold" data-testid="text-bug-title">{report.title || "(no title)"}</h2>
            <p className="text-sm text-muted-foreground">
              {report.reporterName || "Unknown"}{report.reporterEmail ? ` · ${report.reporterEmail}` : ""}{report.businessName ? ` · ${report.businessName}` : ""} · {fmtDate(report.submittedAt ?? report.createdAt)}
            </p>
          </div>

          {report.description && (
            <div>
              <Label className="text-muted-foreground">What happened</Label>
              <p className="mt-1 whitespace-pre-wrap" data-testid="text-bug-description">{report.description}</p>
            </div>
          )}

          {report.transcript && (
            <div>
              <Label className="text-muted-foreground">Voice note transcript</Label>
              <p className="mt-1 whitespace-pre-wrap" data-testid="text-bug-transcript">{report.transcript}</p>
            </div>
          )}

          {report.attachments.length > 0 && (
            <div>
              <Label className="text-muted-foreground">Attachments</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {report.attachments.map((a) => <AttachmentView key={a.id} a={a} />)}
              </div>
            </div>
          )}

          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <div><span className="font-medium text-foreground">Page:</span> {report.pageUrl || "-"}</div>
            <div><span className="font-medium text-foreground">Platform:</span> {report.platform || "-"} {report.screenSize ? `· ${report.screenSize}` : ""} {extra.language ? `· ${extra.language}` : ""} {extra.online === false ? "· offline at the time" : ""}</div>
            <div className="break-all"><span className="font-medium text-foreground">Device:</span> {report.userAgent || "-"}</div>
            {extra.recentErrors && extra.recentErrors.length > 0 && (
              <div>
                <span className="font-medium text-foreground">Recent errors:</span>
                <ul className="mt-1 list-disc pl-4 font-mono">
                  {extra.recentErrors.map((e, i) => <li key={i}>{e.at.slice(11, 19)} {e.message}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-notes">Operator notes</Label>
            <Textarea id="bug-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="textarea-bug-notes" />
            <Button
              size="sm"
              onClick={() => update.mutate({ operatorNotes: notes })}
              disabled={update.isPending || notes === (report.operatorNotes ?? "")}
              data-testid="button-bug-save-notes"
            >
              Save notes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BugReportsAdmin() {
  const [selectedId, setSelectedId] = useReportIdParam();
  const [status, setStatus] = useState<string>("active");
  const queryStatus = status === "active" ? "" : status;
  const { data, isLoading } = useQuery<{ success: boolean; data: ReportRow[] }>({
    queryKey: ["/api/admin/bug-reports", queryStatus],
    queryFn: async () => {
      const r = await fetch(`/api/admin/bug-reports${queryStatus ? `?status=${queryStatus}` : ""}`, { credentials: "include" });
      if (!r.ok) throw new Error("load failed");
      return r.json();
    },
  });
  const rows = (Array.isArray(data?.data) ? data!.data : []).filter((r) =>
    status === "active" ? r.status === "open" || r.status === "in_progress" : true,
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Bug className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-semibold flex-1">Bug reports</h1>
      </div>

      {selectedId ? (
        <ReportDetailView id={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ["active", "Active"],
              ["open", "Open"],
              ["in_progress", "In progress"],
              ["resolved", "Resolved"],
              ["closed", "Closed"],
            ].map(([v, label]) => (
              <Button key={v} size="sm" variant={status === v ? "default" : "outline"} onClick={() => setStatus(v)} data-testid={`button-bug-filter-${v}`}>
                {label}
              </Button>
            ))}
          </div>

          {isLoading && (
            <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          )}

          {!isLoading && rows.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No reports here.</CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="w-full rounded-lg border border-border bg-card p-3 text-left"
                data-testid={`bug-report-row-${r.id}`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={severityVariant(r.severity)}>{SEVERITY_LABEL[r.severity as BugReportSeverity] ?? r.severity}</Badge>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.title || r.description.slice(0, 80) || r.transcript?.slice(0, 80) || "(no text)"}</span>
                  <Badge variant="outline">{STATUS_LABEL[r.status as BugReportStatus] ?? r.status}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{r.reporterName || "Unknown"}{r.businessName ? ` · ${r.businessName}` : ""}</span>
                  <span>{fmtDate(r.submittedAt ?? r.createdAt)}</span>
                  {r.platform && <span>{r.platform}</span>}
                  {(r.attachmentCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /><Video className="h-3 w-3" /><Mic className="h-3 w-3" /> {r.attachmentCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { AlertTriangle, Plus, Download, Filter, Search, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 as Spinner } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { NearMissReport, NearMissWitness, NearMissAction, NearMissAttachment } from "@shared/schema";

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800",
  in_review: "bg-purple-100 text-purple-800",
  actioned: "bg-green-100 text-green-800",
  closed: "bg-zinc-100 text-zinc-800",
};

const CATEGORY_LABEL: Record<string, string> = {
  struck_by: "Struck By",
  fall_from_height: "Fall from Height",
  electrical: "Electrical",
  cut_laceration: "Cut / Laceration",
  vehicle: "Vehicle",
  public_safety: "Public Safety",
  drop_zone_breach: "Drop Zone Breach",
  equipment_failure: "Equipment Failure",
  manual_handling: "Manual Handling",
  other: "Other",
};

interface ReportDetail extends NearMissReport {
  witnesses: NearMissWitness[];
  actions: NearMissAction[];
  attachments: NearMissAttachment[];
}

export default function NearMissHistory() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState(false);

  // Build query string
  const params = new URLSearchParams();
  if (filterStatus !== "all") params.set("status", filterStatus);
  if (filterSeverity !== "all") params.set("severity", filterSeverity);
  if (filterCategory !== "all") params.set("category", filterCategory);
  const queryString = params.toString();

  const { data, isLoading } = useQuery<{ success: boolean; data: NearMissReport[] }>({
    queryKey: [`/api/near-miss-reports${queryString ? `?${queryString}` : ""}`],
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<{ success: boolean; data: ReportDetail }>({
    queryKey: [`/api/near-miss-reports/${selectedId}`],
    enabled: !!selectedId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/near-miss-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/near-miss-reports"] });
      toast({ title: "Draft deleted" });
    },
  });

  const closeActionMutation = useMutation({
    mutationFn: ({ reportId }: { reportId: string }) =>
      apiRequest("PUT", `/api/near-miss-reports/${reportId}`, { status: "closed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/near-miss-reports"] });
      queryClient.invalidateQueries({ queryKey: [`/api/near-miss-reports/${selectedId}`] });
      toast({ title: "Report closed" });
    },
  });

  const reports = data?.data ?? [];

  const filtered = reports.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.reportNumber.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  const detail = detailData?.data;

  const handleDownloadPdf = (id: string, reportNumber: string) => {
    const a = document.createElement("a");
    a.href = `/api/near-miss-reports/${id}/pdf`;
    a.download = `near-miss-${reportNumber}.pdf`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 text-amber-600 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <h1 className="text-xl font-semibold">Near Miss Reports</h1>
        </div>
        <Button
          onClick={() => navigate("/near-miss-report")}
          className="bg-amber-500 text-white hover:bg-amber-600"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Report
        </Button>
      </div>

      {/* Search & Filter bar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by number, category, description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(f => !f)}
            className={showFilters ? "bg-amber-50 border-amber-200" : ""}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-3 gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{reports.length === 0 ? "No near miss reports yet." : "No reports match your filters."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card
              key={r.id}
              className="cursor-pointer hover-elevate"
              onClick={() => setSelectedId(r.id)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{r.reportNumber}</span>
                      <Badge className={SEVERITY_BADGE[r.potentialSeverity] ?? ""}>{r.potentialSeverity}</Badge>
                      <Badge className={STATUS_BADGE[r.status] ?? ""}>{r.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CATEGORY_LABEL[r.category] ?? r.category} &middot;{" "}
                      {format(new Date(r.incidentDatetime), "dd MMM yyyy, HH:mm")}
                    </p>
                    <p className="text-sm mt-1 line-clamp-1 text-muted-foreground">{r.description}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={e => { e.stopPropagation(); handleDownloadPdf(r.id, r.reportNumber); }}
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {detail?.reportNumber ?? "Loading…"}
            </DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 pb-4">
                {/* Metadata row */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={SEVERITY_BADGE[detail.potentialSeverity] ?? ""}>{detail.potentialSeverity}</Badge>
                  <Badge className={STATUS_BADGE[detail.status] ?? ""}>{detail.status.replace("_", " ")}</Badge>
                  <span className="text-sm text-muted-foreground">{CATEGORY_LABEL[detail.category] ?? detail.category}</span>
                  <span className="text-sm text-muted-foreground">{format(new Date(detail.incidentDatetime), "dd MMM yyyy, HH:mm")}</span>
                </div>

                {detail.locationAddress && (
                  <p className="text-sm text-muted-foreground">{detail.locationAddress}</p>
                )}

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{detail.description}</p>
                </div>

                {detail.immediateActionTaken && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Immediate Action</p>
                    <p className="text-sm">{detail.immediateActionTaken}</p>
                  </div>
                )}

                {detail.proposedControl && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Proposed Control</p>
                    <p className="text-sm">{detail.proposedControl}</p>
                  </div>
                )}

                {(detail.equipmentInvolved?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Equipment Involved</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.equipmentInvolved!.map(e => <Badge key={e} variant="secondary">{e}</Badge>)}
                    </div>
                  </div>
                )}

                {(detail.contributingFactors?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Contributing Factors</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.contributingFactors!.map(f => <Badge key={f} variant="outline">{f}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {detail.actions.length > 0 && (
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2"
                      onClick={() => setExpandedActions(v => !v)}
                    >
                      Corrective Actions ({detail.actions.length})
                      {expandedActions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {expandedActions && detail.actions.map(a => (
                      <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-md border bg-muted/30 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.title}</p>
                          {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {a.controlType && <Badge variant="outline" className="text-xs">{a.controlType}</Badge>}
                            <Badge variant="outline" className="text-xs">{a.status}</Badge>
                            {a.dueDate && <span className="text-xs text-muted-foreground">Due {format(new Date(a.dueDate), "dd MMM yyyy")}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Witnesses */}
                {detail.witnesses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Witnesses</p>
                    {detail.witnesses.map(w => (
                      <div key={w.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-muted/30 mb-2">
                        <span className="text-sm">{w.witnessName || "Staff member"}</span>
                        <Badge variant={w.status === "signed" ? "default" : "outline"} className="text-xs">
                          {w.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Toolbox talk flag */}
                {detail.toolboxTalkFlag && (
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-sm text-amber-800">Flagged for toolbox talk discussion</span>
                  </div>
                )}

                {/* Effectiveness review */}
                {detail.effectivenessReviewDate && (
                  <div className="text-sm text-muted-foreground">
                    Effectiveness review due: {format(new Date(detail.effectivenessReviewDate), "dd MMM yyyy")}
                    {detail.effectivenessReviewComplete && <Badge className="ml-2 bg-green-100 text-green-800">Complete</Badge>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(detail.id, detail.reportNumber)}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download PDF
                  </Button>

                  {detail.status === "draft" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedId(null); navigate(`/near-miss-report/${detail.id}`); }}
                      >
                        Edit Draft
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { deleteMutation.mutate(detail.id); setSelectedId(null); }}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        Delete Draft
                      </Button>
                    </>
                  )}

                  {(detail.status === "actioned" || detail.status === "in_review") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => closeActionMutation.mutate({ reportId: detail.id })}
                      disabled={closeActionMutation.isPending}
                    >
                      {closeActionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Mark Closed
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

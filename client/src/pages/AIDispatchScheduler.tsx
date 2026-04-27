import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import {
  Bot, Calendar, CheckCircle2, XCircle, AlertTriangle,
  DollarSign, Users, Wrench, RefreshCw, ArrowRight, ChevronRight, Shield, Clock, ListOrdered
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface ProposedJob {
  jobId: string;
  jobNumber: string;
  title: string;
  address: string;
  revenue: number;
  estimatedDuration: number;
  proposedStartTime: string;
  proposedEndTime: string;
  assignedStaffIds: string[];
  assignedStaffNames: string[];
  equipmentNeeded: string[];
  licenceMatches: { equipment: string; licence: string; heldBy: string }[];
  conflicts: string[];
}

interface ScheduleAlternative {
  rank: number;
  label: string;
  summaryNote: string;
  totalRevenue: number;
  meetsTarget: boolean;
  conflicts: string[];
  proposedJobs: ProposedJob[];
}

interface ScheduleResponse {
  alternatives: ScheduleAlternative[];
  revenueTarget: number;
  targetDate: string;
  generatedAt: string;
}

export default function AIDispatchScheduler() {
  const { toast } = useToast();
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [targetDate, setTargetDate] = useState(tomorrow);
  const [overrideTarget, setOverrideTarget] = useState("");
  const [scheduleResponse, setScheduleResponse] = useState<ScheduleResponse | null>(null);
  const [selectedAltIndex, setSelectedAltIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  // Editable times: maps jobId → { start, end } — owner can adjust before confirming
  const [editedTimes, setEditedTimes] = useState<Record<string, { start: string; end: string }>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { data: settingsData } = useQuery<{ success: boolean; data: { dailyRevenueTarget?: string } }>({
    queryKey: ["/api/business-settings"],
  });
  const defaultTarget = Number(settingsData?.data?.dailyRevenueTarget) || 3500;

  const proposeMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/scheduling/propose", {
        targetDate,
        revenueTarget: overrideTarget ? Number(overrideTarget) : undefined,
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        setScheduleResponse(data.data);
        setSelectedAltIndex(0);
        setConfirmed(false);
        setEditedTimes({});
        setValidationErrors([]);
      } else {
        toast({ title: data.message || "Failed to generate proposal", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error generating schedule proposal", variant: "destructive" });
    },
  });

  const updateJobTime = (jobId: string, field: "start" | "end", value: string) => {
    const selectedAlt = scheduleResponse?.alternatives[selectedAltIndex];
    setEditedTimes(prev => ({
      ...prev,
      [jobId]: {
        start: prev[jobId]?.start ?? (selectedAlt?.proposedJobs.find(j => j.jobId === jobId)?.proposedStartTime ?? "08:00"),
        end: prev[jobId]?.end ?? (selectedAlt?.proposedJobs.find(j => j.jobId === jobId)?.proposedEndTime ?? "17:00"),
        [field]: value,
      },
    }));
  };

  const confirmMutation = useMutation({
    mutationFn: () => {
      const selectedAlt = scheduleResponse?.alternatives[selectedAltIndex];
      // Merge any owner-edited times into the selected alternative's proposed jobs
      const mergedJobs = (selectedAlt?.proposedJobs ?? []).map(pj => ({
        ...pj,
        proposedStartTime: editedTimes[pj.jobId]?.start ?? pj.proposedStartTime,
        proposedEndTime: editedTimes[pj.jobId]?.end ?? pj.proposedEndTime,
      }));
      return apiRequest("POST", "/api/scheduling/confirm", {
        targetDate: scheduleResponse?.targetDate,
        proposedJobs: mergedJobs,
      }).then(r => r.json());
    },
    onSuccess: (data) => {
      if (data.success) {
        setConfirmed(true);
        setValidationErrors([]);
        toast({
          title: `Schedule confirmed for ${format(new Date(targetDate), "EEEE dd MMM")}`,
          description: `${data.data.updatedJobs} jobs scheduled, ${data.data.draftMessages} customer messages queued for approval`,
        });
      } else if (data.validationErrors?.length) {
        setValidationErrors(data.validationErrors);
        toast({ title: "Constraint violations — review errors below", variant: "destructive" });
      } else {
        toast({ title: data.message || "Failed to confirm schedule", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error confirming schedule", variant: "destructive" });
    },
  });

  const effectiveTarget = overrideTarget ? Number(overrideTarget) : defaultTarget;
  const selectedAlt = scheduleResponse?.alternatives[selectedAltIndex];
  const pct = selectedAlt ? Math.min(100, Math.round((selectedAlt.totalRevenue / effectiveTarget) * 100)) : 0;

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">AI Smart Dispatch</h1>
          <p className="text-sm text-muted-foreground">GPT-4o generates ranked schedule alternatives matching crew licences to equipment</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="target-date" className="text-xs">Target Date</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="target-date"
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="w-40"
                  data-testid="input-target-date"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="revenue-override" className="text-xs">Revenue Target Override (NZD)</Label>
              <Input
                id="revenue-override"
                type="number"
                placeholder={`Default: $${defaultTarget.toLocaleString("en-NZ")}`}
                value={overrideTarget}
                onChange={e => setOverrideTarget(e.target.value)}
                className="w-52"
                data-testid="input-revenue-override"
              />
            </div>
            <Button
              onClick={() => proposeMutation.mutate()}
              disabled={proposeMutation.isPending}
              data-testid="button-generate-proposal"
            >
              {proposeMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analysing work orders...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  Generate Proposal
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Proposal results */}
      {scheduleResponse && scheduleResponse.alternatives.length > 0 && (
        <>
          {/* Alternative selector tabs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListOrdered className="w-4 h-4" />
              <span className="font-medium">{scheduleResponse.alternatives.length} ranked alternatives generated — select one to confirm</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {scheduleResponse.alternatives.map((alt, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSelectedAltIndex(idx); setEditedTimes({}); setValidationErrors([]); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    selectedAltIndex === idx
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span className="text-xs opacity-70">#{alt.rank}</span>
                  {alt.label}
                  <Badge variant={alt.meetsTarget ? "default" : "secondary"} className="text-xs ml-1">
                    ${alt.totalRevenue.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}
                  </Badge>
                  {alt.conflicts?.length > 0 && (
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedAlt && (
            <>
              {/* Selected alternative summary */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Rank #{selectedAlt.rank} — {selectedAlt.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(targetDate + "T12:00:00"), "EEEE dd MMMM yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold text-lg">
                        ${selectedAlt.totalRevenue.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-muted-foreground">
                        / ${effectiveTarget.toLocaleString("en-NZ")} target
                      </span>
                      <Badge variant={selectedAlt.meetsTarget ? "default" : "secondary"}>
                        {pct}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <p className="text-sm text-muted-foreground">{selectedAlt.summaryNote}</p>
                </CardContent>
              </Card>

              {/* Server-side validation errors (from confirm endpoint) */}
              {validationErrors.length > 0 && (
                <Card className="border-red-300 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Schedule Not Saved — Constraint Violations ({validationErrors.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-red-600 mb-2">Fix the issues below, adjust start/end times, or select a different alternative.</p>
                    <ul className="space-y-1">
                      {validationErrors.map((e, i) => (
                        <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-1 flex-shrink-0" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* AI-detected conflicts */}
              {selectedAlt.conflicts && selectedAlt.conflicts.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      AI-Detected Conflicts ({selectedAlt.conflicts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1">
                      {selectedAlt.conflicts.map((c, i) => (
                        <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                          <XCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Proposed jobs */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Proposed Jobs ({selectedAlt.proposedJobs?.length ?? 0}) — edit start/end times if needed
                </h2>
                {(selectedAlt.proposedJobs ?? []).map((job, idx) => (
                  <Card key={job.jobId || idx} className={job.conflicts?.length > 0 ? "border-red-200" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">#{job.jobNumber}</span>
                            <span className="font-semibold text-sm truncate">{job.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{job.address}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <input
                              type="time"
                              value={editedTimes[job.jobId]?.start ?? job.proposedStartTime}
                              onChange={e => updateJobTime(job.jobId, "start", e.target.value)}
                              className="border rounded px-1 py-0.5 text-xs bg-background text-foreground w-20"
                              title="Start time"
                            />
                            <span>–</span>
                            <input
                              type="time"
                              value={editedTimes[job.jobId]?.end ?? job.proposedEndTime}
                              onChange={e => updateJobTime(job.jobId, "end", e.target.value)}
                              className="border rounded px-1 py-0.5 text-xs bg-background text-foreground w-20"
                              title="End time"
                            />
                          </div>
                          <span className="font-bold text-sm text-green-700">
                            ${job.revenue.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* Crew */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-muted-foreground font-medium">
                            <Users className="w-3 h-3" /> Crew
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(job.assignedStaffNames ?? []).map(name => (
                              <Badge key={name} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                            {!job.assignedStaffNames?.length && (
                              <span className="text-muted-foreground italic">No crew assigned</span>
                            )}
                          </div>
                        </div>

                        {/* Equipment */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-muted-foreground font-medium">
                            <Wrench className="w-3 h-3" /> Equipment
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(job.equipmentNeeded ?? []).map(eq => (
                              <Badge key={eq} variant="outline" className="text-xs">
                                {eq}
                              </Badge>
                            ))}
                            {!job.equipmentNeeded?.length && (
                              <span className="text-muted-foreground italic">None specified</span>
                            )}
                          </div>
                        </div>

                        {/* Licence matches */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-muted-foreground font-medium">
                            <Shield className="w-3 h-3" /> Licence Checks
                          </div>
                          <div className="flex flex-col gap-1">
                            {(job.licenceMatches ?? []).map((lm, li) => (
                              <div key={li} className="flex items-center gap-1 text-green-700">
                                <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                                <span>{lm.equipment} <ArrowRight className="w-3 h-3 inline" /> {lm.heldBy}</span>
                              </div>
                            ))}
                            {!job.licenceMatches?.length && (
                              <span className="text-muted-foreground italic">No special licences needed</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Per-job conflicts */}
                      {job.conflicts?.length > 0 && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-2 space-y-1">
                          {job.conflicts.map((c, ci) => (
                            <p key={ci} className="text-xs text-red-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              {c}
                            </p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Action bar */}
              {!confirmed && (
                <Card className="sticky bottom-4 z-10 shadow-lg">
                  <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <span className="font-semibold">{selectedAlt.proposedJobs?.length ?? 0} jobs</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-green-700 font-semibold">
                        ${selectedAlt.totalRevenue.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} NZD
                      </span>
                      <span className="text-muted-foreground ml-1">scheduled revenue</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-muted-foreground font-medium">{selectedAlt.label}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => proposeMutation.mutate()}
                        disabled={proposeMutation.isPending || confirmMutation.isPending}
                        data-testid="button-repropose"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Re-propose
                      </Button>
                      <Button
                        onClick={() => confirmMutation.mutate()}
                        disabled={confirmMutation.isPending || !selectedAlt.proposedJobs?.length}
                        data-testid="button-confirm-schedule"
                      >
                        {confirmMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Confirming...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Confirm Schedule
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {confirmed && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">Schedule confirmed ({selectedAlt.label})</p>
                      <p className="text-sm text-green-700">
                        Jobs have been scheduled for {format(new Date(targetDate + "T12:00:00"), "EEEE dd MMM")}. Customer confirmation messages are waiting in the <a href="/communications?tab=pending" className="underline font-medium">Pending Messages</a> queue for your approval.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Empty state */}
      {!scheduleResponse && !proposeMutation.isPending && (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">No proposal yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Select a date and click "Generate Proposal" to have the AI analyse your work orders, crew licences and equipment requirements. Three ranked alternatives will be generated.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md text-left mt-2">
              {[
                { icon: DollarSign, label: "Revenue optimised", desc: "Picks jobs to hit your daily target" },
                { icon: Shield, label: "Licence matching", desc: "Checks crew have required tickets" },
                { icon: Users, label: "Ranked alternatives", desc: "3 different schedule options to choose from" },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                  <item.icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {proposeMutation.isPending && (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div>
              <p className="font-semibold">Generating ranked alternatives...</p>
              <p className="text-sm text-muted-foreground mt-1">
                GPT-4o is analysing your work orders, crew licences, and equipment requirements to generate 3 ranked schedule options.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

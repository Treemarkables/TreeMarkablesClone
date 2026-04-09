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
  DollarSign, Users, Wrench, RefreshCw, ArrowRight, ChevronRight, Shield
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

interface ScheduleProposal {
  proposedJobs: ProposedJob[];
  totalRevenue: number;
  revenueTarget: number;
  meetsTarget: boolean;
  summaryNote: string;
  conflicts: string[];
  targetDate: string;
  generatedAt: string;
}

export default function AIDispatchScheduler() {
  const { toast } = useToast();
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [targetDate, setTargetDate] = useState(tomorrow);
  const [overrideTarget, setOverrideTarget] = useState("");
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null);
  const [confirmed, setConfirmed] = useState(false);

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
        setProposal(data.data);
        setConfirmed(false);
      } else {
        toast({ title: data.message || "Failed to generate proposal", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error generating schedule proposal", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/scheduling/confirm", {
        targetDate: proposal?.targetDate,
        proposedJobs: proposal?.proposedJobs,
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        setConfirmed(true);
        toast({
          title: `Schedule confirmed for ${format(new Date(targetDate), "EEEE dd MMM")}`,
          description: `${data.data.updatedJobs} jobs scheduled, ${data.data.draftMessages} customer messages queued for approval`,
        });
      } else {
        toast({ title: data.message || "Failed to confirm schedule", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error confirming schedule", variant: "destructive" });
    },
  });

  const effectiveTarget = overrideTarget ? Number(overrideTarget) : defaultTarget;
  const pct = proposal ? Math.min(100, Math.round((proposal.totalRevenue / effectiveTarget) * 100)) : 0;

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Smart Dispatch</h1>
          <p className="text-muted-foreground text-sm">
            AI-powered schedule proposals that match crew licences to equipment requirements
          </p>
        </div>
      </div>

      {/* Proposal form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Generate Schedule Proposal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-date">Target Date</Label>
              <Input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                data-testid="input-target-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue-override">
                Revenue Target (NZD)
                <span className="text-muted-foreground ml-1 text-xs">— default: ${defaultTarget.toLocaleString()}</span>
              </Label>
              <Input
                id="revenue-override"
                type="number"
                placeholder={`$${defaultTarget.toLocaleString()}`}
                value={overrideTarget}
                onChange={e => setOverrideTarget(e.target.value)}
                data-testid="input-revenue-override"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => proposeMutation.mutate()}
              disabled={proposeMutation.isPending || !targetDate}
              data-testid="button-generate-proposal"
            >
              {proposeMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  AI is thinking...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  Generate Proposal
                </>
              )}
            </Button>
            {proposal && !confirmed && (
              <span className="text-xs text-muted-foreground">
                Generated {format(new Date(proposal.generatedAt), "HH:mm")}
              </span>
            )}
          </div>

          {proposeMutation.isPending && (
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground animate-pulse">
              Analysing {format(new Date(targetDate), "EEEE dd MMM")} work orders, crew licences and equipment requirements...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proposal results */}
      {proposal && (
        <>
          {/* Summary bar */}
          <Card className={proposal.meetsTarget ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {proposal.meetsTarget ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <span className="font-semibold text-sm">
                    {format(new Date(targetDate + "T12:00:00"), "EEEE dd MMMM yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-lg">
                    ${proposal.totalRevenue.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-muted-foreground">
                    / ${effectiveTarget.toLocaleString("en-NZ")} target
                  </span>
                  <Badge variant={proposal.meetsTarget ? "default" : "secondary"}>
                    {pct}%
                  </Badge>
                </div>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="text-sm text-muted-foreground">{proposal.summaryNote}</p>
            </CardContent>
          </Card>

          {/* Conflicts */}
          {proposal.conflicts && proposal.conflicts.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Scheduling Conflicts ({proposal.conflicts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1">
                  {proposal.conflicts.map((c, i) => (
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
              Proposed Jobs ({proposal.proposedJobs?.length ?? 0})
            </h2>
            {(proposal.proposedJobs ?? []).map((job, idx) => (
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {job.proposedStartTime} – {job.proposedEndTime}
                      </Badge>
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
                  <span className="font-semibold">{proposal.proposedJobs?.length ?? 0} jobs</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-green-700 font-semibold">
                    ${proposal.totalRevenue.toLocaleString("en-NZ", { maximumFractionDigits: 0 })} NZD
                  </span>
                  <span className="text-muted-foreground ml-1">scheduled revenue</span>
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
                    disabled={confirmMutation.isPending || !proposal.proposedJobs?.length}
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
                  <p className="font-semibold text-green-800">Schedule confirmed</p>
                  <p className="text-sm text-green-700">
                    Jobs have been scheduled for {format(new Date(targetDate + "T12:00:00"), "EEEE dd MMM")}. Customer confirmation messages are waiting in the <a href="/communications?tab=pending" className="underline font-medium">Pending Messages</a> queue for your approval.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty state */}
      {!proposal && !proposeMutation.isPending && (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">No proposal yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Select a date and click "Generate Proposal" to have the AI analyse your work orders, crew licences and equipment requirements.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md text-left mt-2">
              {[
                { icon: DollarSign, label: "Revenue optimised", desc: "Picks jobs to hit your daily target" },
                { icon: Shield, label: "Licence matching", desc: "Checks crew have required tickets" },
                { icon: Users, label: "No double-booking", desc: "Staff and equipment conflict checks" },
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
    </div>
  );
}

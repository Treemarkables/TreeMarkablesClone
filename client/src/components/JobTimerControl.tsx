/**
 * Live job timer — clock in / clock out on a job from the job card.
 *
 * Rendered inside JobDetailsPanel, so it appears on both JobCardMobile and
 * JobCardDesktop. One running timer per staff member (enforced server-side);
 * if the user's timer is running on a different job this offers a one-tap
 * "stop & start here" switch. Stopping writes a staffTimeEntries entry via
 * POST /api/timer/stop, which also recomputes labour cost, back-costing and
 * gross margin server-side.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RunningTimer {
  id: string;
  jobId: string;
  startedAt: string;
  jobNumber: number | null;
  jobTitle: string | null;
}

function formatElapsed(startedAt: string): string {
  const totalSec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function JobTimerControl({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: timerResp } = useQuery<{ data: RunningTimer | null }>({
    queryKey: ["/api/timer/current"],
    staleTime: 15_000,
  });
  const timer = timerResp?.data ?? null;
  const runningHere = !!timer && timer.jobId === jobId;
  const runningElsewhere = !!timer && timer.jobId !== jobId;

  // 1s ticker while a timer is running on this job.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!runningHere) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [runningHere]);

  const invalidateAfterChange = (affectedJobId: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/timer/current"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", affectedJobId] });
    queryClient.invalidateQueries({ queryKey: ["time-entries", affectedJobId] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", affectedJobId, "back-costing"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", affectedJobId, "diary-timeline"] });
  };

  const startMutation = useMutation({
    mutationFn: async (opts: { switch?: boolean }) =>
      apiRequest("POST", `/api/jobs/${jobId}/timer/start`, opts),
    onSuccess: () => {
      // A switch also finalized the old job's timer — refresh that job too.
      if (timer && timer.jobId !== jobId) invalidateAfterChange(timer.jobId);
      invalidateAfterChange(jobId);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timer/current"] });
      toast({
        title: "Couldn't start timer",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/timer/stop", {}),
    onSuccess: () => invalidateAfterChange(timer?.jobId ?? jobId),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timer/current"] });
      toast({
        title: "Couldn't stop timer",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const pending = startMutation.isPending || stopMutation.isPending;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
      data-testid="job-timer-control"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`h-9 w-9 rounded-full grid place-items-center flex-shrink-0 ${
            runningHere ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
          }`}
        >
          <Timer className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {runningHere ? (
            <>
              <div className="text-sm font-semibold tabular-nums" data-testid="timer-elapsed">
                {formatElapsed(timer!.startedAt)}
              </div>
              <div className="text-xs text-muted-foreground">Timer running on this job</div>
            </>
          ) : runningElsewhere ? (
            <>
              <div className="text-sm font-semibold truncate">
                Running on Job {timer!.jobNumber ?? ""}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {formatElapsed(timer!.startedAt)} elapsed
                {timer!.jobTitle ? ` — ${timer!.jobTitle}` : ""}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">Job timer</div>
              <div className="text-xs text-muted-foreground">
                Time is added to this job's labour on stop
              </div>
            </>
          )}
        </div>
      </div>

      {runningHere ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => stopMutation.mutate()}
          disabled={pending}
          data-testid="button-timer-stop"
        >
          {stopMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Square className="h-4 w-4 mr-1.5" />
              Stop
            </>
          )}
        </Button>
      ) : runningElsewhere ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => startMutation.mutate({ switch: true })}
          disabled={pending}
          data-testid="button-timer-switch"
        >
          {startMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Stop & start here"
          )}
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => startMutation.mutate({})}
          disabled={pending}
          data-testid="button-timer-start"
        >
          {startMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Play className="h-4 w-4 mr-1.5" />
              Start
            </>
          )}
        </Button>
      )}
    </div>
  );
}

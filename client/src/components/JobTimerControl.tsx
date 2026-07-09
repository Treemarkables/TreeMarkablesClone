/**
 * Live job timer — clock in / clock out on a job from the job card.
 *
 * Rendered inside JobDetailsPanel, so it appears on both JobCardMobile and
 * JobCardDesktop. Start opens a staff picker (checkbox list) so a foreman
 * can clock the whole crew in at once; each running timer is listed with
 * its own elapsed clock and Stop button, plus "Stop all" for end of day.
 *
 * One running timer per staff member (DB-enforced). Picking someone who is
 * clocked in on a different job shows an "on Job #N" badge — starting them
 * here finalizes that other timer first (server-side stop-and-switch).
 * Stopping writes a staffTimeEntries entry and recomputes labour cost,
 * back-costing and gross margin server-side.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Square, Timer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RunningTimer {
  id: string;
  jobId: string;
  employeeId: string;
  employeeName: string;
  startedAt: string;
  jobNumber?: number | null;
}

interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
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
  const { currentUser } = useAuth();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Timers running on THIS job — the card's main state.
  const { data: timersResp } = useQuery<{ data: RunningTimer[] }>({
    queryKey: ["/api/jobs", jobId, "timers"],
    enabled: !!jobId,
    staleTime: 15_000,
  });
  const timers = timersResp?.data ?? [];

  // Staff list + business-wide running timers — only fetched while the
  // picker is open (badges for people already clocked in elsewhere).
  const { data: employeesResp } = useQuery<{ data: EmployeeRow[] }>({
    queryKey: ["/api/employees"],
    enabled: pickerOpen,
    staleTime: 60_000,
  });
  const { data: activeResp } = useQuery<{ data: RunningTimer[] }>({
    queryKey: ["/api/timers/active"],
    enabled: pickerOpen,
    staleTime: 15_000,
  });
  const employees = (employeesResp?.data ?? []).filter((e) => e.isActive !== false);
  const activeTimers = activeResp?.data ?? [];
  const timerByEmployee = new Map(activeTimers.map((t) => [t.employeeId, t]));

  // 1s ticker while anything is running here.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (timers.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timers.length]);

  // Pre-select the logged-in user when the picker opens.
  const openPicker = () => {
    const preset = new Set<string>();
    if (currentUser?.id && !timers.some((t) => t.employeeId === currentUser.id)) {
      preset.add(currentUser.id);
    }
    setSelectedIds(preset);
    setPickerOpen(true);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidateJob = (affectedJobId: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", affectedJobId] });
    queryClient.invalidateQueries({ queryKey: ["time-entries", affectedJobId] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", affectedJobId, "back-costing"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", affectedJobId, "diary-timeline"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", affectedJobId, "timers"] });
  };
  const invalidateTimers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "timers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/timers/active"] });
  };

  const startMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/timer/start`, { employeeIds });
      return (await res.json()) as { data?: { switchedJobIds?: string[] } };
    },
    onSuccess: (result) => {
      invalidateTimers();
      // Switched staff had timers finalized on other jobs — refresh those too.
      for (const switched of result?.data?.switchedJobIds ?? []) invalidateJob(switched);
      setPickerOpen(false);
    },
    onError: () => {
      invalidateTimers();
      toast({
        title: "Couldn't start timers",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (timerId: string) => apiRequest("POST", "/api/timer/stop", { timerId }),
    onSuccess: () => {
      invalidateJob(jobId);
      queryClient.invalidateQueries({ queryKey: ["/api/timers/active"] });
    },
    onError: () => {
      invalidateTimers();
      toast({
        title: "Couldn't stop timer",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const stopAllMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/jobs/${jobId}/timers/stop-all`, {}),
    onSuccess: () => {
      invalidateJob(jobId);
      queryClient.invalidateQueries({ queryKey: ["/api/timers/active"] });
    },
    onError: () => {
      invalidateTimers();
      toast({
        title: "Couldn't stop timers",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const anyPending = startMutation.isPending || stopMutation.isPending || stopAllMutation.isPending;

  return (
    <div
      className="rounded-lg border border-border bg-card px-4 py-3"
      data-testid="job-timer-control"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`h-9 w-9 rounded-full grid place-items-center flex-shrink-0 ${
              timers.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
            }`}
          >
            <Timer className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Job timer</div>
            <div className="text-xs text-muted-foreground">
              {timers.length === 0
                ? "Clock staff in — time lands in this job's labour on stop"
                : `${timers.length} ${timers.length === 1 ? "person" : "people"} clocked in`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {timers.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopAllMutation.mutate()}
              disabled={anyPending}
              data-testid="button-timer-stop-all"
            >
              {stopAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Stop all"
              )}
            </Button>
          )}
          <Button size="sm" onClick={openPicker} disabled={anyPending} data-testid="button-timer-start">
            <Play className="h-4 w-4 mr-1.5" />
            Start
          </Button>
        </div>
      </div>

      {/* Running timers on this job */}
      {timers.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {timers.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2"
              data-testid={`timer-row-${t.employeeId}`}
            >
              <span className="text-sm font-medium truncate">{t.employeeName}</span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatElapsed(t.startedAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => stopMutation.mutate(t.id)}
                  disabled={anyPending}
                  aria-label={`Stop timer for ${t.employeeName}`}
                  data-testid={`button-timer-stop-${t.employeeId}`}
                >
                  <Square className="h-4 w-4 text-red-600" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Staff picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clock in staff
            </DialogTitle>
            <DialogDescription>
              Select who is working on this job. Staff clocked in on another
              job will be switched here.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            <ul className="space-y-1">
              {employees.map((emp) => {
                const running = timerByEmployee.get(emp.id);
                const runningHere = running?.jobId === jobId;
                const name = `${emp.firstName} ${emp.lastName}`;
                return (
                  <li key={emp.id}>
                    <label
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${
                        runningHere ? "opacity-60" : "cursor-pointer hover:bg-muted/60"
                      }`}
                      data-testid={`picker-staff-${emp.id}`}
                    >
                      <Checkbox
                        checked={runningHere || selectedIds.has(emp.id)}
                        disabled={runningHere}
                        onCheckedChange={() => toggleSelected(emp.id)}
                      />
                      <span className="text-sm font-medium flex-1 truncate">{name}</span>
                      {runningHere ? (
                        <span className="text-xs text-emerald-600 font-medium flex-shrink-0">
                          Clocked in
                        </span>
                      ) : running ? (
                        <span className="text-xs text-amber-600 font-medium flex-shrink-0">
                          On Job {running.jobNumber ?? ""}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
              {employees.length === 0 && (
                <li className="text-sm text-muted-foreground px-3 py-4 text-center">
                  No active staff found
                </li>
              )}
            </ul>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPickerOpen(false)}
              disabled={startMutation.isPending}
              data-testid="button-picker-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => startMutation.mutate(Array.from(selectedIds))}
              disabled={selectedIds.size === 0 || startMutation.isPending}
              data-testid="button-picker-start"
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                `Start ${selectedIds.size || ""}`.trim()
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

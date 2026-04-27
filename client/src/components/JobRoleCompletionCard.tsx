import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";

type AssignmentRow = {
  id: string;
  jobId: string;
  employeeId: string;
  dayRole?: 'A' | 'B' | null;
  employeeName?: string;
};

interface RoleRowProps {
  role: 'A' | 'B';
  completed: boolean;
  ownerNames: string[];
  onToggle: (next: boolean) => void;
  pending: boolean;
}

function RoleRow({ role, completed, ownerNames, onToggle, pending }: RoleRowProps) {
  const ownerLabel = ownerNames.length > 0 ? ownerNames.join(', ') : '(no one assigned)';
  return (
    <label className="flex items-center gap-3 py-2 cursor-pointer select-none">
      <Checkbox
        checked={completed}
        disabled={pending}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={`Role ${role} complete`}
      />
      <span className="text-sm font-medium text-foreground">Role {role} complete</span>
      <span className="text-xs text-muted-foreground truncate">· {ownerLabel}</span>
    </label>
  );
}

export function JobRoleCompletionCard({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobResp } = useQuery<{ success: boolean; data: Job }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });
  const job = jobResp?.data;

  const { data: assignmentsResp } = useQuery<{ success: boolean; data: AssignmentRow[] }>({
    queryKey: ["/api/jobs", jobId, "staff-assignments"],
    enabled: !!jobId,
  });
  const assignments = assignmentsResp?.data ?? [];

  const ownersByRole = useMemo(() => {
    const a: string[] = [];
    const b: string[] = [];
    for (const row of assignments) {
      const name = (row.employeeName ?? '').trim();
      if (!name) continue;
      if (row.dayRole === 'A') a.push(name);
      else if (row.dayRole === 'B') b.push(name);
    }
    return { A: a, B: b };
  }, [assignments]);

  const mutation = useMutation({
    mutationFn: async (vars: { role: 'A' | 'B'; completed: boolean }) => {
      const res = await apiRequest('PATCH', `/api/jobs/${jobId}/role-completion`, vars);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/for-date"] });
    },
    onError: (e: Error) => toast({ title: 'Failed to update role completion', description: e.message, variant: 'destructive' }),
  });

  const aDone = !!job?.roleACompletedAt;
  const bDone = !!job?.roleBCompletedAt;

  return (
    <div className="bg-card border border-border rounded-lg p-3 mb-3">
      <h3 className="text-sm font-semibold mb-1 text-foreground">Role completion</h3>
      <p className="text-xs text-muted-foreground mb-1">
        Day roles are set on Staff Schedule. Tick when each role's tasks are done for this job.
      </p>
      <RoleRow
        role="A"
        completed={aDone}
        ownerNames={ownersByRole.A}
        pending={mutation.isPending}
        onToggle={(next) => mutation.mutate({ role: 'A', completed: next })}
      />
      <RoleRow
        role="B"
        completed={bDone}
        ownerNames={ownersByRole.B}
        pending={mutation.isPending}
        onToggle={(next) => mutation.mutate({ role: 'B', completed: next })}
      />
    </div>
  );
}

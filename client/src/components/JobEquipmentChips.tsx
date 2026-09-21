/**
 * Compact job-level heavy plant picker. Multi-select of the locked catalogue
 * (shared on the job, not per person). Persists to jobs.equipment so Today
 * kit chips read the same list.
 */
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  JOB_EQUIPMENT_CATALOGUE,
  sanitizeJobEquipment,
  toggleJobEquipment,
  type JobEquipmentLabel,
} from "@shared/jobEquipmentCatalogue";

interface JobQuery {
  success?: boolean;
  data?: { equipment?: string[] | null };
}

export function JobEquipmentChips({
  jobId,
  selected,
}: {
  jobId: string;
  selected: string[] | null | undefined;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const current = sanitizeJobEquipment(selected ?? []);
  const latestKey = useRef("");

  const save = useMutation({
    mutationFn: async (next: JobEquipmentLabel[]) => {
      const res = await apiRequest("PUT", `/api/jobs/${jobId}`, { equipment: next });
      return res.json();
    },
    onMutate: async (next) => {
      latestKey.current = next.join("|");
      await queryClient.cancelQueries({ queryKey: ["/api/jobs", jobId] });
      const previous = queryClient.getQueryData<JobQuery>(["/api/jobs", jobId]);
      queryClient.setQueryData<JobQuery>(["/api/jobs", jobId], (old) => {
        if (!old?.data) return old;
        return { ...old, data: { ...old.data, equipment: next } };
      });
      return { previous };
    },
    onError: (_err, next, context) => {
      if (latestKey.current !== next.join("|")) return;
      if (context?.previous) {
        queryClient.setQueryData(["/api/jobs", jobId], context.previous);
      }
      toast({
        title: "Could not save equipment",
        variant: "destructive",
      });
    },
    onSettled: (_data, _err, next) => {
      if (latestKey.current !== next.join("|")) return;
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/today-overview"] });
    },
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-4" data-testid="job-equipment">
      <div className="flex items-center gap-2 text-[14px] font-bold text-foreground mb-2">
        <span className="w-1 h-3.5 rounded-full bg-brand-lime" aria-hidden="true" />
        Equipment
      </div>
      <div className="flex flex-wrap gap-1.5">
        {JOB_EQUIPMENT_CATALOGUE.map((item) => {
          const active = current.includes(item.label);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              data-testid={`job-equipment-chip-${item.id}`}
              disabled={!jobId}
              onClick={() => {
                const fromCache = queryClient.getQueryData<JobQuery>(["/api/jobs", jobId])
                  ?.data?.equipment;
                const latest = sanitizeJobEquipment(fromCache ?? current);
                save.mutate(toggleJobEquipment(latest, item.label));
              }}
              className={
                active
                  ? "rounded-full px-2.5 py-1 text-xs font-semibold border border-brand-lime-border bg-brand-lime text-brand-lime-foreground hover-elevate disabled:opacity-60"
                  : "rounded-full px-2.5 py-1 text-xs font-semibold border border-border bg-card text-foreground hover-elevate disabled:opacity-60"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

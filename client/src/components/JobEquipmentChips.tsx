/**
 * Job level heavy plant picker inside the Internal Notes staff only card.
 * Selected kit sits on "Kit on this job". The rest of the locked catalogue
 * sits under "Also available". Persists to jobs.equipment so Today kit chips
 * read the same list.
 */
import { useRef } from "react";
import { Check, Plus } from "lucide-react";
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
  const availableRef = useRef<HTMLDivElement>(null);
  const current = sanitizeJobEquipment(selected ?? []);
  const latestKey = useRef("");
  const onKit = JOB_EQUIPMENT_CATALOGUE.filter((item) => current.includes(item.label));
  const available = JOB_EQUIPMENT_CATALOGUE.filter((item) => !current.includes(item.label));

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

  const toggle = (label: (typeof JOB_EQUIPMENT_CATALOGUE)[number]["label"]) => {
    const fromCache = queryClient.getQueryData<JobQuery>(["/api/jobs", jobId])?.data?.equipment;
    const latest = sanitizeJobEquipment(fromCache ?? current);
    save.mutate(toggleJobEquipment(latest, label));
  };

  return (
    <div data-testid="job-equipment">
      <div className="text-[13px] font-semibold text-foreground mb-2">Kit on this job</div>
      <div className="flex flex-wrap items-center gap-1.5" data-testid="job-equipment-kit">
        {onKit.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed="true"
            data-testid={`job-equipment-chip-${item.id}`}
            disabled={!jobId}
            onClick={() => toggle(item.label)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border border-brand-lime-border bg-brand-lime text-brand-lime-foreground hover-elevate disabled:opacity-60"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
            {item.label}
          </button>
        ))}
        <button
          type="button"
          data-testid="job-equipment-add"
          disabled={!jobId || available.length === 0}
          onClick={() => {
            const first = availableRef.current?.querySelector("button");
            if (first instanceof HTMLElement) first.focus();
          }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border border-orange/40 bg-orange/15 text-orange hover-elevate disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Add kit
        </button>
      </div>
      {available.length > 0 && (
        <div className="mt-3" ref={availableRef} data-testid="job-equipment-available">
          <div className="text-[12.5px] font-medium text-muted-foreground mb-2">Also available</div>
          <div className="flex flex-wrap gap-1.5">
            {available.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed="false"
                data-testid={`job-equipment-chip-${item.id}`}
                disabled={!jobId}
                onClick={() => toggle(item.label)}
                className="rounded-full px-3 py-1 text-xs font-semibold border border-foreground/80 bg-card text-foreground hover-elevate disabled:opacity-60"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

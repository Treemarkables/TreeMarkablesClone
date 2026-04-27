import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Shield,
  ClipboardCheck,
  TriangleAlert,
  Clock,
  Star,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatNZTime } from "@shared/dateUtils";

type ChecklistIcon = React.ComponentType<{ className?: string }>;

interface ChecklistItem {
  id: string;
  label: string;
  Icon: ChecklistIcon;
}

interface ChecklistCompletion {
  id: string;
  jobId: string;
  itemId: string;
  completedAt: string;
  completedByEmployeeId: string | null;
  completedByName: string | null;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: "risk-assessment", label: "Risk assessment", Icon: Shield },
  { id: "pre-start", label: "Pre-start", Icon: ClipboardCheck },
  { id: "signs-out", label: "Signs out", Icon: TriangleAlert },
  { id: "time-tracking", label: "Time tracking", Icon: Clock },
  { id: "review", label: "Review requested", Icon: Star },
];

export function JobChecklistPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const isTempJob = jobId.startsWith("temp-");

  const { data, isLoading } = useQuery<{
    success?: boolean;
    data?: ChecklistCompletion[];
  }>({
    queryKey: ["/api/jobs", jobId, "checklist"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/checklist`);
      if (!res.ok) throw new Error("Failed to load checklist");
      return res.json();
    },
    enabled: !isTempJob,
    staleTime: 30_000,
  });

  const completions = data?.data ?? [];
  const completionByItem = new Map(completions.map((c) => [c.itemId, c]));

  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      const res = await apiRequest(
        "POST",
        `/api/jobs/${jobId}/checklist/${itemId}`,
        { completed },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "checklist"] });
    },
  });

  const completedCount = CHECKLIST_ITEMS.filter((i) => completionByItem.has(i.id)).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className="p-4 w-full" data-testid="job-checklist-panel">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Job completion checklist
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tap a row to tick it off when the task is done.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/50 rounded-md mb-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">Progress</span>
          <span className="text-sm font-semibold text-foreground">
            {completedCount} of {totalCount}
          </span>
        </div>
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${percent}%`, backgroundColor: "#39FF14" }}
          />
        </div>
        <span className="text-sm font-semibold text-muted-foreground shrink-0 min-w-[40px] text-right">
          {percent}%
        </span>
      </div>

      {isTempJob ? (
        <div className="text-xs text-muted-foreground py-2">
          Save the job before ticking checklist items.
        </div>
      ) : isLoading ? (
        <div className="text-xs text-muted-foreground py-2">Loading checklist…</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {CHECKLIST_ITEMS.map((item) => {
            const completion = completionByItem.get(item.id) ?? null;
            return (
              <ChecklistRow
                key={item.id}
                item={item}
                completion={completion}
                disabled={toggleMutation.isPending}
                onToggle={() =>
                  toggleMutation.mutate({
                    itemId: item.id,
                    completed: !completion,
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  completion,
  disabled,
  onToggle,
}: {
  item: ChecklistItem;
  completion: ChecklistCompletion | null;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { id, label, Icon } = item;
  const completed = !!completion;

  const completedMeta = completion
    ? [
        completion.completedByName?.trim() || null,
        formatNZTime(completion.completedAt, "datetime"),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="flex items-start gap-3.5 p-4 bg-card border border-border rounded-lg transition-colors hover:bg-accent/30 text-left w-full disabled:opacity-60 disabled:cursor-not-allowed"
      data-testid={`checklist-item-${id}`}
      aria-pressed={completed}
    >
      <div className="shrink-0 mt-0.5">
        {completed ? (
          <div
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#39FF14" }}
          >
            <Check className="w-3 h-3" strokeWidth={3.5} style={{ color: "#000" }} />
          </div>
        ) : (
          <div className="w-[22px] h-[22px] rounded-full border-[1.5px] border-muted-foreground/40" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className="w-4 h-4 text-foreground shrink-0" />
          <span
            className={
              completed
                ? "text-[15px] font-semibold line-through text-muted-foreground"
                : "text-[15px] font-semibold text-foreground"
            }
          >
            {label}
          </span>
        </div>

        {completedMeta && (
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {completedMeta}
          </div>
        )}
      </div>
    </button>
  );
}

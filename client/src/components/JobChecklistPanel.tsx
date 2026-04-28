import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Shield,
  Camera,
  PhoneCall,
  TriangleAlert,
  ClipboardCheck,
  Clock,
  Star,
  Users,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatNZTime, getNZDateString } from "@shared/dateUtils";

type RoleKey = "A" | "B" | "C";
type ChecklistIcon = React.ComponentType<{ className?: string }>;
// Kaitiaki (C) leads, so it sits first in the buttons row and as the top role section.
const ROLE_KEYS: RoleKey[] = ["C", "A", "B"];

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

interface AssignmentRow {
  id: string;
  jobId: string;
  employeeId: string;
  employeeName?: string;
  startTime?: string;
  dayRole?: RoleKey | null;
}

const ROLE_LABEL: Record<RoleKey, string> = {
  A: "Kaiwhangai",
  B: "Kaitirotiro",
  C: "Kaitiaki",
};

const ROLE_ITEMS: Record<RoleKey, ChecklistItem[]> = {
  A: [
    { id: "risk-assessment", label: "Risk assessment", Icon: Shield },
    { id: "content-creation", label: "Content creation", Icon: Camera },
  ],
  B: [
    { id: "alert-customer-late", label: "Alert customer if running late", Icon: PhoneCall },
    { id: "signs-out", label: "Signs out", Icon: TriangleAlert },
    { id: "pre-start", label: "Pre-start", Icon: ClipboardCheck },
  ],
  C: [
    { id: "time-tracking", label: "Time tracking", Icon: Clock },
    { id: "review-request", label: "Request review from client", Icon: Star },
  ],
};

const ALL_ITEM_IDS = ROLE_KEYS.flatMap((r) => ROLE_ITEMS[r].map((i) => i.id));

export function JobChecklistPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const isTempJob = jobId.startsWith("temp-");

  const { data: completionsResp, isLoading: completionsLoading } = useQuery<{
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

  const { data: assignmentsResp, isLoading: assignmentsLoading } = useQuery<{
    success?: boolean;
    data?: AssignmentRow[];
  }>({
    queryKey: ["/api/jobs", jobId, "staff-assignments"],
    enabled: !isTempJob,
    staleTime: 30_000,
  });

  const completions = completionsResp?.data ?? [];
  const completionByItem = useMemo(
    () => new Map(completions.map((c) => [c.itemId, c])),
    [completions],
  );

  const assignments = assignmentsResp?.data ?? [];

  // Collapse to one row per employee on this job. Pick the earliest startTime so
  // the date for the day-role mutation lines up with when they actually start.
  const staffOnJob = useMemo(() => {
    const byEmp = new Map<string, AssignmentRow>();
    for (const row of assignments) {
      const existing = byEmp.get(row.employeeId);
      if (!existing) {
        byEmp.set(row.employeeId, row);
        continue;
      }
      const a = row.startTime ? new Date(row.startTime).getTime() : Infinity;
      const b = existing.startTime ? new Date(existing.startTime).getTime() : Infinity;
      if (a < b) byEmp.set(row.employeeId, row);
    }
    return Array.from(byEmp.values()).sort((x, y) =>
      (x.employeeName ?? "").localeCompare(y.employeeName ?? ""),
    );
  }, [assignments]);

  const staffByRole = useMemo(() => {
    const groups: Record<RoleKey, AssignmentRow[]> = { A: [], B: [], C: [] };
    for (const s of staffOnJob) {
      if (s.dayRole === "A" || s.dayRole === "B" || s.dayRole === "C") {
        groups[s.dayRole].push(s);
      }
    }
    return groups;
  }, [staffOnJob]);

  const setDayRole = useMutation({
    mutationFn: async (vars: { employeeId: string; date: string; dayRole: RoleKey | null }) => {
      const res = await apiRequest("PUT", "/api/staff-assignments/day-role", vars);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey)
          && q.queryKey[0] === "/api/jobs"
          && q.queryKey[2] === "staff-assignments",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
    },
  });

  const toggleItem = useMutation({
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

  const completedCount = ALL_ITEM_IDS.filter((id) => completionByItem.has(id)).length;
  const totalCount = ALL_ITEM_IDS.length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  if (isTempJob) {
    return (
      <div className="p-4 w-full" data-testid="job-checklist-panel">
        <div className="text-xs text-muted-foreground py-2">
          Save the job before assigning roles or ticking checklist items.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 w-full flex flex-col gap-5" data-testid="job-checklist-panel">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Job completion checklist
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Assign each crew member a role for the day, then tick off their tasks as they go.
          Roles carry across every job that day.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/50 rounded-md">
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

      <section data-testid="role-assignment-section">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Today's roles</h3>
        </div>
        {assignmentsLoading ? (
          <div className="text-xs text-muted-foreground py-2">Loading crew…</div>
        ) : staffOnJob.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            No crew assigned to this job yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {staffOnJob.map((s) => (
              <RoleAssignRow
                key={s.employeeId}
                staff={s}
                disabled={setDayRole.isPending}
                onSelect={(role) => {
                  const date = s.startTime
                    ? getNZDateString(s.startTime)
                    : getNZDateString(new Date());
                  const next = s.dayRole === role ? null : role;
                  setDayRole.mutate({ employeeId: s.employeeId, date, dayRole: next });
                }}
              />
            ))}
          </div>
        )}
      </section>

      {completionsLoading ? (
        <div className="text-xs text-muted-foreground py-2">Loading checklist…</div>
      ) : (
        <>
          {ROLE_KEYS.map((roleKey) => (
            <RoleSection
              key={roleKey}
              roleKey={roleKey}
              staffInRole={staffByRole[roleKey]}
              completionByItem={completionByItem}
              onToggle={(itemId, completed) => toggleItem.mutate({ itemId, completed })}
              disabled={toggleItem.isPending}
            />
          ))}
        </>
      )}
    </div>
  );
}

function RoleAssignRow({
  staff,
  disabled,
  onSelect,
}: {
  staff: AssignmentRow;
  disabled: boolean;
  onSelect: (role: RoleKey) => void;
}) {
  const name = (staff.employeeName ?? "").trim() || "Unknown crew";
  const role = staff.dayRole ?? null;
  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2 bg-card border border-border rounded-md"
      data-testid={`role-assign-row-${staff.employeeId}`}
    >
      <span className="text-sm font-medium text-foreground truncate">{name}</span>
      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
        {ROLE_KEYS.map((r) => {
          const active = role === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onSelect(r)}
              disabled={disabled}
              data-testid={`role-toggle-${staff.employeeId}-${r}`}
              aria-pressed={active}
              className={
                active
                  ? "px-2.5 py-1 rounded-md text-xs font-semibold border border-foreground bg-foreground text-background disabled:opacity-60"
                  : "px-2.5 py-1 rounded-md text-xs font-semibold border border-border bg-card text-foreground disabled:opacity-60"
              }
            >
              {ROLE_LABEL[r]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoleSection({
  roleKey,
  staffInRole,
  completionByItem,
  onToggle,
  disabled,
}: {
  roleKey: RoleKey;
  staffInRole: AssignmentRow[];
  completionByItem: Map<string, ChecklistCompletion>;
  onToggle: (itemId: string, completed: boolean) => void;
  disabled: boolean;
}) {
  const items = ROLE_ITEMS[roleKey];
  const ownerNames = staffInRole
    .map((s) => (s.employeeName ?? "").trim())
    .filter(Boolean);
  const hasOwner = ownerNames.length > 0;

  return (
    <section data-testid={`role-section-${roleKey}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">
          {ROLE_LABEL[roleKey]}
        </h3>
        {hasOwner ? (
          ownerNames.map((name) => (
            <span
              key={name}
              data-testid={`role-owner-${roleKey}-${name}`}
              className="text-xs font-semibold px-2 py-0.5 rounded-full border border-foreground/15 text-foreground"
              style={{ backgroundColor: "rgba(57,255,20,0.18)" }}
            >
              {name}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground italic">Unassigned</span>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const completion = completionByItem.get(item.id) ?? null;
          return (
            <ChecklistRow
              key={item.id}
              item={item}
              completion={completion}
              disabled={disabled}
              onToggle={() => onToggle(item.id, !completion)}
            />
          );
        })}
      </div>
    </section>
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

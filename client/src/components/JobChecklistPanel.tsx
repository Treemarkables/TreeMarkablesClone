import { useMemo, useState } from "react";
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
  UserPlus,
  MessageSquare,
  Bell,
  Mail,
  MapPin,
  Wrench,
  TreePine,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatNZTime, getNZDateString } from "@shared/dateUtils";
import type { RoleChecklistTask } from "@shared/schema";
import { ROLE_KEYS, ROLE_LABEL, type RoleKey } from "@/lib/crewRoles";
import { RoleChips } from "@/components/crew/RoleChips";
import { CrewPickerDialog } from "@/components/crew/CrewPickerDialog";

type ChecklistIcon = React.ComponentType<{ className?: string }>;

// Icon name → lucide component. Keep in sync with RoleChecklistSettings.tsx.
// Unknown names fall back to Check.
const ICON_BY_NAME: Record<string, ChecklistIcon> = {
  Check,
  Shield,
  Camera,
  PhoneCall,
  TriangleAlert,
  ClipboardCheck,
  Clock,
  Star,
  Users,
  MessageSquare,
  Bell,
  Mail,
  MapPin,
  Wrench,
  TreePine,
  AlertTriangle,
};

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

// One person on this job today, from /api/jobs/:id/crew-today. That endpoint unions
// rostered assignments with anyone clocked in, which is what stopped this section
// dead-ending at "No crew assigned" while three people stood on site.
interface CrewMember {
  employeeId: string;
  employeeName: string;
  dayRole: RoleKey | null;
  source: "assigned" | "clocked_in" | "worked";
  isClockedIn: boolean;
}

// Fallback used while the API call is loading or if it fails. Mirrors the
// seed data on the server so the panel never renders empty.
const FALLBACK_ROLE_ITEMS: Record<RoleKey, ChecklistItem[]> = {
  A: [
    { id: "risk-assessment", label: "Risk assessment", Icon: Shield },
    { id: "content-creation", label: "Content creation", Icon: Camera },
  ],
  B: [
    { id: "alert-customer-late", label: "Alert customer if running late", Icon: PhoneCall },
    { id: "signs-out", label: "Signs out", Icon: TriangleAlert },
    { id: "pre-start", label: "Pre-start", Icon: ClipboardCheck },
    { id: "day-progress-update", label: "Day progress update to Jules", Icon: MessageSquare },
  ],
  C: [
    { id: "time-tracking", label: "Time tracking", Icon: Clock },
    { id: "review-request", label: "Request review from client", Icon: Star },
  ],
};

export function JobChecklistPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isTempJob = jobId.startsWith("temp-");

  // Tasks are now driven by the role_checklist_tasks table so users can
  // toggle/edit/add them from Settings. While loading or on error we fall
  // back to the static defaults so the panel never goes empty.
  const { data: tasksResp } = useQuery<{
    success?: boolean;
    data?: RoleChecklistTask[];
  }>({
    queryKey: ["/api/role-checklist-tasks"],
    staleTime: 60_000,
  });

  const roleItems = useMemo<Record<RoleKey, ChecklistItem[]>>(() => {
    const tasks = tasksResp?.data;
    if (!tasks || tasks.length === 0) return FALLBACK_ROLE_ITEMS;
    const groups: Record<RoleKey, ChecklistItem[]> = { A: [], B: [], C: [] };
    const enabled = tasks
      .filter((t) => t.isEnabled && (t.roleKey === "A" || t.roleKey === "B" || t.roleKey === "C"))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const t of enabled) {
      groups[t.roleKey as RoleKey].push({
        id: t.itemId,
        label: t.label,
        Icon: ICON_BY_NAME[t.iconName] ?? Check,
      });
    }
    return groups;
  }, [tasksResp]);

  const allItemIds = useMemo(
    () => ROLE_KEYS.flatMap((r) => roleItems[r].map((i) => i.id)),
    [roleItems],
  );

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

  const { data: crewResp, isLoading: crewLoading } = useQuery<{
    success?: boolean;
    data?: { date: string; crew: CrewMember[] };
  }>({
    queryKey: ["/api/jobs", jobId, "crew-today"],
    enabled: !isTempJob,
    staleTime: 30_000,
  });

  const completions = completionsResp?.data ?? [];
  const completionByItem = useMemo(
    () => new Map(completions.map((c) => [c.itemId, c])),
    [completions],
  );

  // Already collapsed to one row per person and sorted by name server-side.
  const crew = crewResp?.data?.crew;
  const staffOnJob = useMemo(() => crew ?? [], [crew]);
  const crewDate = crewResp?.data?.date ?? getNZDateString(new Date());
  const crewIds = useMemo(
    () => new Set(staffOnJob.map((s) => s.employeeId)),
    [staffOnJob],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<RoleKey | null>(null);
  const openPicker = (role: RoleKey | null) => {
    setPickerRole(role);
    setPickerOpen(true);
  };

  const staffByRole = useMemo(() => {
    const groups: Record<RoleKey, CrewMember[]> = { A: [], B: [], C: [] };
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
          && (q.queryKey[2] === "staff-assignments" || q.queryKey[2] === "crew-today"),
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
      // The API wraps results in {success, data, message}; surface server-
      // reported failures (auth, validation) as exceptions so onError fires
      // and the user actually sees what's wrong instead of a silent no-op.
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      return json;
    },
    // Optimistic update: flip the local cache before the server replies so the
    // tick is instant. If the request fails, onError rolls back.
    onMutate: async ({ itemId, completed }) => {
      const key = ["/api/jobs", jobId, "checklist"];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{ success?: boolean; data?: ChecklistCompletion[] }>(key);
      const prevCompletions = prev?.data ?? [];
      const nextCompletions = completed
        ? [
            ...prevCompletions.filter((c) => c.itemId !== itemId),
            { itemId, completedAt: new Date().toISOString(), completedByName: null } as ChecklistCompletion,
          ]
        : prevCompletions.filter((c) => c.itemId !== itemId);
      queryClient.setQueryData(key, { success: true, data: nextCompletions });
      return { prev };
    },
    onError: (err: Error, _vars, ctx) => {
      // Roll back the optimistic update.
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(["/api/jobs", jobId, "checklist"], ctx.prev);
      }
      toast({
        title: "Couldn't update checklist",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "checklist"] });
    },
  });

  const completedCount = allItemIds.filter((id) => completionByItem.has(id)).length;
  const totalCount = allItemIds.length;
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
            className="h-full bg-green transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-muted-foreground shrink-0 min-w-[40px] text-right">
          {percent}%
        </span>
      </div>

      <section data-testid="role-assignment-section">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Today's roles</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => openPicker(null)}
            data-testid="add-crew"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Add crew
          </Button>
        </div>
        {crewLoading ? (
          <div className="text-xs text-muted-foreground py-2">Loading crew…</div>
        ) : staffOnJob.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            Nobody on this job today yet — add crew, or clock someone in.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {staffOnJob.map((s) => (
              <RoleAssignRow
                key={s.employeeId}
                staff={s}
                disabled={setDayRole.isPending}
                onSelect={(role) =>
                  setDayRole.mutate({
                    employeeId: s.employeeId,
                    date: crewDate,
                    dayRole: role,
                  })
                }
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
              items={roleItems[roleKey]}
              staffInRole={staffByRole[roleKey]}
              completionByItem={completionByItem}
              onAssign={() => openPicker(roleKey)}
              onToggle={(itemId, completed) => toggleItem.mutate({ itemId, completed })}
              disabled={toggleItem.isPending}
            />
          ))}
        </>
      )}

      <CrewPickerDialog
        jobId={jobId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingCrewIds={crewIds}
        defaultRole={pickerRole}
      />
    </div>
  );
}

function RoleAssignRow({
  staff,
  disabled,
  onSelect,
}: {
  staff: CrewMember;
  disabled: boolean;
  onSelect: (role: RoleKey | null) => void;
}) {
  const name = staff.employeeName.trim() || "Unknown crew";
  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2 bg-card border border-border rounded-md"
      data-testid={`role-assign-row-${staff.employeeId}`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{name}</span>
        {staff.isClockedIn && (
          <span className="text-[11px] text-emerald-600 font-medium shrink-0">
            On the clock
          </span>
        )}
      </span>
      <RoleChips
        value={staff.dayRole}
        onSelect={onSelect}
        disabled={disabled}
        testIdPrefix={`role-toggle-${staff.employeeId}`}
      />
    </div>
  );
}

function RoleSection({
  roleKey,
  items,
  staffInRole,
  completionByItem,
  onToggle,
  onAssign,
  disabled,
}: {
  roleKey: RoleKey;
  items: ChecklistItem[];
  staffInRole: CrewMember[];
  completionByItem: Map<string, ChecklistCompletion>;
  onToggle: (itemId: string, completed: boolean) => void;
  onAssign: () => void;
  disabled: boolean;
}) {
  const ownerNames = staffInRole
    .map((s) => s.employeeName.trim())
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
              className="text-xs font-semibold px-2 py-0.5 rounded-full border border-foreground/15 text-foreground bg-green/15"
            >
              {name}
            </span>
          ))
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={onAssign}
            data-testid={`role-assign-${roleKey}`}
          >
            Unassigned — assign
          </Button>
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
          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center bg-green">
            <Check className="w-3 h-3 text-green-foreground" strokeWidth={3.5} />
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

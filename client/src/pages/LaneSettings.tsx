import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Pencil, ArrowRight, X, Mail, MessageSquare, Sparkles,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type UserAutomationType = "customer_nudge" | "staff_reminder" | "auto_move" | "create_task" | "change_status" | "add_note" | "assign_staff";
type UserTrigger = "days_in_lane" | "on_enter" | "status_changed";

interface Lane { id: string; name: string; color: string; sortOrder: number; archived: boolean }
interface LaneAutomation {
  id: string;
  laneId: string;
  type: UserAutomationType | "auto_enter" | "auto_exit";
  trigger: UserTrigger | "quote_sent" | "job_created" | "quote_accepted" | "customer_replied";
  triggerDays: number | null;
  enabled: boolean;
  config: Record<string, any>;
}

const ENTRY_EVENTS = [
  { value: "manual", label: "Manually only" },
  { value: "quote_sent", label: "A quote is sent" },
  { value: "job_created", label: "A new lead is created" },
  { value: "quote_accepted", label: "A quote is accepted" },
  { value: "customer_replied", label: "The customer replies" },
  { value: "invoice_overdue", label: "An invoice is overdue" },
  { value: "status_changed", label: "The status changes to…" },
];
const EXIT_EVENTS = [
  { value: "never", label: "Never (manual only)" },
  { value: "invoice_paid", label: "The invoice is paid" },
  { value: "customer_replied", label: "The customer replies" },
  { value: "quote_accepted", label: "A quote is accepted" },
  { value: "status_changed", label: "The status changes to…" },
];
const JOB_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "quote", label: "Quote" },
  { value: "work_order", label: "Work order" },
  { value: "completed", label: "Completed" },
  { value: "unsuccessful", label: "Unsuccessful" },
];
const CONDITION_FIELDS = [
  { value: "status", label: "Status" },
  { value: "totalAmount", label: "Quote total" },
  { value: "amountOwing", label: "Amount owing" },
  { value: "leadSource", label: "Lead source" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
  { value: "description", label: "Description" },
];
interface Employee { id: string; firstName?: string; lastName?: string }
interface Template { id: string; name: string }
interface Condition { field: string; op: "eq" | "ne" | "gt" | "lt" | "contains"; value: string }

const LANE_COLORS = [
  "#64748b", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#0ea5e9",
];

const TYPE_LABELS: Record<UserAutomationType, string> = {
  customer_nudge: "Nudge the customer",
  staff_reminder: "Remind staff",
  auto_move: "Move to another lane",
  create_task: "Create a task",
  change_status: "Change the job status",
  add_note: "Add a note to the job",
  assign_staff: "Assign staff",
};
const TRIGGER_LABELS: Record<UserTrigger, string> = {
  days_in_lane: "After a number of days",
  on_enter: "As soon as it enters",
  status_changed: "When the job's status changes",
};

// One-line, human summary of an automation for the collapsed row.
function summarize(a: LaneAutomation, lanesById: Map<string, Lane>, tplName: (id: string, ch?: string) => string) {
  const c = a.config || {};
  let when: string;
  if (a.trigger === "days_in_lane") {
    const d = a.triggerDays ?? 0;
    when = d === 0 ? "Right away" : `After ${d} day${d === 1 ? "" : "s"}`;
    if (c.repeat && c.repeatEveryDays) when += ", repeating";
  } else if (a.trigger === "on_enter") when = "On entry";
  else if (a.trigger === "status_changed") when = "On status change";
  else when = String(a.trigger);

  let act: string;
  if (a.type === "customer_nudge") {
    const ch = c.channel === "email" ? "Email" : "Text";
    const t = c.templateId ? tplName(c.templateId, c.channel) : "";
    act = `${ch} the customer · ${t || "custom message"}`;
  } else if (a.type === "staff_reminder") {
    const who: string[] = [];
    if (c.notifyOwner ?? (c.recipients === "owner" || c.recipients === "both")) who.push("owner");
    if (c.notifyAssigned ?? (c.recipients === "assigned" || c.recipients === "both")) who.push("crew");
    if (c.staffIds?.length) who.push(`${c.staffIds.length} ${c.staffIds.length === 1 ? "person" : "people"}`);
    if (c.emails?.length || c.phones?.length) who.push("contacts");
    act = `Remind ${who.length ? who.join(", ") : "staff"}`;
  } else if (a.type === "auto_move") {
    const l = c.targetLaneId ? lanesById.get(c.targetLaneId) : null;
    act = `Move to ${l ? l.name : "another lane"}`;
  } else if (a.type === "create_task") {
    act = c.title ? `Create task: ${c.title}` : "Create a task";
  } else if (a.type === "change_status") {
    const s = JOB_STATUSES.find((x) => x.value === c.targetStatus);
    act = `Change status to ${s ? s.label : "…"}`;
  } else if (a.type === "add_note") {
    act = "Add a note to the job";
  } else if (a.type === "assign_staff") {
    const n = (c.staffIds as string[] | undefined)?.length || 0;
    act = `Assign ${n || ""} staff`.trim();
  } else act = a.type;

  if ((c.conditions as unknown[] | undefined)?.length) act += " (conditional)";
  return { when, act };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function LaneSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedLaneId, setExpandedLaneId] = useState<string | null>(null);

  const fail = (description: string) => toast({ title: "Error", description, variant: "destructive" });
  const LANES_KEY = ["/api/lanes/all"];
  const invalidateLanes = () => queryClient.invalidateQueries({ queryKey: LANES_KEY });

  const { data: lanes = [], isLoading } = useQuery<Lane[]>({
    queryKey: LANES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/lanes?includeArchived=true");
      if (!res.ok) throw new Error("Failed to load lanes");
      return (await res.json()).data as Lane[];
    },
  });

  // Job counts per lane (reuses the board's cached query).
  const { data: jobsResp } = useQuery<{ data: Array<{ laneId?: string | null }> }>({
    queryKey: ["/api/jobs?limit=500&offset=0&excludeCompleted=true&excludeArchived=true"],
  });
  const jobCount = (laneId: string) =>
    (jobsResp?.data || []).filter((j) => j.laneId === laneId).length;

  const createLane = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/lanes", { name: "New lane", color: LANE_COLORS[6], sortOrder: lanes.length });
      return (await res.json()).data as Lane;
    },
    onSuccess: (lane) => { invalidateLanes(); setExpandedLaneId(lane.id); },
    onError: () => fail("Could not create the lane"),
  });

  const updateLane = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lane> }) =>
      apiRequest("PATCH", `/api/lanes/${id}`, updates),
    onSuccess: invalidateLanes,
    onError: () => fail("Could not update the lane"),
  });

  const deleteLane = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/lanes/${id}`),
    onSuccess: invalidateLanes,
    onError: () => fail("Could not delete the lane"),
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => apiRequest("POST", "/api/lanes/reorder", { orderedIds }),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: LANES_KEY });
      const prev = queryClient.getQueryData<Lane[]>(LANES_KEY);
      if (prev) {
        const byId = new Map(prev.map((l) => [l.id, l]));
        queryClient.setQueryData<Lane[]>(LANES_KEY, orderedIds.map((id) => byId.get(id)!).filter(Boolean));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(LANES_KEY, ctx.prev); fail("Could not reorder lanes"); },
    onSettled: invalidateLanes,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = lanes.map((l) => l.id);
    const next = arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string));
    reorder.mutate(next);
  };

  const lanesById = new Map(lanes.map((l) => [l.id, l]));

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lanes</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">
            Custom buckets a job can sit in, on top of its status. Each lane decides how jobs arrive
            and what happens while they wait.
          </p>
        </div>
        <Button onClick={() => createLane.mutate()} disabled={createLane.isPending} data-testid="button-add-lane">
          <Plus className="h-4 w-4 mr-2" />
          New lane
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm mt-6">Loading lanes…</p>
      ) : lanes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No lanes yet</p>
          <p className="text-muted-foreground text-sm mt-1">Create your first lane to start grouping jobs.</p>
          <Button className="mt-4" onClick={() => createLane.mutate()}>
            <Plus className="h-4 w-4 mr-2" /> New lane
          </Button>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border overflow-hidden divide-y">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={lanes.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {lanes.map((lane) => (
                <LaneRow
                  key={lane.id}
                  lane={lane}
                  expanded={expandedLaneId === lane.id}
                  onToggle={() => setExpandedLaneId(expandedLaneId === lane.id ? null : lane.id)}
                  jobCount={jobCount(lane.id)}
                  lanes={lanes}
                  lanesById={lanesById}
                  onError={fail}
                  updateLane={updateLane}
                  deleteLane={deleteLane}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// ── Lane row (sortable) ──────────────────────────────────────────────────────
function LaneRow({
  lane, expanded, onToggle, jobCount, lanes, lanesById, onError, updateLane, deleteLane,
}: {
  lane: Lane;
  expanded: boolean;
  onToggle: () => void;
  jobCount: number;
  lanes: Lane[];
  lanesById: Map<string, Lane>;
  onError: (m: string) => void;
  updateLane: { mutate: (v: { id: string; updates: Partial<Lane> }) => void };
  deleteLane: { mutate: (v: string) => void };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lane.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined };

  const { data: automations = [] } = useQuery<LaneAutomation[]>({
    queryKey: ["/api/lanes", lane.id, "automations"],
    queryFn: async () => {
      const res = await fetch(`/api/lanes/${lane.id}/automations`);
      if (!res.ok) throw new Error("Failed to load automations");
      return (await res.json()).data as LaneAutomation[];
    },
  });

  // Templates power the summary line + the editor's picker.
  const { data: emailTemplates = [] } = useQuery<Template[]>({
    queryKey: ["/api/email-templates"],
    queryFn: async () => (await (await fetch("/api/email-templates")).json()).data,
    enabled: expanded || automations.some((a) => a.type === "customer_nudge"),
  });
  const { data: smsTemplates = [] } = useQuery<Template[]>({
    queryKey: ["/api/sms-templates"],
    queryFn: async () => (await (await fetch("/api/sms-templates")).json()).data,
    enabled: expanded || automations.some((a) => a.type === "customer_nudge"),
  });
  const tplName = (id: string, ch?: string) =>
    ((ch === "email" ? emailTemplates : smsTemplates).find((t) => t.id === id)?.name ?? "") &&
    `${(ch === "email" ? emailTemplates : smsTemplates).find((t) => t.id === id)!.name} template`;

  const visible = automations.filter((a) => a.type !== "auto_enter" && a.type !== "auto_exit");
  const entry = automations.find((a) => a.type === "auto_enter");
  const exit = automations.find((a) => a.type === "auto_exit");

  const entryLabel = entry ? (ENTRY_EVENTS.find((e) => e.value === entry.trigger)?.label ?? "Auto-added") : null;
  const summaryParts = [
    entryLabel ? `Auto-adds: ${entryLabel.replace(/…$/, "").trim().toLowerCase()}` : "Added manually",
    visible.length ? `${visible.length} automation${visible.length === 1 ? "" : "s"}` : "no automations yet",
  ];

  return (
    <div ref={setNodeRef} style={style} className={`bg-card ${lane.archived ? "opacity-60" : ""}`}>
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
        <button
          className="text-muted-foreground/70 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder" {...attributes} {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: lane.color }} />
        <button onClick={onToggle} className="flex-1 min-w-0 text-left" data-testid={`lane-row-${lane.id}`}>
          <div className="text-[15px] font-medium truncate flex items-center gap-2">
            {lane.name}
            {lane.archived && <span className="text-[11px] font-normal text-muted-foreground">(archived)</span>}
          </div>
          <div className="text-[13px] text-muted-foreground truncate">{summaryParts.join("  ·  ")}</div>
        </button>
        {jobCount > 0 && (
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 flex-shrink-0">
            {jobCount} {jobCount === 1 ? "job" : "jobs"}
          </span>
        )}
        <button onClick={onToggle} className="text-muted-foreground" aria-label={expanded ? "Collapse" : "Expand"}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 sm:px-4 pb-5 pl-4 sm:pl-11 space-y-5 bg-muted/30">
          {/* Name + colour + archive/delete */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Input
              defaultValue={lane.name}
              onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== lane.name) updateLane.mutate({ id: lane.id, updates: { name: n } }); }}
              className="h-9 flex-1 min-w-[160px] bg-card"
              data-testid={`input-lane-name-${lane.id}`}
            />
            <div className="flex gap-1.5 items-center">
              {LANE_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Colour ${c}`}
                  onClick={() => updateLane.mutate({ id: lane.id, updates: { color: c } })}
                  className={`h-5 w-5 rounded-full border-2 ${lane.color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm"
              onClick={() => updateLane.mutate({ id: lane.id, updates: { archived: !lane.archived } })}>
              {lane.archived ? "Restore" : "Archive"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete lane" data-testid={`button-lane-delete-${lane.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{lane.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Jobs in this lane will simply leave it (their status is unaffected). The lane's automations
                    will be removed. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteLane.mutate(lane.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Entry + exit rules */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">How jobs arrive here</div>
              <LaneEventRule laneId={lane.id} row={entry} kind="auto_enter" events={ENTRY_EVENTS} clearValue="manual" onError={onError} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Auto-remove when</div>
              <LaneEventRule laneId={lane.id} row={exit} kind="auto_exit" events={EXIT_EVENTS} clearValue="never" onError={onError} />
            </div>
          </div>

          {/* Automations */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">While a job sits here</div>
            <AutomationList
              laneId={lane.id}
              automations={visible}
              lanes={lanes}
              lanesById={lanesById}
              emailTemplates={emailTemplates}
              smsTemplates={smsTemplates}
              tplName={tplName}
              onError={onError}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Entry / exit rule ────────────────────────────────────────────────────────
// Stored as an internal auto_enter / auto_exit automation row on the lane. Picking an event
// creates/updates it; the clear value ("manual"/"never") removes it. For "status changes to…"
// a target status is stored in config.status.
function LaneEventRule({
  laneId, row, kind, events, clearValue, onError,
}: {
  laneId: string;
  row?: LaneAutomation;
  kind: "auto_enter" | "auto_exit";
  events: { value: string; label: string }[];
  clearValue: string;
  onError: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const key = ["/api/lanes", laneId, "automations"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const fail = () => onError("Could not update the rule");

  const upsert = useMutation({
    mutationFn: async ({ trigger, status }: { trigger: string | null; status?: string }) => {
      if (trigger === null) return row ? apiRequest("DELETE", `/api/lane-automations/${row.id}`) : null;
      const config = trigger === "status_changed" ? { status: status ?? JOB_STATUSES[0].value } : {};
      if (row) return apiRequest("PATCH", `/api/lane-automations/${row.id}`, { trigger, config });
      return apiRequest("POST", `/api/lanes/${laneId}/automations`, { type: kind, trigger, enabled: true, config });
    },
    onSuccess: invalidate, onError: fail,
  });

  const current = row?.trigger ?? clearValue;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={current} onValueChange={(v) => upsert.mutate({ trigger: v === clearValue ? null : v, status: row?.config?.status })}>
        <SelectTrigger className="w-full sm:w-60 h-9" data-testid={`rule-${kind}-${laneId}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {events.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {current === "status_changed" && (
        <Select value={row?.config?.status ?? JOB_STATUSES[0].value} onValueChange={(status) => upsert.mutate({ trigger: "status_changed", status })}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {JOB_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ── Automation list ──────────────────────────────────────────────────────────
function AutomationList({
  laneId, automations, lanes, lanesById, emailTemplates, smsTemplates, tplName, onError,
}: {
  laneId: string;
  automations: LaneAutomation[];
  lanes: Lane[];
  lanesById: Map<string, Lane>;
  emailTemplates: Template[];
  smsTemplates: Template[];
  tplName: (id: string, ch?: string) => string;
  onError: (m: string) => void;
}) {
  const queryClient = useQueryClient();
  const key = ["/api/lanes", laneId, "automations"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => (await (await fetch("/api/employees")).json()).data,
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/lanes/${laneId}/automations`, {
        type: "staff_reminder", trigger: "days_in_lane", triggerDays: 3, enabled: true, config: { notifyOwner: true },
      });
      return (await res.json()).data as LaneAutomation;
    },
    onSuccess: (a) => { invalidate(); setEditingId(a.id); },
    onError: () => onError("Could not add the automation"),
  });
  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LaneAutomation> }) =>
      apiRequest("PATCH", `/api/lane-automations/${id}`, updates),
    onSuccess: invalidate, onError: () => onError("Could not update the automation"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/lane-automations/${id}`),
    onSuccess: () => { invalidate(); setEditingId(null); }, onError: () => onError("Could not delete the automation"),
  });

  return (
    <div className="space-y-2">
      {automations.length === 0 && (
        <p className="text-[13px] text-muted-foreground">No automations yet. Add one below.</p>
      )}
      {automations.map((a) => (
        editingId === a.id ? (
          <AutomationEditor
            key={a.id}
            automation={a}
            lanes={lanes}
            employees={employees}
            emailTemplates={emailTemplates}
            smsTemplates={smsTemplates}
            onChange={(updates) => update.mutate({ id: a.id, updates })}
            onDone={() => setEditingId(null)}
            onDelete={() => remove.mutate(a.id)}
          />
        ) : (
          <AutomationSentence
            key={a.id}
            summary={summarize(a, lanesById, tplName)}
            enabled={a.enabled}
            onEdit={() => setEditingId(a.id)}
            onDelete={() => remove.mutate(a.id)}
          />
        )
      ))}
      <button
        onClick={() => create.mutate()}
        disabled={create.isPending}
        className="w-full rounded-lg border border-dashed py-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-2"
        data-testid={`button-add-automation-${laneId}`}
      >
        <Plus className="h-3.5 w-3.5" /> Add automation
      </button>
    </div>
  );
}

// ── Collapsed automation (sentence) ──────────────────────────────────────────
function AutomationSentence({
  summary, enabled, onEdit, onDelete,
}: { summary: { when: string; act: string }; enabled: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={`group flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 ${enabled ? "" : "opacity-55"}`}>
      <span className="text-[12px] font-medium bg-muted text-muted-foreground rounded px-2 py-0.5 whitespace-nowrap">
        {summary.when}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
      <span className="text-[14px] truncate">{summary.act}</span>
      {!enabled && <span className="text-[11px] text-muted-foreground">paused</span>}
      <div className="ml-auto flex items-center gap-1 text-muted-foreground">
        <button onClick={onEdit} aria-label="Edit automation" className="hover:text-foreground p-1"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} aria-label="Delete automation" className="hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

// ── Expanded automation (builder) ────────────────────────────────────────────
function AutomationEditor({
  automation, lanes, employees, emailTemplates, smsTemplates, onChange, onDone, onDelete,
}: {
  automation: LaneAutomation;
  lanes: Lane[];
  employees: Employee[];
  emailTemplates: Template[];
  smsTemplates: Template[];
  onChange: (updates: Partial<LaneAutomation>) => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  const cfg = automation.config || {};
  const setConfig = (patch: Record<string, any>) => onChange({ config: { ...cfg, ...patch } });
  const nudgeTemplates = cfg.channel === "email" ? emailTemplates : smsTemplates;

  return (
    <div className="rounded-lg border border-foreground/15 bg-card p-3.5 space-y-3">
      {/* When */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] text-muted-foreground w-9">When</span>
        <Select value={automation.trigger as string} onValueChange={(t) => onChange({ trigger: t as LaneAutomation["trigger"] })}>
          <SelectTrigger className="w-full sm:w-56 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TRIGGER_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {automation.trigger === "days_in_lane" && (
          <div className="flex items-center gap-1.5">
            <Input type="number" min={0} className="w-16 h-9"
              value={automation.triggerDays ?? 0}
              onChange={(e) => onChange({ triggerDays: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
            <span className="text-[13px] text-muted-foreground">days</span>
          </div>
        )}
      </div>

      {automation.trigger === "days_in_lane" && (
        <div className="flex items-center gap-2 flex-wrap pl-11">
          <Switch checked={!!cfg.repeat} onCheckedChange={(repeat) => setConfig({ repeat })} />
          <span className="text-[13px] text-muted-foreground">Keep reminding</span>
          {cfg.repeat && (
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] text-muted-foreground">every</span>
              <Input type="number" min={1} className="w-14 h-9"
                value={cfg.repeatEveryDays ?? 1}
                onChange={(e) => setConfig({ repeatEveryDays: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
              <span className="text-[13px] text-muted-foreground">days</span>
            </div>
          )}
        </div>
      )}

      {/* Do */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] text-muted-foreground w-9">Do</span>
        <Select value={automation.type as string} onValueChange={(t) => onChange({ type: t as LaneAutomation["type"] })}>
          <SelectTrigger className="w-full sm:w-56 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Action-specific config */}
      <div className="pl-11 space-y-3">
        {automation.type === "customer_nudge" && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={cfg.channel || "sms"} onValueChange={(channel) => setConfig({ channel, templateId: undefined })}>
                <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms"><MessageSquare className="h-3.5 w-3.5 mr-1.5 inline" />SMS</SelectItem>
                  <SelectItem value="email"><Mail className="h-3.5 w-3.5 mr-1.5 inline" />Email</SelectItem>
                </SelectContent>
              </Select>
              {!cfg.useAi && (
                <Select value={cfg.templateId || "__custom__"} onValueChange={(v) => setConfig({ templateId: v === "__custom__" ? undefined : v })}>
                  <SelectTrigger className="w-full sm:w-56 h-9"><SelectValue placeholder="Custom message" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">Custom message</SelectItem>
                    {nudgeTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {cfg.useAi ? (
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> AI writes a tailored follow-up each time it fires.</p>
            ) : !cfg.templateId && (
              <Textarea rows={2} placeholder="Message to the customer. Use {firstName}, {jobNumber}, {jobTitle}."
                value={cfg.template || ""} onChange={(e) => setConfig({ template: e.target.value })} />
            )}
            <div className="flex items-center gap-5 flex-wrap">
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Switch checked={!!cfg.useAi} onCheckedChange={(useAi) => setConfig({ useAi })} /> Let AI write it
              </label>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Switch checked={cfg.respectQuietHours !== false} onCheckedChange={(v) => setConfig({ respectQuietHours: v })} /> Respect quiet hours
              </label>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Switch checked={!!cfg.requireApproval} onCheckedChange={(requireApproval) => setConfig({ requireApproval })} /> Hold for my approval
              </label>
            </div>
          </>
        )}

        {automation.type === "staff_reminder" && (
          <>
            <div className="flex items-center gap-5 flex-wrap">
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={cfg.notifyOwner ?? (cfg.recipients === "owner" || cfg.recipients === "both")}
                  onCheckedChange={(notifyOwner) => setConfig({ notifyOwner })} /> Owner and admins
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={cfg.notifyAssigned ?? (cfg.recipients === "assigned" || cfg.recipients === "both")}
                  onCheckedChange={(notifyAssigned) => setConfig({ notifyAssigned })} /> Assigned crew
              </label>
            </div>
            {employees.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Specific people</Label>
                <div className="flex flex-wrap gap-1.5">
                  {employees.map((e) => {
                    const name = [e.firstName, e.lastName].filter(Boolean).join(" ") || e.id;
                    const sel = ((cfg.staffIds as string[]) || []).includes(e.id);
                    return (
                      <button key={e.id}
                        onClick={() => {
                          const cur: string[] = (cfg.staffIds as string[]) || [];
                          setConfig({ staffIds: sel ? cur.filter((x) => x !== e.id) : [...cur, e.id] });
                        }}
                        className={`text-xs rounded-full border px-2.5 py-1 ${sel ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <TokenList label="Email anyone" placeholder="name@email.com" values={(cfg.emails as string[]) || []} onChange={(emails) => setConfig({ emails })} />
            <TokenList label="Text anyone" placeholder="021 234 5678" values={(cfg.phones as string[]) || []} onChange={(phones) => setConfig({ phones })} />
            <Textarea rows={2} placeholder="Reminder message (optional)." value={cfg.message || ""} onChange={(e) => setConfig({ message: e.target.value })} />
          </>
        )}

        {automation.type === "auto_move" && (
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Move to</Label>
            <Select value={cfg.targetLaneId || ""} onValueChange={(targetLaneId) => setConfig({ targetLaneId })}>
              <SelectTrigger className="w-full sm:w-56 h-9"><SelectValue placeholder="Choose a lane" /></SelectTrigger>
              <SelectContent>
                {lanes.filter((l) => l.id !== automation.laneId && !l.archived).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {automation.type === "create_task" && (
          <div className="space-y-2">
            <Input placeholder="Task title (e.g. Call to confirm decision)" value={cfg.title || ""} onChange={(e) => setConfig({ title: e.target.value })} />
            <div className="flex items-center gap-2">
              <Label className="text-xs">Due in</Label>
              <Input type="number" min={0} className="w-16 h-9" value={cfg.dueInDays ?? 0}
                onChange={(e) => setConfig({ dueInDays: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
              <span className="text-xs text-muted-foreground">days (0 = no due date)</span>
            </div>
          </div>
        )}

        {automation.type === "change_status" && (
          <div className="flex items-center gap-3">
            <Label className="text-xs w-20">New status</Label>
            <Select value={cfg.targetStatus || ""} onValueChange={(targetStatus) => setConfig({ targetStatus })}>
              <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="Choose a status" /></SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {automation.type === "add_note" && (
          <Textarea rows={2} placeholder="Note to add to the job diary."
            value={cfg.note || ""} onChange={(e) => setConfig({ note: e.target.value })} />
        )}

        {automation.type === "assign_staff" && (
          employees.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {employees.map((e) => {
                const name = [e.firstName, e.lastName].filter(Boolean).join(" ") || e.id;
                const sel = ((cfg.staffIds as string[]) || []).includes(e.id);
                return (
                  <button key={e.id}
                    onClick={() => {
                      const cur: string[] = (cfg.staffIds as string[]) || [];
                      setConfig({ staffIds: sel ? cur.filter((x) => x !== e.id) : [...cur, e.id] });
                    }}
                    className={`text-xs rounded-full border px-2.5 py-1 ${sel ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                    {name}
                  </button>
                );
              })}
            </div>
          ) : <p className="text-xs text-muted-foreground">No staff to assign.</p>
        )}
      </div>

      {/* Conditions + guards */}
      <ConditionsBuilder conditions={(cfg.conditions as Condition[]) || []} onChange={(conditions) => setConfig({ conditions })} />
      {automation.trigger === "days_in_lane" && (
        <div className="flex items-center gap-2 flex-wrap pl-11">
          <span className="text-[12px] text-muted-foreground">Stop after</span>
          <Input type="number" min={0} className="w-16 h-9" value={cfg.maxAttempts ?? 0}
            onChange={(e) => setConfig({ maxAttempts: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
          <span className="text-[12px] text-muted-foreground">times (0 = no limit)</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Switch checked={automation.enabled} onCheckedChange={(enabled) => onChange({ enabled })} /> Enabled
        </label>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>Delete</Button>
          <Button size="sm" onClick={onDone}>Done</Button>
        </div>
      </div>
    </div>
  );
}

// "Only if…" conditions: an automation fires only when every row matches the job.
function ConditionsBuilder({ conditions, onChange }: { conditions: Condition[]; onChange: (c: Condition[]) => void }) {
  const opsFor = (field: string): { v: Condition["op"]; l: string }[] =>
    (field === "totalAmount" || field === "amountOwing") ? [{ v: "gt", l: "is more than" }, { v: "lt", l: "is less than" }]
      : (field === "title" || field === "description") ? [{ v: "contains", l: "contains" }]
        : [{ v: "eq", l: "is" }, { v: "ne", l: "is not" }];
  const update = (i: number, patch: Partial<Condition>) => onChange(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const add = () => onChange([...conditions, { field: "status", op: "eq", value: "" }]);

  return (
    <div className="pl-11 space-y-2">
      {conditions.length > 0 && <div className="text-[12px] text-muted-foreground">Only if</div>}
      {conditions.map((c, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <Select value={c.field} onValueChange={(field) => update(i, { field, op: opsFor(field)[0].v })}>
            <SelectTrigger className="w-full sm:w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{CONDITION_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={c.op} onValueChange={(op) => update(i, { op: op as Condition["op"] })}>
            <SelectTrigger className="w-full sm:w-32 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{opsFor(c.field).map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          {c.field === "status" ? (
            <Select value={c.value} onValueChange={(value) => update(i, { value })}>
              <SelectTrigger className="w-full sm:w-36 h-8"><SelectValue placeholder="…" /></SelectTrigger>
              <SelectContent>{JOB_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Input className="w-full sm:w-36 h-8" value={c.value} onChange={(e) => update(i, { value: e.target.value })}
              placeholder={c.field === "totalAmount" ? "amount" : "value"} />
          )}
          <button onClick={() => onChange(conditions.filter((_, idx) => idx !== i))} aria-label="Remove condition" className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={add} className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1">
        <Plus className="h-3 w-3" /> Add condition
      </button>
    </div>
  );
}

// Add/remove free-text tokens (emails or phone numbers).
function TokenList({ label, placeholder, values, onChange }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (v && !values.includes(v)) onChange([...values, v]); setDraft(""); };
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input value={draft} placeholder={placeholder} className="h-8 text-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="text-xs rounded-full border bg-background px-2 py-0.5 flex items-center gap-1">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

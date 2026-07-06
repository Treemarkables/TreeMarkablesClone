import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { CalendarDays, ChevronDown, Plus, Repeat, Trash2 } from "lucide-react";

// ── Domain constants ─────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
] as const;
type ColumnKey = (typeof COLUMNS)[number]["key"];

const CATEGORIES = [
  { key: "equipment", label: "Equipment", color: "#BA7517" },
  { key: "vehicle", label: "Vehicle", color: "#888780" },
  { key: "admin", label: "Admin", color: "#444441" },
  { key: "sales", label: "Sales", color: "#185FA5" },
  { key: "marketing", label: "Marketing", color: "#1D9E75" },
  { key: "training", label: "Training", color: "#534AB7" },
  { key: "yard", label: "Yard", color: "#5F5E5A" },
  { key: "compliance", label: "Compliance", color: "#A32D2D" },
  { key: "personal", label: "Personal", color: "#993556" },
] as const;

const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.color]),
);

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  status: ColumnKey;
  blockedReason?: string | null;
  assigneeId?: string | null;
  createdBy?: string | null;
  dueDate?: string | null;
  linkedJobId?: string | null;
  linkedEquipmentId?: string | null;
  recurring?: boolean;
  recurringIntervalDays?: number | null;
  parentTaskId?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Job {
  id: string;
  jobNumber?: string;
  title?: string;
}

interface Equipment {
  id: string;
  name: string;
  type?: string | null;
}

const isOverdueOrToday = (iso: string | null | undefined): "overdue" | "today" | "future" | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (due < dayStart) return "overdue";
  if (due === dayStart) return "today";
  if (due - dayStart < dayMs) return "today";
  return "future";
};

const fmtDue = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
};

const initials = (first?: string, last?: string) =>
  `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase() || "—";

const avatarStyleFor = (emp: Employee | null | undefined): React.CSSProperties => {
  if (!emp) return { background: "#E5E5E0", color: "#444441" };
  const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
  if (name.includes("jullian") || name.includes("julian")) {
    return { background: "#39FF14", color: "#000000" };
  }
  // Soft pastel palette keyed by id-hash so it's stable per employee.
  const palette: { bg: string; fg: string }[] = [
    { bg: "#FDE2E4", fg: "#7A2A33" },
    { bg: "#DCEFF7", fg: "#1F4F70" },
    { bg: "#E2F5DC", fg: "#2D6B2D" },
    { bg: "#F8E4D2", fg: "#7A4520" },
    { bg: "#E6E0F2", fg: "#3F3473" },
    { bg: "#FFF5C7", fg: "#6E5A00" },
  ];
  let h = 0;
  for (let i = 0; i < emp.id.length; i++) h = (h * 31 + emp.id.charCodeAt(i)) >>> 0;
  const c = palette[h % palette.length];
  return { background: c.bg, color: c.fg };
};

// ── Page ─────────────────────────────────────────────────────────────────────

type View = "list" | "board" | "calendar" | "mine";

export default function Tasks() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("board");
  const [filterAssignee, setFilterAssignee] = useState<string | "">("");
  const [filterCategory, setFilterCategory] = useState<string | "">("");
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [filterLinkedJob, setFilterLinkedJob] = useState<string | "">("");
  const [filterEquipment, setFilterEquipment] = useState<string | "">("");

  const [quickTitle, setQuickTitle] = useState("");
  const [quickCategory, setQuickCategory] = useState<string>("admin");
  const [quickAssignee, setQuickAssignee] = useState<string>("");

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [pendingBlocked, setPendingBlocked] = useState<{ taskId: string; reason: string } | null>(null);

  // Default quick-capture assignee = current user
  useEffect(() => {
    if (!quickAssignee && currentUser?.id) setQuickAssignee(currentUser.id);
  }, [currentUser?.id, quickAssignee]);

  // ── Data ─────────────────────────────────────────────────────────────
  const tasksQ = useQuery<{ success: boolean; data: Record<string, Task[]> }>({
    queryKey: ["/api/tasks/board"],
    queryFn: async () => (await apiRequest("GET", "/api/tasks/board")).json(),
    staleTime: 30_000,
  });
  const employeesQ = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ["/api/employees", "active"],
    queryFn: async () => (await apiRequest("GET", "/api/employees/active")).json(),
    staleTime: 5 * 60 * 1000,
  });
  const jobsQ = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ["/api/jobs"],
    queryFn: async () => (await apiRequest("GET", "/api/jobs?limit=500&offset=0&excludeCompleted=true&excludeArchived=true")).json(),
    staleTime: 60 * 1000,
  });
  const equipmentQ = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ["/api/equipment"],
    queryFn: async () => (await apiRequest("GET", "/api/equipment")).json(),
    staleTime: 5 * 60 * 1000,
  });

  const employees = employeesQ.data?.data || [];
  const jobs = jobsQ.data?.data || [];
  const equipment = equipmentQ.data?.data || [];
  const employeeById = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  // Apply client-side filters to the server-grouped board.
  const board = useMemo<Record<ColumnKey, Task[]>>(() => {
    const raw = tasksQ.data?.data || ({} as Record<string, Task[]>);
    const out: Record<ColumnKey, Task[]> = {
      backlog: [], todo: [], in_progress: [], blocked: [], done: [],
    };
    const matches = (t: Task) => {
      if (view === "mine" && currentUser?.id && t.assigneeId !== currentUser.id) return false;
      if (filterAssignee && t.assigneeId !== filterAssignee) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterLinkedJob && t.linkedJobId !== filterLinkedJob) return false;
      if (filterEquipment && t.linkedEquipmentId !== filterEquipment) return false;
      if (filterOverdueOnly) {
        if (t.status === "done") return false;
        if (isOverdueOrToday(t.dueDate) !== "overdue") return false;
      }
      return true;
    };
    for (const col of COLUMNS) {
      const list = (raw[col.key] || []).filter(matches);
      out[col.key] = list;
    }
    return out;
  }, [tasksQ.data, view, currentUser?.id, filterAssignee, filterCategory, filterLinkedJob, filterEquipment, filterOverdueOnly]);

  const allTasks: Task[] = useMemo(() => {
    return COLUMNS.flatMap((c) => board[c.key]);
  }, [board]);

  // ── Mutations ────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/tasks/board"] });

  const createTask = useMutation({
    mutationFn: async (input: Partial<Task>) => {
      const res = await apiRequest("POST", "/api/tasks", input);
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  const patchTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, patch);
      return res.json();
    },
    onMutate: async ({ id, patch }) => {
      // Optimistic update so drag feels instant.
      await queryClient.cancelQueries({ queryKey: ["/api/tasks/board"] });
      const prev = queryClient.getQueryData<{ success: boolean; data: Record<string, Task[]> }>(["/api/tasks/board"]);
      if (prev) {
        const next: Record<string, Task[]> = {};
        for (const k of Object.keys(prev.data)) next[k] = [...prev.data[k]];
        let moved: Task | null = null;
        for (const k of Object.keys(next)) {
          const idx = next[k].findIndex((t) => t.id === id);
          if (idx >= 0) {
            moved = { ...next[k][idx], ...patch } as Task;
            next[k].splice(idx, 1);
            break;
          }
        }
        if (moved) {
          const targetStatus = (patch.status as ColumnKey) || moved.status;
          (next[targetStatus] ||= []).unshift(moved);
        }
        queryClient.setQueryData(["/api/tasks/board"], { ...prev, data: next });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/tasks/board"], ctx.prev);
    },
    onSettled: () => invalidate(),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/tasks/${id}`)).json(),
    onSuccess: () => invalidate(),
  });

  // ── Quick capture ────────────────────────────────────────────────────
  const handleQuickAdd = () => {
    const title = quickTitle.trim();
    if (!title) return;
    createTask.mutate(
      {
        title,
        category: quickCategory,
        priority: "normal",
        status: "todo",
        assigneeId: quickAssignee || currentUser?.id,
        createdBy: currentUser?.id,
      },
      { onSuccess: () => setQuickTitle("") },
    );
  };

  // ── Drag / drop ──────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const target = String(e.over.id) as ColumnKey;
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.status === target) return;

    if (target === "blocked") {
      // Capture reason before committing.
      setPendingBlocked({ taskId, reason: "" });
      return;
    }
    // Moving away from blocked → clear the stale blocked_reason.
    patchTask.mutate({ id: taskId, patch: { status: target, blockedReason: null } });
  };

  const confirmBlocked = () => {
    if (!pendingBlocked) return;
    if (!pendingBlocked.reason.trim()) return;
    patchTask.mutate({
      id: pendingBlocked.taskId,
      patch: { status: "blocked", blockedReason: pendingBlocked.reason.trim() },
    });
    setPendingBlocked(null);
  };

  const activeTask = activeDragId ? allTasks.find((t) => t.id === activeDragId) : null;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Page header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Internal work — gear, admin, follow-ups, maintenance
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 p-0.5 bg-gray-50">
          {(["list", "board", "calendar", "mine"] as View[]).map((v) => {
            const labels: Record<View, string> = {
              list: "List",
              board: "Board",
              calendar: "Calendar",
              mine: "My tasks",
            };
            const isActive = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  isActive ? "bg-black text-[#39FF14]" : "text-gray-700 hover:bg-gray-100"
                }`}
                data-testid={`task-view-${v}`}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick capture */}
      <div className="px-4 sm:px-6 py-3 bg-[#F1EFE8] border-b border-gray-200 flex flex-wrap items-center gap-2">
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleQuickAdd();
          }}
          placeholder="Quick add — e.g. Order chainbar oil x2"
          className="flex-1 min-w-[220px] h-9 bg-white"
          data-testid="task-quick-input"
        />
        <Select value={quickCategory} onValueChange={setQuickCategory}>
          <SelectTrigger className="h-9 w-[140px] bg-white text-xs" data-testid="task-quick-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quickAssignee} onValueChange={setQuickAssignee}>
          <SelectTrigger className="h-9 w-[160px] bg-white text-xs" data-testid="task-quick-assignee">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleQuickAdd}
          disabled={!quickTitle.trim() || createTask.isPending}
          className="h-9 bg-black text-[#39FF14] hover:bg-black/90"
          data-testid="task-quick-add"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {/* Filter pills */}
      <div className="px-4 sm:px-6 py-2 border-b border-gray-200 flex flex-wrap items-center gap-1.5 text-xs">
        <FilterPill
          label="All assignees"
          activeLabel={filterAssignee ? employeeById.get(filterAssignee)?.firstName + " " + employeeById.get(filterAssignee)?.lastName : null}
          options={employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))}
          value={filterAssignee}
          onChange={setFilterAssignee}
        />
        <FilterPill
          label="All categories"
          activeLabel={filterCategory ? CATEGORIES.find((c) => c.key === filterCategory)?.label : null}
          options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
          value={filterCategory}
          onChange={setFilterCategory}
        />
        <FilterPill
          label="Linked job"
          activeLabel={filterLinkedJob ? `#${jobs.find((j) => j.id === filterLinkedJob)?.jobNumber || "?"}` : null}
          options={jobs.slice(0, 200).map((j) => ({ value: j.id, label: `#${j.jobNumber || "?"} ${j.title || ""}`.trim() }))}
          value={filterLinkedJob}
          onChange={setFilterLinkedJob}
        />
        <FilterPill
          label="Equipment"
          activeLabel={filterEquipment ? equipment.find((e) => e.id === filterEquipment)?.name : null}
          options={equipment.map((e) => ({ value: e.id, label: e.name }))}
          value={filterEquipment}
          onChange={setFilterEquipment}
        />
        <button
          onClick={() => setFilterOverdueOnly((v) => !v)}
          className={`px-2.5 py-1 rounded-md border transition-colors ${
            filterOverdueOnly
              ? "border-[#A32D2D] bg-[#A32D2D] text-white"
              : "border-[#A32D2D]/40 text-[#A32D2D] hover:bg-[#A32D2D]/10"
          }`}
          data-testid="task-filter-overdue"
        >
          Overdue only
        </button>
        {(filterAssignee || filterCategory || filterLinkedJob || filterEquipment || filterOverdueOnly) && (
          <button
            onClick={() => {
              setFilterAssignee("");
              setFilterCategory("");
              setFilterLinkedJob("");
              setFilterEquipment("");
              setFilterOverdueOnly(false);
            }}
            className="px-2.5 py-1 text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Board / List / Calendar */}
      {view === "calendar" ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          Calendar view — coming soon. Try Board for now.
        </div>
      ) : view === "list" ? (
        <ListView tasks={allTasks} employeeById={employeeById} onOpen={setOpenTaskId} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-auto px-4 sm:px-6 py-3 bg-white">
            <div className="flex gap-3 min-w-max h-full">
              {COLUMNS.map((col) => (
                <Column
                  key={col.key}
                  col={col}
                  tasks={board[col.key]}
                  employeeById={employeeById}
                  onOpen={setOpenTaskId}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeTask ? (
              <TaskCard task={activeTask} employeeById={employeeById} onOpen={() => {}} dragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Category legend */}
      <div className="px-4 sm:px-6 py-2 bg-[#F1EFE8] border-t border-gray-200 flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
        <span className="text-gray-500">Categories:</span>
        {CATEGORIES.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>

      {/* Blocked reason modal */}
      <Dialog open={!!pendingBlocked} onOpenChange={(open) => !open && setPendingBlocked(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Why is this blocked?</DialogTitle>
            <DialogDescription>
              A short note so the team knows what's holding this up.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={pendingBlocked?.reason || ""}
            onChange={(e) => setPendingBlocked((p) => (p ? { ...p, reason: e.target.value } : p))}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmBlocked();
            }}
            placeholder="e.g. Waiting on parts from supplier"
            data-testid="task-blocked-reason-input"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingBlocked(null)}>Cancel</Button>
            <Button
              onClick={confirmBlocked}
              disabled={!pendingBlocked?.reason.trim()}
              className="bg-black text-[#39FF14] hover:bg-black/90"
              data-testid="task-blocked-confirm"
            >
              Move to blocked
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Side panel */}
      <TaskDetailPanel
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        employees={employees}
        jobs={jobs}
        equipment={equipment}
        onUpdate={(id, patch) => patchTask.mutate({ id, patch })}
        onDelete={(id) => {
          deleteTask.mutate(id, { onSuccess: () => setOpenTaskId(null) });
        }}
      />
    </div>
  );
}

// ── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  activeLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  activeLabel?: string | null;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = !!value;
  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className={`px-2.5 py-1 rounded-md border flex items-center gap-1 transition-colors ${
          isActive
            ? "border-black bg-black text-[#39FF14]"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {activeLabel || label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute z-20 top-full left-0 mt-1 w-56 max-h-72 overflow-auto rounded-md border border-gray-200 bg-white py-1 text-xs">
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-500"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {label}
            </button>
            {options.map((o) => (
              <button
                key={o.value}
                className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 ${value === o.value ? "bg-gray-100" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────

function Column({
  col,
  tasks,
  employeeById,
  onOpen,
}: {
  col: { key: ColumnKey; label: string };
  tasks: Task[];
  employeeById: Map<string, Employee>;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[280px] shrink-0 rounded-md border border-gray-200 ${
        isOver ? "bg-[#39FF14]/10" : "bg-[#F7F7F4]"
      }`}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200">
        <span className="text-xs font-medium text-gray-700">{col.label}</span>
        <span className="text-[10px] text-gray-500 px-1.5 py-0.5 rounded bg-white border border-gray-200">{tasks.length}</span>
      </div>
      <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto">
        {tasks.length === 0 && (
          <div className="text-[11px] text-gray-400 italic px-1 py-2">No tasks</div>
        )}
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} employeeById={employeeById} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  employeeById,
  onOpen,
}: {
  task: Task;
  employeeById: Map<string, Employee>;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${isDragging ? "opacity-30" : ""}`}
    >
      <TaskCard task={task} employeeById={employeeById} onOpen={onOpen} />
    </div>
  );
}

// ── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  employeeById,
  onOpen,
  dragging,
}: {
  task: Task;
  employeeById: Map<string, Employee>;
  onOpen: (id: string) => void;
  dragging?: boolean;
}) {
  const dueState = isOverdueOrToday(task.dueDate);
  const overdue = dueState === "overdue" && task.status !== "done";
  const today = dueState === "today" && task.status !== "done";
  const assignee = task.assigneeId ? employeeById.get(task.assigneeId) : null;
  const catColor = task.category ? CATEGORY_COLOR[task.category] : "#CCCCCC";

  return (
    <div
      // dnd-kit's activationConstraint.distance=4 means a true click (no
      // movement) lets onClick fire as normal; a drag swallows it. The
      // dragging-overlay variant gets no handler so the overlay clone can't
      // re-open the panel.
      onClick={dragging ? undefined : () => onOpen(task.id)}
      className={`bg-white rounded-md border border-gray-200 p-2.5 cursor-pointer hover:border-gray-300 ${
        dragging ? "shadow-none" : ""
      }`}
      style={{ borderLeft: `3px solid ${catColor}` }}
      data-testid={`task-card-${task.id}`}
    >
      <div className="text-[12px] font-medium text-gray-900 leading-snug break-words">
        {task.title}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
        {task.category && (
          <span
            className="px-1.5 py-0.5 rounded text-white"
            style={{ background: catColor }}
          >
            {task.category}
          </span>
        )}
        {(task.priority === "high" || task.priority === "urgent") && (
          <span
            className={`px-1.5 py-0.5 rounded ${
              task.priority === "urgent" ? "bg-[#A32D2D] text-white" : "bg-[#BA7517] text-white"
            }`}
          >
            {task.priority}
          </span>
        )}
        {task.linkedJobId && (
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
            → Job
          </span>
        )}
        {task.recurring && (
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 inline-flex items-center gap-0.5">
            <Repeat className="h-2.5 w-2.5" /> Recurring
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-[10px] ${
            overdue ? "text-[#A32D2D] font-semibold" : today ? "text-[#A32D2D] font-semibold" : "text-gray-500"
          }`}
        >
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {fmtDue(task.dueDate)}
              {overdue ? " · overdue" : today ? " · today" : ""}
            </span>
          ) : (
            <span className="text-gray-400">No due date</span>
          )}
        </span>
        {assignee && (
          <span
            className="h-[18px] w-[18px] rounded-full inline-flex items-center justify-center text-[9px] font-semibold"
            style={avatarStyleFor(assignee)}
            title={`${assignee.firstName} ${assignee.lastName}`}
          >
            {initials(assignee.firstName, assignee.lastName)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── List view ────────────────────────────────────────────────────────────────

function ListView({
  tasks,
  employeeById,
  onOpen,
}: {
  tasks: Task[];
  employeeById: Map<string, Employee>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-auto px-4 sm:px-6 py-3">
      <table className="w-full text-xs">
        <thead className="text-gray-500">
          <tr className="border-b border-gray-200">
            <th className="text-left font-medium py-2">Title</th>
            <th className="text-left font-medium py-2">Status</th>
            <th className="text-left font-medium py-2">Category</th>
            <th className="text-left font-medium py-2">Due</th>
            <th className="text-left font-medium py-2">Assignee</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const a = t.assigneeId ? employeeById.get(t.assigneeId) : null;
            const overdue = isOverdueOrToday(t.dueDate) === "overdue" && t.status !== "done";
            return (
              <tr
                key={t.id}
                className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => onOpen(t.id)}
              >
                <td className="py-2 text-gray-900">{t.title}</td>
                <td className="py-2 text-gray-600">{COLUMNS.find((c) => c.key === t.status)?.label || t.status}</td>
                <td className="py-2">
                  {t.category && (
                    <span className="px-1.5 py-0.5 rounded text-white text-[10px]" style={{ background: CATEGORY_COLOR[t.category] }}>
                      {t.category}
                    </span>
                  )}
                </td>
                <td className={`py-2 ${overdue ? "text-[#A32D2D] font-semibold" : "text-gray-600"}`}>{fmtDue(t.dueDate)}</td>
                <td className="py-2 text-gray-700">{a ? `${a.firstName} ${a.lastName}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Side panel ───────────────────────────────────────────────────────────────

function TaskDetailPanel({
  taskId,
  onClose,
  employees,
  jobs,
  equipment,
  onUpdate,
  onDelete,
}: {
  taskId: string | null;
  onClose: () => void;
  employees: Employee[];
  jobs: Job[];
  equipment: Equipment[];
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const detailQ = useQuery<{ success: boolean; data: Task & { assignee?: Employee; linkedJob?: Job; linkedEquipment?: Equipment } }>({
    queryKey: ["/api/tasks", taskId],
    queryFn: async () => (await apiRequest("GET", `/api/tasks/${taskId}`)).json(),
    enabled: !!taskId,
  });

  const [draft, setDraft] = useState<Partial<Task>>({});
  useEffect(() => {
    setDraft({});
  }, [taskId]);

  const t = detailQ.data?.data;
  const merged = { ...(t || {}), ...draft } as Task;

  const save = (patch: Partial<Task>) => {
    if (!taskId) return;
    setDraft((d) => ({ ...d, ...patch }));
    onUpdate(taskId, patch);
  };

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-md w-full p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-gray-200">
          <SheetTitle className="text-sm font-semibold">Task</SheetTitle>
        </SheetHeader>
        {!t ? (
          <div className="p-4 text-xs text-gray-500">Loading…</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs">
              <Input
                value={merged.title || ""}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                onBlur={(e) => save({ title: e.target.value })}
                className="text-sm font-semibold border-none px-0 focus-visible:ring-0"
                placeholder="Task title"
              />
              <Textarea
                value={merged.description || ""}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                onBlur={(e) => save({ description: e.target.value })}
                placeholder="Add a description…"
                className="min-h-[80px] text-xs"
              />
              <Field label="Category">
                <Select value={merged.category || ""} onValueChange={(v) => save({ category: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={merged.priority || "normal"} onValueChange={(v) => save({ priority: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Assignee">
                <Select value={merged.assigneeId || ""} onValueChange={(v) => save({ assigneeId: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Due date">
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={merged.dueDate ? new Date(merged.dueDate).toISOString().slice(0, 10) : ""}
                  onChange={(e) => save({ dueDate: e.target.value || null })}
                />
              </Field>
              <Field label="Linked job">
                {/* Sentinel "__none__" instead of empty string — Radix Select
                    throws if any SelectItem has value="". */}
                <Select
                  value={merged.linkedJobId || "__none__"}
                  onValueChange={(v) => save({ linkedJobId: v === "__none__" ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {jobs.slice(0, 200).map((j) => (
                      <SelectItem key={j.id} value={j.id}>#{j.jobNumber || "?"} {j.title || ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {merged.linkedJobId && (
                  <Link
                    href={`/dispatch?job=${merged.linkedJobId}`}
                    className="text-[10px] text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Open job →
                  </Link>
                )}
              </Field>
              <Field label="Linked equipment">
                <Select
                  value={merged.linkedEquipmentId || "__none__"}
                  onValueChange={(v) => save({ linkedEquipmentId: v === "__none__" ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {equipment.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Recurring">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!merged.recurring}
                    onChange={(e) => save({ recurring: e.target.checked })}
                  />
                  <span className="text-gray-700">Yes</span>
                  {merged.recurring && (
                    <>
                      <span className="text-gray-500 ml-2">every</span>
                      <Input
                        type="number"
                        min={1}
                        className="h-7 w-16 text-xs"
                        value={merged.recurringIntervalDays ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, recurringIntervalDays: e.target.value ? Number(e.target.value) : null }))}
                        onBlur={(e) => save({ recurringIntervalDays: e.target.value ? Number(e.target.value) : null })}
                      />
                      <span className="text-gray-500">days</span>
                    </>
                  )}
                </div>
              </Field>
              {merged.status === "blocked" && (
                <Field label="Blocked reason">
                  <Input
                    value={merged.blockedReason || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, blockedReason: e.target.value }))}
                    onBlur={(e) => save({ blockedReason: e.target.value })}
                    placeholder="What's blocking this?"
                    className="h-8 text-xs"
                  />
                </Field>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-[#A32D2D]"
                onClick={() => {
                  if (taskId && confirm("Delete this task?")) onDelete(taskId);
                }}
                data-testid="task-delete"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
              {merged.status !== "done" ? (
                <Button
                  className="bg-[#39FF14] text-black hover:bg-[#39FF14]/90 font-semibold"
                  onClick={() => save({ status: "done" })}
                  data-testid="task-mark-done"
                >
                  Mark as done
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => save({ status: "todo" })}
                  data-testid="task-reopen"
                >
                  Re-open
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

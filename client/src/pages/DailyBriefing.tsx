import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { utcToNZTime } from "@shared/dateUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Clock,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  Pencil,
  Check,
  X,
  FileText,
  ShieldAlert,
  Wrench,
  ListChecks,
} from "lucide-react";

function formatNZDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getTodayNZ(): string {
  return utcToNZTime(new Date()).date;
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const dy = String(date.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface EquipmentChecklistItem {
  id: string;
  equipment: string;
  checked: boolean;
  checkedAt?: string;
  checkedBy?: string;
  notes?: string;
}

interface Job {
  id: string;
  title?: string;
  address?: string;
  jobAddress?: string;
  scheduledDate?: string;
  assignedTo?: string[];
  status?: string;
  serviceType?: string;
  jobType?: string;
  description?: string;
  specialInstructions?: string;
  equipment?: string[];
  equipmentChecklist?: EquipmentChecklistItem[];
  checklist?: ChecklistItem[];
}

interface DailyJobNote {
  id: string;
  jobId: string;
  date: string;
  note: string;
  createdBy?: string;
  createdAt: string;
}

interface DailyBriefingRecord {
  id: string;
  date: string;
  content: string;
}

interface BriefingData {
  briefing: DailyBriefingRecord | null;
  jobNotes: DailyJobNote[];
  jobs: Job[];
}

function buildGearList(
  job: Job,
): { name: string; fromChecklist: boolean; checked: boolean }[] {
  const seen = new Set<string>();
  const items: { name: string; fromChecklist: boolean; checked: boolean }[] =
    [];

  for (const item of job.equipmentChecklist ?? []) {
    const key = item.equipment.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        name: item.equipment.trim(),
        fromChecklist: true,
        checked: item.checked,
      });
    }
  }

  for (const eq of job.equipment ?? []) {
    const trimmed = eq.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ name: trimmed, fromChecklist: false, checked: false });
    }
  }

  return items;
}

function JobCard({
  job,
  notes,
  date,
  isAdmin,
  onNoteAdded,
  onNoteDeleted,
}: {
  job: Job;
  notes: DailyJobNote[];
  date: string;
  isAdmin: boolean;
  onNoteAdded: () => void;
  onNoteDeleted: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newNote, setNewNote] = useState("");

  // Optimistic checklist state — initialised from the job prop
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    Array.isArray(job.checklist) ? job.checklist : [],
  );

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/daily-job-notes", {
        jobId: job.id,
        date,
        note: newNote.trim(),
      }),
    onSuccess: () => {
      setNewNote("");
      setAdding(false);
      onNoteAdded();
    },
    onError: () =>
      toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest("DELETE", `/api/daily-job-notes/${noteId}`),
    onSuccess: onNoteDeleted,
    onError: () =>
      toast({ title: "Failed to delete note", variant: "destructive" }),
  });

  const toggleChecklistItem = (itemId: string) => {
    const prev = checklist;
    const updated = prev.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    // Optimistic update
    setChecklist(updated);

    apiRequest("PATCH", `/api/jobs/${job.id}`, { checklist: updated }).catch(
      () => {
        // Revert on failure
        setChecklist(prev);
        toast({
          title: "Couldn't save — please try again",
          variant: "destructive",
        });
      },
    );
  };

  const address = job.jobAddress || job.address || "No address";
  const type = job.serviceType || job.jobType || job.title || "Job";

  let timeStr = "";
  if (job.scheduledDate) {
    const d = new Date(job.scheduledDate);
    timeStr = d.toLocaleTimeString("en-NZ", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const gearItems = buildGearList(job);
  const hasDescription = !!job.description?.trim();
  const hasSpecialInstructions = !!job.specialInstructions?.trim();
  const hasGear = gearItems.length > 0;
  const hasBriefingNotes = notes.length > 0 || isAdmin;
  const hasChecklist = checklist.length > 0;

  const doneCount = checklist.filter((i) => i.completed).length;
  const allDone = hasChecklist && doneCount === checklist.length;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Job header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {timeStr && (
          <div className="flex flex-col items-center min-w-[52px] pt-0.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
            <span className="text-xs font-bold text-foreground">{timeStr}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 mb-1">
            {type}
          </span>
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-sm font-medium text-foreground leading-snug">
              {address}
            </span>
          </div>
          {job.assignedTo && job.assignedTo.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {job.assignedTo.join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Work Scope ──────────────────────────────────────────────── */}
      {hasDescription && (
        <div className="mx-3 mb-3 rounded-lg p-3 bg-muted/50 border border-border">
          <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            Work Scope
          </p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {job.description!.trim()}
          </p>
        </div>
      )}

      {/* ── Special Instructions ─────────────────────────────────────── */}
      {hasSpecialInstructions && (
        <div className="mx-3 mb-3 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Special Instructions
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">
            {job.specialInstructions!.trim()}
          </p>
        </div>
      )}

      {/* ── Gear Required ────────────────────────────────────────────── */}
      {hasGear && (
        <div className="mx-3 mb-3 rounded-lg p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            Gear Required
          </p>
          <ul className="space-y-1.5">
            {gearItems.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                {item.fromChecklist ? (
                  <span
                    className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                      item.checked
                        ? "bg-blue-500 border-blue-500"
                        : "border-blue-300 dark:border-blue-700"
                    }`}
                  >
                    {item.checked && (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </span>
                ) : (
                  <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500" />
                  </span>
                )}
                <span
                  className={`text-sm leading-snug ${
                    item.checked
                      ? "line-through text-muted-foreground"
                      : "text-blue-900 dark:text-blue-100"
                  }`}
                >
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Task Checklist ───────────────────────────────────────────── */}
      {hasChecklist && (
        <div className="mx-3 mb-3 rounded-lg overflow-hidden border border-green-200 dark:border-green-800">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-950/40">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" />
              Task Checklist
            </p>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                allDone
                  ? "bg-green-500 text-white"
                  : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
              }`}
            >
              {doneCount}/{checklist.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-green-100 dark:bg-green-900/30">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{
                width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Items */}
          <ul className="divide-y divide-green-100 dark:divide-green-900/30 bg-card">
            {checklist.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => toggleChecklistItem(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left active-elevate-2"
                >
                  {/* Checkbox */}
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      item.completed
                        ? "bg-green-500 border-green-500"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {item.completed && <Check className="w-3 h-3 text-white" />}
                  </span>
                  {/* Label */}
                  <span
                    className={`text-sm leading-snug flex-1 ${
                      item.completed
                        ? "line-through text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {item.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* All done banner */}
          {allDone && (
            <div className="flex items-center justify-center gap-1.5 py-2 bg-green-500">
              <Check className="w-3.5 h-3.5 text-white" />
              <span className="text-xs font-bold text-white">
                All tasks complete
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Briefing Notes (admin-added per-job notes) ──────────────── */}
      {hasBriefingNotes && (
        <div className="mx-3 mb-3 rounded-lg p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Briefing Notes
          </p>

          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No notes for this job
            </p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5 flex-shrink-0 text-xs">
                    •
                  </span>
                  <span className="text-xs text-foreground leading-snug flex-1">
                    {n.note}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => deleteMutation.mutate(n.id)}
                      disabled={deleteMutation.isPending}
                      className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isAdmin && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="mt-2 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add note
            </button>
          )}

          {isAdmin && adding && (
            <div className="mt-2 space-y-2">
              <Textarea
                autoFocus
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Type a briefing note for this job..."
                rows={2}
                className="text-xs resize-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => addMutation.mutate()}
                  disabled={!newNote.trim() || addMutation.isPending}
                  className="h-7 text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setNewNote("");
                  }}
                  className="h-7 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyBriefing() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const today = getTodayNZ();
  const [date, setDate] = useState(today);
  const [editingDayNote, setEditingDayNote] = useState(false);
  const [draftDayNote, setDraftDayNote] = useState("");

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    data: BriefingData;
  }>({
    queryKey: ["/api/daily-briefing", date],
    queryFn: () =>
      fetch(`/api/daily-briefing?date=${date}`).then((r) => r.json()),
  });

  const briefingData = data?.data;
  const dayNote = briefingData?.briefing?.content ?? "";
  const jobs = briefingData?.jobs ?? [];
  const allNotes = briefingData?.jobNotes ?? [];

  const saveDayNoteMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("PUT", "/api/daily-briefing", { date, content }),
    onSuccess: () => {
      setEditingDayNote(false);
      refetch();
    },
    onError: () =>
      toast({ title: "Failed to save note", variant: "destructive" }),
  });

  const startEditDayNote = () => {
    setDraftDayNote(dayNote);
    setEditingDayNote(true);
  };

  const isToday = date === today;

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Page header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-base leading-none">
            Daily Briefing
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAdmin
              ? "Manage day notes & job instructions for your crew"
              : "Today's schedule and instructions"}
          </p>
        </div>
      </div>

      {/* Date navigation */}
      <div className="bg-background border-b border-border px-4 py-2 flex items-center justify-between">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setDate(addDays(date, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="font-semibold text-foreground text-sm">
            {formatNZDate(date)}
          </p>
          {isToday && (
            <span className="text-xs font-medium" style={{ color: "#39FF14" }}>
              Today
            </span>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Next day"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* General Day Note */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div
            className="px-4 py-2 flex items-center justify-between"
            style={{ backgroundColor: "#0f1f0f" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#39FF14" }}
            >
              General Day Note
            </p>
            {isAdmin && !editingDayNote && (
              <button
                onClick={startEditDayNote}
                aria-label="Edit day note"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="px-4 py-3">
            {!editingDayNote ? (
              dayNote ? (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {dayNote}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {isAdmin
                    ? "No note yet — tap the pencil to add one."
                    : "No general note for today."}
                </p>
              )
            ) : (
              <div className="space-y-2">
                <Textarea
                  autoFocus
                  value={draftDayNote}
                  onChange={(e) => setDraftDayNote(e.target.value)}
                  placeholder="Write a morning message for the whole team..."
                  rows={4}
                  className="resize-none text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveDayNoteMutation.mutate(draftDayNote)}
                    disabled={saveDayNoteMutation.isPending}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingDayNote(false)}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Jobs */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-10">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">
              No jobs scheduled for this day
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""} scheduled
            </p>
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  notes={allNotes.filter((n) => n.jobId === job.id)}
                  date={date}
                  isAdmin={isAdmin}
                  onNoteAdded={refetch}
                  onNoteDeleted={refetch}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

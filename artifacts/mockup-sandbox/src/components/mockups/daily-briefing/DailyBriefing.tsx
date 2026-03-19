import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Check,
  X,
  FileText,
  ShieldAlert,
  Wrench,
  ListChecks,
  AlertCircle,
  CalendarDays,
} from "lucide-react";

const CREW_COLORS: Record<string, string> = {
  "Jack H": "#3b82f6",
  "Sam T": "#8b5cf6",
  "Ben R": "#ef4444",
  "Maria C": "#f59e0b",
  "Liam W": "#10b981",
};

function crewInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function CrewBubbles({ crew }: { crew: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {crew.map((name) => {
        const color = CREW_COLORS[name] ?? "#6b7280";
        return (
          <span
            key={name}
            title={name}
            style={{ backgroundColor: color }}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          >
            {crewInitials(name)}
          </span>
        );
      })}
      <span className="text-xs text-gray-500 ml-1">
        {crew.join(", ")}
      </span>
    </div>
  );
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface MockJob {
  id: string;
  time: string;
  address: string;
  type: string;
  crew: string[];
  description: string;
  specialInstructions: string;
  gear: string[];
  checklist: ChecklistItem[];
  briefingNotes: string[];
}

const mockJobs: MockJob[] = [
  {
    id: "1",
    time: "7:30 AM",
    address: "42 Reads Quay, Gisborne",
    type: "Tree Removal",
    crew: ["Jack H", "Sam T"],
    description:
      "Remove two large macrocarpa trees overhanging the boundary fence. Chip all branchwood on site; logs to be cut to firewood lengths and stacked by gate.",
    specialInstructions:
      "Tight access — back truck in from the Reads Quay end only. Customer (Margaret) will be home. She prefers we don't park across the driveway.",
    gear: ["Chainsaw (Stihl MS 500i)", "Chipper", "Climbing harness x2", "Hi-vis vests", "Hard hats"],
    checklist: [
      { id: "c1-1", text: "Site safety check complete", completed: false },
      { id: "c1-2", text: "Exclusion zone set up", completed: false },
      { id: "c1-3", text: "Tree 1 felled & chipped", completed: false },
      { id: "c1-4", text: "Tree 2 felled & chipped", completed: false },
      { id: "c1-5", text: "Site clean-up done", completed: false },
    ],
    briefingNotes: [
      "Margaret has asked us to leave the large rounds — her son is collecting them.",
    ],
  },
  {
    id: "2",
    time: "11:00 AM",
    address: "18 Carnarvon St, Gisborne",
    type: "Stump Grinding",
    crew: ["Jack H"],
    description:
      "Grind four stumps left from last month's removal. Aim to go 150 mm below grade. Backfill with grindings.",
    specialInstructions:
      "Large dog on site — customer says it's friendly but keep gate closed at all times.",
    gear: ["Stump grinder (Vermeer SC252)", "Eye protection", "Hearing protection"],
    checklist: [
      { id: "c2-1", text: "Confirm stump locations with customer", completed: false },
      { id: "c2-2", text: "All four stumps ground to depth", completed: false },
      { id: "c2-3", text: "Backfill and rake level", completed: false },
    ],
    briefingNotes: [],
  },
  {
    id: "3",
    time: "2:00 PM",
    address: "77 Crawford Rd, Wainui",
    type: "Hedge Trimming",
    crew: ["Sam T", "Ben R"],
    description:
      "Trim approximately 40 m of macrocarpa hedge along the road boundary. Keep at 2.5 m height. Load and remove all clippings.",
    specialInstructions: "",
    gear: ["Hedge trimmer (Stihl HS 82)", "Long-reach trimmer", "Trailer"],
    checklist: [
      { id: "c3-1", text: "Hedge trimmed to spec", completed: false },
      { id: "c3-2", text: "Clippings loaded & removed", completed: false },
    ],
    briefingNotes: [],
  },
];

function JobSection({
  icon: Icon,
  label,
  colorClass,
  children,
}: {
  icon: React.ElementType;
  label: string;
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-3 mt-3 border-t border-gray-100">
      <p className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${colorClass}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </p>
      {children}
    </div>
  );
}

function TaskChecklist({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (updated: ChecklistItem[]) => void;
}) {
  const done = items.filter((i) => i.completed).length;
  const total = items.length;
  const allDone = done === total;
  const pct = total > 0 ? (done / total) * 100 : 0;

  const toggle = (id: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)));
  };

  return (
    <div>
      {/* Progress bar + counter */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
            allDone ? "bg-green-500 text-white" : "bg-green-100 text-green-700"
          }`}
        >
          {done}/{total}
        </span>
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex items-center gap-2.5 text-left py-1.5 px-1 rounded-md transition-colors"
            >
              <span
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  item.completed ? "bg-green-500 border-green-500" : "border-gray-300"
                }`}
              >
                {item.completed && <Check className="w-3 h-3 text-white" />}
              </span>
              <span
                className={`text-sm leading-snug flex-1 transition-all ${
                  item.completed ? "line-through text-gray-400" : "text-gray-700"
                }`}
              >
                {item.text}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="flex items-center gap-1.5 mt-2 text-green-600">
          <Check className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">All tasks complete</span>
        </div>
      )}
    </div>
  );
}

function JobCard({ job, isAdmin }: { job: MockJob; isAdmin: boolean }) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(job.checklist);
  const [briefingNotes, setBriefingNotes] = useState<string[]>(job.briefingNotes);
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState("");

  const addNote = () => {
    if (newNote.trim()) {
      setBriefingNotes([...briefingNotes, newNote.trim()]);
      setNewNote("");
      setAddingNote(false);
    }
  };

  const serviceColor: Record<string, string> = {
    "Tree Removal": "bg-red-100 text-red-700",
    "Stump Grinding": "bg-orange-100 text-orange-700",
    "Hedge Trimming": "bg-emerald-100 text-emerald-700",
  };
  const pillColor = serviceColor[job.type] ?? "bg-blue-100 text-blue-700";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        {/* Time + service type */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base font-bold text-gray-900">{job.time}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${pillColor}`}>
            {job.type}
          </span>
        </div>

        {/* Address */}
        <div className="flex items-start gap-1.5 mb-2">
          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800 leading-snug">{job.address}</span>
        </div>

        {/* Crew */}
        <CrewBubbles crew={job.crew} />
      </div>

      {/* Card body — sections separated by interior dividers */}
      <div className="px-4 pb-4">
        {/* Work Scope */}
        {job.description && (
          <JobSection icon={FileText} label="Work Scope" colorClass="text-gray-600">
            <p className="text-sm text-gray-700 leading-relaxed">{job.description}</p>
          </JobSection>
        )}

        {/* Special Instructions */}
        {job.specialInstructions && (
          <JobSection icon={ShieldAlert} label="Special Instructions" colorClass="text-amber-600">
            <p className="text-sm text-amber-900 leading-relaxed">{job.specialInstructions}</p>
          </JobSection>
        )}

        {/* Gear Required */}
        {job.gear.length > 0 && (
          <JobSection icon={Wrench} label="Gear Required" colorClass="text-blue-600">
            <ul className="space-y-1">
              {job.gear.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-sm text-blue-900">{item}</span>
                </li>
              ))}
            </ul>
          </JobSection>
        )}

        {/* Task Checklist */}
        {checklist.length > 0 && (
          <JobSection icon={ListChecks} label="Task Checklist" colorClass="text-green-600">
            <TaskChecklist items={checklist} onChange={setChecklist} />
          </JobSection>
        )}

        {/* Briefing Notes */}
        {(briefingNotes.length > 0 || isAdmin) && (
          <JobSection icon={AlertCircle} label="Briefing Notes" colorClass="text-orange-600">
            {briefingNotes.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No notes for this job yet</p>
            ) : (
              <ul className="space-y-1.5 mb-2">
                {briefingNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-orange-400 mt-0.5 flex-shrink-0 text-xs">•</span>
                    <span className="text-sm text-gray-700 leading-snug flex-1">{note}</span>
                    {isAdmin && (
                      <button
                        onClick={() => setBriefingNotes(briefingNotes.filter((_, j) => j !== i))}
                        className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {isAdmin && !addingNote && (
              <button
                onClick={() => setAddingNote(true)}
                className="mt-1 text-xs text-orange-500 font-medium hover:text-orange-700 transition-colors"
              >
                + Add note
              </button>
            )}

            {isAdmin && addingNote && (
              <div className="mt-2 space-y-2">
                <textarea
                  autoFocus
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type a briefing note..."
                  rows={2}
                  className="w-full text-sm border border-orange-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addNote}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setAddingNote(false); setNewNote(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </JobSection>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className="w-10 h-3 rounded bg-gray-200 animate-pulse mb-1" />
        <div className="w-px flex-1 bg-gray-100" />
      </div>
      <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-3">
        <div className="px-4 pt-4 pb-4 space-y-2.5">
          <div className="flex gap-2">
            <div className="w-16 h-5 rounded bg-gray-200 animate-pulse" />
            <div className="w-24 h-5 rounded-full bg-gray-100 animate-pulse" />
          </div>
          <div className="w-3/4 h-4 rounded bg-gray-100 animate-pulse" />
          <div className="flex gap-1">
            <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" />
            <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <CalendarDays className="w-12 h-12 text-gray-200 mb-4" />
      <p className="text-sm font-semibold text-gray-500 mb-1">Nothing scheduled</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        No jobs are lined up for this day. Enjoy the downtime!
      </p>
    </div>
  );
}

export function DailyBriefing() {
  const today = "Thursday";
  const fullDate = "19 March 2026";

  const [isAdmin, setIsAdmin] = useState(true);
  const [dayNote, setDayNote] = useState(
    "Morning toolbox meeting at 7:30am before leaving the yard. Full PPE required on all sites today — hard hats, hi-vis, and safety boots."
  );
  const [editingDayNote, setEditingDayNote] = useState(false);
  const [draftDayNote, setDraftDayNote] = useState(dayNote);

  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateEmpty, setSimulateEmpty] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-50"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {/* ── App header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-base leading-none">Daily Briefing</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? "Manage day notes & job instructions" : "Today's schedule and instructions"}
          </p>
        </div>
        {/* Role toggle (demo only) */}
        <button
          onClick={() => setIsAdmin(!isAdmin)}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors ${
            isAdmin
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-gray-500 border-gray-200"
          }`}
        >
          {isAdmin ? "Admin" : "Crew"}
        </button>
      </div>

      {/* ── Date navigation (merged hero) ───────────────────────────── */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          {/* Prev arrow pill */}
          <button className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>

          {/* Date display */}
          <div className="text-center flex-1">
            <p className="text-2xl font-extrabold text-gray-900 leading-none">{today}</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-sm text-gray-500">{fullDate}</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                Today
              </span>
            </div>
          </div>

          {/* Next arrow pill */}
          <button className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

        {/* ── General Day Note ──────────────────────────────────────── */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              General Day Note
            </p>
            {isAdmin && !editingDayNote && (
              <button
                onClick={() => { setEditingDayNote(true); setDraftDayNote(dayNote); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="px-4 py-3">
            {!editingDayNote ? (
              dayNote ? (
                <p className="text-sm text-gray-700 leading-relaxed">{dayNote}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  {isAdmin ? "No note yet — tap the pencil to add one." : "No general note for today."}
                </p>
              )
            ) : (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={draftDayNote}
                  onChange={(e) => setDraftDayNote(e.target.value)}
                  rows={4}
                  className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Write a morning message for the whole team..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDayNote(draftDayNote); setEditingDayNote(false); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 inline mr-1" />
                    Save
                  </button>
                  <button
                    onClick={() => setEditingDayNote(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Jobs ─────────────────────────────────────────────────── */}
        {simulateLoading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : simulateEmpty ? (
          <EmptyState />
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
              {mockJobs.length} jobs scheduled
            </p>

            {/* Timeline layout */}
            <div className="relative">
              {/* Vertical connecting line along the time rail */}
              <div className="absolute left-[18px] top-2 bottom-6 w-px bg-gray-200" />

              <div className="space-y-4">
                {mockJobs.map((job) => (
                  <div key={job.id} className="flex gap-3">
                    {/* Time rail */}
                    <div className="flex flex-col items-center pt-1 w-9 flex-shrink-0">
                      {/* Dot on timeline */}
                      <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm z-10 flex-shrink-0" />
                    </div>

                    {/* Job card floated right */}
                    <div className="flex-1 min-w-0 pb-1">
                      <JobCard job={job} isAdmin={isAdmin} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Preview controls — for mockup demo only */}
        <div className="border-t border-dashed border-gray-200 pt-3 mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 text-center mb-2">
            Preview controls
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => { setSimulateLoading(!simulateLoading); setSimulateEmpty(false); }}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                simulateLoading ? "bg-blue-100 text-blue-600 border-blue-200" : "bg-white text-gray-300 border-gray-200"
              }`}
            >
              {simulateLoading ? "Loading on" : "Simulate loading"}
            </button>
            <button
              onClick={() => { setSimulateEmpty(!simulateEmpty); setSimulateLoading(false); }}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                simulateEmpty ? "bg-blue-100 text-blue-600 border-blue-200" : "bg-white text-gray-300 border-gray-200"
              }`}
            >
              {simulateEmpty ? "Empty on" : "Simulate empty"}
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-300 mt-2 pb-2">
            Toggle "Admin / Crew" in the header to preview each role's view
          </p>
        </div>
      </div>
    </div>
  );
}

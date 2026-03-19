import { useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, MapPin, Clock, Users, Plus, Trash2, AlertCircle } from "lucide-react";

const DOMAIN = "/__mockup";

const mockJobs = [
  {
    id: "1",
    time: "7:30 AM",
    address: "42 Reads Quay, Gisborne",
    type: "Tree Removal",
    crew: ["Jack H", "Sam T"],
    notes: [
      "Tight access — back truck in from the Reads Quay end only",
      "Customer (Margaret) will be home. She prefers we don't park across the driveway",
    ],
  },
  {
    id: "2",
    time: "11:00 AM",
    address: "18 Carnarvon St, Gisborne",
    type: "Stump Grinding",
    crew: ["Jack H"],
    notes: [
      "Large dog on site — customer says it's friendly but keep gate closed",
    ],
  },
  {
    id: "3",
    time: "2:00 PM",
    address: "77 Crawford Rd, Wainui",
    type: "Hedge Trimming",
    crew: ["Sam T", "Ben R"],
    notes: [],
  },
];

function JobCard({ job, isAdmin }: { job: typeof mockJobs[0]; isAdmin: boolean }) {
  const [notes, setNotes] = useState(job.notes);
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);

  const addNote = () => {
    if (newNote.trim()) {
      setNotes([...notes, newNote.trim()]);
      setNewNote("");
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Job header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="flex flex-col items-center min-w-[52px]">
          <Clock className="w-3.5 h-3.5 text-gray-400 mb-0.5" />
          <span className="text-xs font-bold text-gray-700">{job.time}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#dcfce7", color: "#166534" }}
            >
              {job.type}
            </span>
          </div>
          <div className="flex items-start gap-1">
            <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800 leading-snug">{job.address}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{job.crew.join(", ")}</span>
          </div>
        </div>
      </div>

      {/* Briefing notes */}
      {(notes.length > 0 || isAdmin) && (
        <div
          className="mx-3 mb-3 rounded-lg p-3"
          style={{ backgroundColor: "#fffbeb", borderLeft: "3px solid #f59e0b" }}
        >
          <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Briefing Notes
          </p>
          {notes.length === 0 && (
            <p className="text-xs text-gray-400 italic">No notes yet</p>
          )}
          <ul className="space-y-1.5">
            {notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span className="text-xs text-gray-700 leading-snug flex-1">{note}</span>
                {isAdmin && (
                  <button
                    onClick={() => setNotes(notes.filter((_, j) => j !== i))}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3 text-gray-300 hover:text-red-400" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Admin: add note */}
          {isAdmin && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="mt-2 flex items-center gap-1 text-xs text-amber-600 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add note
            </button>
          )}
          {isAdmin && adding && (
            <div className="mt-2 flex flex-col gap-1.5">
              <textarea
                autoFocus
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Type a briefing note..."
                rows={2}
                className="w-full text-xs border border-amber-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={addNote}
                  className="text-xs font-semibold px-3 py-1 rounded-md text-white"
                  style={{ backgroundColor: "#39FF14", color: "#0a160a" }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setAdding(false); setNewNote(""); }}
                  className="text-xs text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DailyBriefing() {
  const [isAdmin, setIsAdmin] = useState(true);
  const [dayNote, setDayNote] = useState(
    "Morning toolbox meeting at 7:30am before leaving the yard. Full PPE required on all sites today — hard hats, hi-vis, and safety boots."
  );
  const [editingDayNote, setEditingDayNote] = useState(false);
  const [draftDayNote, setDraftDayNote] = useState(dayNote);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}
    >
      {/* App header */}
      <div
        className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{ backgroundColor: "#0f1f0f" }}
      >
        <ClipboardList className="w-5 h-5" style={{ color: "#39FF14" }} />
        <h1 className="text-white font-bold text-base flex-1">Daily Briefing</h1>
        {/* Role toggle for demo */}
        <button
          onClick={() => setIsAdmin(!isAdmin)}
          className="text-xs px-2 py-1 rounded-full font-medium"
          style={{
            backgroundColor: isAdmin ? "#39FF14" : "#1a2e1a",
            color: isAdmin ? "#0a160a" : "#9ca3af",
          }}
        >
          {isAdmin ? "Admin" : "Crew"}
        </button>
      </div>

      {/* Date navigation */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: "#1a2e1a" }}
      >
        <button className="p-1">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">Thursday, 19 March 2026</p>
          <p className="text-xs" style={{ color: "#39FF14" }}>Today</p>
        </div>
        <button className="p-1">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">

        {/* General Day Note */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "#0f1f0f", border: "1px solid #1a2e1a" }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#39FF14" }}>
              General Day Note
            </p>
            {isAdmin && !editingDayNote && (
              <button
                onClick={() => { setEditingDayNote(true); setDraftDayNote(dayNote); }}
                className="text-xs text-gray-400 underline"
              >
                Edit
              </button>
            )}
          </div>

          {!editingDayNote ? (
            dayNote ? (
              <p className="text-white text-sm leading-relaxed">{dayNote}</p>
            ) : (
              <p className="text-gray-500 text-sm italic">No general note for today.</p>
            )
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                value={draftDayNote}
                onChange={e => setDraftDayNote(e.target.value)}
                rows={4}
                className="w-full text-sm rounded-lg px-3 py-2 resize-none bg-white focus:outline-none"
                placeholder="Write a message for the whole team..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setDayNote(draftDayNote); setEditingDayNote(false); }}
                  className="text-xs font-bold px-4 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#39FF14", color: "#0a160a" }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingDayNote(false)}
                  className="text-xs text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Jobs section */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
            {mockJobs.length} Jobs Scheduled
          </p>
          <div className="space-y-3">
            {mockJobs.map(job => (
              <JobCard key={job.id} job={job} isAdmin={isAdmin} />
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Toggle "Admin / Crew" in the header to preview each role's view
        </p>
      </div>
    </div>
  );
}

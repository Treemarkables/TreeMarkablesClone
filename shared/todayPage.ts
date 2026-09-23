/**
 * Today page (locked today-05) helpers: time/money copy, crew grouping, and
 * All crews / Just me filtering. Extra instructions are ops notes for a person
 * or a whole crew — not job equipment / kit.
 *
 * UI copy in TODAY_COPY must not use hyphens (spaces / "to" / rephrase).
 */

import { sanitizeJobEquipment } from "./jobEquipmentCatalogue.ts";
import type { RiskAssessmentStatus } from "./jhaJobRisk.ts";

export const NO_CREW_ID = "__no_crew__";
export const NO_CREW_NAME = "No crew";

export const TODAY_COPY = {
  allCrews: "All crews",
  justMe: "Just me",
  jobsToday: "jobs today",
  crewsLive: "crews live",
  peopleOut: "people out",
  booked: "booked",
  extraNotes: "extra notes",
  todayNotes: "Today notes",
  notesSubtitle: "Extra instructions for a person or crew",
  add: "Add",
  addInstruction: "Add instruction",
  pickWho: "Pick who",
  pickWhoHint: "Pick who · person or crew · type a short note · save",
  save: "Save",
  loading: "Loading",
  noJobsToday: "No jobs today",
  noJobsForYou: "No jobs for you today",
  noNotes: "No extra notes yet",
  people: "People",
  crews: "Crews",
  live: "live",
  failedToSave: "Could not save the extra instruction",
  failedToRemove: "Could not remove the extra instruction",
  pickWhoNeeded: "Pick a person or crew",
  noteNeeded: "Type a short note",
} as const;

export function notesCountLabel(n: number): string {
  return n === 1 ? "1 note" : `${n} notes`;
}

export function jobsCountLabel(n: number): string {
  return n === 1 ? "1 job" : `${n} jobs`;
}

export type TodayScope = "person" | "crew";
export type TodayView = "all" | "me";

export interface TodayPerson {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  initials: string;
  color: string;
}

export interface TodayNote {
  id: string;
  scope: TodayScope;
  targetId: string;
  targetName: string;
  note: string;
  color: string;
}

export interface TodayJobRow {
  id: string;
  title: string;
  address: string;
  timeLabel: string;
  people: TodayPerson[];
  kit: string[];
  bookedLabel: string;
  bookedAmount: number;
  riskAssessmentStatus: RiskAssessmentStatus;
  riskAssessmentId: string | null;
}

export interface TodayCrewGroup {
  id: string;
  name: string;
  color: string;
  members: TodayPerson[];
  notesCount: number;
  jobs: TodayJobRow[];
}

export interface TodayOverviewData {
  date: string;
  dateLabel: string;
  businessName: string;
  currentEmployeeId: string;
  counts: {
    jobsToday: number;
    crewsLive: number;
    peopleOut: number;
    bookedLabel: string;
    extraNotes: number;
  };
  notes: TodayNote[];
  crews: TodayCrewGroup[];
  peopleOptions: TodayPerson[];
  crewOptions: { id: string; name: string }[];
}

export const PEOPLE_PALETTE = [
  "#f97316", // orange
  "#10b981", // emerald
  "#3b82f6", // blue
  "#a855f7", // purple
  "#eab308", // yellow
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ef4444", // red
] as const;

export const CREW_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#db2777",
  "#0d9488",
] as const;

export function colorForId(id: string, palette: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length];
}

export function uniqueIds(...lists: Array<readonly string[] | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const raw of list) {
      const id = raw?.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function initialsFor(firstName: string, lastName = ""): string {
  const first = firstName.trim();
  if (first) return first.charAt(0).toUpperCase();
  const last = lastName.trim();
  if (last) return last.charAt(0).toUpperCase();
  return "P";
}

export function displayFirstName(
  person: { id: string; firstName: string; lastName: string },
  allFirstNames: Map<string, number>,
): string {
  const first = person.firstName.trim() || "Crew";
  const dup = (allFirstNames.get(first.toLowerCase()) ?? 0) > 1;
  const last = person.lastName.trim();
  if (dup && last) return `${first} ${last.charAt(0).toUpperCase()}`;
  return first;
}

export function formatClock(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return "";
  }
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  if (minute) return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  return `${hour12} ${suffix}`;
}

export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = formatClock(start);
  const to = formatClock(end);
  if (from && to) return `${from} to ${to}`;
  return from || to;
}

export function parseClockToMinutes(hhmm: string | null | undefined): number {
  if (!hhmm) return 24 * 60;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return 24 * 60;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) {
    return 24 * 60;
  }
  return hour * 60 + minute;
}

export function formatBookedAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0";
  if (amount >= 1000) {
    const k = amount / 1000;
    const label = amount % 1000 === 0 ? String(Math.round(k)) : k.toFixed(1);
    return `$${label}k`;
  }
  return `$${Math.round(amount).toLocaleString("en-NZ")}`;
}

export function formatTodayHeading(nzDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nzDate);
  if (!match) return nzDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const labeled = utc.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return labeled.replace(/,/g, "");
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Job price exc. GST. Same hierarchy as Staff Schedule / job cards. */
export function jobBookedAmount(job: {
  lineItems?: Array<{
    total?: number | string | null;
    totalExGst?: number | string | null;
    priceExGst?: number | string | null;
    quantity?: number | string | null;
  }> | null;
  subtotal?: string | number | null;
  totalIncludingGst?: string | number | null;
  totalAmount?: string | number | null;
}): number {
  const lineItems = job.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    const lineItemsTotal = lineItems.reduce((sum, item) => {
      const exGst =
        toNumber(item.totalExGst) ||
        (item.priceExGst != null ? toNumber(item.priceExGst) * toNumber(item.quantity ?? 1) : 0);
      return sum + (exGst || toNumber(item.total));
    }, 0);
    if (lineItemsTotal > 0) return lineItemsTotal;
  }
  const sub = toNumber(job.subtotal);
  if (sub > 0) return sub;
  const incGst = toNumber(job.totalIncludingGst);
  if (incGst > 0) return incGst / 1.15;
  const total = toNumber(job.totalAmount);
  return total > 0 ? total / 1.15 : 0;
}

/** Today kit chips: labels saved on the job card (`jobs.equipment`). */
export function kitLabels(equipment: string[] | null | undefined): string[] {
  return sanitizeJobEquipment(equipment);
}

export interface CrewAssignJob {
  id: string;
  peopleIds: string[];
  startMinutes: number;
}

export interface CrewAssignTeam {
  id: string;
  name: string;
  memberIds: string[];
}

export interface CrewAssignGroup {
  crewId: string;
  jobIds: string[];
}

/** Assign each job to the crew with the most overlapping members. Empty crews omitted. */
export function assignJobsToCrews(
  jobs: CrewAssignJob[],
  teams: CrewAssignTeam[],
): CrewAssignGroup[] {
  const sortedJobs = [...jobs].sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id));
  const byCrew = new Map<string, string[]>();
  const leftover: string[] = [];

  for (const job of sortedJobs) {
    let bestId: string | null = null;
    let bestOverlap = 0;
    for (const team of teams) {
      if (team.memberIds.length === 0) continue;
      const members = new Set(team.memberIds);
      const overlap = job.peopleIds.filter((id) => members.has(id)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestId = team.id;
      }
    }
    if (bestId) {
      const list = byCrew.get(bestId) ?? [];
      list.push(job.id);
      byCrew.set(bestId, list);
    } else {
      leftover.push(job.id);
    }
  }

  const groups: CrewAssignGroup[] = [];
  for (const team of teams) {
    const jobIds = byCrew.get(team.id);
    if (jobIds && jobIds.length > 0) groups.push({ crewId: team.id, jobIds });
  }
  groups.sort((a, b) => {
    const aJob = jobs.find((j) => j.id === a.jobIds[0]);
    const bJob = jobs.find((j) => j.id === b.jobIds[0]);
    return (aJob?.startMinutes ?? 24 * 60) - (bJob?.startMinutes ?? 24 * 60);
  });
  if (leftover.length > 0) groups.push({ crewId: NO_CREW_ID, jobIds: leftover });
  return groups;
}

function notesForCrew(notes: TodayNote[], crew: TodayCrewGroup): number {
  const memberIds = new Set(crew.members.map((m) => m.id));
  return notes.filter((note) => {
    if (note.scope === "crew") return note.targetId === crew.id;
    return memberIds.has(note.targetId);
  }).length;
}

function recount(notes: TodayNote[], crews: TodayCrewGroup[]): TodayOverviewData["counts"] {
  const jobs = crews.flatMap((crew) => crew.jobs);
  const people = new Set(jobs.flatMap((job) => job.people.map((person) => person.id)));
  const booked = jobs.reduce((sum, job) => sum + job.bookedAmount, 0);
  return {
    jobsToday: jobs.length,
    crewsLive: crews.length,
    peopleOut: people.size,
    bookedLabel: formatBookedAmount(booked),
    extraNotes: notes.length,
  };
}

export function applyTodayView(
  data: TodayOverviewData,
  view: TodayView,
  employeeId: string,
): TodayOverviewData {
  if (view === "all" || !employeeId) return data;

  const myCrewIds = new Set(
    data.crews
      .filter(
        (crew) =>
          crew.members.some((member) => member.id === employeeId) ||
          crew.jobs.some((job) => job.people.some((person) => person.id === employeeId)),
      )
      .map((crew) => crew.id),
  );

  const notes = data.notes.filter(
    (note) =>
      (note.scope === "person" && note.targetId === employeeId) ||
      (note.scope === "crew" && myCrewIds.has(note.targetId)),
  );

  const crews = data.crews
    .map((crew) => ({
      ...crew,
      jobs: crew.jobs.filter((job) => job.people.some((person) => person.id === employeeId)),
    }))
    .filter((crew) => crew.jobs.length > 0)
    .map((crew) => {
      const peopleOnJobs = new Set(crew.jobs.flatMap((job) => job.people.map((person) => person.id)));
      const members = crew.members.filter((member) => peopleOnJobs.has(member.id));
      const next = { ...crew, members };
      return { ...next, notesCount: notesForCrew(notes, next) };
    });

  return {
    ...data,
    notes,
    crews,
    counts: recount(notes, crews),
  };
}

export function pickerValue(scope: TodayScope, id: string): string {
  return `${scope}:${id}`;
}

export function parsePickerValue(value: string): { scope: TodayScope; id: string } | null {
  const person = value.startsWith("person:");
  const crew = value.startsWith("crew:");
  if (!person && !crew) return null;
  const id = value.slice(person ? 7 : 5);
  if (!id) return null;
  return { scope: person ? "person" : "crew", id };
}

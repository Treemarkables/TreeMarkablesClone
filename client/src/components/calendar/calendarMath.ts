// Shared pure helpers, constants and types for every calendar surface
// (/calendar views, CalendarGrid on /dispatch). Extracted verbatim from
// CalendarGrid.tsx so both render paths stay pixel- and logic-identical.
import { toZonedTime } from "date-fns-tz";
import {
  REVENUE_EXCLUDE,
  jobDayCount,
  jobQuoteExGst,
  jobRevenue,
} from "@shared/dispatchRevenue";

export { REVENUE_EXCLUDE, jobDayCount, jobQuoteExGst, jobRevenue };

export const NZ_TZ = "Pacific/Auckland";

// ── Gantt (day-view) constants ────────────────────────────────────────────────
// Default the day-view timeline to 8 AM (most jobs start there). Components
// expand the start backwards if the visible day actually contains a job
// scheduled earlier — see computeGanttStartH in useCalendarData.
export const DEFAULT_GANTT_START_H = 8;
export const GANTT_END_H = 19;
export const GANTT_COL_W = 148; // px — name column width (matches StaffSchedule)
export const GANTT_ROW_H = 72; // px — matches StaffSchedule default row height
export const GANTT_MIN_COL_W = 110; // px minimum per hour column — forces horizontal scroll on narrow screens
export const GANTT_MIN_DURATION_MINS = 60; // minimum block size = 1 hour

// Same palette used in Staff Schedule — index-stable colours per crew member
export const GANTT_STAFF_PALETTE = [
  { dot: '#60a5fa', row: '#eff6ff', avatar: '#1e40af' }, // blue-400
  { dot: '#34d399', row: '#f0fdf4', avatar: '#065f46' }, // emerald-400
  { dot: '#fb923c', row: '#fff7ed', avatar: '#9a3412' }, // orange-400
  { dot: '#c084fc', row: '#faf5ff', avatar: '#6b21a8' }, // purple-400
  { dot: '#f472b6', row: '#fdf2f8', avatar: '#9d174d' }, // pink-400
  { dot: '#facc15', row: '#fefce8', avatar: '#713f12' }, // yellow-400
  { dot: '#2dd4bf', row: '#f0fdfa', avatar: '#134e4a' }, // teal-400
  { dot: '#f87171', row: '#fef2f2', avatar: '#991b1b' }, // red-400
];

// Job identity colours — same 12-colour palette as Staff Schedule. Same job →
// same colour across every staff row and every date.
export const JOB_IDENTITY_PALETTE = [
  { bg: '#eff6ff', border: '#2563eb', text: '#1e3a8a' }, // blue-50
  { bg: '#ecfdf5', border: '#059669', text: '#064e3b' }, // emerald-50
  { bg: '#fff7ed', border: '#ea580c', text: '#7c2d12' }, // orange-50
  { bg: '#faf5ff', border: '#a855f7', text: '#6b21a8' }, // purple-50
  { bg: '#fdf2f8', border: '#db2777', text: '#831843' }, // pink-50
  { bg: '#fffbeb', border: '#ca8a04', text: '#713f12' }, // amber-50
  { bg: '#f0fdfa', border: '#0d9488', text: '#134e4a' }, // teal-50
  { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d' }, // red-50
  { bg: '#eef2ff', border: '#4f46e5', text: '#312e81' }, // indigo-50
  { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' }, // green-50
  { bg: '#fefce8', border: '#d97706', text: '#78350f' }, // yellow-50
  { bg: '#f5f3ff', border: '#7c3aed', text: '#4c1d95' }, // violet-50
];
export type JobIdentityColor = (typeof JOB_IDENTITY_PALETTE)[number];

// ── Shared row types (shape of the API payloads the calendar consumes) ───────
export interface CalendarEmployee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  status: string;
  isActive: boolean;
}

export interface CalendarJob {
  id: string;
  jobNumber: string;
  title?: string;
  customerId?: string;
  address: string;
  scheduledDate: string;
  scheduledEndDate?: string;
  scheduledDates?: string[] | null;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  status: string;
  assignedTo: string[];
  serviceType?: string;
  totalAmount?: string;
  totalIncludingGst?: string;
  subtotal?: string;
  customerConfirmed?: boolean;
  customerReplyReceivedAt?: string | Date | null;
  confirmationReplySentAt?: string | Date | null;
  priority?: string | null;
  lineItems?: Array<Record<string, unknown>>;
}

export interface CalendarStaffAssignment {
  id: string;
  jobId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface CalendarCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

// ── Gantt math ────────────────────────────────────────────────────────────────
export function buildGanttHourLabels(startH: number, endH: number): string[] {
  // Labels for the START of each 1-hour slot ((endH - startH) columns, NOT +1).
  // Keeps label positions aligned with the percent helper, which also uses
  // (endH - startH) as the denominator. The last column's right edge implicitly
  // marks endH without a label.
  return Array.from({ length: endH - startH }, (_, i) => {
    const h = startH + i;
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  });
}

export function ganttTimeToMins(t: string | undefined): number {
  if (!t) return 8 * 60;
  const [h, m] = t.split(':').map(Number);
  return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function makeGanttMinsToPercent(startH: number, endH: number) {
  const startMin = startH * 60;
  const totalMin = (endH - startH) * 60;
  return (mins: number) => ((mins - startMin) / totalMin) * 100;
}

export function ganttLaneStyle(lane: number, totalLanes: number) {
  const pct = 100 / totalLanes;
  return { top: `calc(${lane * pct}% + 3px)`, height: `calc(${pct}% - 6px)` };
}

// Accept pre-computed effective times so assignment UTC times can be used as fallback
export function assignGanttLanes(items: { id: string; startMins: number; endMins: number }[]) {
  const sorted = [...items].sort((a, b) => a.startMins - b.startMins);
  const laneEnd: number[] = [];
  const laneOf = new Map<string, number>();
  for (const item of sorted) {
    let placed = -1;
    for (let l = 0; l < laneEnd.length; l++) {
      if (laneEnd[l] <= item.startMins) { placed = l; laneEnd[l] = item.endMins; break; }
    }
    if (placed === -1) { placed = laneEnd.length; laneEnd.push(item.endMins); }
    laneOf.set(item.id, placed);
  }
  const total = laneEnd.length || 1;
  const result = new Map<string, { lane: number; totalLanes: number }>();
  laneOf.forEach((lane, id) => result.set(id, { lane, totalLanes: total }));
  return result;
}

export function ganttInitials(emp: { firstName: string; lastName: string }): string {
  return `${(emp.firstName || ' ')[0]}${(emp.lastName || ' ')[0]}`.toUpperCase();
}

export function ganttFormatTime(t: string | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

// Format NZ minutes-since-midnight (0..1439) to "H AM/PM" string
export function ganttFormatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

// Visible time ranges on despatch calendar cards use "to", never a hyphen/en-dash.
export function ganttFormatRange(start: string, end: string): string {
  const a = start.trim();
  const b = end.trim();
  if (a && b) return `${a} to ${b}`;
  return a || b;
}

export function ganttStreetAddress(address: string | undefined | null): string {
  if (!address) return "";
  return address.split(",")[0]?.trim() || "";
}

export function ganttJobName(
  job: Pick<CalendarJob, "title" | "jobNumber">,
  customerName?: string,
): string {
  const title = job.title?.trim();
  if (title) return title;
  const name = customerName?.trim();
  if (name) return name;
  return job.jobNumber ? `#${job.jobNumber}` : "";
}

// Compute effective Gantt minutes for a job block.
// Priority: scheduledStartTime/EndTime text → assignment UTC times → 8 AM default.
export function effectiveGanttMins(
  job: CalendarJob,
  assignment: CalendarStaffAssignment | null,
): { startMins: number; endMins: number; fromAssignment: boolean } {
  if (job.scheduledStartTime) {
    const startMins = ganttTimeToMins(job.scheduledStartTime);
    const rawEnd = job.scheduledEndTime ? ganttTimeToMins(job.scheduledEndTime) : startMins + GANTT_MIN_DURATION_MINS;
    return { startMins, endMins: Math.max(rawEnd, startMins + GANTT_MIN_DURATION_MINS), fromAssignment: false };
  }
  if (assignment) {
    const startNZ = toZonedTime(new Date(assignment.startTime), NZ_TZ);
    const endNZ = toZonedTime(new Date(assignment.endTime), NZ_TZ);
    const startMins = startNZ.getHours() * 60 + startNZ.getMinutes();
    const rawEnd = endNZ.getHours() * 60 + endNZ.getMinutes();
    return { startMins, endMins: Math.max(rawEnd, startMins + GANTT_MIN_DURATION_MINS), fromAssignment: true };
  }
  return { startMins: 8 * 60, endMins: 9 * 60, fromAssignment: false };
}

export function formatNZD(amount: number): string {
  return amount === 0
    ? "$0"
    : `$${amount >= 1000 ? (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + "k" : Math.round(amount).toLocaleString()}`;
}

export function revenueColor(amount: number, target: number | null): string {
  if (target == null || target <= 0) return "text-foreground bg-muted border-border";
  if (amount >= target) return "text-green-700 bg-green-50 border-green-200";
  if (amount >= target * 0.7) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export function revenueBarClass(amount: number, target: number | null): string {
  if (target == null || target <= 0) return "bg-muted-foreground/30";
  if (amount >= target) return "bg-green-500";
  if (amount >= target * 0.7) return "bg-amber-400";
  return "bg-red-400";
}

export function revenueBarPercent(amount: number, target: number | null): number {
  if (target == null || target <= 0) return 0;
  return Math.min(100, (amount / target) * 100);
}

export function revenueChipClass(amount: number, target: number | null): string {
  if (target == null || target <= 0) return "text-muted-foreground bg-muted";
  if (amount >= target) return "text-green-700 bg-green-50";
  if (amount >= target * 0.7) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

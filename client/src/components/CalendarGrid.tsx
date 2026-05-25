import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Check, GripVertical, MapPin, AlignJustify, MessageSquare } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  isSameDayNZ,
  isBetweenNZ,
  getNZDateString,
  nzTimeToUTC,
} from "@shared/dateUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import { JobCardErrorBoundary } from "@/components/JobCardErrorBoundary";
import { useToast } from "@/hooks/use-toast";

const NZ_TZ = "Pacific/Auckland";

// ── Gantt (day-view) constants & helpers ──────────────────────────────────────
// Default the day-view timeline to 8 AM (most jobs start there). The component
// expands the start backwards if the visible day actually contains a job
// scheduled earlier — see ganttStartH inside the component.
const DEFAULT_GANTT_START_H = 8;
const GANTT_END_H            = 19;

function buildGanttHourLabels(startH: number, endH: number): string[] {
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
// Same palette used in Staff Schedule — index-stable colours per crew member
const GANTT_STAFF_PALETTE = [
  { dot: '#60a5fa', row: '#eff6ff', avatar: '#1e40af' }, // blue-400 (was blue-500)
  { dot: '#34d399', row: '#f0fdf4', avatar: '#065f46' }, // emerald-400
  { dot: '#fb923c', row: '#fff7ed', avatar: '#9a3412' }, // orange-400
  { dot: '#c084fc', row: '#faf5ff', avatar: '#6b21a8' }, // purple-400
  { dot: '#f472b6', row: '#fdf2f8', avatar: '#9d174d' }, // pink-400
  { dot: '#facc15', row: '#fefce8', avatar: '#713f12' }, // yellow-400
  { dot: '#2dd4bf', row: '#f0fdfa', avatar: '#134e4a' }, // teal-400
  { dot: '#f87171', row: '#fef2f2', avatar: '#991b1b' }, // red-400
];
const GANTT_COL_W = 148; // px — name column width (matches StaffSchedule)
const GANTT_ROW_H = 72;  // px — matches StaffSchedule default row height
const GANTT_MIN_COL_W = 110; // px minimum per hour column — forces horizontal scroll on narrow screens

const GANTT_MIN_DURATION_MINS = 60; // minimum block size = 1 hour

function ganttTimeToMins(t: string | undefined): number {
  if (!t) return 8 * 60;
  const [h, m] = t.split(':').map(Number);
  return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
}
function makeGanttMinsToPercent(startH: number, endH: number) {
  const startMin = startH * 60;
  const totalMin = (endH - startH) * 60;
  return (mins: number) => ((mins - startMin) / totalMin) * 100;
}
function ganttLaneStyle(lane: number, totalLanes: number) {
  const pct = 100 / totalLanes;
  return { top: `calc(${lane * pct}% + 3px)`, height: `calc(${pct}% - 6px)` };
}
// Accept pre-computed effective times so assignment UTC times can be used as fallback
function assignGanttLanes(items: { id: string; startMins: number; endMins: number }[]) {
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
  for (const [id, lane] of laneOf) result.set(id, { lane, totalLanes: total });
  return result;
}
function ganttInitials(emp: { firstName: string; lastName: string }): string {
  return `${(emp.firstName || ' ')[0]}${(emp.lastName || ' ')[0]}`.toUpperCase();
}
function ganttFormatTime(t: string | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}
// Format NZ minutes-since-midnight (0..1439) to "H AM/PM" string
function ganttFormatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  status: string;
  isActive: boolean;
}

interface Job {
  id: string;
  jobNumber: string;
  title?: string;
  customerId?: string;
  address: string;
  scheduledDate: string;
  scheduledEndDate?: string;
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
}

interface StaffAssignment {
  id: string;
  jobId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface Customer {
  id: string;
  name: string;
}

type ViewMode = "day" | "week" | "2weeks" | "4weeks" | "month";

interface CalendarGridProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  onJobDrop?: (
    jobId: string,
    date: Date,
    hour: number,
    employeeId: string,
  ) => void;
  draggingJob?: {
    id: string;
    durationHours: number;
    customerName: string;
  } | null;
}

export function CalendarGrid({
  selectedDate: externalDate,
  onDateChange,
  onJobDrop,
  draggingJob,
}: CalendarGridProps = {}) {
  const [internalDate, setInternalDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [ganttRowHeight, setGanttRowHeight] = useState(72);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [dayViewDragOver, setDayViewDragOver] = useState<string | null>(null); // employeeId or 'unassigned'
  const [dayViewDragHour, setDayViewDragHour] = useState<{ employeeId: string; hour: number } | null>(null);
  const [showRevBreakdown, setShowRevBreakdown] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Track internal drag state (job blocks dragged within the calendar)
  const dragRef = useRef<{
    jobId: string;
    employeeId: string;
    assignmentId: string | null;
    durationHours: number;
  } | null>(null);

  // Swipe-to-navigate refs
  const swipeTouchStartX = useRef<number | null>(null);
  const swipeTouchStartY = useRef<number | null>(null);

  const currentDate = externalDate || internalDate;
  const setCurrentDate = (date: Date) => {
    if (onDateChange) onDateChange(date);
    else setInternalDate(date);
  };

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || swipeTouchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - swipeTouchStartX.current;
    const deltaY = e.changedTouches[0].clientY - swipeTouchStartY.current;
    swipeTouchStartX.current = null;
    swipeTouchStartY.current = null;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) goToNext();
      else goToPrevious();
    }
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: employeesData } = useQuery<{
    success: boolean;
    data: Employee[];
  }>({
    queryKey: ["/api/employees/active"],
  });
  const { data: jobsData } = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ["/api/jobs?limit=10000&offset=0"],
  });
  const { data: assignmentsData } = useQuery<{
    success: boolean;
    data: StaffAssignment[];
  }>({
    queryKey: ["/api/staff-assignments"],
    refetchInterval: 30000,
  });
  const { data: customersData } = useQuery<{
    success: boolean;
    data: Customer[];
  }>({
    queryKey: ["/api/customers"],
  });
  const { data: businessSettingsData } = useQuery<{
    success: boolean;
    data: { dailyRevenueTarget?: string | number | null };
  }>({
    queryKey: ["/api/business-settings"],
  });

  const employees = employeesData?.data || [];
  const allJobs = jobsData?.data || [];
  const allAssignments = assignmentsData?.data || [];
  const customers = customersData?.data || [];

  // ── Derived maps ───────────────────────────────────────────────────────────
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    allJobs.forEach((j) => map.set(j.id, j));
    return map;
  }, [allJobs]);

  // ── Job identity colours — same 12-colour palette as Staff Schedule ────────
  const JOB_IDENTITY_PALETTE = [
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

  // Assign a stable colour to each job based on sorted job number order.
  // Same job → same colour across every staff row and every date.
  const jobColorMap = useMemo(() => {
    const sorted = [...allJobs].sort((a, b) => (a.jobNumber ?? 0) - (b.jobNumber ?? 0));
    const map = new Map<string, typeof JOB_IDENTITY_PALETTE[0]>();
    sorted.forEach((job, idx) => {
      map.set(job.id, JOB_IDENTITY_PALETTE[idx % JOB_IDENTITY_PALETTE.length]);
    });
    return map;
  }, [allJobs]);

  const getJobColor = (jobId: string) =>
    jobColorMap.get(jobId) ?? JOB_IDENTITY_PALETTE[0];

  // employee+date → [{assignment, job}]
  // Keys use NZ date strings so UTC-stored startTimes are bucketed correctly
  const assignmentsByEmployeeDate = useMemo(() => {
    const map = new Map<string, { assignment: StaffAssignment; job: Job }[]>();
    allAssignments.forEach((a) => {
      const job = jobMap.get(a.jobId);
      if (!job || job.status === "archived" || job.status === "unsuccessful")
        return;
      // getNZDateString converts UTC → NZ date (e.g. "2026-03-16T19:00Z" → "2026-03-17")
      const nzDateStr = getNZDateString(a.startTime);
      const key = `${a.employeeId}__${nzDateStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ assignment: a, job });
    });
    return map;
  }, [allAssignments, jobMap]);

  // Separate index: employee → list of multi-day jobs (one entry per job, not per day).
  // Used to make day 2+ of a multi-day job appear when only one assignment record
  // exists for the employee (the one keyed to the start day).
  const multiDayByEmployee = useMemo(() => {
    const map = new Map<string, { assignment: StaffAssignment; job: Job }[]>();
    allAssignments.forEach((a) => {
      const job = jobMap.get(a.jobId);
      if (
        !job ||
        job.status === "archived" ||
        job.status === "unsuccessful" ||
        !job.scheduledDate ||
        !job.scheduledEndDate
      )
        return;
      const startNZ = getNZDateString(new Date(job.scheduledDate));
      const endNZ = getNZDateString(new Date(job.scheduledEndDate));
      if (startNZ >= endNZ) return; // single-day or bad data — skip
      if (!map.has(a.employeeId)) map.set(a.employeeId, []);
      const list = map.get(a.employeeId)!;
      if (!list.some((x) => x.job.id === job.id)) {
        list.push({ assignment: a, job });
      }
    });
    return map;
  }, [allAssignments, jobMap]);

  // Helper: returns multiDay entries for an employee that span a given NZ date
  // AND whose start date is NOT the same as that date (so we don't double-count day 1).
  const multiDaySpanningDate = (employeeId: string, dateKey: string) =>
    (multiDayByEmployee.get(employeeId) || []).filter(({ job }) => {
      const startNZ = getNZDateString(new Date(job.scheduledDate!));
      const endNZ = getNZDateString(new Date(job.scheduledEndDate!));
      return dateKey > startNZ && dateKey <= endNZ;
    });

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToPrevious = () => {
    if (viewMode === "day") setCurrentDate(subDays(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else if (viewMode === "2weeks") setCurrentDate(subWeeks(currentDate, 2));
    else if (viewMode === "4weeks") setCurrentDate(subWeeks(currentDate, 4));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const goToNext = () => {
    if (viewMode === "day") setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else if (viewMode === "2weeks") setCurrentDate(addWeeks(currentDate, 2));
    else if (viewMode === "4weeks") setCurrentDate(addWeeks(currentDate, 4));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  // ── Date range ─────────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    if (viewMode === "day") return [startOfDay(currentDate)];
    if (viewMode === "week")
      return eachDayOfInterval({
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate),
      });
    if (viewMode === "2weeks")
      return eachDayOfInterval({
        start: startOfWeek(currentDate),
        end: endOfWeek(addWeeks(currentDate, 1)),
      });
    if (viewMode === "4weeks")
      return eachDayOfInterval({
        start: startOfWeek(currentDate),
        end: endOfWeek(addWeeks(currentDate, 3)),
      });
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });
  }, [currentDate, viewMode]);

  // ── Time slots (7 am – 6 pm) ───────────────────────────────────────────────
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 18; h++) {
      slots.push({
        hour: h,
        label: format(new Date().setHours(h, 0), "h:00 a"),
      });
    }
    return slots;
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCustomerName = (job: Job) => {
    if (job.customerId)
      return customerMap.get(job.customerId) || job.title || "Unknown Customer";
    return job.title || "No Customer";
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "scheduled":
        return "bg-blue-100 border-blue-300 text-blue-800";
      case "work_order":
        return "bg-amber-100 border-amber-300 text-amber-800";
      case "in_progress":
        return "bg-yellow-100 border-yellow-300 text-yellow-800";
      case "completed":
        return "bg-green-100 border-green-300 text-green-800";
      case "cancelled":
        return "bg-red-100 border-red-300 text-red-800";
      default:
        return "bg-gray-100 border-gray-300 text-gray-800";
    }
  };

  // Jobs for a specific employee + hour slot (day view)
  // Uses staff assignments as primary source; falls back to job.assignedTo
  const getItemsForHour = (employeeId: string, date: Date, hour: number) => {
    const dateKey = getNZDateString(date);
    const assigned =
      assignmentsByEmployeeDate.get(`${employeeId}__${dateKey}`) || [];

    // Filter to assignments that overlap with this hour
    const fromAssignments = assigned.filter(({ assignment }) => {
      const startNZ = toZonedTime(new Date(assignment.startTime), NZ_TZ);
      const endNZ = toZonedTime(new Date(assignment.endTime), NZ_TZ);
      const startH = startNZ.getHours() + startNZ.getMinutes() / 60;
      const endH = endNZ.getHours() + endNZ.getMinutes() / 60;
      return startH < hour + 1 && endH > hour;
    });

    // Day 2+ of multi-day jobs: the assignment is only stored under day 1's key,
    // so look it up from multiDayByEmployee instead of the date-keyed map.
    const seenIds = new Set(fromAssignments.map((x) => x.job.id));
    const fromMultiDay = multiDaySpanningDate(employeeId, dateKey).filter(
      ({ job }) => {
        if (seenIds.has(job.id)) return false;
        if (!job.scheduledStartTime) return hour === 7;
        const [sh] = job.scheduledStartTime.split(":").map(Number);
        const eh = job.scheduledEndTime
          ? Number(job.scheduledEndTime.split(":")[0])
          : sh + 2;
        return sh < hour + 1 && eh > hour;
      },
    );

    if (fromAssignments.length > 0 || fromMultiDay.length > 0) {
      return [
        ...fromAssignments.map((x) => x.job),
        ...fromMultiDay.map((x) => x.job),
      ];
    }

    // Fallback: jobs with job.assignedTo (no assignment record at all)
    return allJobs.filter((job) => {
      if (job.status === "archived" || job.status === "unsuccessful")
        return false;
      if (!job.scheduledDate) return false;
      if (!job.assignedTo?.includes(employeeId)) return false;
      if (!isSameDayNZ(job.scheduledDate, date)) return false;
      if (job.scheduledStartTime) {
        const [sh] = job.scheduledStartTime.split(":").map(Number);
        const eh = job.scheduledEndTime
          ? Number(job.scheduledEndTime.split(":")[0])
          : sh + 2;
        return sh < hour + 1 && eh > hour;
      }
      return hour === 7;
    });
  };

  // Jobs for a specific employee + date cell (week/month view)
  const getItemsForDate = (employeeId: string, date: Date) => {
    const dateKey = getNZDateString(date);
    const assigned =
      assignmentsByEmployeeDate.get(`${employeeId}__${dateKey}`) || [];

    // Day 2+ of multi-day jobs (assignment only stored under day 1 key)
    const seenIds = new Set(assigned.map((x) => x.job.id));
    const fromMultiDay = multiDaySpanningDate(employeeId, dateKey).filter(
      (x) => !seenIds.has(x.job.id),
    );

    if (assigned.length > 0 || fromMultiDay.length > 0) {
      return [...assigned.map((x) => x.job), ...fromMultiDay.map((x) => x.job)];
    }

    // Fallback: jobs with job.assignedTo (no assignment record at all)
    return allJobs.filter((job) => {
      if (job.status === "archived" || job.status === "unsuccessful")
        return false;
      if (!job.assignedTo?.includes(employeeId)) return false;
      if (!job.scheduledDate) return false;
      return job.scheduledEndDate
        ? isBetweenNZ(
            date,
            new Date(job.scheduledDate),
            new Date(job.scheduledEndDate),
          )
        : isSameDayNZ(job.scheduledDate, date);
    });
  };

  // ── Day-view Gantt items (returns job + assignment pair) ────────────────────
  // Returns { job, assignment } pairs for a given employee on the current day.
  // The assignment is used as a fallback for block positioning when the job has no scheduledStartTime.
  const getDayGanttItems = (employeeId: string, date: Date): { job: Job; assignment: StaffAssignment | null }[] => {
    const dateKey = getNZDateString(date);
    const assigned = assignmentsByEmployeeDate.get(`${employeeId}__${dateKey}`) || [];
    const seenIds = new Set(assigned.map((x) => x.job.id));
    const fromMultiDay = multiDaySpanningDate(employeeId, dateKey).filter(({ job }) => !seenIds.has(job.id));
    if (assigned.length > 0 || fromMultiDay.length > 0) {
      return [
        ...assigned.map((x) => ({ job: x.job, assignment: x.assignment })),
        ...fromMultiDay.map((x) => ({ job: x.job, assignment: x.assignment })),
      ];
    }
    // Fallback: jobs with job.assignedTo (no assignment record at all)
    return allJobs.filter((job) => {
      if (job.status === "archived" || job.status === "unsuccessful") return false;
      if (!job.assignedTo?.includes(employeeId)) return false;
      if (!job.scheduledDate) return false;
      return job.scheduledEndDate
        ? isBetweenNZ(date, new Date(job.scheduledDate), new Date(job.scheduledEndDate))
        : isSameDayNZ(job.scheduledDate, date);
    }).map((job) => ({ job, assignment: null }));
  };

  // Compute effective Gantt minutes for a job block.
  // Priority: scheduledStartTime/EndTime text → assignment UTC times → 8 AM default.
  const effectiveGanttMins = (job: Job, assignment: StaffAssignment | null): { startMins: number; endMins: number; fromAssignment: boolean } => {
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
  };

  // Jobs for the selected day with a scheduledDate but NO assignment record for any employee.
  // These are shown in the "Unassigned" swim lane at the top of the day-view Gantt.
  const unassignedJobsForDay = useMemo((): Job[] => {
    if (viewMode !== "day") return [];
    const dateKey = getNZDateString(currentDate);
    const assignedJobIds = new Set<string>();
    for (const [key, items] of assignmentsByEmployeeDate) {
      if (key.endsWith(`__${dateKey}`)) {
        items.forEach(({ job }) => assignedJobIds.add(job.id));
      }
    }
    // Pre-schedule statuses (lead/quote/work_order) aren't on the calendar yet —
    // if a stale scheduledDate lingers on one of those, don't surface it here.
    const EXCLUDE = new Set([
      'archived',
      'unsuccessful',
      'cancelled',
      'lead',
      'quote',
      'work_order',
    ]);
    return allJobs.filter((job) => {
      if (EXCLUDE.has(job.status)) return false;
      if (assignedJobIds.has(job.id)) return false;
      if (!job.scheduledDate) return false;
      return job.scheduledEndDate
        ? isBetweenNZ(currentDate, new Date(job.scheduledDate), new Date(job.scheduledEndDate))
        : isSameDayNZ(job.scheduledDate, currentDate);
    });
  }, [viewMode, currentDate, assignmentsByEmployeeDate, allJobs]);

  // Dynamic day-view timeline start — default 8 AM, expand backwards (down to
  // 0) if the visible day has any job/assignment scheduled before then. Hours
  // before the earliest block are hidden so the grid isn't padded with empty
  // 6/7 AM cells. Mirrors the StaffSchedule logic.
  const ganttStartH = useMemo(() => {
    if (viewMode !== "day") return DEFAULT_GANTT_START_H;
    const dateKey = getNZDateString(currentDate);

    const startMinsFor = (job: Job, assignment: StaffAssignment | null): number => {
      if (job.scheduledStartTime) return ganttTimeToMins(job.scheduledStartTime);
      if (assignment) {
        const startNZ = toZonedTime(new Date(assignment.startTime), NZ_TZ);
        return startNZ.getHours() * 60 + startNZ.getMinutes();
      }
      return 8 * 60;
    };

    let earliestMins = DEFAULT_GANTT_START_H * 60;
    for (const [key, items] of assignmentsByEmployeeDate.entries()) {
      if (!key.endsWith(`__${dateKey}`)) continue;
      for (const { job, assignment } of items) {
        const m = startMinsFor(job, assignment);
        if (m < earliestMins) earliestMins = m;
      }
    }
    for (const job of unassignedJobsForDay) {
      const m = startMinsFor(job, null);
      if (m < earliestMins) earliestMins = m;
    }
    return Math.max(0, Math.min(DEFAULT_GANTT_START_H, Math.floor(earliestMins / 60)));
  }, [viewMode, currentDate, assignmentsByEmployeeDate, unassignedJobsForDay]);

  const ganttHours = GANTT_END_H - ganttStartH;
  const ganttHourLabels = useMemo(
    () => buildGanttHourLabels(ganttStartH, GANTT_END_H),
    [ganttStartH],
  );
  const ganttMinsToPercent = useMemo(
    () => makeGanttMinsToPercent(ganttStartH, GANTT_END_H),
    [ganttStartH],
  );

  // ── Revenue helpers ─────────────────────────────────────────────────────────
  // Statuses that don't represent confirmed revenue (quotes/leads aren't booked work)
  const REVENUE_EXCLUDE = new Set(['archived', 'unsuccessful', 'cancelled', 'quote', 'lead']);

  // Returns the unique set of revenue-generating jobs on a given date (no duplicates across staff rows)
  const getUniqueJobsForDate = (date: Date): Job[] => {
    const dateKey = getNZDateString(date);
    const seen = new Set<string>();
    const result: Job[] = [];
    // Primary: staff assignments
    for (const [key, items] of assignmentsByEmployeeDate.entries()) {
      if (!key.endsWith(`__${dateKey}`)) continue;
      items.forEach(({ job }) => {
        if (!seen.has(job.id) && !REVENUE_EXCLUDE.has(job.status)) {
          seen.add(job.id);
          result.push(job);
        }
      });
    }
    // Fallback: jobs with scheduledDate (no assignment record)
    allJobs.forEach((job) => {
      if (
        seen.has(job.id) ||
        REVENUE_EXCLUDE.has(job.status) ||
        !job.scheduledDate
      )
        return;
      const spans = job.scheduledEndDate
        ? isBetweenNZ(
            date,
            new Date(job.scheduledDate),
            new Date(job.scheduledEndDate),
          )
        : isSameDayNZ(job.scheduledDate, date);
      if (spans) {
        seen.add(job.id);
        result.push(job);
      }
    });
    return result;
  };

  const DAY_TARGET = Number(businessSettingsData?.data?.dailyRevenueTarget) || 3500;

  // Number of calendar days a job spans (minimum 1)
  const jobDayCount = (job: Job): number => {
    if (!job.scheduledDate || !job.scheduledEndDate) return 1;
    const startKey = getNZDateString(new Date(job.scheduledDate));
    const endKey = getNZDateString(new Date(job.scheduledEndDate));
    if (endKey <= startKey) return 1;
    const startMs = new Date(startKey + "T12:00:00Z").getTime();
    const endMs = new Date(endKey + "T12:00:00Z").getTime();
    return Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
  };

  // Per-day share of a job's exc-GST price. Multi-day jobs render in N day cells
  // across week/2week views, so the price MUST be divided by jobDayCount or the
  // same total double-counts in every cell. Use this for any per-day price label
  // — do not introduce a separate "full price" helper for cell rendering.
  //
  // Hierarchy mirrors the canonical desktop GlobalJobCard header (lines 4582-
  // 4613) and the Live Roster `getJobPrice` fixed in PR #28: line items
  // (ex-GST) → job.subtotal → job.totalIncludingGst / 1.15 → job.totalAmount
  // / 1.15. Jobs created from accepted proposals carry `lineItems` populated
  // but no rolled-up `subtotal`, so without the lineItems check those jobs
  // contribute $0 to the day's revenue bar even though they're worth real
  // money — same blank-price symptom that surfaced on the Live Roster.
  const jobRevenue = (job: Job): number => {
    const toNum = (v: unknown): number => {
      if (v == null) return 0;
      const n = typeof v === "string" ? parseFloat(v) : (v as number);
      return Number.isFinite(n) ? n : 0;
    };
    const raw = (() => {
      const lineItems = (job as any).lineItems as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        const lineItemsTotal = lineItems.reduce((sum, li) => {
          const exGst =
            toNum(li.totalExGst) ||
            (li.priceExGst != null ? toNum(li.priceExGst) * toNum(li.quantity || 1) : 0);
          return sum + (exGst || toNum(li.total));
        }, 0);
        if (lineItemsTotal > 0) return Math.round(lineItemsTotal * 100) / 100;
      }
      const sub = parseFloat(job.subtotal || "0");
      if (sub > 0) return sub;
      const incGst = parseFloat(job.totalIncludingGst || "0");
      if (incGst > 0) return Math.round((incGst / 1.15) * 100) / 100;
      const total = parseFloat(job.totalAmount || "0");
      if (total > 0) return Math.round((total / 1.15) * 100) / 100;
      return 0;
    })();
    return raw / jobDayCount(job);
  };

  const revenueForDate = (date: Date): number =>
    getUniqueJobsForDate(date).reduce((sum, job) => sum + jobRevenue(job), 0);

  // Day-view: single total for currentDate
  const dayRevenue = useMemo(() => {
    if (viewMode !== "day") return null;
    return revenueForDate(currentDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentDate, assignmentsByEmployeeDate, allJobs]);

  // Week/2week-view: per-date totals keyed by ISO date string
  const weekRevenue = useMemo(() => {
    if (viewMode === "day") return {};
    const map: Record<string, number> = {};
    dateRange.forEach((d) => {
      map[format(d, "yyyy-MM-dd")] = revenueForDate(d);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, dateRange, assignmentsByEmployeeDate, allJobs]);

  const revenueColor = (amount: number) => {
    if (amount >= DAY_TARGET)
      return "text-green-700 bg-green-50 border-green-200";
    if (amount >= DAY_TARGET * 0.7)
      return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  const formatNZD = (amount: number) =>
    amount === 0
      ? "$0"
      : `$${amount >= 1000 ? (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + "k" : Math.round(amount).toLocaleString()}`;

  // Per-day exc-GST price for a job, used by cell labels. Aliased to jobRevenue
  // so cells in week/2week views show the per-day share, not the full total
  // duplicated across every day. Do NOT reintroduce a non-splitting variant.
  const getJobPrice = jobRevenue;

  // Round to the same $100 display unit that the k-formatter uses, so the badge
  // ("$3.0k") and "to go" always add up to the target on screen.
  const displayDayRevenue =
    dayRevenue !== null
      ? dayRevenue >= 1000
        ? Math.round(dayRevenue / 100) * 100
        : Math.round(dayRevenue)
      : null;

  // ── Internal reschedule (drag within calendar) ────────────────────────────
  const handleInternalReschedule = async (
    jobId: string,
    fromEmployeeId: string,
    assignmentId: string | null,
    durationHours: number,
    toHour: number,
    toEmployeeId: string,
    toDate: Date,
  ) => {
    const job = jobMap.get(jobId);
    if (!job) return;

    const nzDateStr = toDate.toLocaleDateString("en-CA", {
      timeZone: "Pacific/Auckland",
    });
    const endHour = Math.min(toHour + durationHours, 23);
    const startTimeStr = `${String(toHour).padStart(2, "0")}:00`;
    const endTimeStr = `${String(endHour).padStart(2, "0")}:00`;

    const startDateTime = nzTimeToUTC(nzDateStr, startTimeStr);
    const endDateTime = nzTimeToUTC(nzDateStr, endTimeStr);

    try {
      if (assignmentId) {
        await fetch(`/api/staff-assignments/${assignmentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            employeeId: toEmployeeId,
          }),
        });
      } else {
        // No assignment record — create one
        await fetch(`/api/jobs/${jobId}/staff-assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffAssignments: [
              {
                employeeId: toEmployeeId,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                notes: "",
              },
            ],
            sendNotifications: false,
            sendClientNotification: false,
            addOnly: true,
          }),
        });
      }

      await fetch(`/api/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: startDateTime.toISOString() }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs?limit=10000&offset=0"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch {
      toast({
        title: "Reschedule failed",
        description: "Could not update the job time.",
        variant: "destructive",
      });
    }
  };

  // ── Date range label ───────────────────────────────────────────────────────
  const dateRangeDisplay = useMemo(() => {
    if (viewMode === "day") return format(currentDate, "EEE d MMMM yyyy");
    if (viewMode === "week" || viewMode === "2weeks" || viewMode === "4weeks") {
      return `${format(dateRange[0], "d MMM")} – ${format(dateRange[dateRange.length - 1], "d MMM yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [currentDate, viewMode, dateRange]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full h-full flex flex-col"
      onDragOver={onJobDrop ? (e) => e.preventDefault() : undefined}
      onTouchStart={handleSwipeTouchStart}
      onTouchEnd={handleSwipeTouchEnd}
    >
      {/* Navigation Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0 flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          data-testid="button-today"
        >
          Today
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            data-testid="button-previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-base font-semibold min-w-[200px] text-center">
            {dateRangeDisplay}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            data-testid="button-next"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "day" && (
            <div className="flex items-center gap-1.5 border-r pr-2 mr-1">
              <AlignJustify className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="range"
                min={44}
                max={160}
                step={4}
                value={ganttRowHeight}
                onChange={e => setGanttRowHeight(Number(e.target.value))}
                className="w-20 accent-orange-500 cursor-pointer"
                title={`Row height: ${ganttRowHeight}px`}
              />
            </div>
          )}
          {(["day", "week", "2weeks", "4weeks"] as ViewMode[]).map((v) => (
            <Button
              key={v}
              variant={viewMode === v ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode(v)}
              data-testid={`button-view-${v}`}
            >
              {v === "2weeks"
                ? "2 wks"
                : v === "4weeks"
                  ? "4 wks"
                  : v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Day revenue bar */}
      {viewMode === "day" &&
        dayRevenue !== null &&
        displayDayRevenue !== null && (
          <div
            className="border-b bg-gray-50 flex-shrink-0"
            data-testid="day-revenue-bar"
          >
            <div className="flex items-center gap-3 px-4 py-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(currentDate, "d MMM")} jobs:
              </span>
              <button
                className={`text-sm font-semibold px-2 py-0.5 rounded border ${revenueColor(dayRevenue)}`}
                onClick={() => setShowRevBreakdown(v => !v)}
                title="Click to see job breakdown"
              >
                {formatNZD(displayDayRevenue)}
              </button>
              {(() => {
                const dayJobs = getUniqueJobsForDate(currentDate);
                return (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""} · target {formatNZD(DAY_TARGET)} exc. GST
                  </span>
                );
              })()}
              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden min-w-[60px]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dayRevenue >= DAY_TARGET ? "bg-green-500" : dayRevenue >= DAY_TARGET * 0.7 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{
                    width: `${Math.min(100, (dayRevenue / DAY_TARGET) * 100)}%`,
                  }}
                />
              </div>
              {displayDayRevenue >= DAY_TARGET && (
                <span className="text-xs font-medium text-green-700 whitespace-nowrap">
                  Target hit!
                </span>
              )}
              {displayDayRevenue > 0 && displayDayRevenue < DAY_TARGET && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatNZD(DAY_TARGET - displayDayRevenue)} to go
                </span>
              )}
            </div>
            {showRevBreakdown && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {getUniqueJobsForDate(currentDate).length === 0 ? (
                  <span className="text-xs text-muted-foreground">No jobs counted</span>
                ) : (
                  getUniqueJobsForDate(currentDate).map(j => (
                    <span
                      key={j.id}
                      className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700"
                    >
                      #{j.jobNumber} {getCustomerName(j)} — ${Math.round(jobRevenue(j))} exc. GST
                      {j.scheduledEndDate ? ` (${jobDayCount(j)}-day job, split)` : ''}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        )}

      {/* Grid */}
      <div
        className="flex-1 overflow-auto"
        onDragOver={onJobDrop ? (e) => e.preventDefault() : undefined}
      >
        <div
          className={`flex flex-col h-full ${viewMode !== "day" ? "min-w-max" : ""}`}
          style={viewMode === "day" ? { minWidth: GANTT_COL_W + ganttHourLabels.length * GANTT_MIN_COL_W } : undefined}
        >
          {/* Header row */}
          <div className="sticky top-0 z-10 flex bg-white border-b">
            {viewMode === "day" ? (
              <>
                <div
                  className="flex-shrink-0 border-r bg-gray-50 font-semibold p-2 text-sm sticky left-0 z-20 flex items-end"
                  style={{ width: GANTT_COL_W }}
                >
                  CREW
                </div>
                <div className="flex flex-1">
                  {ganttHourLabels.map((label, i) => (
                    <div
                      key={i}
                      className="flex-1 border-r border-gray-100 last:border-r-0 text-[10px] text-gray-400 font-medium pb-1 pl-0.5 flex items-end"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
            <div className="w-28 flex-shrink-0 border-r bg-gray-50 font-semibold p-2 text-sm sticky left-0 z-20">
              Staff
            </div>
            {dateRange.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const rev = weekRevenue[dateKey] ?? 0;
                  return (
                    <div
                      key={date.toISOString()}
                      className="w-36 flex-shrink-0 border-r p-2 text-xs text-center font-medium"
                      data-testid={`date-header-${dateKey}`}
                    >
                      <div>{format(date, "EEE")}</div>
                      <div className="font-semibold">
                        {format(date, "d MMM")}
                      </div>
                      {rev > 0 && (
                        <div
                          className={`mt-1 text-[10px] font-medium px-1 py-0.5 rounded ${rev >= DAY_TARGET ? "text-green-700 bg-green-50" : rev >= DAY_TARGET * 0.7 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"}`}
                        >
                          {formatNZD(rev)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Staff rows */}
          <div
            className="flex-1 flex flex-col"
            onDragOver={onJobDrop ? (e) => e.preventDefault() : undefined}
          >
            {/* ── Unassigned swim lane (day view only) ───────────────────── */}
            {viewMode === "day" && unassignedJobsForDay.length > 0 && (() => {
              const unassignedEffective = unassignedJobsForDay.map((job) => ({
                id: job.id,
                startMins: ganttTimeToMins(job.scheduledStartTime),
                endMins: job.scheduledStartTime
                  ? Math.max(ganttTimeToMins(job.scheduledEndTime), ganttTimeToMins(job.scheduledStartTime) + GANTT_MIN_DURATION_MINS)
                  : 9 * 60,
              }));
              const unassignedLanes = assignGanttLanes(unassignedEffective);
              return (
                <div
                  className="flex border-b"
                  style={{ height: ganttRowHeight }}
                >
                  {/* Name column */}
                  <div
                    className="flex-shrink-0 border-r flex items-center gap-2 px-3 sticky left-0 z-10"
                    style={{ width: GANTT_COL_W, backgroundColor: '#f9fafb' }}
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-[10px] font-bold flex-shrink-0">
                      ?
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500 truncate leading-tight">Unassigned</p>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {unassignedJobsForDay.length} job{unassignedJobsForDay.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {/* Timeline */}
                  <div
                    className={`flex-1 relative transition-colors duration-100 ${dayViewDragOver === 'unassigned' ? 'bg-blue-50' : 'bg-gray-50/40'}`}
                  >
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {ganttHourLabels.map((_, i) => (
                        <div key={i} className="flex-1 border-r border-gray-100 last:border-r-0 h-full" />
                      ))}
                    </div>
                    {/* Job blocks */}
                    {unassignedJobsForDay.map((job) => {
                      const eff = unassignedEffective.find((x) => x.id === job.id)!;
                      const startPct = ganttMinsToPercent(eff.startMins);
                      const blockW = Math.max(4, ganttMinsToPercent(eff.endMins) - startPct);
                      const { lane, totalLanes } = unassignedLanes.get(job.id) ?? { lane: 0, totalLanes: 1 };
                      const ls = ganttLaneStyle(lane, totalLanes);
                      const c = getJobColor(job.id);
                      const custName = getCustomerName(job);
                      const timeLabel = job.scheduledStartTime
                        ? `${ganttFormatTime(job.scheduledStartTime)}–${ganttFormatTime(job.scheduledEndTime)}`
                        : '';
                      return (
                        <button
                          key={job.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            const durationMins = eff.endMins - eff.startMins;
                            dragRef.current = {
                              jobId: job.id,
                              employeeId: '',
                              assignmentId: null,
                              durationHours: Math.max(1, Math.round(durationMins / 60)),
                            };
                          }}
                          onDragEnd={() => setDayViewDragOver(null)}
                          onClick={() => { setSelectedJobId(job.id); setShowJobCard(true); }}
                          title={`${custName}${timeLabel ? ' — ' + timeLabel : ''} (unassigned — drag to assign crew)`}
                          className="absolute rounded text-left overflow-hidden hover:brightness-95 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400 cursor-grab active:cursor-grabbing"
                          style={{
                            left: `${Math.max(0, startPct)}%`,
                            width: `${blockW}%`,
                            top: ls.top,
                            height: ls.height,
                            backgroundColor: c.bg,
                            borderLeft: `3px solid ${c.border}`,
                            borderStyle: 'dashed',
                            borderWidth: '1px 1px 1px 3px',
                            borderColor: c.border,
                            minWidth: 40,
                          }}
                        >
                          <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                            <div className="flex items-start gap-1">
                              <span className="text-[10px] font-semibold leading-tight flex-1 min-w-0 whitespace-normal break-words" style={{ color: c.text }}>
                                {custName}
                              </span>
                              {job.customerConfirmed && (
                                <Check className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={3} style={{ color: c.border }} />
                              )}
                              {!job.customerConfirmed && job.customerReplyReceivedAt && (
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={2.5} style={{ color: c.border }} />
                              )}
                            </div>
                            {blockW > 8 && timeLabel && (
                              <span className="text-[9px] leading-tight block truncate" style={{ color: c.border }}>
                                {timeLabel}
                              </span>
                            )}
                            {(() => {
                              const price = getJobPrice(job);
                              return price > 0 ? (
                                <span className="text-[10px] font-bold leading-tight block truncate" style={{ color: c.border }}>
                                  {formatNZD(price)}
                                </span>
                              ) : null;
                            })()}
                            {blockW > 8 && (
                              <span className="text-[9px] leading-tight block truncate text-gray-400">
                                drag to assign
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {employees.map((employee, empIdx) => {
              const gPalette = GANTT_STAFF_PALETTE[empIdx % GANTT_STAFF_PALETTE.length];
              const empDayItems = viewMode === "day" ? getDayGanttItems(employee.id, currentDate) : [];
              const empGanttLaneInput = empDayItems.map(({ job, assignment }) => {
                const eff = effectiveGanttMins(job, assignment);
                return { id: job.id, startMins: eff.startMins, endMins: eff.endMins };
              });
              const empGanttLanes = viewMode === "day" ? assignGanttLanes(empGanttLaneInput) : new Map<string, { lane: number; totalLanes: number }>();
              return (
              <div
                key={employee.id}
                className={`flex border-b ${viewMode !== "day" ? "min-h-[80px] hover:bg-gray-50/50" : ""}`}
                style={viewMode === "day" ? { height: ganttRowHeight } : undefined}
                data-testid={`staff-row-${employee.id}`}
                onDragOver={onJobDrop ? (e) => e.preventDefault() : undefined}
              >
                {/* Name column */}
                {viewMode === "day" ? (
                  <div
                    className="flex-shrink-0 border-r flex items-center gap-2 px-3 sticky left-0 z-10"
                    style={{ width: GANTT_COL_W, backgroundColor: gPalette.row + '80' }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: gPalette.dot, color: gPalette.avatar }}
                    >
                      {ganttInitials(employee)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {empDayItems.length} job{empDayItems.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-28 flex-shrink-0 border-r p-2 flex items-center gap-2 sticky left-0 bg-white z-10">
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {employee.firstName[0]}
                        {employee.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{employee.firstName}</span>
                  </div>
                )}

                {viewMode === "day" ? (
                  /* ── Gantt timeline bar ─────────────────────────────── */
                  <div
                    className={`flex-1 relative transition-colors duration-100 ${dayViewDragOver === employee.id ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                    style={{ backgroundColor: dayViewDragOver === employee.id ? gPalette.row : gPalette.row + "55" }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDayViewDragOver(employee.id);
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const mins = ganttStartH * 60 + pct * ganttHours * 60;
                      const hour = Math.max(ganttStartH, Math.min(GANTT_END_H - 1, Math.floor(mins / 60)));
                      setDayViewDragHour((prev) =>
                        prev && prev.employeeId === employee.id && prev.hour === hour
                          ? prev
                          : { employeeId: employee.id, hour },
                      );
                    }}
                    onDragLeave={(e) => {
                      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                        setDayViewDragOver(null);
                        setDayViewDragHour((prev) => (prev?.employeeId === employee.id ? null : prev));
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDayViewDragOver(null);
                      setDayViewDragHour(null);
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const mins = ganttStartH * 60 + pct * ganttHours * 60;
                      const hour = Math.max(ganttStartH, Math.min(GANTT_END_H - 1, Math.floor(mins / 60)));
                      const drag = dragRef.current;
                      if (drag) {
                        dragRef.current = null;
                        handleInternalReschedule(drag.jobId, drag.employeeId, drag.assignmentId, drag.durationHours, hour, employee.id, currentDate);
                        return;
                      }
                      if (onJobDrop) {
                        const externalJobId = e.dataTransfer.getData("jobId");
                        if (externalJobId) {
                          onJobDrop(externalJobId, currentDate, hour, employee.id);
                        }
                      }
                    }}
                  >
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {ganttHourLabels.map((_, i) => (
                        <div key={i} className="flex-1 border-r border-gray-100 last:border-r-0 h-full" />
                      ))}
                    </div>
                    {/* Drag-over preview block — sized to the dragged job's duration */}
                    {dayViewDragHour?.employeeId === employee.id && (() => {
                      const h = dayViewDragHour.hour;
                      const durationHours = Math.max(0.25, draggingJob?.durationHours ?? 1);
                      const startMins = h * 60;
                      const endMins = Math.min(startMins + durationHours * 60, GANTT_END_H * 60);
                      const leftPct = ((startMins - ganttStartH * 60) / (ganttHours * 60)) * 100;
                      const widthPct = ((endMins - startMins) / (ganttHours * 60)) * 100;
                      const hourLabel = `${h % 12 === 0 ? 12 : h % 12}:00${h < 12 ? 'am' : 'pm'}`;
                      const previewName = draggingJob?.customerName || "";
                      return (
                        <>
                          <div
                            className="absolute pointer-events-none rounded border-2 border-dashed border-blue-500 bg-blue-400/25 flex items-center justify-center px-1 overflow-hidden"
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              top: 4,
                              bottom: 4,
                            }}
                          >
                            {previewName && widthPct > 6 && (
                              <span className="text-[10px] font-semibold text-blue-900 truncate">
                                {previewName}
                              </span>
                            )}
                          </div>
                          <div
                            className="absolute -top-1 z-20 pointer-events-none bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow whitespace-nowrap"
                            style={{ left: `${leftPct}%` }}
                          >
                            {employee.firstName} · {hourLabel}
                          </div>
                        </>
                      );
                    })()}
                    {/* Job blocks */}
                    {empDayItems.map(({ job, assignment }) => {
                      const eff = effectiveGanttMins(job, assignment);
                      const startPct = ganttMinsToPercent(eff.startMins);
                      const blockW   = Math.max(4, ganttMinsToPercent(eff.endMins) - startPct);
                      const { lane, totalLanes } = empGanttLanes.get(job.id) ?? { lane: 0, totalLanes: 1 };
                      const ls = ganttLaneStyle(lane, totalLanes);
                      const c = getJobColor(job.id);
                      const custName = getCustomerName(job);
                      const timeLabel = eff.fromAssignment
                        ? `${ganttFormatMins(eff.startMins)}–${ganttFormatMins(eff.endMins)}`
                        : `${ganttFormatTime(job.scheduledStartTime)}–${ganttFormatTime(job.scheduledEndTime)}`;
                      return (
                        <button
                          key={job.id}
                          onClick={() => { setSelectedJobId(job.id); setShowJobCard(true); }}
                          title={`${custName} — ${timeLabel}`}
                          className="absolute rounded text-left overflow-hidden hover:brightness-95 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400"
                          style={{
                            left: `${Math.max(0, startPct)}%`,
                            width: `${blockW}%`,
                            top: ls.top,
                            height: ls.height,
                            backgroundColor: c.bg,
                            borderLeft: `3px solid ${c.border}`,
                            minWidth: 32,
                          }}
                        >
                          <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                            <div className="flex items-start gap-1">
                              <span className="text-[10px] font-semibold leading-tight flex-1 min-w-0 whitespace-normal break-words" style={{ color: c.text }}>
                                {custName}
                              </span>
                              {job.customerConfirmed && (
                                <Check className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={3} style={{ color: c.border }} />
                              )}
                              {!job.customerConfirmed && job.customerReplyReceivedAt && (
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={2.5} style={{ color: c.border }} />
                              )}
                            </div>
                            {blockW > 8 && timeLabel && (
                              <span className="text-[9px] leading-tight block truncate" style={{ color: c.border }}>
                                {timeLabel}
                              </span>
                            )}
                            {(() => {
                              const price = getJobPrice(job);
                              return price > 0 ? (
                                <span className="text-[10px] font-bold leading-tight block truncate" style={{ color: c.border }}>
                                  {formatNZD(price)}
                                </span>
                              ) : null;
                            })()}
                            {job.address && (
                              <span className="text-[9px] leading-tight flex items-start gap-0.5 whitespace-normal break-words" style={{ color: c.text, opacity: 0.7 }}>
                                <MapPin className="w-2 h-2 shrink-0 mt-0.5" />
                                <span className="min-w-0">{job.address.split(",")[0]}</span>
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Week / 2wks / 4wks: per-date cells ──────────────── */
                  <>
                  {dateRange.map((date) => {
                      const items = getItemsForDate(employee.id, date);
                      const slotKey = `${employee.id}-${format(date, "yyyy-MM-dd")}`;
                      const isOver = dragOverSlot === slotKey;
                      return (
                        <div
                          key={date.toISOString()}
                          className={`w-36 flex-shrink-0 border-r p-1 min-h-[80px] transition-colors duration-100 ${isOver ? "bg-blue-50 border-blue-300 border-2" : ""}`}
                          data-testid={`slot-${employee.id}-${format(date, "yyyy-MM-dd")}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDragOverSlot(slotKey);
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSlot(null);
                            const drag = dragRef.current;
                            if (drag) {
                              dragRef.current = null;
                              handleInternalReschedule(
                                drag.jobId,
                                drag.employeeId,
                                drag.assignmentId,
                                drag.durationHours,
                                8,
                                employee.id,
                                date,
                              );
                            } else if (onJobDrop) {
                              const jobId = e.dataTransfer.getData("jobId");
                              if (jobId) onJobDrop(jobId, date, 8, employee.id);
                            }
                          }}
                        >
                          {isOver && (
                            <div className="text-[10px] text-blue-500 font-medium text-center py-1 opacity-80">
                              Drop to schedule
                            </div>
                          )}
                          {items.map((job) => {
                            const c = getJobColor(job.id);
                            return (
                              <div
                                key={job.id}
                                className="text-xs p-1.5 rounded border cursor-pointer mb-1"
                                style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  setShowJobCard(true);
                                }}
                                data-testid={`job-block-${job.id}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="font-semibold line-clamp-2 leading-tight flex-1">
                                    {getCustomerName(job)}
                                  </div>
                                  {job.customerConfirmed && (
                                    <Check className="h-4 w-4 flex-shrink-0" strokeWidth={3} style={{ color: c.border }} />
                                  )}
                                  {!job.customerConfirmed && job.customerReplyReceivedAt && (
                                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} style={{ color: c.border }} />
                                  )}
                                </div>
                                <div className="opacity-70 truncate mt-0.5">
                                  {job.address?.split(",")[0]}
                                </div>
                                <div className="flex items-center justify-between gap-1 mt-0.5">
                                  <span className="opacity-80 font-mono">
                                    #{job.jobNumber}
                                  </span>
                                  {(() => {
                                    const price = getJobPrice(job);
                                    return price > 0 ? (
                                      <span className="font-bold" style={{ color: c.border }}>
                                        {formatNZD(price)}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                  })}
                  </>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Job card modal */}
      {selectedJobId && showJobCard && (
        <JobCardErrorBoundary onClose={() => { setShowJobCard(false); setSelectedJobId(null); }}>
          <GlobalJobCard
            isOpen={showJobCard}
            mode="edit"
            jobId={selectedJobId}
            onClose={() => {
              setShowJobCard(false);
              setSelectedJobId(null);
            }}
          />
        </JobCardErrorBoundary>
      )}
    </div>
  );
}

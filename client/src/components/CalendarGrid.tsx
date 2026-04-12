import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Check, GripVertical } from "lucide-react";
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
}

export function CalendarGrid({
  selectedDate: externalDate,
  onDateChange,
  onJobDrop,
}: CalendarGridProps = {}) {
  const [internalDate, setInternalDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
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

  // ── Revenue helpers ─────────────────────────────────────────────────────────
  // Returns the unique set of jobs scheduled on a given date (no duplicates across staff rows)
  const getUniqueJobsForDate = (date: Date): Job[] => {
    const dateKey = getNZDateString(date);
    const seen = new Set<string>();
    const result: Job[] = [];
    // Primary: staff assignments
    for (const [key, items] of assignmentsByEmployeeDate.entries()) {
      if (!key.endsWith(`__${dateKey}`)) continue;
      items.forEach(({ job }) => {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          result.push(job);
        }
      });
    }
    // Fallback: jobs with scheduledDate (no assignment record)
    allJobs.forEach((job) => {
      if (
        seen.has(job.id) ||
        job.status === "archived" ||
        job.status === "unsuccessful" ||
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

  const DAY_TARGET = 3500;

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

  // Revenue attributed to one day of the job (exc-GST, split evenly across all days)
  const jobRevenue = (job: Job): number => {
    const raw = (() => {
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

        <div className="flex items-center gap-1">
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
            className="flex items-center gap-3 px-4 py-2 border-b bg-gray-50 flex-shrink-0"
            data-testid="day-revenue-bar"
          >
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(currentDate, "d MMM")} jobs:
            </span>
            <span
              className={`text-sm font-semibold px-2 py-0.5 rounded border ${revenueColor(dayRevenue)}`}
            >
              {formatNZD(displayDayRevenue)}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {getUniqueJobsForDate(currentDate).length} job
              {getUniqueJobsForDate(currentDate).length !== 1 ? "s" : ""} ·
              target $3.5k exc. GST
            </span>
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
        )}

      {/* Grid */}
      <div
        className="flex-1 overflow-auto"
        onDragOver={onJobDrop ? (e) => e.preventDefault() : undefined}
      >
        <div className="flex flex-col min-w-max h-full">
          {/* Header row */}
          <div className="sticky top-0 z-10 flex bg-white border-b">
            <div className="w-28 flex-shrink-0 border-r bg-gray-50 font-semibold p-2 text-sm sticky left-0 z-20">
              Staff
            </div>
            {viewMode === "day"
              ? timeSlots.map((slot) => (
                  <div
                    key={slot.hour}
                    className="w-[110px] flex-shrink-0 border-r p-1 text-xs text-center font-medium text-gray-600 whitespace-nowrap"
                    data-testid={`time-slot-${slot.hour}`}
                  >
                    {slot.label}
                  </div>
                ))
              : dateRange.map((date) => {
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
          </div>

          {/* Staff rows */}
          <div
            className="flex-1 flex flex-col"
            onDragOver={onJobDrop ? (e) => e.preventDefault() : undefined}
          >
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex min-h-[80px] border-b hover:bg-gray-50/50"
                data-testid={`staff-row-${employee.id}`}
                onDragOver={onJobDrop ? (e) => e.preventDefault() : undefined}
              >
                {/* Name column */}
                <div className="w-28 flex-shrink-0 border-r p-2 flex items-center gap-2 sticky left-0 bg-white z-10">
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {employee.firstName[0]}
                      {employee.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{employee.firstName}</span>
                </div>

                {viewMode === "day"
                  ? timeSlots.map((slot) => {
                      const dateKey = getNZDateString(currentDate);
                      const assignedItems =
                        assignmentsByEmployeeDate.get(
                          `${employee.id}__${dateKey}`,
                        ) || [];
                      const items = getItemsForHour(
                        employee.id,
                        currentDate,
                        slot.hour,
                      );
                      const slotKey = `${employee.id}-${slot.hour}`;
                      const isOver = dragOverSlot === slotKey;
                      return (
                        <div
                          key={slot.hour}
                          className={`w-[110px] flex-shrink-0 border-r p-1 min-h-[80px] transition-colors duration-100 ${isOver ? "bg-blue-50 border-blue-300 border-2" : ""}`}
                          data-testid={`slot-${employee.id}-${slot.hour}`}
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
                              // Internal reschedule: job block dragged within calendar
                              dragRef.current = null;
                              handleInternalReschedule(
                                drag.jobId,
                                drag.employeeId,
                                drag.assignmentId,
                                drag.durationHours,
                                slot.hour,
                                employee.id,
                                currentDate,
                              );
                            } else if (onJobDrop) {
                              // External drop from right panel
                              const jobId = e.dataTransfer.getData("jobId");
                              if (jobId)
                                onJobDrop(
                                  jobId,
                                  currentDate,
                                  slot.hour,
                                  employee.id,
                                );
                            }
                          }}
                        >
                          {isOver && (
                            <div className="text-[10px] text-blue-500 font-medium text-center py-1 opacity-80">
                              Drop to schedule {slot.label}
                            </div>
                          )}
                          {items.map((job) => {
                            const assignment =
                              assignedItems.find((x) => x.job.id === job.id)
                                ?.assignment || null;
                            const durationHours = assignment
                              ? Math.max(
                                  1,
                                  Math.round(
                                    (new Date(assignment.endTime).getTime() -
                                      new Date(
                                        assignment.startTime,
                                      ).getTime()) /
                                      3600000,
                                  ),
                                )
                              : 2;
                            return (
                              <div
                                key={job.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", job.id);
                                  dragRef.current = {
                                    jobId: job.id,
                                    employeeId: employee.id,
                                    assignmentId: assignment?.id ?? null,
                                    durationHours,
                                  };
                                }}
                                onDragEnd={() => {
                                  dragRef.current = null;
                                }}
                                className={`text-xs p-1.5 rounded border cursor-grab active:cursor-grabbing mb-1 ${getStatusColor(job.status)}`}
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  setShowJobCard(true);
                                }}
                                data-testid={`job-block-${job.id}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <GripVertical className="h-3 w-3 opacity-40 flex-shrink-0" />
                                  <div className="font-semibold line-clamp-2 leading-tight flex-1">
                                    {getCustomerName(job)}
                                  </div>
                                  {job.customerConfirmed && (
                                    <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="opacity-70 truncate mt-0.5">
                                  {job.address?.split(",")[0]}
                                </div>
                                <div className="opacity-80 mt-0.5 font-mono">
                                  #{job.jobNumber}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  : dateRange.map((date) => {
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
                          {items.map((job) => (
                            <div
                              key={job.id}
                              className={`text-xs p-1.5 rounded border cursor-pointer mb-1 ${getStatusColor(job.status)}`}
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
                                  <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                )}
                              </div>
                              <div className="opacity-70 truncate mt-0.5">
                                {job.address?.split(",")[0]}
                              </div>
                              <div className="opacity-80 mt-0.5 font-mono">
                                #{job.jobNumber}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
              </div>
            ))}
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

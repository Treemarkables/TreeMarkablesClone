// Single data source for every calendar surface (/calendar views and
// CalendarGrid on /dispatch). Queries + derived indexes extracted verbatim
// from CalendarGrid.tsx, parameterized by date and an optional view filter.
//
// Filtering contract: when `filter` is provided, the date-parameterized
// helpers (getItemsForDate / getDayGanttItems / unassignedJobsForDate) and
// `jobPassesFilter` honour it. Revenue helpers deliberately do NOT filter —
// the daily target is a business-wide metric, so hiding a crew member must
// not make the day look under target.
import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toZonedTime } from "date-fns-tz";
import {
  getNZDateString,
  getJobScheduledNZDates,
  jobRunsOnNZDate,
} from "@shared/dateUtils";
import {
  NZ_TZ,
  DEFAULT_GANTT_START_H,
  JOB_IDENTITY_PALETTE,
  type JobIdentityColor,
  type CalendarEmployee,
  type CalendarJob,
  type CalendarStaffAssignment,
  type CalendarCustomer,
  ganttTimeToMins,
  jobRevenue,
  REVENUE_EXCLUDE,
} from "./calendarMath";

export interface CalendarFilter {
  staffIds: string[]; // empty = all staff
  statuses: string[]; // empty = all statuses
}

export interface AssignmentItem {
  assignment: CalendarStaffAssignment;
  job: CalendarJob;
}

export interface BusyBlock {
  id: string;
  connectionId: string;
  googleEventId: string;
  summary: string | null;
  startTime: string; // ISO UTC
  endTime: string;   // ISO UTC
  status: string | null;
  userId: string;    // employees.id of the connected user
}

// Statuses that never render on the calendar's unassigned lane: pre-schedule
// statuses (lead/quote/work_order) aren't on the calendar yet — if a stale
// scheduledDate lingers on one of those, don't surface it.
const UNASSIGNED_EXCLUDE = new Set([
  'archived',
  'unsuccessful',
  'cancelled',
  'lead',
  'quote',
  'work_order',
]);

export function useCalendarData(filter?: CalendarFilter) {
  const { data: employeesData } = useQuery<{ success: boolean; data: CalendarEmployee[] }>({
    queryKey: ["/api/employees/active"],
  });
  const { data: jobsData } = useQuery<{ success: boolean; data: CalendarJob[] }>({
    queryKey: ["/api/jobs?limit=10000&offset=0"],
  });
  const { data: assignmentsData } = useQuery<{ success: boolean; data: CalendarStaffAssignment[] }>({
    queryKey: ["/api/staff-assignments"],
    refetchInterval: 30000,
  });
  const { data: customersData } = useQuery<{ success: boolean; data: CalendarCustomer[] }>({
    queryKey: ["/api/customers"],
  });
  const { data: businessSettingsData } = useQuery<{
    success: boolean;
    data: { dailyRevenueTarget?: string | number | null; businessName?: string | null };
  }>({
    queryKey: ["/api/business-settings"],
  });

  // Google Calendar busy blocks — ±60 day window, refreshed every 5 min (matches poller cadence)
  const busyWindowStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString();
  }, []);
  const busyWindowEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString();
  }, []);
  const { data: busyEventsData } = useQuery<{ success: boolean; data: BusyBlock[] }>({
    queryKey: ["/api/google-calendar/busy", busyWindowStart.slice(0, 10)],
    queryFn: async () => {
      const res = await fetch(
        `/api/google-calendar/busy?start=${encodeURIComponent(busyWindowStart)}&end=${encodeURIComponent(busyWindowEnd)}`,
      );
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
  const allBusyBlocks = useMemo(() => busyEventsData?.data || [], [busyEventsData]);

  const employees = employeesData?.data || [];
  const allJobs = useMemo(() => jobsData?.data || [], [jobsData]);
  const allAssignments = useMemo(() => assignmentsData?.data || [], [assignmentsData]);
  const customers = customersData?.data || [];
  const isLoading = !jobsData;

  // ── Derived maps ───────────────────────────────────────────────────────────
  const customerMap = useMemo(() => {
    const map = new Map<string, CalendarCustomer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const jobMap = useMemo(() => {
    const map = new Map<string, CalendarJob>();
    allJobs.forEach((j) => map.set(j.id, j));
    return map;
  }, [allJobs]);

  // Assign a stable colour to each job based on sorted job number order.
  // Same job → same colour across every staff row and every date.
  const jobColorMap = useMemo(() => {
    const sorted = [...allJobs].sort((a, b) => Number(a.jobNumber ?? 0) - Number(b.jobNumber ?? 0));
    const map = new Map<string, JobIdentityColor>();
    sorted.forEach((job, idx) => {
      map.set(job.id, JOB_IDENTITY_PALETTE[idx % JOB_IDENTITY_PALETTE.length]);
    });
    return map;
  }, [allJobs]);

  const getJobColor = useCallback(
    (jobId: string) => jobColorMap.get(jobId) ?? JOB_IDENTITY_PALETTE[0],
    [jobColorMap],
  );

  // jobId → every employee linked to it (assignment records + assignedTo
  // fallback). Used by the staff filter so it covers the same fallback chain
  // the render helpers walk.
  const jobEmployeeIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (jobId: string, employeeId: string) => {
      if (!map.has(jobId)) map.set(jobId, new Set());
      map.get(jobId)!.add(employeeId);
    };
    allAssignments.forEach((a) => add(a.jobId, a.employeeId));
    allJobs.forEach((job) => {
      (job.assignedTo || []).forEach((empId) => add(job.id, empId));
    });
    return map;
  }, [allAssignments, allJobs]);

  // ── View filter ────────────────────────────────────────────────────────────
  const jobPassesFilter = useCallback(
    (job: CalendarJob): boolean => {
      if (!filter) return true;
      if (filter.statuses.length > 0 && !filter.statuses.includes(job.status)) return false;
      if (filter.staffIds.length > 0) {
        const empIds = jobEmployeeIds.get(job.id);
        if (!empIds || !filter.staffIds.some((id) => empIds.has(id))) return false;
      }
      return true;
    },
    [filter, jobEmployeeIds],
  );

  // Staff rows hidden by the staff filter (job filters never hide a row —
  // an empty row still communicates "free that day").
  const visibleEmployees = useMemo(() => {
    if (!filter || filter.staffIds.length === 0) return employees;
    return employees.filter((e) => filter.staffIds.includes(e.id));
  }, [employees, filter]);

  // employee+date → [{assignment, job}]
  // Keys use NZ date strings so UTC-stored startTimes are bucketed correctly
  const assignmentsByEmployeeDate = useMemo(() => {
    const map = new Map<string, AssignmentItem[]>();
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
    const map = new Map<string, AssignmentItem[]>();
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
  const multiDaySpanningDate = useCallback(
    (employeeId: string, dateKey: string) =>
      (multiDayByEmployee.get(employeeId) || []).filter(({ job }) => {
        // Honour a non-contiguous scheduledDates set so carved-out days (e.g.
        // weekends) don't render a phantom block. Exclude day 1 — it's handled
        // by the per-day assignment index, not the multi-day fallback.
        const days = getJobScheduledNZDates(job);
        return days.includes(dateKey) && dateKey !== days[0];
      }),
    [multiDayByEmployee],
  );

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCustomerName = useCallback(
    (job: CalendarJob) => {
      if (job.customerId)
        return customerMap.get(job.customerId)?.name || job.title || "Unknown Customer";
      return job.title || "No Customer";
    },
    [customerMap],
  );

  // Jobs for a specific employee + date cell (week/month view)
  const getItemsForDate = useCallback(
    (employeeId: string, date: Date): CalendarJob[] => {
      const dateKey = getNZDateString(date);
      const assigned = (assignmentsByEmployeeDate.get(`${employeeId}__${dateKey}`) || [])
        .filter(({ job }) => jobPassesFilter(job));

      // Day 2+ of multi-day jobs (assignment only stored under day 1 key)
      const seenIds = new Set(assigned.map((x) => x.job.id));
      const fromMultiDay = multiDaySpanningDate(employeeId, dateKey).filter(
        (x) => !seenIds.has(x.job.id) && jobPassesFilter(x.job),
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
        if (!jobPassesFilter(job)) return false;
        return jobRunsOnNZDate(job, date);
      });
    },
    [assignmentsByEmployeeDate, multiDaySpanningDate, allJobs, jobPassesFilter],
  );

  // ── Day-view Gantt items (returns job + assignment pair) ────────────────────
  // Returns { job, assignment } pairs for a given employee on a given day.
  // The assignment is used as a fallback for block positioning when the job has
  // no scheduledStartTime.
  const getDayGanttItems = useCallback(
    (employeeId: string, date: Date): { job: CalendarJob; assignment: CalendarStaffAssignment | null }[] => {
      const dateKey = getNZDateString(date);
      const assigned = (assignmentsByEmployeeDate.get(`${employeeId}__${dateKey}`) || [])
        .filter(({ job }) => jobPassesFilter(job));
      const seenIds = new Set(assigned.map((x) => x.job.id));
      const fromMultiDay = multiDaySpanningDate(employeeId, dateKey).filter(
        ({ job }) => !seenIds.has(job.id) && jobPassesFilter(job),
      );
      if (assigned.length > 0 || fromMultiDay.length > 0) {
        return [
          ...assigned.map((x) => ({ job: x.job, assignment: x.assignment })),
          ...fromMultiDay.map((x) => ({ job: x.job, assignment: x.assignment })),
        ];
      }
      // Fallback: jobs with job.assignedTo (no assignment record at all)
      return allJobs
        .filter((job) => {
          if (job.status === "archived" || job.status === "unsuccessful") return false;
          if (!job.assignedTo?.includes(employeeId)) return false;
          if (!job.scheduledDate) return false;
          if (!jobPassesFilter(job)) return false;
          return jobRunsOnNZDate(job, date);
        })
        .map((job) => ({ job, assignment: null }));
    },
    [assignmentsByEmployeeDate, multiDaySpanningDate, allJobs, jobPassesFilter],
  );

  // Jobs for a day with a scheduledDate but NO assignment record for any employee.
  // These are shown in the "Unassigned" swim lane at the top of the day-view Gantt.
  const unassignedJobsForDate = useCallback(
    (date: Date): CalendarJob[] => {
      const dateKey = getNZDateString(date);
      const assignedJobIds = new Set<string>();
      assignmentsByEmployeeDate.forEach((items, key) => {
        if (key.endsWith(`__${dateKey}`)) {
          items.forEach(({ job }) => assignedJobIds.add(job.id));
        }
      });
      return allJobs.filter((job) => {
        if (UNASSIGNED_EXCLUDE.has(job.status)) return false;
        if (assignedJobIds.has(job.id)) return false;
        if (!job.scheduledDate) return false;
        if (!jobPassesFilter(job)) return false;
        return jobRunsOnNZDate(job, date);
      });
    },
    [assignmentsByEmployeeDate, allJobs, jobPassesFilter],
  );

  // Dynamic day-view timeline start — default 8 AM, expand backwards (down to
  // 0) if the visible day has any job/assignment scheduled before then. Hours
  // before the earliest block are hidden so the grid isn't padded with empty
  // 6/7 AM cells. Mirrors the StaffSchedule logic.
  const computeGanttStartH = useCallback(
    (date: Date, unassignedJobs: CalendarJob[]): number => {
      const dateKey = getNZDateString(date);

      const startMinsFor = (job: CalendarJob, assignment: CalendarStaffAssignment | null): number => {
        if (job.scheduledStartTime) return ganttTimeToMins(job.scheduledStartTime);
        if (assignment) {
          const startNZ = toZonedTime(new Date(assignment.startTime), NZ_TZ);
          return startNZ.getHours() * 60 + startNZ.getMinutes();
        }
        return 8 * 60;
      };

      let earliestMins = DEFAULT_GANTT_START_H * 60;
      assignmentsByEmployeeDate.forEach((items, key) => {
        if (!key.endsWith(`__${dateKey}`)) return;
        for (const { job, assignment } of items) {
          const m = startMinsFor(job, assignment);
          if (m < earliestMins) earliestMins = m;
        }
      });
      for (const job of unassignedJobs) {
        const m = startMinsFor(job, null);
        if (m < earliestMins) earliestMins = m;
      }
      return Math.max(0, Math.min(DEFAULT_GANTT_START_H, Math.floor(earliestMins / 60)));
    },
    [assignmentsByEmployeeDate],
  );

  // ── Revenue (unfiltered — business-wide metric) ────────────────────────────
  const DAY_TARGET = Number(businessSettingsData?.data?.dailyRevenueTarget) || 3500;
  const businessName = businessSettingsData?.data?.businessName || "";

  // Returns the unique set of revenue-generating jobs on a given date (no duplicates across staff rows)
  const getUniqueJobsForDate = useCallback(
    (date: Date): CalendarJob[] => {
      const dateKey = getNZDateString(date);
      const seen = new Set<string>();
      const result: CalendarJob[] = [];
      // Primary: staff assignments
      assignmentsByEmployeeDate.forEach((items, key) => {
        if (!key.endsWith(`__${dateKey}`)) return;
        items.forEach(({ job }) => {
          if (!seen.has(job.id) && !REVENUE_EXCLUDE.has(job.status)) {
            seen.add(job.id);
            result.push(job);
          }
        });
      });
      // Fallback: jobs with scheduledDate (no assignment record)
      allJobs.forEach((job) => {
        if (seen.has(job.id) || REVENUE_EXCLUDE.has(job.status) || !job.scheduledDate)
          return;
        if (jobRunsOnNZDate(job, date)) {
          seen.add(job.id);
          result.push(job);
        }
      });
      return result;
    },
    [assignmentsByEmployeeDate, allJobs],
  );

  const revenueForDate = useCallback(
    (date: Date): number =>
      getUniqueJobsForDate(date).reduce((sum, job) => sum + jobRevenue(job), 0),
    [getUniqueJobsForDate],
  );

  // Busy blocks that overlap with a given UTC time window
  const getBusyBlocksInRange = useCallback(
    (startUtc: Date, endUtc: Date): BusyBlock[] =>
      allBusyBlocks.filter((b) => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < endUtc && bEnd > startUtc;
      }),
    [allBusyBlocks],
  );

  // Busy blocks for a specific employee on a specific date (NZ date string "YYYY-MM-DD")
  const getBusyBlocksForEmployee = useCallback(
    (userId: string, dateKey: string): BusyBlock[] => {
      const dayStart = new Date(`${dateKey}T00:00:00+12:00`);
      const dayEnd = new Date(`${dateKey}T23:59:59+12:00`);
      return allBusyBlocks.filter((b) => {
        if (b.userId !== userId) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < dayEnd && bEnd > dayStart;
      });
    },
    [allBusyBlocks],
  );

  return {
    isLoading,
    employees,
    visibleEmployees,
    allJobs,
    allAssignments,
    customers,
    customerMap,
    jobMap,
    jobColorMap,
    getJobColor,
    getCustomerName,
    jobPassesFilter,
    assignmentsByEmployeeDate,
    multiDayByEmployee,
    multiDaySpanningDate,
    getItemsForDate,
    getDayGanttItems,
    unassignedJobsForDate,
    computeGanttStartH,
    getUniqueJobsForDate,
    revenueForDate,
    DAY_TARGET,
    businessName,
    allBusyBlocks,
    getBusyBlocksInRange,
    getBusyBlocksForEmployee,
  };
}

export type CalendarData = ReturnType<typeof useCalendarData>;

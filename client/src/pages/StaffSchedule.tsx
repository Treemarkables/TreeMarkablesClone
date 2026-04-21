import { useQuery } from '@tanstack/react-query';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addDays, format, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin, AlignJustify } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import type { Job, Employee } from '@shared/schema';
import { GlobalJobCard } from '@/components/GlobalJobCard';

// ─── Constants ────────────────────────────────────────────────────────────────

const NZ_TZ = 'Pacific/Auckland';
const TIMELINE_START_H = 6;   // 6 AM
const TIMELINE_END_H   = 19;  // 7 PM
const TIMELINE_HOURS   = TIMELINE_END_H - TIMELINE_START_H;
const STAFF_COL_W      = 148; // px — fixed left column width
const MIN_HOUR_COL_W   = 110; // px minimum per hour column — forces horizontal scroll on narrow screens
const DAY_TARGET       = 3500; // NZD daily revenue target

const HOUR_LABELS = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => {
  const h = TIMELINE_START_H + i;
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
});

// Staff accent colours (assigned by index)
const STAFF_PALETTE = [
  { dot: '#3b82f6', row: '#eff6ff', avatar: '#1e40af' }, // blue
  { dot: '#10b981', row: '#f0fdf4', avatar: '#065f46' }, // emerald
  { dot: '#f97316', row: '#fff7ed', avatar: '#9a3412' }, // orange
  { dot: '#a855f7', row: '#faf5ff', avatar: '#6b21a8' }, // purple
  { dot: '#ec4899', row: '#fdf2f8', avatar: '#9d174d' }, // pink
  { dot: '#eab308', row: '#fefce8', avatar: '#713f12' }, // yellow
  { dot: '#14b8a6', row: '#f0fdfa', avatar: '#134e4a' }, // teal
  { dot: '#ef4444', row: '#fef2f2', avatar: '#991b1b' }, // red
];

// 12 visually distinct colours — each job on the day gets its own, consistent across all crew rows
const JOB_IDENTITY_PALETTE = [
  { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' }, // blue
  { bg: '#d1fae5', border: '#059669', text: '#064e3b' }, // emerald
  { bg: '#ffedd5', border: '#ea580c', text: '#7c2d12' }, // orange
  { bg: '#faf5ff', border: '#a855f7', text: '#6b21a8' }, // purple
  { bg: '#fce7f3', border: '#db2777', text: '#831843' }, // pink
  { bg: '#fef9c3', border: '#ca8a04', text: '#713f12' }, // amber
  { bg: '#ccfbf1', border: '#0d9488', text: '#134e4a' }, // teal
  { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' }, // red
  { bg: '#e0e7ff', border: '#4f46e5', text: '#312e81' }, // indigo
  { bg: '#dcfce7', border: '#16a34a', text: '#14532d' }, // green
  { bg: '#fef3c7', border: '#d97706', text: '#78350f' }, // yellow
  { bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95' }, // violet
];

// Status dot colours used in the legend only
const STATUS_LEGEND: Array<{ label: string; color: string }> = [
  { label: 'Lead',        color: '#ca8a04' },
  { label: 'Quoted',      color: '#ea580c' },
  { label: 'Scheduled',   color: '#2563eb' },
  { label: 'In Progress', color: '#059669' },
  { label: 'Completed',   color: '#6b7280' },
  { label: 'Invoiced',    color: '#7c3aed' },
  { label: 'Paid',        color: '#16a34a' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToPercent(minutes: number): number {
  const start = TIMELINE_START_H * 60;
  const total = TIMELINE_HOURS * 60;
  return Math.max(0, Math.min(100, (minutes - start) / total * 100));
}


function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function nzDateStr(date: Date) {
  return formatInTimeZone(date, NZ_TZ, 'yyyy-MM-dd');
}

// Assigns overlapping items in a single row to vertical lanes so they don't cover each other.
// Returns a map of item.id → { lane, totalLanes }.
function assignLanes(items: { id: string; startMins: number; endMins: number }[]): Map<string, { lane: number; totalLanes: number }> {
  const sorted = [...items].sort((a, b) => a.startMins - b.startMins);
  const laneEnd: number[] = []; // end-time (mins) of the last item placed in each lane
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

// Returns CSS top/height strings that divide the row equally between lanes.
function laneStyle(lane: number, totalLanes: number) {
  const pct = 100 / totalLanes;
  return { top: `calc(${lane * pct}% + 3px)`, height: `calc(${pct}% - 6px)` };
}

// Minimum on-screen block size, in minutes. Matches CalendarGrid's GANTT_MIN_DURATION_MINS.
const MIN_BLOCK_MINS = 60;

// Compute effective NZ-minutes for a slot. Mirrors CalendarGrid's effectiveGanttMins:
// prefer the job's scheduled string times; fall back to the assignment's UTC timestamps;
// finally default to 8 AM–4 PM.
function effectiveMins(
  job: Job,
  assignment: { startTime: string | Date; endTime: string | Date } | null,
): { startMins: number; endMins: number } {
  if (job.scheduledStartTime) {
    const startMins = timeStrToMinutes(job.scheduledStartTime);
    const rawEnd = job.scheduledEndTime ? timeStrToMinutes(job.scheduledEndTime) : startMins + MIN_BLOCK_MINS;
    return { startMins, endMins: Math.max(rawEnd, startMins + MIN_BLOCK_MINS) };
  }
  if (assignment) {
    const startNZ = toZonedTime(new Date(assignment.startTime), NZ_TZ);
    const endNZ   = toZonedTime(new Date(assignment.endTime),   NZ_TZ);
    const startMins = startNZ.getHours() * 60 + startNZ.getMinutes();
    const rawEnd    = endNZ.getHours()   * 60 + endNZ.getMinutes();
    return { startMins, endMins: Math.max(rawEnd, startMins + MIN_BLOCK_MINS) };
  }
  return { startMins: 8 * 60, endMins: 16 * 60 };
}

function formatTimeFromMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaffSchedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = toZonedTime(new Date(), NZ_TZ);
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);
  const [rowHeight, setRowHeight] = useState(72);

  // Current-time line position (refreshed every minute)
  const [nowPercent, setNowPercent] = useState<number | null>(null);
  useEffect(() => {
    const calc = () => {
      const now = toZonedTime(new Date(), NZ_TZ);
      const mins = now.getHours() * 60 + now.getMinutes();
      setNowPercent(minutesToPercent(mins));
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  const dateStr = nzDateStr(selectedDate);
  const isTodaySelected = isToday(selectedDate);

  // ── Queries ──
  // Use a date-scoped endpoint so we fetch only the few jobs for this day, not all 3500+
  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ['/api/jobs/for-date', dateStr],
    queryFn: () => fetch(`/api/jobs/for-date?date=${dateStr}`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const { data: employeesData } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees'],
  });
  const { data: assignmentsData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/staff-assignments'],
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const { data: customersData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/customers'],
  });
  const { data: revenueData } = useQuery<{
    success: boolean;
    data: { scheduledRevenue: number; dailyTarget: number; percentComplete: number; jobCount: number; belowTarget: boolean };
  }>({
    queryKey: ['/api/scheduling/revenue', dateStr],
    queryFn: () => fetch(`/api/scheduling/revenue/${dateStr}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const revenueInfo = revenueData?.data;

  // dayJobs comes directly from the date-scoped API — no client-side filtering needed
  const dayJobs        = jobsData?.data ?? [];
  const allEmployees   = employeesData?.data ?? [];
  const allAssignments = assignmentsData?.data ?? [];
  const allCustomers   = customersData?.data ?? [];

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    allCustomers.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [allCustomers]);

  // Active crew (non-admin) sorted by first name
  const crewMembers = useMemo(() =>
    allEmployees
      .filter(e => e.isActive && e.role !== 'admin')
      .sort((a, b) => `${a.firstName}`.localeCompare(`${b.firstName}`)),
    [allEmployees]
  );

  const jobMap = useMemo(() => {
    const m = new Map<string, Job>();
    dayJobs.forEach(j => m.set(j.id, j));
    return m;
  }, [dayJobs]);

  // Assign each job a unique identity colour (stable by job order in the day)
  const jobColorMap = useMemo(() => {
    const m = new Map<string, typeof JOB_IDENTITY_PALETTE[0]>();
    dayJobs.forEach((job, idx) => {
      m.set(job.id, JOB_IDENTITY_PALETTE[idx % JOB_IDENTITY_PALETTE.length]);
    });
    return m;
  }, [dayJobs]);

  // Slots = one renderable block each, keyed by assignment id (or a fallback key for
  // job.assignedTeam entries that have no assignment record).
  // This mirrors CalendarGrid: we render one block per assignment record so multiple
  // short assignments on the same day don't collapse into a single job-level block.
  const slotsByEmployee = useMemo(() => {
    const map = new Map<string, { id: string; job: Job; assignment: any | null; startMins: number; endMins: number }[]>();

    // 1. Assignment records that fall on the selected NZ date
    allAssignments.forEach((a: any) => {
      const job = jobMap.get(a.jobId);
      if (!job) return;
      const aDate = formatInTimeZone(new Date(a.startTime), NZ_TZ, 'yyyy-MM-dd');
      if (aDate !== dateStr) return;
      const { startMins, endMins } = effectiveMins(job, a);
      const list = map.get(a.employeeId) ?? [];
      list.push({ id: a.id, job, assignment: a, startMins, endMins });
      map.set(a.employeeId, list);
    });

    // 2. Fallback for job.assignedTeam[] entries that have no assignment record today
    dayJobs.forEach(job => {
      (job.assignedTeam ?? []).forEach((empId: string) => {
        const list = map.get(empId) ?? [];
        if (list.some(s => s.job.id === job.id)) return;
        const { startMins, endMins } = effectiveMins(job, null);
        list.push({ id: `team::${empId}::${job.id}`, job, assignment: null, startMins, endMins });
        map.set(empId, list);
      });
    });

    return map;
  }, [allAssignments, jobMap, dayJobs, dateStr]);

  // Jobs that don't appear on any crew row — surface them in an "Unassigned" swim lane
  // so the user can still see (and open) them from the roster.
  const unassignedSlots = useMemo(() => {
    const assignedJobIds = new Set<string>();
    slotsByEmployee.forEach(list => list.forEach(s => assignedJobIds.add(s.job.id)));
    return dayJobs
      .filter(j => !assignedJobIds.has(j.id))
      .map(job => {
        const { startMins, endMins } = effectiveMins(job, null);
        return { id: job.id, job, assignment: null as any, startMins, endMins };
      });
  }, [dayJobs, slotsByEmployee]);

  // Summary stats
  const totalAssigned = useMemo(() => {
    let count = 0;
    crewMembers.forEach(e => { count += (slotsByEmployee.get(e.id) ?? []).length; });
    return count;
  }, [crewMembers, slotsByEmployee]);

  const navigate = (delta: number) => {
    setSelectedDate(d => {
      const next = addDays(d, delta);
      return next;
    });
  };

  const openJob = (job: Job) => {
    setSelectedJob(job);
    setShowJobCard(true);
  };

  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Live Roster</h1>
          <p className="text-xs text-gray-500">
            {format(selectedDate, 'EEEE d MMMM yyyy')}
            {' · '}
            {crewMembers.length} crew
            {' · '}
            {totalAssigned} jobs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Row height slider */}
          <div className="flex items-center gap-1.5">
            <AlignJustify className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="range"
              min={44}
              max={160}
              step={4}
              value={rowHeight}
              onChange={e => setRowHeight(Number(e.target.value))}
              className="w-20 accent-orange-500 cursor-pointer"
              title={`Row height: ${rowHeight}px`}
            />
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const now = toZonedTime(new Date(), NZ_TZ);
              now.setHours(0, 0, 0, 0);
              setSelectedDate(now);
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              isTodaySelected
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Revenue target tracker ── */}
      {revenueInfo && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex-wrap gap-y-1">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {format(selectedDate, 'd MMM')} revenue:
          </span>
          <span
            className={`text-sm font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
              revenueInfo.belowTarget
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}
          >
            ${revenueInfo.scheduledRevenue.toLocaleString('en-NZ', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {revenueInfo.jobCount} job{revenueInfo.jobCount !== 1 ? 's' : ''} · target $3,500 exc. GST
          </span>
          <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden min-w-[60px]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                revenueInfo.belowTarget ? 'bg-amber-400' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, revenueInfo.percentComplete)}%` }}
            />
          </div>
          {!revenueInfo.belowTarget && (
            <span className="text-xs font-medium text-green-700 whitespace-nowrap">Target hit!</span>
          )}
          {revenueInfo.belowTarget && revenueInfo.scheduledRevenue > 0 && (
            <span className="text-xs text-gray-400 whitespace-nowrap">
              ${(DAY_TARGET - revenueInfo.scheduledRevenue).toLocaleString('en-NZ', { maximumFractionDigits: 0 })} to go
            </span>
          )}
        </div>
      )}

      {/* ── Timeline grid ── */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: STAFF_COL_W + HOUR_LABELS.length * MIN_HOUR_COL_W }}>

          {/* Hour header */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200">
            {/* Staff column header */}
            <div
              className="shrink-0 border-r border-gray-200 flex items-center px-3 py-2 sticky left-0 z-30 bg-white"
              style={{ width: STAFF_COL_W }}
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Crew</span>
            </div>

            {/* Hour labels */}
            <div className="flex-1 relative flex">
              {HOUR_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="flex-1 text-center py-2 border-r border-gray-100 last:border-r-0"
                >
                  <span className="text-[10px] font-medium text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unassigned swim lane — jobs scheduled for this day but not yet assigned to a crew member */}
          {unassignedSlots.length > 0 && (() => {
            const lanes = assignLanes(unassignedSlots);
            return (
              <div
                className="flex border-b-2 border-amber-200 bg-amber-50/40"
                style={{ minHeight: rowHeight }}
              >
                <div
                  className="shrink-0 border-r border-gray-200 flex items-center gap-2 px-3 py-2 sticky left-0 z-10 bg-amber-50"
                  style={{ width: STAFF_COL_W }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 bg-amber-500">
                    ?
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-900 truncate leading-tight">Unassigned</p>
                    <p className="text-[10px] text-amber-700 leading-tight">
                      {unassignedSlots.length} job{unassignedSlots.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex-1 relative">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {HOUR_LABELS.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-gray-100 last:border-r-0 h-full" />
                    ))}
                  </div>

                  {isTodaySelected && nowPercent !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none"
                      style={{ left: `${nowPercent}%` }}
                    />
                  )}

                  {unassignedSlots.map(slot => {
                    const { job, startMins, endMins } = slot;
                    const left  = minutesToPercent(startMins);
                    const width = Math.max(2, minutesToPercent(endMins) - left);
                    const colors = jobColorMap.get(job.id) ?? JOB_IDENTITY_PALETTE[0];
                    const custName = job.customerId ? (customerMap.get(job.customerId) ?? '') : '';
                    const label = custName || job.title || `#${job.jobNumber}`;
                    const timeLabel = `${formatTimeFromMins(startMins)}–${formatTimeFromMins(endMins)}`;
                    const { lane, totalLanes } = lanes.get(slot.id) ?? { lane: 0, totalLanes: 1 };
                    const ls = laneStyle(lane, totalLanes);

                    return (
                      <button
                        key={slot.id}
                        onClick={() => openJob(job)}
                        title={`${label} — ${timeLabel} (unassigned)`}
                        className="absolute rounded text-left overflow-hidden hover:brightness-95 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          top: ls.top,
                          height: ls.height,
                          backgroundColor: colors.bg,
                          borderLeft: `3px solid ${colors.border}`,
                          borderStyle: 'dashed',
                          borderTopWidth: 1,
                          borderRightWidth: 1,
                          borderBottomWidth: 1,
                          borderTopColor: colors.border,
                          borderRightColor: colors.border,
                          borderBottomColor: colors.border,
                          minWidth: 32,
                        }}
                      >
                        <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                          <span
                            className="text-[10px] font-semibold leading-tight block whitespace-normal break-words"
                            style={{ color: colors.text }}
                          >
                            {label}
                          </span>
                          {width > 8 && (
                            <span className="text-[9px] leading-tight block truncate" style={{ color: colors.border }}>
                              {timeLabel}
                            </span>
                          )}
                          {job.address && (
                            <span className="text-[9px] leading-tight flex items-start gap-0.5 whitespace-normal break-words" style={{ color: colors.text, opacity: 0.7 }}>
                              <MapPin className="w-2 h-2 shrink-0 mt-0.5" />
                              <span className="min-w-0">{job.address}</span>
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

          {/* Staff rows */}
          {crewMembers.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              No active crew members found.
            </div>
          ) : (
            crewMembers.map((emp, empIdx) => {
              const palette   = STAFF_PALETTE[empIdx % STAFF_PALETTE.length];
              const empSlots  = slotsByEmployee.get(emp.id) ?? [];
              const lanes     = assignLanes(empSlots);
              const empName   = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
              const empInit   = initials(empName || 'U');

              return (
                <div
                  key={emp.id}
                  className="flex border-b border-gray-100 last:border-b-0"
                  style={{ minHeight: rowHeight }}
                >
                  {/* Staff name cell */}
                  <div
                    className="shrink-0 border-r border-gray-200 flex items-center gap-2 px-3 py-2 sticky left-0 z-10"
                    style={{ width: STAFF_COL_W, backgroundColor: palette.row }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: palette.dot }}
                    >
                      {empInit}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{empName}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {empSlots.length} job{empSlots.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Timeline cell */}
                  <div className="flex-1 relative" style={{ backgroundColor: palette.row + '55' }}>
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {HOUR_LABELS.map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 border-r border-gray-100 last:border-r-0 h-full"
                        />
                      ))}
                    </div>

                    {/* Current time line */}
                    {isTodaySelected && nowPercent !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none"
                        style={{ left: `${nowPercent}%` }}
                      />
                    )}

                    {/* Job blocks */}
                    {empSlots.map(slot => {
                      const { job, startMins, endMins } = slot;
                      const left  = minutesToPercent(startMins);
                      const width = Math.max(2, minutesToPercent(endMins) - left);
                      const colors = jobColorMap.get(job.id) ?? JOB_IDENTITY_PALETTE[0];
                      const custName = job.customerId ? (customerMap.get(job.customerId) ?? '') : '';
                      const label = custName || job.title || `#${job.jobNumber}`;
                      const timeLabel = `${formatTimeFromMins(startMins)}–${formatTimeFromMins(endMins)}`;
                      const { lane, totalLanes } = lanes.get(slot.id) ?? { lane: 0, totalLanes: 1 };
                      const ls = laneStyle(lane, totalLanes);

                      return (
                        <button
                          key={slot.id}
                          onClick={() => openJob(job)}
                          title={`${label} — ${timeLabel}`}
                          className="absolute rounded text-left overflow-hidden hover:brightness-95 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top: ls.top,
                            height: ls.height,
                            backgroundColor: colors.bg,
                            borderLeft: `3px solid ${colors.border}`,
                            minWidth: 32,
                          }}
                        >
                          <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                            <span
                              className="text-[10px] font-semibold leading-tight block whitespace-normal break-words"
                              style={{ color: colors.text }}
                            >
                              {label}
                            </span>
                            {width > 8 && (
                              <span className="text-[9px] leading-tight block truncate" style={{ color: colors.border }}>
                                {timeLabel}
                              </span>
                            )}
                            {job.address && (
                              <span className="text-[9px] leading-tight flex items-start gap-0.5 whitespace-normal break-words" style={{ color: colors.text, opacity: 0.7 }}>
                                <MapPin className="w-2 h-2 shrink-0 mt-0.5" />
                                <span className="min-w-0">{job.address}</span>
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {empSlots.length === 0 && (
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-[10px] text-gray-300 italic">No jobs</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Legend: job identity colours (top row) + status reference (bottom row) ── */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-2 bg-white space-y-1.5">
        {/* Per-job colour swatches */}
        {dayJobs.length > 0 && (
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="text-[10px] text-gray-400 shrink-0">Jobs:</span>
            {dayJobs.map(job => {
              const colors = jobColorMap.get(job.id) ?? JOB_IDENTITY_PALETTE[0];
              const custName = job.customerId ? (customerMap.get(job.customerId) ?? '') : '';
              const label = custName || job.title || `#${job.jobNumber}`;
              return (
                <div key={job.id} className="flex items-center gap-1 shrink-0">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: colors.border }}
                  />
                  <span className="text-[10px] text-gray-600 truncate max-w-[80px]">{label}</span>
                </div>
              );
            })}
          </div>
        )}
        {/* Status reference */}
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] text-gray-400 shrink-0">Status:</span>
          {STATUS_LEGEND.map(s => (
            <div key={s.label} className="flex items-center gap-1 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Job card modal ── */}
      {showJobCard && selectedJob && (
        <GlobalJobCard
          job={selectedJob}
          isOpen={showJobCard}
          onClose={() => { setShowJobCard(false); setSelectedJob(null); }}
          mode="edit"
        />
      )}
    </div>
  );
}

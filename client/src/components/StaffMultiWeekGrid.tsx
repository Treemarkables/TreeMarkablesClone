import type { Job as BaseJob, Employee } from '@shared/schema';
import { useIsMobile } from '@/hooks/use-mobile';

// Multi-week availability grid for the Staff Schedule page. Presentation-only:
// the page computes every data structure (range, slots, revenue) and this
// component just lays it out. Staff are rows, days are fluid-width columns —
// `minmax(0, 1fr)` makes the whole period fit the viewport with no horizontal
// scrolling, which is the entire point of the view.

type Job = BaseJob & {
  confirmationReplySentAt?: string | Date | null;
  customerReplyReceivedAt?: string | Date | null;
};

export interface MultiWeekCellSlot {
  id: string;
  job: Job;
  startMins: number;
  endMins: number;
  /** True when the previous calendar day is not part of this job's run. */
  isRunStart: boolean;
  /** True when the next calendar day is not part of this job's run. */
  isRunEnd: boolean;
  timeLabel: string;
}

export interface JobColors {
  bg: string;
  border: string;
  text: string;
}

interface StaffMultiWeekGridProps {
  /** YYYY-MM-DD keys, Monday-start, contiguous. */
  rangeDates: string[];
  crewMembers: Employee[];
  slotsByEmployeeByDate: Map<string, Map<string, MultiWeekCellSlot[]>>;
  unassignedByDate: Map<string, Job[]>;
  perDaySummary: Map<string, { revenue: number; jobCount: number }>;
  jobColorMap: Map<string, JobColors>;
  customerMap: Map<string, string>;
  dailyTarget: number;
  todayKey: string;
  onOpenJob: (job: Job) => void;
  onDrillToDay: (dateKey: string) => void;
}

// Mirrors STAFF_PALETTE in StaffSchedule.tsx — both index by position in the
// same firstName-sorted crew list, so row tints match between Day and week views.
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

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A day reads as "booked out" at 7+ clamped working hours (8 AM–5 PM window).
const WORK_START_MINS = 8 * 60;
const WORK_END_MINS = 17 * 60;
const BOOKED_OUT_MINS = 7 * 60;

const MAX_BARS_PER_CELL = 3;

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function formatNZDShort(amount: number): string {
  if (amount === 0) return '$0';
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  }
  return `$${Math.round(amount).toLocaleString()}`;
}

// Day-of-week (0=Sun) for a YYYY-MM-DD key via noon-UTC anchoring (DST-safe).
function dayOfWeek(key: string): number {
  return new Date(key + 'T12:00:00Z').getUTCDay();
}

function bookedMins(slots: MultiWeekCellSlot[]): number {
  return slots.reduce((sum, s) => {
    const start = Math.max(s.startMins, WORK_START_MINS);
    const end = Math.min(s.endMins, WORK_END_MINS);
    return sum + Math.max(0, end - start);
  }, 0);
}

export function StaffMultiWeekGrid({
  rangeDates,
  crewMembers,
  slotsByEmployeeByDate,
  unassignedByDate,
  perDaySummary,
  jobColorMap,
  customerMap,
  dailyTarget,
  todayKey,
  onOpenJob,
  onDrillToDay,
}: StaffMultiWeekGridProps) {
  const isMobile = useIsMobile();
  const labelColW = isMobile ? 44 : 148;
  const rowH = isMobile ? 30 : 46;
  const fourPlusWeeks = rangeDates.length > 14;
  // Mirror Day mode: only show the Unassigned lane when the period has any
  const hasUnassigned = rangeDates.some(k => (unassignedByDate.get(k)?.length ?? 0) > 0);

  const jobLabel = (job: Job) => {
    const custName = job.customerId ? (customerMap.get(job.customerId) ?? '') : '';
    return custName || job.title || `#${job.jobNumber}`;
  };

  // Per-column classes shared by every row so weekend / today / week-boundary
  // styling stays aligned down the whole grid.
  const colMeta = rangeDates.map((dateKey, idx) => {
    const dow = dayOfWeek(dateKey);
    return {
      dateKey,
      isWeekend: dow === 0 || dow === 6,
      isToday: dateKey === todayKey,
      isWeekStart: dow === 1 && idx > 0,
      dayNum: parseInt(dateKey.slice(8), 10),
      monthLabel: MONTH_LABELS[parseInt(dateKey.slice(5, 7), 10) - 1],
      weekday: WEEKDAY_LABELS[dow],
    };
  });

  const cellBorder = (meta: (typeof colMeta)[0]) =>
    `border-r border-b border-gray-100 ${meta.isWeekStart ? 'border-l-2 border-l-gray-300' : ''}`;

  const cellBg = (meta: (typeof colMeta)[0], booked: number) => {
    if (booked >= BOOKED_OUT_MINS) return '#bfdbfe'; // blue-200 — booked out
    if (booked > 0) return '#dbeafe'; // blue-100 — partially booked
    if (meta.isToday) return '#fff7ed'; // orange-50
    if (meta.isWeekend) return '#f9fafb'; // gray-50
    return '#ffffff';
  };

  // One continuous strip per job run: square ends + edge-bleed margins on
  // middle days so the bar visually crosses cell borders.
  const barStyle = (slot: MultiWeekCellSlot, colors: JobColors, dashed: boolean) => ({
    backgroundColor: colors.border,
    marginLeft: slot.isRunStart ? 2 : -2,
    marginRight: slot.isRunEnd ? 2 : -2,
    borderRadius: `${slot.isRunStart ? 3 : 0}px ${slot.isRunEnd ? 3 : 0}px ${slot.isRunEnd ? 3 : 0}px ${slot.isRunStart ? 3 : 0}px`,
    ...(dashed ? { backgroundColor: colors.bg, border: `1px dashed ${colors.border}` } : {}),
  });

  return (
    <div
      className="grid w-full"
      style={{ gridTemplateColumns: `${labelColW}px repeat(${rangeDates.length}, minmax(0, 1fr))` }}
      data-testid="staff-multiweek-grid"
    >
      {/* ── Day header row ── */}
      <div className="sticky top-0 z-20 bg-white border-r border-b border-gray-200 flex items-center px-1.5 md:px-3 py-1.5">
        <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Crew</span>
      </div>
      {colMeta.map(meta => (
        <button
          key={`hdr-${meta.dateKey}`}
          onClick={() => onDrillToDay(meta.dateKey)}
          title={`Open ${meta.dateKey} in Day view`}
          className={`sticky top-0 z-20 bg-white ${cellBorder(meta)} py-1 text-center cursor-pointer min-w-0 overflow-hidden ${
            meta.isWeekend ? 'bg-gray-50' : ''
          }`}
        >
          <span className={`block text-[8px] leading-tight ${meta.isToday ? 'font-bold text-orange-600' : 'text-gray-400'}`}>
            {meta.weekday}
          </span>
          <span
            className={`inline-block text-[10px] leading-tight font-medium rounded-full min-w-[16px] ${
              meta.isToday ? 'bg-orange-500 text-white px-1' : 'text-gray-600'
            }`}
          >
            {meta.dayNum}
          </span>
          {(meta.dayNum === 1 || meta.dateKey === rangeDates[0]) && (
            <span className="block text-[8px] leading-tight text-gray-400">{meta.monthLabel}</span>
          )}
        </button>
      ))}

      {/* ── Unassigned lane ── */}
      {hasUnassigned && (
      <div className="border-r border-b-2 border-amber-200 bg-amber-50 flex items-center gap-1.5 px-1.5 md:px-3 py-1" style={{ minHeight: rowH }}>
        <div className="hidden md:flex w-6 h-6 rounded-full items-center justify-center text-white text-[10px] font-bold shrink-0 bg-amber-500">?</div>
        <span className="text-[10px] md:text-xs font-semibold text-amber-900 truncate">
          {isMobile ? '?' : 'Unassigned'}
        </span>
      </div>
      )}
      {hasUnassigned && colMeta.map(meta => {
        const jobs = unassignedByDate.get(meta.dateKey) ?? [];
        return (
          <div
            key={`un-${meta.dateKey}`}
            onClick={() => onDrillToDay(meta.dateKey)}
            title={jobs.length ? jobs.map(j => jobLabel(j)).join(', ') : undefined}
            className={`${cellBorder(meta)} border-b-2 border-b-amber-200 bg-amber-50/40 cursor-pointer min-w-0 overflow-hidden flex flex-col justify-center gap-px py-0.5`}
            style={{ minHeight: rowH }}
          >
            {!isMobile && jobs.slice(0, MAX_BARS_PER_CELL).map(job => {
              const colors = jobColorMap.get(job.id) ?? { bg: '#eff6ff', border: '#2563eb', text: '#1e3a8a' };
              return (
                <button
                  key={job.id}
                  onClick={e => { e.stopPropagation(); onOpenJob(job); }}
                  title={`${jobLabel(job)} (unassigned)`}
                  className="h-[7px] rounded-[3px] mx-0.5 shrink-0"
                  style={{ backgroundColor: colors.bg, border: `1px dashed ${colors.border}` }}
                />
              );
            })}
            {jobs.length > 0 && (isMobile || jobs.length > MAX_BARS_PER_CELL) && (
              <span className="text-[9px] font-semibold text-amber-700 text-center leading-none">
                {isMobile ? jobs.length : `+${jobs.length - MAX_BARS_PER_CELL}`}
              </span>
            )}
          </div>
        );
      })}

      {/* ── Crew rows ── */}
      {crewMembers.map((emp, empIdx) => {
        const palette = STAFF_PALETTE[empIdx % STAFF_PALETTE.length];
        const empName = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
        const byDate = slotsByEmployeeByDate.get(emp.id);
        return [
          <div
            key={`emp-${emp.id}`}
            className="border-r border-b border-gray-100 flex items-center gap-1.5 px-1.5 md:px-3 py-1 min-w-0"
            style={{ backgroundColor: palette.row + '80', minHeight: rowH }}
          >
            <div
              className="flex w-6 h-6 rounded-full items-center justify-center text-white text-[9px] font-bold shrink-0"
              style={{ backgroundColor: palette.dot }}
            >
              {initials(empName || 'U')}
            </div>
            <p className="hidden md:block text-xs font-semibold text-gray-800 truncate leading-tight">{empName}</p>
          </div>,
          ...colMeta.map(meta => {
            const slots = byDate?.get(meta.dateKey) ?? [];
            const booked = bookedMins(slots);
            return (
              <div
                key={`${emp.id}-${meta.dateKey}`}
                onClick={() => onDrillToDay(meta.dateKey)}
                title={slots.length ? slots.map(s => `${jobLabel(s.job)} — ${s.timeLabel}`).join('\n') : undefined}
                className={`${cellBorder(meta)} cursor-pointer min-w-0 flex flex-col justify-center gap-px py-0.5`}
                style={{ backgroundColor: cellBg(meta, booked), minHeight: rowH }}
              >
                {!isMobile && slots.slice(0, MAX_BARS_PER_CELL).map(slot => {
                  const colors = jobColorMap.get(slot.job.id) ?? { bg: '#eff6ff', border: '#2563eb', text: '#1e3a8a' };
                  return (
                    <button
                      key={slot.id}
                      onClick={e => { e.stopPropagation(); onOpenJob(slot.job); }}
                      title={`${jobLabel(slot.job)} — ${slot.timeLabel}`}
                      className="h-[7px] shrink-0 hover:brightness-90 transition-all"
                      style={barStyle(slot, colors, false)}
                    />
                  );
                })}
                {slots.length > 0 && (isMobile || slots.length > MAX_BARS_PER_CELL) && (
                  <span className="text-[9px] font-semibold text-gray-600 text-center leading-none">
                    {isMobile ? slots.length : `+${slots.length - MAX_BARS_PER_CELL}`}
                  </span>
                )}
              </div>
            );
          }),
        ];
      })}

      {/* ── Per-day revenue footer ── */}
      <div className="border-r border-t border-gray-200 bg-gray-50 flex items-center px-1.5 md:px-3 py-1" style={{ minHeight: rowH }}>
        <span className="text-[9px] md:text-[10px] font-semibold text-gray-500 uppercase tracking-wide truncate">
          {isMobile ? '$' : 'Revenue'}
        </span>
      </div>
      {colMeta.map(meta => {
        const summary = perDaySummary.get(meta.dateKey) ?? { revenue: 0, jobCount: 0 };
        // Same thresholds as CalendarGrid's revenueColor: target hit = green,
        // ≥70% = amber, anything below = red. Empty days stay neutral.
        const chipClass =
          summary.jobCount === 0
            ? 'text-gray-300'
            : summary.revenue >= dailyTarget
              ? 'text-green-700 bg-green-100'
              : summary.revenue >= dailyTarget * 0.7
                ? 'text-amber-700 bg-amber-100'
                : 'text-red-700 bg-red-100';
        return (
          <div
            key={`rev-${meta.dateKey}`}
            onClick={() => onDrillToDay(meta.dateKey)}
            className={`${cellBorder(meta)} border-t border-t-gray-200 bg-gray-50 cursor-pointer min-w-0 overflow-hidden flex items-center justify-center`}
            style={{ minHeight: rowH }}
            title={summary.jobCount > 0 ? `${formatNZDShort(summary.revenue)} · ${summary.jobCount} job${summary.jobCount !== 1 ? 's' : ''}` : undefined}
          >
            <span className={`${fourPlusWeeks ? 'text-[8px]' : 'text-[9px]'} font-semibold rounded px-0.5 leading-tight ${chipClass}`}>
              {summary.jobCount === 0 ? '–' : formatNZDShort(summary.revenue)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

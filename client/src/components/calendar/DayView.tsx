// Day Gantt — port of CalendarGrid's day mode for the unified calendar.
// Horizontal timeline with one row per crew member, an "Unassigned" swim lane
// on top, and the daily revenue bar. All job blocks are draggable (mouse drag
// or touch long-press via useCalendarDnD) onto any crew row to reassign and
// retime; double-bookings surface the conflict dialog before saving.
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, MapPin, MessageSquare } from "lucide-react";
import {
  GANTT_COL_W,
  GANTT_END_H,
  GANTT_MIN_COL_W,
  GANTT_MIN_DURATION_MINS,
  GANTT_ROW_H,
  GANTT_STAFF_PALETTE,
  assignGanttLanes,
  buildGanttHourLabels,
  effectiveGanttMins,
  formatNZD,
  ganttFormatMins,
  ganttFormatTime,
  ganttInitials,
  ganttLaneStyle,
  ganttTimeToMins,
  jobRevenue,
  jobDayCount,
  makeGanttMinsToPercent,
  revenueColor,
  type CalendarJob,
} from "./calendarMath";
import { toZonedTime } from "date-fns-tz";
import { NZ_TZ } from "./calendarMath";
import type { CalendarData } from "./useCalendarData";
import type { CalendarDnD } from "./useCalendarDnD";

interface DayViewProps {
  currentDate: Date;
  onJobClick: (job: CalendarJob) => void;
  data: CalendarData;
  dnd: CalendarDnD;
}

export function DayView({ currentDate, onJobClick, data, dnd }: DayViewProps) {
  const {
    visibleEmployees,
    getJobColor,
    getCustomerName,
    getDayGanttItems,
    unassignedJobsForDate,
    computeGanttStartH,
    getUniqueJobsForDate,
    revenueForDate,
    DAY_TARGET,
    getBusyBlocksForEmployee,
  } = data;

  const [showRevBreakdown, setShowRevBreakdown] = useState(false);

  const dateStr = format(currentDate, "yyyy-MM-dd");

  const unassignedJobsForDay = useMemo(
    () => unassignedJobsForDate(currentDate),
    [unassignedJobsForDate, currentDate],
  );

  const ganttStartH = useMemo(
    () => computeGanttStartH(currentDate, unassignedJobsForDay),
    [computeGanttStartH, currentDate, unassignedJobsForDay],
  );

  const ganttHours = GANTT_END_H - ganttStartH;
  const ganttHourLabels = useMemo(
    () => buildGanttHourLabels(ganttStartH, GANTT_END_H),
    [ganttStartH],
  );
  const ganttMinsToPercent = useMemo(
    () => makeGanttMinsToPercent(ganttStartH, GANTT_END_H),
    [ganttStartH],
  );

  const dayRevenue = useMemo(
    () => revenueForDate(currentDate),
    [revenueForDate, currentDate],
  );

  // Round to the same $100 display unit that the k-formatter uses, so the badge
  // ("$3.0k") and "to go" always add up to the target on screen.
  const displayDayRevenue =
    dayRevenue >= 1000 ? Math.round(dayRevenue / 100) * 100 : Math.round(dayRevenue);

  const handleBlockClick = (job: CalendarJob) => {
    if (dnd.consumeDragClick()) return;
    onJobClick(job);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day revenue bar */}
      <div className="border-b bg-muted/40 flex-shrink-0" data-testid="day-revenue-bar">
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(currentDate, "d MMM")} jobs:
          </span>
          <button
            className={`text-sm font-semibold px-2 py-0.5 rounded border ${revenueColor(dayRevenue, DAY_TARGET)}`}
            onClick={() => setShowRevBreakdown((v) => !v)}
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
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[60px]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${dayRevenue >= DAY_TARGET ? "bg-green-500" : dayRevenue >= DAY_TARGET * 0.7 ? "bg-amber-400" : "bg-red-400"}`}
              style={{ width: `${Math.min(100, (dayRevenue / DAY_TARGET) * 100)}%` }}
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
              getUniqueJobsForDate(currentDate).map((j) => (
                <span
                  key={j.id}
                  className="text-xs px-2 py-0.5 rounded bg-card border text-foreground"
                >
                  #{j.jobNumber} {getCustomerName(j)} — ${Math.round(jobRevenue(j))} exc. GST
                  {j.scheduledEndDate ? ` (${jobDayCount(j)}-day job, split)` : ""}
                </span>
              ))
            )}
          </div>
        )}
      </div>

      {/* Gantt grid */}
      <div className="flex-1 overflow-auto">
        <div
          className="flex flex-col h-full"
          style={{ minWidth: GANTT_COL_W + ganttHourLabels.length * GANTT_MIN_COL_W }}
        >
          {/* Header row */}
          <div className="sticky top-0 z-10 flex bg-card border-b">
            <div
              className="flex-shrink-0 border-r bg-muted/50 font-semibold p-2 text-sm sticky left-0 z-20 flex items-end"
              style={{ width: GANTT_COL_W }}
            >
              CREW
            </div>
            <div className="flex flex-1">
              {ganttHourLabels.map((label, i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-border/40 last:border-r-0 text-[10px] text-muted-foreground font-medium pb-1 pl-0.5 flex items-end"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Unassigned swim lane ───────────────────────────────────────── */}
          {unassignedJobsForDay.length > 0 && (() => {
            const unassignedEffective = unassignedJobsForDay.map((job) => ({
              id: job.id,
              startMins: ganttTimeToMins(job.scheduledStartTime),
              endMins: job.scheduledStartTime
                ? Math.max(ganttTimeToMins(job.scheduledEndTime), ganttTimeToMins(job.scheduledStartTime) + GANTT_MIN_DURATION_MINS)
                : 9 * 60,
            }));
            const unassignedLanes = assignGanttLanes(unassignedEffective);
            return (
              <div className="flex border-b" style={{ height: GANTT_ROW_H }}>
                {/* Name column */}
                <div
                  className="flex-shrink-0 border-r flex items-center gap-2 px-3 sticky left-0 z-10 bg-muted/50"
                  style={{ width: GANTT_COL_W }}
                >
                  <div className="w-7 h-7 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground text-[10px] font-bold flex-shrink-0">
                    ?
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground truncate leading-tight">Unassigned</p>
                    <p className="text-[10px] text-muted-foreground/70 leading-tight">
                      {unassignedJobsForDay.length} job{unassignedJobsForDay.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {/* Timeline */}
                <div className="flex-1 relative bg-muted/20">
                  {/* Hour grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {ganttHourLabels.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-border/40 last:border-r-0 h-full" />
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
                    const price = jobRevenue(job);
                    return (
                      <button
                        key={job.id}
                        onPointerDown={(e) =>
                          dnd.startPointerDrag(e, {
                            jobId: job.id,
                            sourceEmployeeId: '',
                            assignmentId: null,
                            durationHours: Math.max(1, Math.round((eff.endMins - eff.startMins) / 60)),
                            label: custName,
                          })
                        }
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => handleBlockClick(job)}
                        title={`${custName}${timeLabel ? ' — ' + timeLabel : ''} (unassigned — drag to assign crew)`}
                        className="absolute rounded text-left overflow-hidden hover:brightness-95 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400 cursor-grab active:cursor-grabbing select-none"
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
                          {price > 0 && (
                            <span className="text-[10px] font-bold leading-tight block truncate" style={{ color: c.border }}>
                              {formatNZD(price)}
                            </span>
                          )}
                          {blockW > 8 && (
                            <span className="text-[9px] leading-tight block truncate text-muted-foreground">
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

          {/* Staff rows */}
          {visibleEmployees.map((employee, empIdx) => {
            const gPalette = GANTT_STAFF_PALETTE[empIdx % GANTT_STAFF_PALETTE.length];
            const empDayItems = getDayGanttItems(employee.id, currentDate);
            const empGanttLaneInput = empDayItems.map(({ job, assignment }) => {
              const eff = effectiveGanttMins(job, assignment);
              return { id: job.id, startMins: eff.startMins, endMins: eff.endMins };
            });
            const empGanttLanes = assignGanttLanes(empGanttLaneInput);
            const isDropTarget = dnd.dropHover?.employeeId === employee.id && dnd.dropHover?.dateStr === dateStr;
            return (
              <div
                key={employee.id}
                className="flex border-b"
                style={{ height: GANTT_ROW_H }}
                data-testid={`staff-row-${employee.id}`}
              >
                {/* Name column */}
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

                {/* Gantt timeline bar — drop target for pointer drags */}
                <div
                  className={`flex-1 relative transition-colors duration-100 ${isDropTarget ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                  style={{ backgroundColor: isDropTarget ? gPalette.row : gPalette.row + "55" }}
                  data-drop-employee={employee.id}
                  data-drop-date={dateStr}
                  data-gantt-start={ganttStartH}
                  data-gantt-end={GANTT_END_H}
                >
                  {/* Hour grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {ganttHourLabels.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-border/40 last:border-r-0 h-full" />
                    ))}
                  </div>
                  {/* Drag-over preview block */}
                  {isDropTarget && dnd.dropHover && (() => {
                    const h = dnd.dropHover.hour;
                    const durationHours = Math.max(0.25, dnd.dragState?.item.durationHours ?? 1);
                    const startMins = h * 60;
                    const endMins = Math.min(startMins + durationHours * 60, GANTT_END_H * 60);
                    const leftPct = ((startMins - ganttStartH * 60) / (ganttHours * 60)) * 100;
                    const widthPct = ((endMins - startMins) / (ganttHours * 60)) * 100;
                    const hourLabel = `${h % 12 === 0 ? 12 : h % 12}:00${h < 12 ? 'am' : 'pm'}`;
                    return (
                      <>
                        <div
                          className="absolute pointer-events-none rounded border-2 border-dashed border-blue-500 bg-blue-400/25 flex items-center justify-center px-1 overflow-hidden"
                          style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: 4, bottom: 4 }}
                        />
                        <div
                          className="absolute -top-1 z-20 pointer-events-none bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow whitespace-nowrap"
                          style={{ left: `${leftPct}%` }}
                        >
                          {employee.firstName} · {hourLabel}
                        </div>
                      </>
                    );
                  })()}
                  {/* Google Calendar busy blocks (gray, hatched, non-interactive) */}
                  {getBusyBlocksForEmployee(employee.id, dateStr).map((busy) => {
                    const busyNzStart = toZonedTime(new Date(busy.startTime), NZ_TZ);
                    const busyNzEnd = toZonedTime(new Date(busy.endTime), NZ_TZ);
                    const startMins = busyNzStart.getHours() * 60 + busyNzStart.getMinutes();
                    const endMins = busyNzEnd.getHours() * 60 + busyNzEnd.getMinutes();
                    const startPct = ganttMinsToPercent(Math.max(startMins, ganttStartH * 60));
                    const endPct = ganttMinsToPercent(Math.min(endMins, GANTT_END_H * 60));
                    const blockW = Math.max(2, endPct - startPct);
                    const label = busy.summary || 'Busy';
                    return (
                      <div
                        key={busy.id}
                        className="absolute pointer-events-none rounded overflow-hidden"
                        title={`Google Calendar: ${label}`}
                        style={{
                          left: `${startPct}%`,
                          width: `${blockW}%`,
                          top: 4,
                          bottom: 4,
                          background: 'repeating-linear-gradient(45deg,#9ca3af33 0px,#9ca3af33 4px,#d1d5db22 4px,#d1d5db22 8px)',
                          border: '1px solid #9ca3af66',
                          minWidth: 8,
                        }}
                      >
                        <span className="text-[9px] text-gray-500 px-1 truncate block leading-tight">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                  {/* Job blocks */}
                  {empDayItems.map(({ job, assignment }) => {
                    const eff = effectiveGanttMins(job, assignment);
                    const startPct = ganttMinsToPercent(eff.startMins);
                    const blockW = Math.max(4, ganttMinsToPercent(eff.endMins) - startPct);
                    const { lane, totalLanes } = empGanttLanes.get(job.id) ?? { lane: 0, totalLanes: 1 };
                    const ls = ganttLaneStyle(lane, totalLanes);
                    const c = getJobColor(job.id);
                    const custName = getCustomerName(job);
                    const timeLabel = eff.fromAssignment
                      ? `${ganttFormatMins(eff.startMins)}–${ganttFormatMins(eff.endMins)}`
                      : `${ganttFormatTime(job.scheduledStartTime)}–${ganttFormatTime(job.scheduledEndTime)}`;
                    const price = jobRevenue(job);
                    return (
                      <button
                        key={job.id}
                        onPointerDown={(e) =>
                          dnd.startPointerDrag(e, {
                            jobId: job.id,
                            sourceEmployeeId: employee.id,
                            assignmentId: assignment?.id ?? null,
                            durationHours: Math.max(1, Math.round((eff.endMins - eff.startMins) / 60)),
                            label: custName,
                          })
                        }
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => handleBlockClick(job)}
                        title={`${custName} — ${timeLabel}`}
                        className="absolute rounded text-left overflow-hidden hover:brightness-95 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400 cursor-grab active:cursor-grabbing select-none"
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
                          {price > 0 && (
                            <span className="text-[10px] font-bold leading-tight block truncate" style={{ color: c.border }}>
                              {formatNZD(price)}
                            </span>
                          )}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

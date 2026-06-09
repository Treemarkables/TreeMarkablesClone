// Day Gantt — port of CalendarGrid's day mode for the unified calendar.
// Horizontal timeline with one row per crew member, an "Unassigned" swim lane
// on top, and the daily revenue bar. Unassigned blocks can be dragged onto a
// crew row to assign + time them (same HTML5 drag machinery as /dispatch;
// Phase B unifies this on pointer events and adds touch + conflict warnings).
import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, MapPin, MessageSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { nzTimeToUTC } from "@shared/dateUtils";
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
import type { CalendarData } from "./useCalendarData";

interface DayViewProps {
  currentDate: Date;
  onJobClick: (job: CalendarJob) => void;
  data: CalendarData;
}

export function DayView({ currentDate, onJobClick, data }: DayViewProps) {
  const {
    visibleEmployees,
    jobMap,
    getJobColor,
    getCustomerName,
    getDayGanttItems,
    unassignedJobsForDate,
    computeGanttStartH,
    getUniqueJobsForDate,
    revenueForDate,
    DAY_TARGET,
  } = data;

  const [dayViewDragOver, setDayViewDragOver] = useState<string | null>(null);
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
                <div
                  className={`flex-1 relative transition-colors duration-100 ${dayViewDragOver === 'unassigned' ? 'bg-blue-50' : 'bg-muted/20'}`}
                >
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
                        onClick={() => onJobClick(job)}
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

                {/* Gantt timeline bar */}
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
                    }
                  }}
                >
                  {/* Hour grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {ganttHourLabels.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-border/40 last:border-r-0 h-full" />
                    ))}
                  </div>
                  {/* Drag-over preview block */}
                  {dayViewDragHour?.employeeId === employee.id && (() => {
                    const h = dayViewDragHour.hour;
                    const durationHours = Math.max(0.25, dragRef.current?.durationHours ?? 1);
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
                        onClick={() => onJobClick(job)}
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

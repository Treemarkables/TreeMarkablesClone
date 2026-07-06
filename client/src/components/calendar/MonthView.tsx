// Job-centric month grid. Multi-day jobs render as horizontal span bars across
// each week row (honouring non-contiguous scheduledDates carve-outs — a job
// that skips the weekend renders as two separate segments), replacing the old
// count-badge cells.
import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { Check, MessageSquare, Reply } from "lucide-react";
import { getJobScheduledNZDates } from "@shared/dateUtils";
import type { CalendarJob } from "./calendarMath";
import { assignGanttLanes } from "./calendarMath";
import type { CalendarData } from "./useCalendarData";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Bars per week row before collapsing into a "+N more" pill.
const MAX_VISIBLE_LANES = 3;
const DAY_NUMBER_STRIP_PX = 28;
const BAR_HEIGHT_PX = 18;
const BAR_GAP_PX = 2;

interface SpanSegment {
  job: CalendarJob;
  startIdx: number; // 0..6 within the week
  span: number; // number of days covered in this week
  continuesLeft: boolean; // job has scheduled days before this segment
  continuesRight: boolean; // job has scheduled days after this segment
  lane: number;
}

interface MonthViewProps {
  currentDate: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onJobClick: (job: CalendarJob) => void;
  data: CalendarData;
}

export function MonthView({
  currentDate,
  selectedDate,
  onSelectDate,
  onJobClick,
  data,
}: MonthViewProps) {
  const { allJobs, jobPassesFilter, getJobColor, getCustomerName } = data;

  const weeks = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentDate)),
      end: endOfWeek(endOfMonth(currentDate)),
    });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [currentDate]);

  // Scheduled jobs visible on the calendar, with their NZ day sets precomputed
  const scheduledJobs = useMemo(() => {
    return allJobs
      .filter(
        (job) =>
          job.scheduledDate &&
          job.status !== "unsuccessful" &&
          job.status !== "archived" &&
          jobPassesFilter(job),
      )
      .map((job) => ({ job, days: getJobScheduledNZDates(job) }))
      .filter(({ days }) => days.length > 0);
  }, [allJobs, jobPassesFilter]);

  // Per-week: laid-out span segments + per-day hidden counts
  const weekLayouts = useMemo(() => {
    return weeks.map((weekDays) => {
      const dayKeys = weekDays.map((d) => format(d, "yyyy-MM-dd"));
      const keySet = new Set(dayKeys);

      // Collect contiguous runs of each job's days that fall inside this week
      const rawSegments: Omit<SpanSegment, "lane">[] = [];
      for (const { job, days } of scheduledJobs) {
        if (!days.some((d) => keySet.has(d))) continue;
        const idxs = dayKeys
          .map((key, idx) => (days.includes(key) ? idx : -1))
          .filter((idx) => idx >= 0);
        let runStart = idxs[0];
        let prev = idxs[0];
        const flush = (endIdx: number) => {
          const firstKey = dayKeys[runStart];
          const lastKey = dayKeys[endIdx];
          rawSegments.push({
            job,
            startIdx: runStart,
            span: endIdx - runStart + 1,
            continuesLeft: days.indexOf(firstKey) > 0,
            continuesRight: days.indexOf(lastKey) < days.length - 1,
          });
        };
        for (let i = 1; i < idxs.length; i++) {
          if (idxs[i] !== prev + 1) {
            flush(prev);
            runStart = idxs[i];
          }
          prev = idxs[i];
        }
        flush(prev);
      }

      // Lane assignment — reuse the gantt lane packer with day indexes as the axis
      const laneMap = assignGanttLanes(
        rawSegments.map((seg, i) => ({
          id: `${seg.job.id}:${i}`,
          startMins: seg.startIdx,
          endMins: seg.startIdx + seg.span,
        })),
      );
      const segments: SpanSegment[] = rawSegments.map((seg, i) => ({
        ...seg,
        lane: laneMap.get(`${seg.job.id}:${i}`)?.lane ?? 0,
      }));

      // Per-day hidden-job counts (segments pushed past the visible lane cap)
      const hiddenCounts = new Array(7).fill(0) as number[];
      for (const seg of segments) {
        if (seg.lane < MAX_VISIBLE_LANES) continue;
        for (let d = seg.startIdx; d < seg.startIdx + seg.span; d++) {
          hiddenCounts[d]++;
        }
      }

      return { weekDays, segments, hiddenCounts };
    });
  }, [weeks, scheduledJobs]);

  return (
    <div className="p-2 sm:p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="border-l border-t rounded-md overflow-hidden pb-px">
        {weekLayouts.map(({ weekDays, segments, hiddenCounts }, weekIdx) => (
          <div key={weekIdx} className="relative">
            <div className="grid grid-cols-7">
              {weekDays.map((day, dayIdx) => {
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const hidden = hiddenCounts[dayIdx];
                return (
                  <div
                    key={dayIdx}
                    className={`min-h-[96px] sm:min-h-[120px] border-r border-b bg-card cursor-pointer transition-colors flex flex-col ${
                      !isCurrentMonth ? "opacity-40" : ""
                    } ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                    onClick={() => onSelectDate(day)}
                    data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className="p-1 sm:p-1.5">
                      <span
                        className={`text-xs sm:text-sm font-medium inline-flex ${
                          isTodayDate
                            ? "bg-primary text-primary-foreground rounded-full h-6 w-6 items-center justify-center"
                            : ""
                        }`}
                        data-testid={`text-day-${format(day, "yyyy-MM-dd")}`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    {hidden > 0 && (
                      <div className="mt-auto pb-1 text-[10px] text-muted-foreground text-center">
                        +{hidden} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Span bars overlay */}
            <div className="absolute inset-x-0 top-0 pointer-events-none">
              {segments
                .filter((seg) => seg.lane < MAX_VISIBLE_LANES)
                .map((seg, i) => {
                  const c = getJobColor(seg.job.id);
                  const awaitingConfirm =
                    seg.job.status === "work_order" && !seg.job.customerConfirmed;
                  const leftPct = (seg.startIdx * 100) / 7;
                  const widthPct = (seg.span * 100) / 7;
                  const custName = getCustomerName(seg.job);
                  return (
                    <button
                      key={`${seg.job.id}:${i}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onJobClick(seg.job);
                      }}
                      title={`#${seg.job.jobNumber} ${custName}`}
                      className={`absolute pointer-events-auto text-left overflow-hidden hover:brightness-95 transition-all focus:outline-none focus:ring-1 focus:ring-ring ${
                        seg.continuesLeft ? "rounded-l-none" : "rounded-l"
                      } ${seg.continuesRight ? "rounded-r-none" : "rounded-r"} ${
                        awaitingConfirm ? "opacity-70" : ""
                      }`}
                      style={{
                        left: `calc(${leftPct}% + ${seg.continuesLeft ? 0 : 2}px)`,
                        width: `calc(${widthPct}% - ${(seg.continuesLeft ? 0 : 2) + (seg.continuesRight ? 0 : 2)}px)`,
                        top: DAY_NUMBER_STRIP_PX + seg.lane * (BAR_HEIGHT_PX + BAR_GAP_PX),
                        height: BAR_HEIGHT_PX,
                        backgroundColor: c.bg,
                        borderLeft: seg.continuesLeft ? `1px ${awaitingConfirm ? "dashed" : "solid"} ${c.border}` : `3px solid ${c.border}`,
                        borderTop: `1px ${awaitingConfirm ? "dashed" : "solid"} ${c.border}`,
                        borderBottom: `1px ${awaitingConfirm ? "dashed" : "solid"} ${c.border}`,
                        borderRight: `1px ${awaitingConfirm ? "dashed" : "solid"} ${c.border}`,
                      }}
                      data-testid={`month-span-${seg.job.id}`}
                    >
                      <span className="flex items-center gap-0.5 px-1 h-full">
                        <span
                          className="text-[10px] font-semibold truncate flex-1 min-w-0 leading-none"
                          style={{ color: c.text }}
                        >
                          {custName}
                        </span>
                        {seg.job.customerConfirmed && (
                          <Check
                            className="h-3 w-3 shrink-0"
                            strokeWidth={3}
                            style={{ color: c.border }}
                            data-testid={`icon-confirmed-${seg.job.id}`}
                          />
                        )}
                        {!seg.job.customerConfirmed && seg.job.customerReplyReceivedAt && (
                          <MessageSquare
                            className="h-3 w-3 shrink-0"
                            strokeWidth={2.5}
                            style={{ color: c.border }}
                            data-testid={`icon-customer-replied-${seg.job.id}`}
                          />
                        )}
                        {seg.job.confirmationReplySentAt && (
                          <Reply
                            className="h-3 w-3 shrink-0"
                            strokeWidth={3}
                            style={{ color: c.border }}
                            data-testid={`icon-reply-sent-${seg.job.id}`}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

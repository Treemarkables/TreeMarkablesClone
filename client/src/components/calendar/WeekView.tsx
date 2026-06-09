// Staff-row week grid — port of CalendarGrid's week mode for the unified
// calendar. One row per crew member, one column per day; multi-day jobs render
// in every scheduled day's cell via the shared data helpers.
import { useMemo } from "react";
import {
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isToday,
  isSameDay,
} from "date-fns";
import { Check, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CalendarJob } from "./calendarMath";
import { jobRevenue, formatNZD } from "./calendarMath";
import type { CalendarData } from "./useCalendarData";

interface WeekViewProps {
  currentDate: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onJobClick: (job: CalendarJob) => void;
  data: CalendarData;
}

export function WeekView({
  currentDate,
  selectedDate,
  onSelectDate,
  onJobClick,
  data,
}: WeekViewProps) {
  const {
    visibleEmployees,
    getItemsForDate,
    getCustomerName,
    getJobColor,
    revenueForDate,
    DAY_TARGET,
  } = data;

  const dateRange = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate),
      }),
    [currentDate],
  );

  const weekRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    dateRange.forEach((d) => {
      map[format(d, "yyyy-MM-dd")] = revenueForDate(d);
    });
    return map;
  }, [dateRange, revenueForDate]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex flex-col min-w-max">
        {/* Header row */}
        <div className="sticky top-0 z-10 flex bg-card border-b">
          <div className="w-28 flex-shrink-0 border-r bg-muted/50 font-semibold p-2 text-sm sticky left-0 z-20">
            Staff
          </div>
          {dateRange.map((date) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const rev = weekRevenue[dateKey] ?? 0;
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            return (
              <button
                key={date.toISOString()}
                className={`w-36 flex-shrink-0 border-r p-2 text-xs text-center font-medium cursor-pointer transition-colors ${
                  isSelected ? "bg-accent" : ""
                }`}
                onClick={() => onSelectDate(date)}
                data-testid={`date-header-${dateKey}`}
              >
                <div>{format(date, "EEE")}</div>
                <div
                  className={`font-semibold ${
                    isToday(date)
                      ? "bg-primary text-primary-foreground rounded-full px-1.5 inline-block"
                      : ""
                  }`}
                >
                  {format(date, "d MMM")}
                </div>
                {rev > 0 && (
                  <div
                    className={`mt-1 text-[10px] font-medium px-1 py-0.5 rounded ${rev >= DAY_TARGET ? "text-green-700 bg-green-50" : rev >= DAY_TARGET * 0.7 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"}`}
                  >
                    {formatNZD(rev)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Staff rows */}
        <div className="flex-1 flex flex-col">
          {visibleEmployees.map((employee) => (
            <div
              key={employee.id}
              className="flex border-b min-h-[80px] hover:bg-muted/30"
              data-testid={`staff-row-${employee.id}`}
            >
              <div className="w-28 flex-shrink-0 border-r p-2 flex items-center gap-2 sticky left-0 bg-card z-10">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {employee.firstName[0]}
                    {employee.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{employee.firstName}</span>
              </div>
              {dateRange.map((date) => {
                const items = getItemsForDate(employee.id, date);
                return (
                  <div
                    key={date.toISOString()}
                    className="w-36 flex-shrink-0 border-r p-1 min-h-[80px]"
                    data-testid={`slot-${employee.id}-${format(date, "yyyy-MM-dd")}`}
                  >
                    {items.map((job) => {
                      const c = getJobColor(job.id);
                      const price = jobRevenue(job);
                      return (
                        <div
                          key={job.id}
                          className="text-xs p-1.5 rounded border cursor-pointer mb-1"
                          style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
                          onClick={() => onJobClick(job)}
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
                            {price > 0 && (
                              <span className="font-bold" style={{ color: c.border }}>
                                {formatNZD(price)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

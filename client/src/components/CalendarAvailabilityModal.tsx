import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfWeek, addWeeks, subWeeks, format, isSameDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const NZ_TZ = 'Pacific/Auckland';
const DAY_START_H = 6;   // 6 AM
const DAY_END_H   = 19;  // 7 PM
const DAY_HOURS   = DAY_END_H - DAY_START_H;

interface CalendarEventSummary {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink?: string;
  location?: string;
}

interface EventsResponse {
  success: boolean;
  data?: CalendarEventSummary[];
  error?: 'not_connected' | 'invalid_range' | 'upstream';
  message?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSlotPick: (slotStart: Date) => void;
}

function minsToPercent(mins: number): number {
  return Math.max(0, Math.min(100, ((mins - DAY_START_H * 60) / (DAY_HOURS * 60)) * 100));
}

// NZ-zoned hours/mins from a UTC ISO string
function nzMinsOfDay(iso: string): number {
  const [h, m] = formatInTimeZone(new Date(iso), NZ_TZ, 'H:m').split(':').map(Number);
  return h * 60 + m;
}

// NZ date string (yyyy-MM-dd) for bucketing events into day columns
function nzDateKey(d: Date | string): string {
  return formatInTimeZone(new Date(d), NZ_TZ, 'yyyy-MM-dd');
}

export function CalendarAvailabilityModal({ isOpen, onClose, onSlotPick }: Props) {
  // Monday-anchored NZ week
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const nowNZ = toZonedTime(new Date(), NZ_TZ);
    const monday = startOfWeek(nowNZ, { weekStartsOn: 1 });
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Convert the NZ week boundary to UTC ISO for the API query
  const startIso = useMemo(
    () => new Date(formatInTimeZone(weekStart, NZ_TZ, "yyyy-MM-dd'T'00:00:00XXX")).toISOString(),
    [weekStart],
  );
  const endIso = useMemo(
    () => new Date(formatInTimeZone(addDays(weekStart, 7), NZ_TZ, "yyyy-MM-dd'T'00:00:00XXX")).toISOString(),
    [weekStart],
  );

  const { data, isLoading, isError } = useQuery<EventsResponse>({
    queryKey: ['/api/google-calendar/events', startIso, endIso],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`);
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const notConnected = data?.success === false && data.error === 'not_connected';
  const events = data?.success && data.data ? data.data : [];

  // Group events by NZ date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventSummary[]>();
    for (const ev of events) {
      const key = nzDateKey(ev.start);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  // Hour labels down the left axis
  const hourLabels = useMemo(() => {
    return Array.from({ length: DAY_HOURS + 1 }, (_, i) => {
      const h = DAY_START_H + i;
      if (h === 12) return '12 PM';
      return h < 12 ? `${h} AM` : `${h - 12} PM`;
    });
  }, []);

  const goPrev = () => setWeekStart((d) => subWeeks(d, 1));
  const goNext = () => setWeekStart((d) => addWeeks(d, 1));
  const goToday = () => {
    const nowNZ = toZonedTime(new Date(), NZ_TZ);
    const monday = startOfWeek(nowNZ, { weekStartsOn: 1 });
    monday.setHours(0, 0, 0, 0);
    setWeekStart(monday);
  };

  // Click handler: compute NZ-local slot start from y offset, snap to 30 min
  const handleColumnClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that bubbled up from an event block
    const target = e.target as HTMLElement;
    if (target.closest('[data-event-block="true"]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = Math.max(0, Math.min(1, y / rect.height));
    const rawMins = DAY_START_H * 60 + pct * DAY_HOURS * 60;
    const snappedMins = Math.floor(rawMins / 30) * 30;
    const h = Math.floor(snappedMins / 60);
    const m = snappedMins % 60;

    // Build the NZ-local ISO with that day's date and time, then parse as a real Date
    const dateStr = formatInTimeZone(day, NZ_TZ, 'yyyy-MM-dd');
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    // Construct by asking date-fns-tz to format a string we'll then parse. Use the NZ offset.
    const offset = formatInTimeZone(day, NZ_TZ, 'XXX');
    const slotIso = `${dateStr}T${hh}:${mm}:00${offset}`;
    const slot = new Date(slotIso);
    if (Number.isNaN(slot.getTime())) return;

    onSlotPick(slot);
    onClose();
  };

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const startFmt = sameMonth ? format(weekStart, 'd') : format(weekStart, 'd MMM');
    const endFmt = format(end, 'd MMM yyyy');
    return `${startFmt} – ${endFmt}`;
  }, [weekStart]);

  const todayKey = nzDateKey(new Date());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Your availability — {weekLabel}
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Previous week" data-testid="btn-availability-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs" data-testid="btn-availability-today">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={goNext} aria-label="Next week" data-testid="btn-availability-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {notConnected ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <CalendarIcon className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                Google Calendar isn't connected yet. Connect it to see your availability while you compose messages.
              </p>
              <Link href="/integrations">
                <Button variant="outline" size="sm" onClick={onClose} data-testid="btn-availability-connect">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open Integrations
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day header */}
            <div className="flex border-b bg-gray-50">
              <div className="w-14 shrink-0 border-r" />
              {days.map((d) => {
                const key = nzDateKey(d);
                const isToday = key === todayKey;
                return (
                  <div key={d.toISOString()} className={`flex-1 text-center py-2 border-r last:border-r-0 ${isToday ? 'bg-orange-50' : ''}`}>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">{format(d, 'EEE')}</div>
                    <div className={`text-sm font-semibold ${isToday ? 'text-orange-600' : 'text-gray-900'}`}>{format(d, 'd MMM')}</div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable grid body */}
            <div className="flex-1 overflow-auto">
              <div className="flex h-[600px] min-h-full">
                {/* Hour labels column */}
                <div className="w-14 shrink-0 border-r relative">
                  {hourLabels.map((label, i) => (
                    <div
                      key={label}
                      className="absolute left-0 right-0 text-[10px] text-gray-400 px-1 -translate-y-1/2"
                      style={{ top: `${(i / DAY_HOURS) * 100}%` }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {days.map((day) => {
                  const key = nzDateKey(day);
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 relative border-r last:border-r-0 cursor-pointer hover:bg-blue-50/30 ${isToday ? 'bg-orange-50/40' : ''}`}
                      onClick={(e) => handleColumnClick(day, e)}
                      data-testid={`availability-day-${key}`}
                    >
                      {/* Hour gridlines */}
                      {Array.from({ length: DAY_HOURS }, (_, i) => (
                        <div
                          key={i}
                          className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                          style={{ top: `${(i / DAY_HOURS) * 100}%` }}
                        />
                      ))}

                      {/* Event blocks */}
                      {dayEvents.map((ev) => {
                        const startMins = nzMinsOfDay(ev.start);
                        const endMins = Math.max(nzMinsOfDay(ev.end), startMins + 15);
                        // Clamp to visible window
                        const top = minsToPercent(startMins);
                        const bottom = minsToPercent(endMins);
                        const height = Math.max(2, bottom - top);
                        const visible = top < 100 && bottom > 0;
                        if (!visible) return null;
                        return (
                          <div
                            key={ev.id}
                            data-event-block="true"
                            className="absolute left-1 right-1 rounded bg-blue-100 border-l-2 border-blue-500 px-1 py-0.5 overflow-hidden text-[10px] leading-tight text-blue-900 shadow-sm"
                            style={{ top: `${top}%`, height: `${height}%` }}
                            title={`${ev.summary}\n${formatInTimeZone(new Date(ev.start), NZ_TZ, 'h:mm a')} – ${formatInTimeZone(new Date(ev.end), NZ_TZ, 'h:mm a')}${ev.location ? `\n${ev.location}` : ''}`}
                          >
                            <div className="font-semibold truncate">{ev.summary}</div>
                            {height > 5 && (
                              <div className="opacity-80 truncate">
                                {formatInTimeZone(new Date(ev.start), NZ_TZ, 'h:mm a')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer hint */}
            <div className="border-t px-4 py-2 text-[11px] text-gray-500 bg-gray-50">
              {isLoading
                ? 'Loading…'
                : isError
                  ? 'Could not load calendar events.'
                  : 'Click any empty slot to drop that time into your message.'}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

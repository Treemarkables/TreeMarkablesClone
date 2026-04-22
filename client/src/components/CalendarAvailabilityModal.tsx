import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfWeek, addWeeks, subWeeks, format } from 'date-fns';
import { toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz';
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

interface GoogleEventSummary {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink?: string;
  location?: string;
}

interface GoogleEventsResponse {
  success: boolean;
  data?: GoogleEventSummary[];
  error?: 'not_connected' | 'invalid_range' | 'upstream';
  message?: string;
}

interface ScheduledJob {
  id: string;
  jobNumber?: string | null;
  title?: string | null;
  address?: string | null;
  scheduledDate?: string | null;
  scheduledEndDate?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  estimatedDuration?: number | string | null;
  status?: string | null;
}

interface JobsResponse {
  success: boolean;
  data?: ScheduledJob[];
  message?: string;
}

interface CalendarBlock {
  id: string;
  kind: 'job' | 'google';
  title: string;
  subtitle?: string;
  startIso: string;
  endIso: string;
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

// Combine an NZ-local date (yyyy-MM-dd) and time (HH:mm) into a UTC ISO string
function nzLocalToUtcIso(dateStr: string, timeStr: string): string {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, NZ_TZ).toISOString();
}

// Turn a scheduled job into a calendar block. Returns null if the job lacks enough info to place.
function jobToBlock(job: ScheduledJob): CalendarBlock | null {
  if (!job.scheduledDate) return null;

  const startDateKey = nzDateKey(job.scheduledDate);

  // Start: prefer explicit scheduledStartTime in NZ wall-clock; otherwise fall back to the
  // time encoded in scheduledDate itself (which is already the correct NZ wall-clock once
  // converted through NZ_TZ).
  const startIso = job.scheduledStartTime
    ? nzLocalToUtcIso(startDateKey, job.scheduledStartTime)
    : new Date(job.scheduledDate).toISOString();

  // End date: scheduledEndDate for multi-day jobs, else the same NZ day as start.
  const endDateKey = job.scheduledEndDate ? nzDateKey(job.scheduledEndDate) : startDateKey;

  let endIso: string;
  if (job.scheduledEndTime) {
    endIso = nzLocalToUtcIso(endDateKey, job.scheduledEndTime);
  } else {
    const durationHours =
      typeof job.estimatedDuration === 'number'
        ? job.estimatedDuration
        : typeof job.estimatedDuration === 'string' && job.estimatedDuration
          ? parseFloat(job.estimatedDuration)
          : NaN;
    const hours = Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 1;
    endIso = new Date(new Date(startIso).getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  // Guard against inverted intervals.
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
  }

  const jobLabel = job.jobNumber ? `#${job.jobNumber}` : 'Job';
  const title = job.title ? `${jobLabel} — ${job.title}` : jobLabel;

  return {
    id: `job:${job.id}`,
    kind: 'job',
    title,
    subtitle: job.address || undefined,
    startIso,
    endIso,
  };
}

function googleEventToBlock(ev: GoogleEventSummary): CalendarBlock {
  return {
    id: `google:${ev.id}`,
    kind: 'google',
    title: ev.summary,
    subtitle: ev.location || undefined,
    startIso: ev.start,
    endIso: ev.end,
  };
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

  // UTC ISO range for the Google Calendar API (expects ISO with offset).
  const startIso = useMemo(
    () => new Date(formatInTimeZone(weekStart, NZ_TZ, "yyyy-MM-dd'T'00:00:00XXX")).toISOString(),
    [weekStart],
  );
  const endIso = useMemo(
    () => new Date(formatInTimeZone(addDays(weekStart, 7), NZ_TZ, "yyyy-MM-dd'T'00:00:00XXX")).toISOString(),
    [weekStart],
  );

  // NZ-local YYYY-MM-DD range for the jobs endpoint (half-open).
  const startDateNZ = useMemo(() => formatInTimeZone(weekStart, NZ_TZ, 'yyyy-MM-dd'), [weekStart]);
  const endDateNZ = useMemo(() => formatInTimeZone(addDays(weekStart, 7), NZ_TZ, 'yyyy-MM-dd'), [weekStart]);

  const googleQuery = useQuery<GoogleEventsResponse>({
    queryKey: ['/api/google-calendar/events', startIso, endIso],
    queryFn: async () => {
      const res = await fetch(`/api/google-calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`);
      return res.json();
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const jobsQuery = useQuery<JobsResponse>({
    queryKey: ['/api/jobs/in-range', startDateNZ, endDateNZ],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/in-range?start=${startDateNZ}&end=${endDateNZ}`);
      return res.json();
    },
    enabled: isOpen,
    staleTime: 60 * 1000,
  });

  const googleNotConnected = googleQuery.data?.success === false && googleQuery.data.error === 'not_connected';
  const googleEvents = googleQuery.data?.success && googleQuery.data.data ? googleQuery.data.data : [];
  const jobs = jobsQuery.data?.success && jobsQuery.data.data ? jobsQuery.data.data : [];

  const blocks = useMemo<CalendarBlock[]>(() => {
    const jobBlocks = jobs.map(jobToBlock).filter((b): b is CalendarBlock => b !== null);
    const googleBlocks = googleEvents.map(googleEventToBlock);
    return [...jobBlocks, ...googleBlocks];
  }, [jobs, googleEvents]);

  // Group blocks by NZ date
  const blocksByDate = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const b of blocks) {
      const key = nzDateKey(b.startIso);
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return map;
  }, [blocks]);

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

  const isLoading = googleQuery.isLoading || jobsQuery.isLoading;
  const jobsError = jobsQuery.isError;
  const googleUpstreamError =
    googleQuery.isError ||
    (googleQuery.data?.success === false && googleQuery.data.error !== 'not_connected');

  let footerHint: string;
  if (isLoading) {
    footerHint = 'Loading…';
  } else if (jobsError && googleUpstreamError) {
    footerHint = 'Could not load calendar data.';
  } else if (jobsError) {
    footerHint = 'Could not load scheduled jobs.';
  } else if (googleUpstreamError) {
    footerHint = 'Could not load Google Calendar events.';
  } else {
    footerHint = 'Click any empty slot to drop that time into your message.';
  }

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

        <div className="flex-1 flex flex-col overflow-hidden">
          {googleNotConnected && (
            <div className="px-4 py-2 text-[11px] border-b bg-amber-50 text-amber-900 flex items-center justify-between gap-2">
              <span>
                Google Calendar isn't connected — showing Treemarkables scheduled jobs only.
              </span>
              <Link href="/integrations">
                <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs" data-testid="btn-availability-connect">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Connect
                </Button>
              </Link>
            </div>
          )}

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
                const dayBlocks = blocksByDate.get(key) ?? [];
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
                    {dayBlocks.map((b) => {
                      const startMins = nzMinsOfDay(b.startIso);
                      const endMins = Math.max(nzMinsOfDay(b.endIso), startMins + 15);
                      const top = minsToPercent(startMins);
                      const bottom = minsToPercent(endMins);
                      const height = Math.max(2, bottom - top);
                      const visible = top < 100 && bottom > 0;
                      if (!visible) return null;
                      const isJob = b.kind === 'job';
                      const colourClass = isJob
                        ? 'bg-orange-100 border-orange-500 text-orange-900'
                        : 'bg-blue-100 border-blue-500 text-blue-900';
                      const timeLabel = `${formatInTimeZone(new Date(b.startIso), NZ_TZ, 'h:mm a')} – ${formatInTimeZone(new Date(b.endIso), NZ_TZ, 'h:mm a')}`;
                      return (
                        <div
                          key={b.id}
                          data-event-block="true"
                          className={`absolute left-1 right-1 rounded border-l-2 px-1 py-0.5 overflow-hidden text-[10px] leading-tight shadow-sm ${colourClass}`}
                          style={{ top: `${top}%`, height: `${height}%` }}
                          title={`${b.title}\n${timeLabel}${b.subtitle ? `\n${b.subtitle}` : ''}`}
                        >
                          <div className="font-semibold truncate">{b.title}</div>
                          {height > 5 && (
                            <div className="opacity-80 truncate">
                              {formatInTimeZone(new Date(b.startIso), NZ_TZ, 'h:mm a')}
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
            {footerHint}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

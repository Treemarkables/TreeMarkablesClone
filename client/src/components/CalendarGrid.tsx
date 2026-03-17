import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import {
  format, addDays, subDays, startOfDay, addWeeks, subWeeks,
  addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { isSameDayNZ, isBetweenNZ, getNZDateString } from '@shared/dateUtils';
import { useQuery } from '@tanstack/react-query';

const NZ_TZ = 'Pacific/Auckland';


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

type ViewMode = 'day' | 'week' | '2weeks' | 'month';

interface CalendarGridProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

export function CalendarGrid({ selectedDate: externalDate, onDateChange }: CalendarGridProps = {}) {
  const [internalDate, setInternalDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);

  const currentDate = externalDate || internalDate;
  const setCurrentDate = (date: Date) => {
    if (onDateChange) onDateChange(date);
    else setInternalDate(date);
  };

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: employeesData } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees/active'],
  });
  const { data: jobsData } = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ['/api/jobs'],
  });
  const { data: assignmentsData } = useQuery<{ success: boolean; data: StaffAssignment[] }>({
    queryKey: ['/api/staff-assignments'],
    refetchInterval: 30000,
  });
  const { data: customersData } = useQuery<{ success: boolean; data: Customer[] }>({
    queryKey: ['/api/customers'],
  });

  const employees = employeesData?.data || [];
  const allJobs = jobsData?.data || [];
  const allAssignments = assignmentsData?.data || [];
  const customers = customersData?.data || [];

  // ── Derived maps ───────────────────────────────────────────────────────────
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach(c => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    allJobs.forEach(j => map.set(j.id, j));
    return map;
  }, [allJobs]);

  // employee+date → [{assignment, job}]
  // Keys use NZ date strings so UTC-stored startTimes are bucketed correctly
  const assignmentsByEmployeeDate = useMemo(() => {
    const map = new Map<string, { assignment: StaffAssignment; job: Job }[]>();
    allAssignments.forEach(a => {
      const job = jobMap.get(a.jobId);
      if (!job || job.status === 'archived') return;
      // getNZDateString converts UTC → NZ date (e.g. "2026-03-16T19:00Z" → "2026-03-17")
      const nzDateStr = getNZDateString(a.startTime);
      const key = `${a.employeeId}__${nzDateStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ assignment: a, job });
    });
    return map;
  }, [allAssignments, jobMap]);

  // Debug: log map keys so we can verify timezone matching
  useEffect(() => {
    if (allAssignments.length === 0) return;
    const keys = Array.from(assignmentsByEmployeeDate.keys());
    const todayKey = getNZDateString(currentDate);
    console.log('[CalendarGrid] assignments loaded:', allAssignments.length);
    console.log('[CalendarGrid] map size:', assignmentsByEmployeeDate.size);
    console.log('[CalendarGrid] sample map keys (first 5):', keys.slice(0, 5));
    console.log('[CalendarGrid] today NZ lookup key:', todayKey);
    // Show first assignment raw for comparison
    const a = allAssignments[0];
    console.log('[CalendarGrid] first assignment startTime:', a.startTime, '→ nzDate:', getNZDateString(a.startTime));
  }, [allAssignments.length, assignmentsByEmployeeDate.size, currentDate.toDateString()]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToPrevious = () => {
    if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else if (viewMode === '2weeks') setCurrentDate(subWeeks(currentDate, 2));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const goToNext = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else if (viewMode === '2weeks') setCurrentDate(addWeeks(currentDate, 2));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  // ── Date range ─────────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    if (viewMode === 'day') return [startOfDay(currentDate)];
    if (viewMode === 'week') return eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });
    if (viewMode === '2weeks') return eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(addWeeks(currentDate, 1)) });
    return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  }, [currentDate, viewMode]);

  // ── Time slots (7 am – 6 pm) ───────────────────────────────────────────────
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 18; h++) {
      slots.push({ hour: h, label: format(new Date().setHours(h, 0), 'h:00 a') });
    }
    return slots;
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCustomerName = (job: Job) => {
    if (job.customerId) return customerMap.get(job.customerId) || job.title || 'Unknown Customer';
    return job.title || 'No Customer';
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'scheduled':   return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'work_order':  return 'bg-amber-100 border-amber-300 text-amber-800';
      case 'in_progress': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'completed':   return 'bg-green-100 border-green-300 text-green-800';
      case 'cancelled':   return 'bg-red-100 border-red-300 text-red-800';
      default:            return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  // Jobs for a specific employee + hour slot (day view)
  // Uses staff assignments as primary source; falls back to job.assignedTo
  const getItemsForHour = (employeeId: string, date: Date, hour: number) => {
    // Use NZ timezone for lookup to match the NZ-timezone keys in assignmentsByEmployeeDate
    const dateKey = getNZDateString(date);
    const assigned = assignmentsByEmployeeDate.get(`${employeeId}__${dateKey}`) || [];

    // Filter to assignments that overlap with this hour
    // Convert UTC → NZ local time before extracting hours
    const fromAssignments = assigned.filter(({ assignment }) => {
      const startNZ = toZonedTime(new Date(assignment.startTime), NZ_TZ);
      const endNZ = toZonedTime(new Date(assignment.endTime), NZ_TZ);
      const startH = startNZ.getHours() + startNZ.getMinutes() / 60;
      const endH = endNZ.getHours() + endNZ.getMinutes() / 60;
      return startH < hour + 1 && endH > hour;
    });

    if (fromAssignments.length > 0) return fromAssignments.map(x => x.job);

    // Fallback: jobs with job.assignedTo that include this employee
    return allJobs.filter(job => {
      if (job.status === 'archived') return false;
      if (!job.scheduledDate) return false;
      if (!job.assignedTo?.includes(employeeId)) return false;
      if (!isSameDayNZ(job.scheduledDate, date)) return false;
      if (job.scheduledStartTime) {
        const [sh] = job.scheduledStartTime.split(':').map(Number);
        const eh = job.scheduledEndTime ? Number(job.scheduledEndTime.split(':')[0]) : sh + 2;
        return sh < hour + 1 && eh > hour;
      }
      return hour === 7;
    });
  };

  // Jobs for a specific employee + date cell (week/month view)
  const getItemsForDate = (employeeId: string, date: Date) => {
    const dateKey = getNZDateString(date);
    const assigned = assignmentsByEmployeeDate.get(`${employeeId}__${dateKey}`) || [];

    if (assigned.length > 0) return assigned.map(x => x.job);

    // Fallback
    return allJobs.filter(job => {
      if (job.status === 'archived') return false;
      if (!job.assignedTo?.includes(employeeId)) return false;
      if (!job.scheduledDate) return false;
      return job.scheduledEndDate
        ? isBetweenNZ(date, new Date(job.scheduledDate), new Date(job.scheduledEndDate))
        : isSameDayNZ(job.scheduledDate, date);
    });
  };

  // ── Date range label ───────────────────────────────────────────────────────
  const dateRangeDisplay = useMemo(() => {
    if (viewMode === 'day') return format(currentDate, 'EEE d MMMM yyyy');
    if (viewMode === 'week' || viewMode === '2weeks') {
      return `${format(dateRange[0], 'd MMM')} – ${format(dateRange[dateRange.length - 1], 'd MMM yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  }, [currentDate, viewMode, dateRange]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col">
      {/* Navigation Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0 flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
          Today
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevious} data-testid="button-previous">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-base font-semibold min-w-[200px] text-center">{dateRangeDisplay}</div>
          <Button variant="ghost" size="icon" onClick={goToNext} data-testid="button-next">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {(['day', 'week', '2weeks'] as ViewMode[]).map(v => (
            <Button
              key={v}
              variant={viewMode === v ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(v)}
              data-testid={`button-view-${v}`}
            >
              {v === '2weeks' ? '2 weeks' : v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col min-w-max h-full">
          {/* Header row */}
          <div className="sticky top-0 z-10 flex bg-white border-b">
            <div className="w-28 flex-shrink-0 border-r bg-gray-50 font-semibold p-2 text-sm sticky left-0 z-20">
              Staff
            </div>
            {viewMode === 'day'
              ? timeSlots.map(slot => (
                  <div key={slot.hour} className="w-[110px] flex-shrink-0 border-r p-1 text-xs text-center font-medium text-gray-600 whitespace-nowrap" data-testid={`time-slot-${slot.hour}`}>
                    {slot.label}
                  </div>
                ))
              : dateRange.map(date => (
                  <div key={date.toISOString()} className="w-36 flex-shrink-0 border-r p-2 text-xs text-center font-medium" data-testid={`date-header-${format(date, 'yyyy-MM-dd')}`}>
                    <div>{format(date, 'EEE')}</div>
                    <div className="font-semibold">{format(date, 'd MMM')}</div>
                  </div>
                ))
            }
          </div>

          {/* Staff rows */}
          <div className="flex-1 flex flex-col">
            {employees.map(employee => (
              <div key={employee.id} className="flex min-h-[80px] border-b hover:bg-gray-50/50" data-testid={`staff-row-${employee.id}`}>
                {/* Name column */}
                <div className="w-28 flex-shrink-0 border-r p-2 flex items-center gap-2 sticky left-0 bg-white z-10">
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {employee.firstName[0]}{employee.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{employee.firstName}</span>
                </div>

                {viewMode === 'day'
                  ? timeSlots.map(slot => {
                      const items = getItemsForHour(employee.id, currentDate, slot.hour);
                      return (
                        <div key={slot.hour} className="w-[110px] flex-shrink-0 border-r p-1 min-h-[80px]" data-testid={`slot-${employee.id}-${slot.hour}`}>
                          {items.map(job => (
                            <div
                              key={job.id}
                              className={`text-xs p-1.5 rounded border cursor-pointer mb-1 ${getStatusColor(job.status)}`}
                              onClick={() => { setSelectedJobId(job.id); setShowJobCard(true); }}
                              data-testid={`job-block-${job.id}`}
                            >
                              <div className="font-semibold line-clamp-2 leading-tight">{getCustomerName(job)}</div>
                              <div className="opacity-70 truncate mt-0.5">{job.address?.split(',')[0]}</div>
                              <div className="opacity-80 mt-0.5 font-mono">#{job.jobNumber}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  : dateRange.map(date => {
                      const items = getItemsForDate(employee.id, date);
                      return (
                        <div key={date.toISOString()} className="w-36 flex-shrink-0 border-r p-1 min-h-[80px]" data-testid={`slot-${employee.id}-${format(date, 'yyyy-MM-dd')}`}>
                          {items.map(job => (
                            <div
                              key={job.id}
                              className={`text-xs p-1.5 rounded border cursor-pointer mb-1 ${getStatusColor(job.status)}`}
                              onClick={() => { setSelectedJobId(job.id); setShowJobCard(true); }}
                              data-testid={`job-block-${job.id}`}
                            >
                              <div className="font-semibold line-clamp-2 leading-tight">{getCustomerName(job)}</div>
                              <div className="opacity-70 truncate mt-0.5">{job.address?.split(',')[0]}</div>
                              <div className="opacity-80 mt-0.5 font-mono">#{job.jobNumber}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Job card modal */}
      {selectedJobId && showJobCard && (
        <GlobalJobCard
          isOpen={showJobCard}
          mode="edit"
          jobId={selectedJobId}
          onClose={() => { setShowJobCard(false); setSelectedJobId(null); }}
        />
      )}
    </div>
  );
}

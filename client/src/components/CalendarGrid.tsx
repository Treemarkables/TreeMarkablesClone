import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, addDays, subDays, startOfDay, addWeeks, subWeeks, addMonths, subMonths, isSameDay, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { GlobalJobCard } from '@/components/GlobalJobCard';

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
  customerName: string;
  address: string;
  scheduledDate: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  status: string;
  assignedTo: string[];
  serviceType?: string;
}

type ViewMode = 'day' | 'week' | '2weeks' | 'month';

export function CalendarGrid() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);

  // Fetch employees
  const { data: employeesData } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees/active'],
  });

  // Fetch jobs
  const { data: jobsData } = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ['/api/jobs'],
  });

  const employees = employeesData?.data || [];
  const allJobs = jobsData?.data || [];

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else if (viewMode === '2weeks') setCurrentDate(subWeeks(currentDate, 2));
    else if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNext = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else if (viewMode === '2weeks') setCurrentDate(addWeeks(currentDate, 2));
    else if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'day') {
      return [startOfDay(currentDate)];
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return eachDayOfInterval({ start, end });
    } else if (viewMode === '2weeks') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(addWeeks(currentDate, 1));
      return eachDayOfInterval({ start, end });
    } else if (viewMode === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
    return [currentDate];
  }, [currentDate, viewMode]);

  // Time slots (7am to 6pm)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 7; hour <= 18; hour++) {
      slots.push({
        hour,
        label: format(new Date().setHours(hour, 0), 'h:00 a'),
      });
    }
    return slots;
  }, []);

  // Get jobs for a specific employee and time slot
  const getJobsForSlot = (employeeId: string, date: Date, hour: number) => {
    return allJobs.filter(job => {
      // Check if job is assigned to this employee
      if (!job.assignedTo?.includes(employeeId)) return false;

      // Check if job is scheduled for this date
      if (!job.scheduledDate) return false;
      const jobDate = parseISO(job.scheduledDate);
      if (!isSameDay(jobDate, date)) return false;

      // Check if job overlaps with this hour
      if (job.scheduledStartTime) {
        const [startHour, startMinute = 0] = job.scheduledStartTime.split(':').map(Number);
        
        // If no end time, assume 1-hour duration
        let endHour = startHour + 1;
        let endMinute = startMinute;
        
        if (job.scheduledEndTime) {
          const [h, m = 0] = job.scheduledEndTime.split(':').map(Number);
          endHour = h;
          endMinute = m;
        }
        
        // Create time boundaries for the slot (e.g., 10:00 - 11:00)
        const slotStart = hour;
        const slotEnd = hour + 1;
        
        // Convert job times to decimal hours for comparison
        const jobStartDecimal = startHour + (startMinute / 60);
        const jobEndDecimal = endHour + (endMinute / 60);
        
        // Check if job overlaps with this hour slot
        // Job overlaps if: job starts before slot ends AND job ends after slot starts
        return jobStartDecimal < slotEnd && jobEndDecimal > slotStart;
      }

      return false;
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'scheduled':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'in_progress':
      case 'in progress':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'cancelled':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  // Format date range display
  const dateRangeDisplay = useMemo(() => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEE d MMMM yyyy');
    } else if (viewMode === 'week' || viewMode === '2weeks') {
      const start = dateRange[0];
      const end = dateRange[dateRange.length - 1];
      return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`;
    } else if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy');
    }
    return '';
  }, [currentDate, viewMode, dateRange]);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setShowJobCard(true);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Navigation Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          data-testid="button-today"
        >
          Today
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            data-testid="button-previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="text-lg font-semibold min-w-[250px] text-center">
            {dateRangeDisplay}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            data-testid="button-next"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            data-testid="button-view-day"
          >
            Day
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            data-testid="button-view-week"
          >
            Week
          </Button>
          <Button
            variant={viewMode === '2weeks' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('2weeks')}
            data-testid="button-view-2weeks"
          >
            2 weeks
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('month')}
            data-testid="button-view-month"
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="w-full h-full flex flex-col">
          {/* Time Header Row */}
          <div className="sticky top-0 z-10 flex bg-white border-b">
            <div className="w-32 flex-shrink-0 border-r bg-gray-50 font-semibold p-2">
              Staff
            </div>
            {viewMode === 'day' ? (
              timeSlots.map(slot => (
                <div
                  key={slot.hour}
                  className="flex-1 min-w-[40px] border-r p-1 text-[10px] text-center font-medium text-gray-600 whitespace-nowrap overflow-hidden"
                  data-testid={`time-slot-${slot.hour}`}
                >
                  {slot.label}
                </div>
              ))
            ) : (
              dateRange.map(date => (
                <div
                  key={date.toISOString()}
                  className="w-32 flex-shrink-0 border-r p-2 text-xs text-center font-medium"
                  data-testid={`date-header-${format(date, 'yyyy-MM-dd')}`}
                >
                  <div>{format(date, 'EEE')}</div>
                  <div className="font-semibold">{format(date, 'd MMM')}</div>
                </div>
              ))
            )}
          </div>

          {/* Staff Rows */}
          <div className="flex-1 overflow-hidden">
          {employees.map(employee => (
            <div
              key={employee.id}
              className="flex border-b hover:bg-gray-50"
              data-testid={`staff-row-${employee.id}`}
            >
              {/* Staff Name Column */}
              <div className="w-32 flex-shrink-0 border-r p-2 flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {employee.firstName[0]}{employee.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">
                  {employee.firstName}
                </span>
              </div>

              {/* Time/Date Slots */}
              {viewMode === 'day' ? (
                timeSlots.map(slot => {
                  const jobs = getJobsForSlot(employee.id, currentDate, slot.hour);
                  return (
                    <div
                      key={slot.hour}
                      className="flex-1 min-w-[40px] border-r p-1 min-h-[60px] relative overflow-hidden"
                      data-testid={`slot-${employee.id}-${slot.hour}`}
                    >
                      {jobs.map(job => (
                        <div
                          key={job.id}
                          className={`text-xs p-1 rounded border cursor-pointer mb-1 ${getStatusColor(job.status)}`}
                          onClick={() => handleJobClick(job)}
                          data-testid={`job-block-${job.id}`}
                        >
                          <div className="font-semibold truncate">
                            {job.jobNumber}
                          </div>
                          <div className="truncate">{job.customerName}</div>
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                dateRange.map(date => {
                  // Get all jobs for this employee on this date
                  const dayJobs = allJobs.filter(job => 
                    job.assignedTo?.includes(employee.id) &&
                    job.scheduledDate &&
                    isSameDay(parseISO(job.scheduledDate), date)
                  );
                  
                  return (
                    <div
                      key={date.toISOString()}
                      className="w-32 flex-shrink-0 border-r p-1 min-h-[60px]"
                      data-testid={`slot-${employee.id}-${format(date, 'yyyy-MM-dd')}`}
                    >
                      {dayJobs.map(job => (
                        <div
                          key={job.id}
                          className={`text-xs p-1 rounded border cursor-pointer mb-1 ${getStatusColor(job.status)}`}
                          onClick={() => handleJobClick(job)}
                          data-testid={`job-block-${job.id}`}
                        >
                          <div className="font-semibold truncate">
                            {job.jobNumber}
                          </div>
                          <div className="truncate text-[10px]">
                            {job.scheduledStartTime || 'All day'}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJob && showJobCard && (
        <GlobalJobCard
          isOpen={showJobCard}
          mode="edit"
          jobId={selectedJob.id}
          onClose={() => {
            setShowJobCard(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}

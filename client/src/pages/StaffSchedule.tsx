import { useQuery, useMutation } from '@tanstack/react-query';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, MapPin, ChevronRight as ChevronRightSmall } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { Job, Employee, Customer } from '@shared/schema';
import { GlobalJobCard } from '@/components/GlobalJobCard';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function StaffSchedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    const nzNow = toZonedTime(now, 'Pacific/Auckland');
    nzNow.setHours(0, 0, 0, 0);
    return nzNow;
  });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);
  const { toast } = useToast();

  const { data: jobsData } = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ['/api/jobs?limit=10000'],
    refetchInterval: 5000,
  });

  const { data: employeesData } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees'],
  });

  const { data: customersData } = useQuery<{ success: boolean; data: Customer[] }>({
    queryKey: ['/api/customers'],
  });

  const { data: staffAssignmentsData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/staff-assignments'],
    refetchInterval: 5000,
  });

  const jobs = jobsData?.data || [];
  const employees = employeesData?.data || [];
  const customers = customersData?.data || [];
  const staffAssignments = staffAssignmentsData?.data || [];

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach(customer => {
      map.set(customer.id, customer.name);
    });
    return map;
  }, [customers]);

  const getCustomerName = (job: Job) => {
    if (job.customerId) {
      return customerMap.get(job.customerId) || 'Unknown Customer';
    }
    return 'No Customer';
  };

  // Number of calendar days a job spans (minimum 1) — used to split revenue per day
  const jobDayCount = (job: any): number => {
    if (!job.scheduledDate || !job.scheduledEndDate) return 1;
    const startNZ = formatInTimeZone(new Date(job.scheduledDate), 'Pacific/Auckland', 'yyyy-MM-dd');
    const endNZ = formatInTimeZone(new Date(job.scheduledEndDate), 'Pacific/Auckland', 'yyyy-MM-dd');
    if (endNZ <= startNZ) return 1;
    const startMs = new Date(startNZ + 'T12:00:00Z').getTime();
    const endMs = new Date(endNZ + 'T12:00:00Z').getTime();
    return Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
  };

  // Revenue attributed to one day of the job (exc-GST, split evenly across all scheduled days)
  const calculateJobTotal = (job: any): number => {
    let raw = 0;
    if (job.subtotal && Number(job.subtotal) > 0) raw = Number(job.subtotal);
    else if (job.totalAmount && Number(job.totalAmount) > 0) raw = Number(job.totalAmount);
    else if (job.totalIncludingGst && Number(job.totalIncludingGst) > 0) raw = Number(job.totalIncludingGst) / 1.15;
    else {
      const lineItems = job.lineItems;
      if (lineItems && Array.isArray(lineItems)) {
        raw = lineItems.reduce((sum: number, item: any) => {
          return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        }, 0);
      }
    }
    return raw / jobDayCount(job);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach(job => {
      map.set(job.id, job);
    });
    return map;
  }, [jobs]);

  const getEmployeeJobs = (employeeId: string) => {
    const selectedDateNZ = formatInTimeZone(selectedDate, 'Pacific/Auckland', 'yyyy-MM-dd');
    const allEmployeeAssignments = staffAssignments.filter((a: any) => a.employeeId === employeeId);

    const directMatches = allEmployeeAssignments.filter((assignment: any) => {
      const startTimeStr = assignment.startTime;
      if (!startTimeStr) return false;
      const assignmentDateNZ = formatInTimeZone(new Date(startTimeStr), 'Pacific/Auckland', 'yyyy-MM-dd');
      return assignmentDateNZ === selectedDateNZ;
    });

    const includedJobIds = new Set(directMatches.map((a: any) => a.jobId));
    const fallbackMatches: any[] = [];
    const employeeJobIds = new Set(allEmployeeAssignments.map((a: any) => a.jobId));

    for (const jobId of employeeJobIds) {
      if (includedJobIds.has(jobId)) continue;
      const job = jobMap.get(jobId as string);
      if (!job?.scheduledDate || !(job as any).scheduledEndDate) continue;

      const jobStartNZ = formatInTimeZone(new Date((job as any).scheduledDate), 'Pacific/Auckland', 'yyyy-MM-dd');
      const jobEndNZ = formatInTimeZone(new Date((job as any).scheduledEndDate), 'Pacific/Auckland', 'yyyy-MM-dd');

      if (selectedDateNZ >= jobStartNZ && selectedDateNZ <= jobEndNZ) {
        const templateAssignment = allEmployeeAssignments.find((a: any) => a.jobId === jobId);
        if (templateAssignment) {
          fallbackMatches.push(templateAssignment);
          includedJobIds.add(jobId as string);
        }
      }
    }

    const matchedAssignments = [...directMatches, ...fallbackMatches];

    return matchedAssignments
      .map((assignment: any) => {
        const job = jobMap.get(assignment.jobId);
        if (!job) return null;
        // Hide archived or unsuccessful jobs from the schedule
        if (job.status === 'archived' || job.status === 'unsuccessful') return null;
        return { ...job, _assignmentStartTime: assignment.startTime };
      })
      .filter((job): job is Job & { _assignmentStartTime: string } => job !== null)
      .sort((a, b) => new Date(a._assignmentStartTime).getTime() - new Date(b._assignmentStartTime).getTime());
  };

  const formatTime12Hour = (time24?: string) => {
    if (!time24) return 'All day';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const staffAccentColors = [
    'bg-blue',
    'bg-green',
    'bg-purple',
    'bg-orange',
    'bg-pink',
    'bg-teal',
    'bg-yellow',
    'bg-destructive',
    'bg-primary',
    'bg-blue',
    'bg-green',
    'bg-purple',
    'bg-orange',
    'bg-pink',
    'bg-teal',
    'bg-yellow',
  ];

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      const isAdmin = fullName.includes('admin');
      const isActive = employee.isActive !== false;
      return !isAdmin && isActive;
    });
  }, [employees]);

  const getStaffAccentColor = (employeeId: string) => {
    const index = filteredEmployees.findIndex(emp => emp.id === employeeId);
    return staffAccentColors[index % staffAccentColors.length];
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setShowJobCard(true);
  };

  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ jobId, employeeId }: { jobId: string; employeeId: string }) => {
      const assignments = staffAssignments.filter(
        a => a.jobId === jobId && a.employeeId === employeeId
      );
      for (const assignment of assignments) {
        await apiRequest('DELETE', `/api/staff-assignments/${assignment.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove job from schedule",
        variant: "destructive"
      });
    }
  });

  const handleRemoveJob = (e: React.MouseEvent, job: Job & { _assignmentStartTime?: string }, employeeId: string) => {
    e.stopPropagation();
    if (confirm('Remove this job from the schedule?')) {
      removeAssignmentMutation.mutate({ jobId: job.id, employeeId });
    }
  };

  const previousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const nextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const allEmployeeJobData = useMemo(() => {
    return filteredEmployees.map(employee => {
      const employeeJobs = getEmployeeJobs(employee.id);
      const totalBooked = employeeJobs.reduce((sum, job) => sum + calculateJobTotal(job), 0);
      return { employee, jobs: employeeJobs, totalBooked };
    });
  }, [filteredEmployees, staffAssignments, jobs, selectedDate, jobMap, customerMap]);

  const uniqueJobIds = new Set<string>();
  const uniqueJobTotals = new Map<string, number>();
  allEmployeeJobData.forEach(({ jobs: empJobs }) => {
    empJobs.forEach(job => {
      if (!uniqueJobIds.has(job.id)) {
        uniqueJobIds.add(job.id);
        uniqueJobTotals.set(job.id, calculateJobTotal(job));
      }
    });
  });
  const totalJobs = uniqueJobIds.size;
  const totalRevenue = Array.from(uniqueJobTotals.values()).reduce((sum, v) => sum + v, 0);

  return (
    <div className="h-full flex flex-col p-3 md:p-4 overflow-auto">
      {/* Date Heading + Nav inline */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h2 className="text-lg md:text-xl font-bold" data-testid="text-current-date">
          {formatInTimeZone(selectedDate, 'Pacific/Auckland', 'EEEE, MMMM d, yyyy')}
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={previousDay}
            data-testid="button-prev-day"
            className="gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="button-jobs-view"
            className="gap-1"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Jobs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(new Date())}
            data-testid="button-today"
            className="gap-1"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={nextDay}
            data-testid="button-next-day"
            className="gap-1"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground">
          JOBS <span className="text-foreground">{totalJobs}</span>
        </span>
        <span className="text-xs font-semibold text-muted-foreground">
          REVENUE <span className="text-foreground">{formatCurrency(totalRevenue)}</span>
        </span>
      </div>

      {/* Staff Schedule List */}
      <div className="space-y-2">
        {allEmployeeJobData.map(({ employee, jobs: employeeJobs, totalBooked }) => {
          const accentColor = getStaffAccentColor(employee.id);

          return (
            <div
              key={employee.id}
              data-testid={`staff-card-${employee.id}`}
              className="bg-card border rounded-md overflow-visible"
            >
              {/* Staff Header */}
              <div className="flex items-center gap-2 px-3 py-2">
                <Avatar className={`h-8 w-8 flex-shrink-0 ${accentColor}`}>
                  <AvatarFallback className="text-xs font-semibold text-primary-foreground">
                    {employee.firstName[0]}{employee.lastName[0]}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm leading-tight">
                    {employee.firstName} {employee.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {employeeJobs.length} {employeeJobs.length === 1 ? 'Job' : 'Jobs'}
                    {totalBooked > 0 && ` · ${formatCurrency(totalBooked)} booked`}
                  </span>
                </div>
              </div>

              {/* Job Cards Grid */}
              <div className="px-3 pb-2">
                {employeeJobs.length === 0 ? (
                  <div
                    className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"
                    data-testid={`no-jobs-${employee.id}`}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 opacity-50" />
                    <span>No jobs scheduled</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {employeeJobs.map(job => {
                      const jobTotal = calculateJobTotal(job);
                      const timeDisplay = job._assignmentStartTime
                        ? formatInTimeZone(new Date(job._assignmentStartTime), 'Pacific/Auckland', 'h:mm a')
                        : (job.scheduledStartTime ? formatTime12Hour(job.scheduledStartTime) : '');

                      return (
                        <div
                          key={job.id}
                          className="group relative rounded-md bg-green/8 dark:bg-green/10 border border-green/20 dark:border-green/15 px-3 py-2 cursor-pointer hover-elevate"
                          onClick={() => handleJobClick(job)}
                          data-testid={`job-item-${job.id}`}
                        >
                          {/* Remove button — top right, hidden until hover */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-1 right-1 invisible group-hover:visible md:invisible md:group-hover:visible text-muted-foreground flex-shrink-0"
                            onClick={(e) => handleRemoveJob(e, job, employee.id)}
                            disabled={removeAssignmentMutation.isPending}
                            data-testid={`button-remove-job-${job.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>

                          {/* Time + Customer + Price row */}
                          <div className="flex items-center justify-between gap-1.5 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="h-2 w-2 rounded-full bg-green flex-shrink-0" />
                              <span className="text-sm font-bold text-green tabular-nums">
                                {timeDisplay}
                              </span>
                              <span className="font-bold text-sm truncate">
                                {getCustomerName(job)}
                              </span>
                            </div>
                            {jobTotal > 0 && (
                              <span className="text-xs font-bold whitespace-nowrap flex-shrink-0">
                                {formatCurrency(jobTotal)} <span className="font-normal text-muted-foreground">ex</span>
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          {job.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2 mb-0.5 pl-[14px]">
                              {job.description}
                            </div>
                          )}

                          {/* Address row */}
                          <div className="flex items-center justify-between gap-1.5">
                            {job.address && (
                              <div className="flex items-center gap-1 text-sm min-w-0">
                                <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-blue" />
                                <span className="truncate font-medium">{job.address}</span>
                              </div>
                            )}
                            <ChevronRightSmall className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 ml-auto" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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

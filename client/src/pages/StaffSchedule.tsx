import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { Job, Employee, Customer } from '@shared/schema';
import { GlobalJobCard } from '@/components/GlobalJobCard';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function StaffSchedule() {
  // Initialize with current date in NZ timezone to avoid UTC offset issues
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    // Convert current UTC time to NZ timezone
    const nzNow = toZonedTime(now, 'Pacific/Auckland');
    // Create a Date object representing midnight of today in NZ
    nzNow.setHours(0, 0, 0, 0);
    return nzNow;
  });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);
  const { toast } = useToast();

  const { data: jobsData } = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ['/api/jobs?limit=10000'], // Load all jobs
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: employeesData } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees'],
  });

  const { data: customersData } = useQuery<{ success: boolean; data: Customer[] }>({
    queryKey: ['/api/customers'],
  });

  const { data: staffAssignmentsData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/staff-assignments'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds to show newly scheduled staff
  });

  const jobs = jobsData?.data || [];
  const employees = employeesData?.data || [];
  const customers = customersData?.data || [];
  const staffAssignments = staffAssignmentsData?.data || [];

  // Create a map of customer IDs to customer names for quick lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach(customer => {
      map.set(customer.id, customer.name);
    });
    return map;
  }, [customers]);

  // Helper function to get customer name for a job
  const getCustomerName = (job: Job) => {
    if (job.customerId) {
      return customerMap.get(job.customerId) || 'Unknown Customer';
    }
    return 'No Customer';
  };

  // Calculate job total from job data — always returns ex-GST price
  const calculateJobTotal = (job: any): number => {
    // subtotal is always ex-GST
    if (job.subtotal && Number(job.subtotal) > 0) {
      return Number(job.subtotal);
    }
    // totalAmount matches subtotal (ex-GST) for most jobs
    if (job.totalAmount && Number(job.totalAmount) > 0) {
      return Number(job.totalAmount);
    }
    // totalIncludingGst is GST-inclusive — divide by 1.15 to get ex-GST
    if (job.totalIncludingGst && Number(job.totalIncludingGst) > 0) {
      return Number(job.totalIncludingGst) / 1.15;
    }
    // Fallback to calculating from line items (ex-GST)
    const lineItems = job.lineItems;
    if (!lineItems || !Array.isArray(lineItems)) return 0;
    return lineItems.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
  };

  // Format currency in NZD
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Create a map of job IDs to jobs for quick lookup
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach(job => {
      map.set(job.id, job);
    });
    return map;
  }, [jobs]);

  // Get jobs for each employee based on staff assignments
  // Uses two strategies:
  //   1. Direct match: assignment.startTime NZ date === selected date  (primary)
  //   2. Date-range fallback: job has scheduledDate..scheduledEndDate covering selected date
  //      and employee has at least one assignment for that job  (safety net for missing per-day assignments)
  const getEmployeeJobs = (employeeId: string) => {
    const selectedDateNZ = formatInTimeZone(selectedDate, 'Pacific/Auckland', 'yyyy-MM-dd');

    // All assignments for this employee
    const allEmployeeAssignments = staffAssignments.filter((a: any) => a.employeeId === employeeId);

    // --- Strategy 1: direct date match ---
    const directMatches = allEmployeeAssignments.filter((assignment: any) => {
      const startTimeStr = assignment.startTime;
      if (!startTimeStr) return false;
      const assignmentDateNZ = formatInTimeZone(new Date(startTimeStr), 'Pacific/Auckland', 'yyyy-MM-dd');
      return assignmentDateNZ === selectedDateNZ;
    });

    const includedJobIds = new Set(directMatches.map((a: any) => a.jobId));

    // --- Strategy 2: multi-day range fallback ---
    // If a job spans multiple days and is missing a per-day assignment for the selected date,
    // but this employee is assigned to the job (has any assignment for it), show it anyway.
    const fallbackMatches: any[] = [];
    const employeeJobIds = new Set(allEmployeeAssignments.map((a: any) => a.jobId));

    for (const jobId of employeeJobIds) {
      if (includedJobIds.has(jobId)) continue; // Already showing from strategy 1
      const job = jobMap.get(jobId as string);
      if (!job?.scheduledDate || !(job as any).scheduledEndDate) continue;

      const jobStartNZ = formatInTimeZone(new Date((job as any).scheduledDate), 'Pacific/Auckland', 'yyyy-MM-dd');
      const jobEndNZ = formatInTimeZone(new Date((job as any).scheduledEndDate), 'Pacific/Auckland', 'yyyy-MM-dd');

      if (selectedDateNZ >= jobStartNZ && selectedDateNZ <= jobEndNZ) {
        // Use day-1 assignment as template for the time display (same start time each day)
        const templateAssignment = allEmployeeAssignments.find((a: any) => a.jobId === jobId);
        if (templateAssignment) {
          fallbackMatches.push(templateAssignment);
          includedJobIds.add(jobId as string);
        }
      }
    }

    const matchedAssignments = [...directMatches, ...fallbackMatches];

    // Map to jobs with attached assignment start time, then sort by start time
    return matchedAssignments
      .map((assignment: any) => {
        const job = jobMap.get(assignment.jobId);
        if (!job) return null;
        return { ...job, _assignmentStartTime: assignment.startTime };
      })
      .filter((job): job is Job & { _assignmentStartTime: string } => job !== null)
      .sort((a, b) => new Date(a._assignmentStartTime).getTime() - new Date(b._assignmentStartTime).getTime());
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Approved': return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'Scheduled': return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'In Progress': return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'Completed': return 'bg-green-50 border-green-200 text-green-900';
      case 'Cancelled': return 'bg-gray-100 border-gray-200 text-gray-600';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  // Convert 24-hour time to 12-hour format
  const formatTime12Hour = (time24?: string) => {
    if (!time24) return 'All day';
    
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Assign a consistent color to each staff member - expanded palette
  const staffColors = [
    { bg: 'bg-blue-50', border: 'border-blue-300', avatar: 'bg-blue-500' },
    { bg: 'bg-green-50', border: 'border-green-300', avatar: 'bg-green-500' },
    { bg: 'bg-purple-50', border: 'border-purple-300', avatar: 'bg-purple-500' },
    { bg: 'bg-orange-50', border: 'border-orange-300', avatar: 'bg-orange-500' },
    { bg: 'bg-pink-50', border: 'border-pink-300', avatar: 'bg-pink-500' },
    { bg: 'bg-indigo-50', border: 'border-indigo-300', avatar: 'bg-indigo-500' },
    { bg: 'bg-teal-50', border: 'border-teal-300', avatar: 'bg-teal-500' },
    { bg: 'bg-cyan-50', border: 'border-cyan-300', avatar: 'bg-cyan-500' },
    { bg: 'bg-red-50', border: 'border-red-300', avatar: 'bg-red-500' },
    { bg: 'bg-amber-50', border: 'border-amber-300', avatar: 'bg-amber-500' },
    { bg: 'bg-lime-50', border: 'border-lime-300', avatar: 'bg-lime-500' },
    { bg: 'bg-emerald-50', border: 'border-emerald-300', avatar: 'bg-emerald-500' },
    { bg: 'bg-sky-50', border: 'border-sky-300', avatar: 'bg-sky-500' },
    { bg: 'bg-violet-50', border: 'border-violet-300', avatar: 'bg-violet-500' },
    { bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', avatar: 'bg-fuchsia-500' },
    { bg: 'bg-rose-50', border: 'border-rose-300', avatar: 'bg-rose-500' },
  ];

  // Filter employees and create a stable mapping
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      // Filter out admin users and inactive employees
      const isAdmin = fullName.includes('admin');
      const isActive = employee.isActive !== false;
      return !isAdmin && isActive;
    });
  }, [employees]);

  const getStaffColor = (employeeId: string) => {
    const index = filteredEmployees.findIndex(emp => emp.id === employeeId);
    return staffColors[index % staffColors.length];
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setShowJobCard(true);
  };

  // Mutation to remove a staff assignment
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ jobId, employeeId }: { jobId: string; employeeId: string }) => {
      // Find the assignment ID for this job and employee
      const assignments = staffAssignments.filter(
        a => a.jobId === jobId && a.employeeId === employeeId
      );
      
      // Delete all assignments for this employee on this job
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
    e.stopPropagation(); // Prevent job card from opening
    
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

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-4" data-testid="page-title">Staff Schedule</h1>
        
        {/* Date Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={previousDay}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-md border">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium" data-testid="text-current-date">
              {formatInTimeZone(selectedDate, 'Pacific/Auckland', 'EEEE, MMMM d, yyyy')}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={nextDay}
            data-testid="button-next-day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(new Date())}
            data-testid="button-today"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Staff Schedule List */}
      <div className="space-y-4">
        {filteredEmployees.map(employee => {
          const employeeJobs = getEmployeeJobs(employee.id);
          const color = getStaffColor(employee.id);
          
          return (
            <Card key={employee.id} data-testid={`staff-card-${employee.id}`} className={`border-l-4 ${color.border} ${color.bg}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className={`h-10 w-10 ${color.avatar}`}>
                    <AvatarFallback className="text-sm text-white">
                      {employee.firstName[0]}{employee.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      {employee.firstName} {employee.lastName}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {employeeJobs.length} {employeeJobs.length === 1 ? 'job' : 'jobs'} scheduled
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {employeeJobs.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center" data-testid={`no-jobs-${employee.id}`}>
                    No jobs scheduled for this day
                  </div>
                ) : (
                  <div className="space-y-2">
                    {employeeJobs.map(job => (
                      <div
                        key={job.id}
                        className={`p-3 rounded-md border cursor-pointer hover-elevate ${getStatusColor(job.status)}`}
                        onClick={() => handleJobClick(job)}
                        data-testid={`job-item-${job.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-semibold text-sm mb-1">
                              {getCustomerName(job)}
                            </div>
                            <div className="flex items-center gap-2 text-xs opacity-90">
                              <span>Job #{job.jobNumber}</span>
                              {calculateJobTotal(job) > 0 && (
                                <span className="font-bold">{formatCurrency(calculateJobTotal(job))}</span>
                              )}
                            </div>
                            {job.description && (
                              <div className="text-xs opacity-80 mt-1 whitespace-pre-line line-clamp-3">
                                {job.description}
                              </div>
                            )}
                            {job.address && (
                              <div className="text-xs opacity-75 mt-1">
                                {job.address}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {job._assignmentStartTime 
                                  ? formatInTimeZone(new Date(job._assignmentStartTime), 'Pacific/Auckland', 'h:mm a')
                                  : formatTime12Hour(job.scheduledStartTime)}
                              </div>
                              {job.status && (
                                <div className="text-xs mt-1">
                                  {job.status}
                                </div>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0"
                              onClick={(e) => handleRemoveJob(e, job, employee.id)}
                              disabled={removeAssignmentMutation.isPending}
                              data-testid={`button-remove-job-${job.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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

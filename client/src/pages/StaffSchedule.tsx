import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import type { Job, Employee } from '@shared/schema';
import { GlobalJobCard } from '@/components/GlobalJobCard';

export default function StaffSchedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobCard, setShowJobCard] = useState(false);

  const { data: jobsData } = useQuery<{ success: boolean; data: Job[] }>({
    queryKey: ['/api/jobs'],
  });

  const { data: employeesData } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees'],
  });

  const jobs = jobsData?.data || [];
  const employees = employeesData?.data || [];

  // Filter jobs for selected date
  const dateJobs = jobs.filter(job => {
    if (!job.scheduledDate) return false;
    const jobDate = parseISO(job.scheduledDate);
    return jobDate >= startOfDay(selectedDate) && jobDate <= endOfDay(selectedDate);
  });

  // Get jobs for each employee
  const getEmployeeJobs = (employeeId: string) => {
    return dateJobs
      .filter(job => job.assignedTo?.includes(employeeId))
      .sort((a, b) => {
        // Sort by scheduled start time
        if (!a.scheduledStartTime && !b.scheduledStartTime) return 0;
        if (!a.scheduledStartTime) return 1;
        if (!b.scheduledStartTime) return -1;
        return a.scheduledStartTime.localeCompare(b.scheduledStartTime);
      });
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

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setShowJobCard(true);
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
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
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
        {employees.map(employee => {
          const employeeJobs = getEmployeeJobs(employee.id);
          
          return (
            <Card key={employee.id} data-testid={`staff-card-${employee.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm">
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
                              {job.title || 'Untitled Job'}
                            </div>
                            <div className="text-xs opacity-90">
                              Job #{job.jobNumber}
                            </div>
                            {job.address && (
                              <div className="text-xs opacity-75 mt-1">
                                {job.address}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {job.scheduledStartTime || 'All day'}
                            </div>
                            {job.status && (
                              <div className="text-xs mt-1">
                                {job.status}
                              </div>
                            )}
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

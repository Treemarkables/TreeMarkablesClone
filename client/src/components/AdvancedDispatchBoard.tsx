import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSensors, useSensor, PointerSensor, DndContext, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalJobCard } from "./GlobalJobCard";
import type { JobStatusType, Job } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Settings,
  Edit
} from 'lucide-react';
import { format, addDays, subDays, startOfDay, addHours, isSameDay } from 'date-fns';

type AdvancedDispatchBoardProps = {
  compact?: boolean;
};

export function AdvancedDispatchBoard({ compact = false }: AdvancedDispatchBoardProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [showGlobalJobCardEdit, setShowGlobalJobCardEdit] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [draggedJob, setDraggedJob] = useState<any | null>(null);

  // Drag and drop sensors with mobile optimization
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile ? {
        distance: 12,
        delay: 100,
      } : {
        distance: 8,
      },
    })
  );

  // Fetch real employee data from API
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
  });

  // Fetch real jobs data from API
  const jobsQuery = useQuery({
    queryKey: ['/api/jobs'],
  });
  const jobsData = jobsQuery.data;

  // Fetch customers data for customer names
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
  });

  // Time slots from 7 AM to 6 PM (11 hours)
  const timeSlots = [];
  for (let i = 0; i < 11; i++) {
    const time = addHours(startOfDay(currentDate).setHours(7), i);
    timeSlots.push(time);
  }

  // Get staff members from employees data
  const staff = (employeesData as any)?.data?.map((emp: any) => ({
    id: emp.id,
    name: `${emp.firstName} ${emp.lastName}`,
    role: emp.position,
    status: emp.status === 'active' ? 'available' : 'offline',
    color: '#3B82F6'
  })) || [];

  // Filter jobs for today
  const todaysJobs = (jobsData as any)?.data?.filter((job: any) => {
    if (!job.scheduledDate) return false;
    const jobDate = new Date(job.scheduledDate);
    return isSameDay(jobDate, currentDate);
  }) || [];

  // Handle job card click to edit
  const handleJobCardClick = (job: any) => {
    setJobToEdit(job);
    setShowGlobalJobCardEdit(true);
  };

  // Handle drag and drop
  const handleDragStart = (event: any) => {
    setDraggedJob(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedJob(null);
    // Handle job time slot reassignment here
    // This would update the job's scheduled time
  };

  // Get customer name for a job
  const getCustomerName = (customerId: string) => {
    const customer = (customersData as any)?.data?.find((c: any) => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  // Render job card
  const renderJobCard = (job: any) => (
    <Card 
      key={job.id} 
      className="mb-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => handleJobCardClick(job)}
      data-testid={`job-card-${job.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-sm text-gray-900">{job.title}</h4>
            <p className="text-xs text-gray-600 mt-1">{getCustomerName(job.customerId)}</p>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">{job.address}</span>
            </div>
          </div>
          <Badge 
            variant={job.priority === 'high' ? 'destructive' : job.priority === 'medium' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {job.priority}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col" data-testid="advanced-dispatch-board">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Dispatch Board</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(subDays(currentDate, 1))}
                data-testid="button-previous-day"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentDate, 'MMM dd, yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addDays(currentDate, 1))}
                data-testid="button-next-day"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              data-testid="button-grid-view"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              data-testid="button-list-view"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Staff Roster Sidebar */}
          <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4" />
              <h3 className="font-medium">Staff Roster</h3>
            </div>
            {staff.map((member: any) => (
              <Card key={member.id} className="mb-2" data-testid={`staff-member-${member.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {member.name.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-gray-600">{member.role}</p>
                    </div>
                    <Badge 
                      variant={member.status === 'available' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {member.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-full">
              {/* Time Grid Header */}
              <div className="grid grid-cols-12 border-b bg-white sticky top-0 z-10">
                <div className="p-2 text-sm font-medium border-r">Time</div>
                {staff.slice(0, 11).map((member: any) => (
                  <div key={member.id} className="p-2 text-sm font-medium border-r text-center">
                    {member.name.split(' ')[0]}
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              {timeSlots.map((timeSlot) => (
                <div key={timeSlot.toString()} className="grid grid-cols-12 border-b min-h-[80px]">
                  {/* Time Label */}
                  <div className="p-2 border-r bg-gray-50 flex items-start">
                    <span className="text-sm font-medium">
                      {format(timeSlot, 'h:mm a')}
                    </span>
                  </div>

                  {/* Staff Time Slots */}
                  {staff.slice(0, 11).map((member: any) => (
                    <div 
                      key={`${timeSlot}-${member.id}`}
                      className="border-r p-1 min-h-[80px] hover:bg-gray-50"
                      data-testid={`time-slot-${member.id}-${format(timeSlot, 'HH:mm')}`}
                    >
                      {/* Jobs scheduled for this time slot and staff member */}
                      {todaysJobs
                        .filter((job: any) => {
                          if (!job.scheduledTime) return false;
                          const jobTime = new Date(`${format(currentDate, 'yyyy-MM-dd')} ${job.scheduledTime}`);
                          const slotHour = timeSlot.getHours();
                          return jobTime.getHours() === slotHour && job.assignedTo === member.id;
                        })
                        .map((job: any) => renderJobCard(job))
                      }
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Job Status Categories Sidebar */}
          <div className="w-80 border-l bg-white overflow-y-auto">
            {/* Lead Jobs */}
            <div className="border-b">
              <div className="p-3 bg-blue-50 border-b">
                <h3 className="font-medium text-blue-900">Lead</h3>
              </div>
              <div className="p-2 space-y-1 min-h-[120px]">
                {jobsData?.data?.filter((job: any) => job.status === 'lead').map((job: any) => renderJobCard(job))}
              </div>
            </div>

            {/* Work Order Jobs */}
            <div className="border-b">
              <div className="p-3 bg-orange-50 border-b">
                <h3 className="font-medium text-orange-900">Work Order</h3>
              </div>
              <div className="p-2 space-y-1 min-h-[120px]">
                {jobsData?.data?.filter((job: any) => job.status === 'work_order').map((job: any) => renderJobCard(job))}
              </div>
            </div>

            {/* Done Jobs */}
            <div className="border-b">
              <div className="p-3 bg-green-50 border-b">
                <h3 className="font-medium text-green-900">Done</h3>
              </div>
              <div className="p-2 space-y-1 min-h-[120px]">
                {jobsData?.data?.filter((job: any) => job.status === 'done').map((job: any) => renderJobCard(job))}
              </div>
            </div>

            {/* Completed Jobs */}
            <div className="border-b">
              <div className="p-3 bg-emerald-50 border-b">
                <h3 className="font-medium text-emerald-900">Completed</h3>
              </div>
              <div className="p-2 space-y-1 min-h-[120px]">
                {jobsData?.data?.filter((job: any) => job.status === 'completed').map((job: any) => renderJobCard(job))}
              </div>
            </div>

            {/* Unsuccessful Jobs */}
            <div className="border-b">
              <div className="p-3 bg-red-50 border-b">
                <h3 className="font-medium text-red-900">Unsuccessful</h3>
              </div>
              <div className="p-2 space-y-1 min-h-[120px]">
                {jobsData?.data?.filter((job: any) => job.status === 'unsuccessful').map((job: any) => renderJobCard(job))}
              </div>
            </div>
          </div>
        </div>

        {/* Global Job Card for editing */}
        <GlobalJobCard
          isOpen={showGlobalJobCardEdit}
          mode="edit"
          jobId={jobToEdit?.id}
          job={jobToEdit}
          onClose={() => {
            setShowGlobalJobCardEdit(false);
            setJobToEdit(null);
          }}
          onJobUpdated={(updatedJob: Job) => {
            toast({
              title: "Job Updated",
              description: `${updatedJob.title} has been updated successfully.`,
            });
            setShowGlobalJobCardEdit(false);
            setJobToEdit(null);
            // Refresh the jobs data
            jobsQuery.refetch();
          }}
        />
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedJob ? renderJobCard(draggedJob) : null}
      </DragOverlay>
    </DndContext>
  );
}
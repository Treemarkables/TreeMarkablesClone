import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  AlertTriangle,
  Target,
  GripVertical
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, addDays, subDays, startOfDay, addHours, isSameDay, parseISO, isWithinInterval, addMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';

// Import types from shared schema
import type { Job } from '@shared/schema';

// Interface for real Employee from API
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position: string;
  status: string;
  skillLevel: string;
  certifications: string[];
  skills: string[];
  hourlyRate?: number;
  availableHours?: string;
  isActive: boolean;
}

// Interface for conflicts and allocation
interface ResourceConflict {
  employeeId: string;
  employeeName: string;
  conflictingJobId: string;
  conflictingJobTitle: string;
  timeOverlap: {
    start: Date;
    end: Date;
  };
}

interface AllocationSuggestion {
  employees: Employee[];
  estimatedCost: number;
  skillMatch: number; // 0-100 percentage
  availability: number; // 0-100 percentage
  conflicts: ResourceConflict[];
}

interface AdvancedDispatchBoardProps {
  compact?: boolean;
}

// Utility functions for resource allocation and conflict detection
const detectSchedulingConflicts = (
  employeeId: string,
  newJobStart: Date,
  newJobEnd: Date,
  existingJobs: any[]
): ResourceConflict[] => {
  const conflicts: ResourceConflict[] = [];
  
  existingJobs.forEach(job => {
    if (job.assignedTeam && job.assignedTeam.includes(employeeId)) {
      const jobStart = new Date(job.scheduledDate);
      const jobEnd = addHours(jobStart, job.estimatedDuration || 4);
      
      if (isWithinInterval(newJobStart, { start: jobStart, end: jobEnd }) ||
          isWithinInterval(newJobEnd, { start: jobStart, end: jobEnd }) ||
          isWithinInterval(jobStart, { start: newJobStart, end: newJobEnd })) {
        conflicts.push({
          employeeId,
          employeeName: `Employee ${employeeId}`,
          conflictingJobId: job.id,
          conflictingJobTitle: job.title,
          timeOverlap: {
            start: jobStart > newJobStart ? jobStart : newJobStart,
            end: jobEnd < newJobEnd ? jobEnd : newJobEnd,
          },
        });
      }
    }
  });
  
  return conflicts;
};

const calculateResourceAllocation = (
  job: any,
  employees: Employee[],
  existingJobs: any[]
): AllocationSuggestion[] => {
  const suggestions: AllocationSuggestion[] = [];
  
  // Simple algorithm: suggest teams of 2-4 based on job requirements
  const teamSizes = [2, 3, 4];
  
  teamSizes.forEach(size => {
    // Find best employees for this job based on skills and availability
    const availableEmployees = employees.filter(emp => emp.isActive && emp.status === 'active');
    const selectedEmployees = availableEmployees.slice(0, size);
    
    if (selectedEmployees.length >= size) {
      const conflicts: ResourceConflict[] = [];
      let totalCost = 0;
      let skillMatch = 0;
      
      selectedEmployees.forEach(emp => {
        // Check for conflicts
        const empConflicts = detectSchedulingConflicts(
          emp.id,
          new Date(job.scheduledDate),
          addHours(new Date(job.scheduledDate), job.estimatedDuration || 4),
          existingJobs
        );
        conflicts.push(...empConflicts);
        
        // Calculate cost
        totalCost += (emp.hourlyRate || 50) * (job.estimatedDuration || 4);
        
        // Calculate skill match (simplified)
        if (emp.skills && emp.skills.length > 0) {
          skillMatch += 25; // Each skilled employee adds 25%
        }
      });
      
      suggestions.push({
        employees: selectedEmployees,
        estimatedCost: totalCost,
        skillMatch: Math.min(100, skillMatch),
        availability: conflicts.length === 0 ? 100 : Math.max(0, 100 - (conflicts.length * 20)),
        conflicts,
      });
    }
  });
  
  return suggestions.sort((a, b) => 
    (b.availability + b.skillMatch) - (a.availability + a.skillMatch)
  );
};

export function AdvancedDispatchBoard({ compact = false }: AdvancedDispatchBoardProps) {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [draggedJob, setDraggedJob] = useState<any | null>(null);
  const [allocationSuggestions, setAllocationSuggestions] = useState<AllocationSuggestion[]>([]);
  const [showAllocationPanel, setShowAllocationPanel] = useState(false);
  const [selectedJobForAllocation, setSelectedJobForAllocation] = useState<any | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch real employee data from API
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
  });

  // Fetch real jobs data from API
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
  });

  // Fetch schedule events for conflict detection
  const { data: scheduleEventsData } = useQuery({
    queryKey: ['/api/schedule-events'],
  });

  const employees: Employee[] = (employeesData as any)?.data || [];
  const jobs: any[] = (jobsData as any)?.data || [];
  const scheduleEvents: any[] = (scheduleEventsData as any)?.data || [];

  // Mutation for updating job assignments
  const updateJobAssignmentMutation = useMutation({
    mutationFn: async ({ jobId, assignedTeam, scheduledDate, status }: { 
      jobId: string; 
      assignedTeam: string[];
      scheduledDate?: string;
      status?: string;
    }) => {
      const updateData: any = { assignedTeam };
      if (scheduledDate) updateData.scheduledDate = scheduledDate;
      if (status) updateData.status = status;
      
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) throw new Error('Failed to update job assignment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Assignment Updated",
        description: "Job assignment updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job assignment",
        variant: "destructive",
      });
    },
  });

  // Utility functions
  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee ${employeeId}`;
  };

  const getEmployeeColor = (employeeId: string) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'];
    const index = parseInt(employeeId) % colors.length;
    return colors[index];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'in_progress': return 'bg-orange-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'border-l-gray-300';
      case 'medium': return 'border-l-blue-500';
      case 'high': return 'border-l-orange-500';
      case 'urgent': return 'border-l-red-500';
      default: return 'border-l-gray-300';
    }
  };

  const getAssignedStaffNames = (staffIds: string[]) => {
    if (!staffIds || staffIds.length === 0) return 'Unassigned';
    return staffIds.map(id => getEmployeeName(id)).join(', ');
  };

  // Draggable Job Card Component
  function DraggableJobCard({ job, isDragging }: { job: Job; isDragging?: boolean }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging: dragging,
    } = useDraggable({
      id: `unscheduled-${job.id}`,
      data: {
        type: 'job',
        job,
      },
    });

    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`p-2 bg-white border rounded cursor-move hover:shadow-sm transition-shadow ${getPriorityColor(job.priority)} border-l-4 ${
          dragging ? 'opacity-50' : ''
        }`}
        data-testid={`unscheduled-job-${job.id}`}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{job.title}</div>
            <div className="text-xs text-muted-foreground truncate">{job.address}</div>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              <span className="text-xs">{job.estimatedDuration || 4}h</span>
              <Badge variant="outline" className="text-xs ml-2">
                {job.priority}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Droppable Time Slot Component
  function DroppableTimeSlot({ 
    employeeId, 
    hour, 
    children, 
    className = "" 
  }: { 
    employeeId: string; 
    hour: number; 
    children: React.ReactNode; 
    className?: string;
  }) {
    const { isOver, setNodeRef } = useDroppable({
      id: `slot:${employeeId}:${hour}`,
      data: {
        type: 'timeslot',
        employeeId,
        hour,
      },
    });

    return (
      <div
        ref={setNodeRef}
        className={`w-[96px] p-1 border-r relative min-h-16 transition-colors ${
          isOver ? 'bg-blue-100' : 'hover:bg-blue-50'
        } ${className}`}
        data-testid={`time-slot-${employeeId}-${hour}`}
      >
        {children}
      </div>
    );
  }

  // Draggable Scheduled Job Component
  function DraggableScheduledJob({ job }: { job: Job }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: job.id,
      data: {
        type: 'scheduled-job',
        job,
      },
    });

    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`absolute inset-1 bg-blue-100 border border-blue-300 rounded p-1 text-xs cursor-move hover:bg-blue-200 transition-colors ${
          isDragging ? 'opacity-50 z-50' : ''
        }`}
        data-testid={`job-${job.id}`}
      >
        <div className="font-medium truncate">{job.title}</div>
        <div className="text-muted-foreground truncate">{job.address}</div>
        <Badge variant="outline" className="text-xs mt-1">
          {job.status}
        </Badge>
      </div>
    );
  }

  // Droppable Employee Component
  function DroppableEmployee({ 
    employee, 
    children 
  }: { 
    employee: Employee; 
    children: React.ReactNode;
  }) {
    const { isOver, setNodeRef } = useDroppable({
      id: employee.id,
      data: {
        type: 'employee',
        employee,
      },
    });

    return (
      <div
        ref={setNodeRef}
        className={`flex items-center gap-2 p-3 border-b transition-colors ${
          isOver ? 'bg-blue-100' : 'hover:bg-gray-100'
        } cursor-pointer`}
        data-testid={`staff-member-${employee.id}`}
      >
        {children}
      </div>
    );
  }

  // Drag and Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    
    // Handle both scheduled and unscheduled jobs
    let job;
    if (activeId.startsWith('unscheduled-')) {
      const jobId = activeId.replace('unscheduled-', '');
      job = jobs.find(j => j.id === jobId);
    } else {
      job = jobs.find(j => j.id === activeId);
    }
    
    setDraggedJob(job);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDraggedJob(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Parse the drop target
    let targetEmployeeId: string;
    let targetHour: number | null = null;
    
    if (overId.startsWith('slot:')) {
      // Dropped on a time slot: slot:employeeId:hour
      const parts = overId.split(':');
      targetEmployeeId = parts[1];
      targetHour = parseInt(parts[2]);
    } else {
      // Dropped on employee (for general assignment)
      targetEmployeeId = overId;
    }
    
    // Determine if this is an unscheduled job
    let jobId = activeId;
    let isUnscheduledJob = false;
    
    if (activeId.startsWith('unscheduled-')) {
      jobId = activeId.replace('unscheduled-', '');
      isUnscheduledJob = true;
    }
    
    // Find the job being dragged
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // If this is an unscheduled job being dragged to an employee, schedule it for today
    if (isUnscheduledJob) {
      // Schedule the job with specific time if dropped on time slot
      const scheduledDate = new Date(currentDate);
      if (targetHour !== null) {
        scheduledDate.setHours(targetHour, 0, 0, 0);
      } else {
        // Default to 9:00 AM if dropped on employee but not specific time slot
        scheduledDate.setHours(9, 0, 0, 0);
      }
      
      // Update job with schedule and assignment
      updateJobAssignmentMutation.mutate({ 
        jobId, 
        assignedTeam: [targetEmployeeId],
        scheduledDate: scheduledDate.toISOString(),
        status: 'scheduled'
      });
      
      toast({
        title: "Job Scheduled",
        description: `Job assigned to ${getEmployeeName(targetEmployeeId)} for ${format(scheduledDate, 'MMM dd, yyyy at h:mm a')}`,
      });
    } else {
      // Moving an already scheduled job to a new time/employee
      const scheduledDate = new Date(currentDate);
      if (targetHour !== null) {
        scheduledDate.setHours(targetHour, 0, 0, 0);
      } else {
        // Keep existing time if dropped on employee but not specific time slot
        const existingDate = new Date(job.scheduledDate);
        scheduledDate.setHours(existingDate.getHours(), existingDate.getMinutes(), 0, 0);
      }

      const conflicts = detectSchedulingConflicts(
        targetEmployeeId,
        scheduledDate,
        addHours(scheduledDate, job.estimatedDuration || 4),
        jobs.filter(j => j.id !== jobId)
      );

      if (conflicts.length > 0) {
        toast({
          title: "Scheduling Conflict Detected",
          description: `Employee ${getEmployeeName(targetEmployeeId)} has ${conflicts.length} conflicting assignment(s)`,
          variant: "destructive",
        });
      }

      // Update assignment and time
      updateJobAssignmentMutation.mutate({ 
        jobId, 
        assignedTeam: [targetEmployeeId],
        scheduledDate: scheduledDate.toISOString(),
        status: 'scheduled'
      });

      toast({
        title: "Job Rescheduled",
        description: `Job moved to ${getEmployeeName(targetEmployeeId)} at ${format(scheduledDate, 'h:mm a')}`,
      });
    }
    
    setDraggedJob(null);
  };

  // Resource Allocation
  const handleResourceAllocation = (job: any) => {
    setSelectedJobForAllocation(job);
    const suggestions = calculateResourceAllocation(job, employees, jobs);
    setAllocationSuggestions(suggestions);
    setShowAllocationPanel(true);
  };

  const applyAllocationSuggestion = (suggestion: AllocationSuggestion) => {
    if (!selectedJobForAllocation) return;
    
    const employeeIds = suggestion.employees.map(emp => emp.id);
    updateJobAssignmentMutation.mutate({
      jobId: selectedJobForAllocation.id,
      assignedTeam: employeeIds
    });
    setShowAllocationPanel(false);
    setSelectedJobForAllocation(null);
  };

  // Filter jobs for today
  const todaysJobs = useMemo(() => {
    return jobs.filter(job => 
      job.scheduledDate && isSameDay(new Date(job.scheduledDate), currentDate)
    );
  }, [jobs, currentDate]);

  // Filter unscheduled jobs (jobs without a scheduledDate)
  const unscheduledJobs = useMemo(() => {
    return jobs.filter(job => 
      !job.scheduledDate || job.status === 'new' || job.status === 'quote_accepted'
    ).slice(0, 10); // Limit to 10 to prevent UI overflow
  }, [jobs]);

  // Group employees by availability
  const employeesByAvailability = useMemo(() => {
    const available = employees.filter(emp => emp.isActive && emp.status === 'active');
    const busy = employees.filter(emp => emp.isActive && emp.status === 'busy');
    const offline = employees.filter(emp => !emp.isActive || emp.status === 'offline');
    
    return { available, busy, offline };
  }, [employees]);

  if (compact) {
    return (
      <Card data-testid="dispatch-board-compact">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Dispatch Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{employeesByAvailability.available.length}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{employeesByAvailability.busy.length}</div>
              <div className="text-sm text-muted-foreground">Busy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{todaysJobs.length}</div>
              <div className="text-sm text-muted-foreground">Jobs Today</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate time slots for the grid (7 AM to 6 PM)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 7; hour <= 18; hour++) {
      slots.push({
        time: `${hour}:00`,
        displayTime: format(new Date().setHours(hour, 0, 0, 0), 'h:mm a'),
        hour
      });
    }
    return slots;
  }, []);

  return (
    <div className="h-full bg-white" data-testid="advanced-dispatch-board">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h2 className="text-2xl font-bold">Dispatch Board</h2>
          <p className="text-sm text-muted-foreground">
            Drag and drop to schedule jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subDays(currentDate, 1))}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="font-medium min-w-[120px] text-center">
            {format(currentDate, 'EEE dd MMM yyyy')}
          </div>
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

      {/* Main Layout - ServiceM8 Style */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <div className="flex h-[calc(100vh-140px)]">
          {/* Staff Column (Left) */}
          <div className="w-48 border-r bg-gray-50">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-sm">Staff</h3>
            </div>
            <div className="overflow-y-auto h-full">
              {employees.map((employee) => (
                <DroppableEmployee key={employee.id} employee={employee}>
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {employee.position}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`w-2 h-2 rounded-full ${
                        employee.isActive && employee.status === 'active' 
                          ? 'bg-green-500' 
                          : employee.status === 'busy' 
                          ? 'bg-yellow-500' 
                          : 'bg-gray-400'
                      }`} />
                      <span className="text-xs text-muted-foreground">
                        {employee.isActive && employee.status === 'active' 
                          ? 'Available' 
                          : employee.status === 'busy' 
                          ? 'Busy' 
                          : 'Offline'}
                      </span>
                    </div>
                  </div>
                </DroppableEmployee>
              ))}
              
              {employees.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No staff members</p>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Grid (Center) */}
          <div className="flex-1 overflow-auto">
            {/* Time Header */}
            <div className="flex border-b bg-white sticky top-0 z-20">
              <div className="w-16"></div> {/* Empty corner */}
              {timeSlots.map((slot) => (
                <div
                  key={slot.time}
                  className="w-[96px] p-2 border-r text-center text-sm font-medium"
                >
                  {slot.displayTime}
                </div>
              ))}
            </div>

            {/* Staff Rows with Time Slots */}
            <div>
              {employees.map((employee) => (
                <div key={employee.id} className="flex border-b min-h-16">
                  {/* Staff Name (sticky) */}
                  <div className="w-16 p-2 bg-gray-50 border-r flex items-center justify-center sticky left-0 z-10">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  {/* Time Slots for this staff member */}
                  {timeSlots.map((slot) => {
                    // Find jobs for this employee at this time
                    const jobsInSlot = todaysJobs.filter(job => {
                      if (!job.assignedTeam?.includes(employee.id) || !job.scheduledDate) return false;
                      const jobDate = new Date(job.scheduledDate);
                      const jobHour = jobDate.getHours();
                      return jobHour === slot.hour;
                    });

                    return (
                      <DroppableTimeSlot
                        key={`${employee.id}-${slot.time}`}
                        employeeId={employee.id}
                        hour={slot.hour}
                      >
                        {jobsInSlot.map((job) => (
                          <DraggableScheduledJob key={job.id} job={job} />
                        ))}
                      </DroppableTimeSlot>
                    );
                  })}
                </div>
              ))}
              
              {employees.length === 0 && (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No staff to schedule</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Jobs Panel (Right) */}
          <div className="w-80 border-l bg-gray-50">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-sm">Jobs</h3>
            </div>
            
            {/* Unscheduled Jobs */}
            <div className="p-3">
              <h4 className="text-sm font-medium mb-2 text-orange-600">
                Unscheduled ({unscheduledJobs.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {unscheduledJobs.map((job) => (
                  <DraggableJobCard key={job.id} job={job} />
                ))}
                
                {unscheduledJobs.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-xs">No unscheduled jobs</p>
                  </div>
                )}
              </div>
            </div>

            {/* Today's Jobs */}
            <div className="p-3 border-t">
              <h4 className="text-sm font-medium mb-2 text-blue-600">
                Today's Jobs ({todaysJobs.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {todaysJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-2 bg-blue-50 border border-blue-200 rounded text-xs"
                    data-testid={`todays-job-${job.id}`}
                  >
                    <div className="font-medium truncate">{job.title}</div>
                    <div className="text-muted-foreground truncate">{job.address}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{job.scheduledDate ? format(new Date(job.scheduledDate), 'h:mm a') : 'No time'}</span>
                      <span className="ml-auto">
                        {getAssignedStaffNames(job.assignedTeam || [])}
                      </span>
                    </div>
                  </div>
                ))}
                
                {todaysJobs.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-xs">No jobs scheduled</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedJob && (
            <div className="p-4 bg-white border rounded-lg shadow-lg">
              <h4 className="font-medium">{draggedJob.title}</h4>
              <p className="text-sm text-muted-foreground">{draggedJob.address}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Resource Allocation Panel */}
      {showAllocationPanel && selectedJobForAllocation && (
        <Dialog open={showAllocationPanel} onOpenChange={setShowAllocationPanel}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Resource Allocation Suggestions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium">{selectedJobForAllocation.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedJobForAllocation.address}</p>
              </div>
              
              {allocationSuggestions.map((suggestion, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium">Team Option {index + 1}</h5>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        Skills: {suggestion.skillMatch}%
                      </Badge>
                      <Badge variant="outline">
                        Available: {suggestion.availability}%
                      </Badge>
                      <Badge variant="outline">
                        ${suggestion.estimatedCost.toFixed(0)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    {suggestion.employees.map((employee) => (
                      <div key={employee.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{employee.firstName} {employee.lastName}</div>
                          <div className="text-xs text-muted-foreground">{employee.position}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {suggestion.conflicts.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Conflicts Detected</span>
                      </div>
                      {suggestion.conflicts.map((conflict, conflictIndex) => (
                        <div key={conflictIndex} className="text-xs text-red-600 ml-6">
                          {conflict.employeeName} has conflict with {conflict.conflictingJobTitle}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button
                    onClick={() => applyAllocationSuggestion(suggestion)}
                    disabled={suggestion.conflicts.length > 0}
                    className="w-full"
                    data-testid={`button-apply-suggestion-${index}`}
                  >
                    Assign This Team
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
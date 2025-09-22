import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
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
  GripVertical,
  Plus
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, addDays, subDays, startOfDay, addHours, isSameDay, parseISO, isWithinInterval, addMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
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
import type { Job, JobStatusType } from '@shared/schema';
import { ServiceJobForm } from '@/components/ServiceJobForm';

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
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [showServiceJobForm, setShowServiceJobForm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [draggedJob, setDraggedJob] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<JobStatusType>('work_order');
  const [allocationSuggestions, setAllocationSuggestions] = useState<AllocationSuggestion[]>([]);
  const [showAllocationPanel, setShowAllocationPanel] = useState(false);
  const [selectedJobForAllocation, setSelectedJobForAllocation] = useState<any | null>(null);
  const [showMobileCalendar, setShowMobileCalendar] = useState(false);

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
      
      return apiRequest('PUT', `/api/jobs/${jobId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
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

  // Helper function to get status color for the new 5 statuses
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'lead': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'quote': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'work_order': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'unsuccessful': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Helper function to get status display name
  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'lead': return 'Lead';
      case 'quote': return 'Quote';
      case 'work_order': return 'Work Order';
      case 'completed': return 'Completed';
      case 'unsuccessful': return 'Unsuccessful';
      default: return status;
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

  // Job Card Component with Status Controls
  function JobCard({ job, selectedStatus }: { job: Job; selectedStatus: JobStatusType }) {
    const { toast } = useToast();
    
    // All jobs can be dragged to the schedule (they auto-convert to work order when dropped)
    const canBeDragged = selectedStatus !== 'completed' && selectedStatus !== 'unsuccessful';
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: `job-${job.id}`,
      disabled: !canBeDragged,
      data: {
        type: 'job',
        job,
      },
    });

    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    const updateJobStatus = async (newStatus: JobStatusType) => {
      try {
        await apiRequest('PUT', `/api/jobs/${job.id}`, { status: newStatus });
        
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/schedule-events'] });
        toast({ description: `Job status updated to ${getStatusDisplayName(newStatus)}` });
      } catch (error) {
        console.error('Error updating job status:', error);
        toast({ 
          variant: 'destructive',
          description: 'Failed to update job status'
        });
      }
    };

    const isCompleted = selectedStatus === 'completed';
    const isUnsuccessful = selectedStatus === 'unsuccessful';
    
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...(canBeDragged ? listeners : {})}
        {...(canBeDragged ? attributes : {})}
        className={`p-2 bg-white border rounded shadow-sm text-xs ${getPriorityColor(job.priority || 'medium')} border-l-4 ${
          canBeDragged 
            ? `cursor-move ${isDragging ? 'opacity-50 z-50' : 'hover:shadow-md'}` 
            : isCompleted || isUnsuccessful 
              ? 'opacity-60' 
              : 'hover:shadow-sm'
        }`}
        data-testid={`job-card-${job.id}`}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-xs truncate">{job.title}</h4>
            <p className="text-muted-foreground text-xs truncate">{job.address}</p>
          </div>
          {canBeDragged && (
            <GripVertical className="w-3 h-3 text-gray-400 ml-1 flex-shrink-0" />
          )}
        </div>
        
        <div className="flex items-center justify-between mb-1">
          <Badge variant="outline" className={getStatusColor(job.status || 'lead')}>
            {getStatusDisplayName(job.status || 'lead')}
          </Badge>
          {job.estimatedDuration && (
            <span className="text-muted-foreground">
              {job.estimatedDuration}h
            </span>
          )}
        </div>
        
        {/* Assigned Team Display */}
        {job.assignedTeam && job.assignedTeam.length > 0 && (
          <div className="flex items-center gap-1 mb-1 text-muted-foreground">
            <Users className="w-3 h-3" />
            <span className="text-xs truncate">
              {getAssignedStaffNames(job.assignedTeam)}
            </span>
          </div>
        )}
        
        {/* Status Control */}
        {!isCompleted && !isUnsuccessful && (
          <Select 
            value={job.status || 'lead'} 
            onValueChange={(value: JobStatusType) => updateJobStatus(value)}
          >
            <SelectTrigger className="h-5 text-xs" data-testid={`status-select-${job.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="quote">Quote</SelectItem>
              <SelectItem value="work_order">Work Order</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
            </SelectContent>
          </Select>
        )}
        
        {job.scheduledDate && (
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{format(new Date(job.scheduledDate), 'h:mm a')}</span>
          </div>
        )}
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
        className={`w-[80px] p-1 border-r relative min-h-12 transition-colors ${
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
        {job.assignedTeam && job.assignedTeam.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-muted-foreground">
            <Users className="w-3 h-3" />
            <span className="text-xs truncate">
              {getAssignedStaffNames(job.assignedTeam)}
            </span>
          </div>
        )}
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
        className={`flex items-center gap-2 p-2 border-b transition-colors ${
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
    
    // Handle job cards with consistent job-* format
    let jobId = activeId;
    if (activeId.startsWith('job-')) {
      jobId = activeId.replace('job-', '');
    }
    
    const job = jobs.find(j => j.id === jobId);
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
    
    // Get job ID - now using consistent job-${id} format
    let jobId = activeId;
    if (activeId.startsWith('job-')) {
      jobId = activeId.replace('job-', '');
    }
    
    // Find the job being dragged
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // Calculate the scheduled date
    const scheduledDate = new Date(currentDate);
    if (targetHour !== null) {
      scheduledDate.setHours(targetHour, 0, 0, 0);
    } else if (job.scheduledDate) {
      // Keep existing time if job is already scheduled but dropped on employee
      const existingDate = new Date(job.scheduledDate);
      scheduledDate.setHours(existingDate.getHours(), existingDate.getMinutes(), 0, 0);
    } else {
      // Default to 9:00 AM for new scheduling
      scheduledDate.setHours(9, 0, 0, 0);
    }

    // Check for conflicts if moving to a different employee or time
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

    // Determine new status - auto-convert to work_order if not already
    const newStatus = job.status === 'work_order' ? 'work_order' : 'work_order';
    const wasConverted = job.status !== 'work_order';

    // Update job with schedule, assignment, and status
    updateJobAssignmentMutation.mutate({ 
      jobId, 
      assignedTeam: [targetEmployeeId],
      scheduledDate: scheduledDate.toISOString(),
      status: newStatus
    });

    // Show appropriate toast message
    if (wasConverted) {
      toast({
        title: "Job Converted & Scheduled",
        description: `Job converted to Work Order and assigned to ${getEmployeeName(targetEmployeeId)} for ${format(scheduledDate, 'MMM dd, yyyy at h:mm a')}`,
      });
    } else if (!job.scheduledDate) {
      toast({
        title: "Job Scheduled",
        description: `Job assigned to ${getEmployeeName(targetEmployeeId)} for ${format(scheduledDate, 'MMM dd, yyyy at h:mm a')}`,
      });
    } else {
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

  // Filter jobs by status
  const getJobsByStatus = (status: JobStatusType) => {
    return jobs.filter(job => (job.status || 'lead') === status);
  };

  const leadJobs = useMemo(() => getJobsByStatus('lead'), [jobs]);
  const quoteJobs = useMemo(() => getJobsByStatus('quote'), [jobs]);
  const workOrderJobs = useMemo(() => getJobsByStatus('work_order'), [jobs]);
  const completedJobs = useMemo(() => getJobsByStatus('completed'), [jobs]);
  const unsuccessfulJobs = useMemo(() => getJobsByStatus('unsuccessful'), [jobs]);

  // Filter jobs for today (only work orders that are scheduled)
  const todaysJobs = useMemo(() => {
    return workOrderJobs.filter(job => {
      if (!job.scheduledDate) return false;
      return isSameDay(new Date(job.scheduledDate), currentDate);
    });
  }, [workOrderJobs, currentDate]);

  // Get current status jobs for the selected tab
  const currentStatusJobs = useMemo(() => getJobsByStatus(selectedStatus), [jobs, selectedStatus]);

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

  // Generate time slots for the grid (8 AM to 5 PM for compact view)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 17; hour++) {
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
      <div className="flex items-center justify-between px-2 py-1 border-b bg-gray-50">
        <div>
          <h2 className="text-lg font-bold">Dispatch Board</h2>
          <p className="text-xs text-muted-foreground">
            Drag and drop to schedule jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Calendar Widget */}
          {isMobile ? (
            <Popover open={showMobileCalendar} onOpenChange={setShowMobileCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="min-w-[200px] justify-center"
                  data-testid="button-mobile-calendar"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {format(currentDate, 'EEE dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <div className="space-y-2">
                  <CalendarComponent
                    mode="single"
                    selected={currentDate}
                    defaultMonth={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setCurrentDate(date);
                        setShowMobileCalendar(false);
                      }
                    }}
                    className="rounded-md border-0"
                    data-testid="mobile-calendar-widget"
                  />
                  <div className="flex p-3 pt-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentDate(new Date());
                        setShowMobileCalendar(false);
                      }}
                      className="flex-1"
                      data-testid="button-calendar-today"
                    >
                      Today
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            // Desktop Navigation
            <>
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
              
              {/* Add Job Button */}
              <Button 
                size="sm" 
                onClick={() => setShowServiceJobForm(true)}
                data-testid="add-job-btn"
                className="ml-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Job
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ServiceM8-style Job Form */}
      <ServiceJobForm 
        isOpen={showServiceJobForm}
        onClose={() => setShowServiceJobForm(false)}
        onJobCreated={(job) => {
          toast({
            title: "Job Created",
            description: `${job.title} has been added to the dispatch board.`,
          });
        }}
      />

      {/* Main Layout - ServiceM8 Style */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <div className="flex h-[calc(100vh-120px)]">
          {/* Staff Column (Left) */}
          <div className="w-44 border-r bg-gray-50">
            <div className="p-1 border-b">
              <h3 className="font-semibold text-xs">Staff</h3>
            </div>
            <div className="overflow-y-auto h-full">
              {employees.map((employee) => (
                <DroppableEmployee key={employee.id} employee={employee}>
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {employee.position}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
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
                <div className="p-4 text-center text-muted-foreground">
                  <Users className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-xs">No staff members</p>
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
                  className="w-[80px] p-1 border-r text-center text-xs font-medium"
                >
                  {slot.displayTime}
                </div>
              ))}
            </div>

            {/* Staff Rows with Time Slots */}
            <div>
              {employees.map((employee) => (
                <div key={employee.id} className="flex border-b min-h-12">
                  {/* Staff Name (sticky) */}
                  <div className="w-14 p-1 bg-gray-50 border-r flex items-center justify-center sticky left-0 z-10">
                    <Avatar className="w-5 h-5">
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
          <div className="w-72 border-l bg-gray-50">
            <div className="p-1 border-b">
              <h3 className="font-semibold text-xs">Jobs by Status</h3>
            </div>
            
            <Tabs value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as JobStatusType)} className="h-full">
              <TabsList className="grid w-full grid-cols-5 p-0.5 m-1 mb-0">
                <TabsTrigger value="lead" className="text-xs px-0.5" data-testid="tab-lead">
                  Lead ({leadJobs.length})
                </TabsTrigger>
                <TabsTrigger value="quote" className="text-xs px-0.5" data-testid="tab-quote">
                  Quote ({quoteJobs.length})
                </TabsTrigger>
                <TabsTrigger value="work_order" className="text-xs px-0.5" data-testid="tab-work-order">
                  Work ({workOrderJobs.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-xs px-0.5" data-testid="tab-completed">
                  Done ({completedJobs.length})
                </TabsTrigger>
                <TabsTrigger value="unsuccessful" className="text-xs px-0.5" data-testid="tab-unsuccessful">
                  Lost ({unsuccessfulJobs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value={selectedStatus} className="p-1 mt-0">
                <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto">
                  {currentStatusJobs.map((job) => (
                    <JobCard key={job.id} job={job} selectedStatus={selectedStatus} />
                  ))}
                  
                  {currentStatusJobs.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Target className="w-6 h-6 mx-auto mb-1" />
                      <p className="text-xs">No {getStatusDisplayName(selectedStatus).toLowerCase()} jobs</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

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
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
  Phone,
  User,
  Users,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Settings,
  Edit,
  Check,
  RotateCcw,
  MessageSquare,
  X,
  ExternalLink,
  AlertTriangle,
  Target,
  Zap,
  GripVertical,
  Move
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, addDays, subDays, startOfDay, addHours, isSameDay, parseISO, isWithinInterval, addMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';

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
    mutationFn: async ({ jobId, assignedTeam }: { jobId: string; assignedTeam: string[] }) => {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignedTeam }),
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

  // Drag and Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const job = jobs.find(j => j.id === active.id);
    setDraggedJob(job);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDraggedJob(null);
      return;
    }

    const jobId = active.id as string;
    const employeeId = over.id as string;
    
    // Find the job being dragged
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // Check for conflicts before assignment
    const conflicts = detectSchedulingConflicts(
      employeeId,
      new Date(job.scheduledDate),
      addHours(new Date(job.scheduledDate), job.estimatedDuration || 4),
      jobs
    );

    if (conflicts.length > 0) {
      toast({
        title: "Scheduling Conflict Detected",
        description: `Employee ${getEmployeeName(employeeId)} has ${conflicts.length} conflicting assignment(s)`,
        variant: "destructive",
      });
    }

    // Update assignment (add employee to existing team or create new)
    const currentTeam = job.assignedTeam || [];
    const newTeam = currentTeam.includes(employeeId) 
      ? currentTeam 
      : [...currentTeam, employeeId];

    updateJobAssignmentMutation.mutate({ jobId, assignedTeam: newTeam });
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

  return (
    <div className="space-y-6" data-testid="advanced-dispatch-board">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Advanced Dispatch Board</h2>
          <p className="text-muted-foreground">
            Drag and drop jobs to assign crew members with real-time conflict detection
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
            {format(currentDate, 'MMM dd, yyyy')}
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Employee Roster */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Crew Roster
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Available Employees */}
                <div>
                  <h4 className="font-medium text-green-600 mb-2">Available ({employeesByAvailability.available.length})</h4>
                  <div className="space-y-2">
                    {employeesByAvailability.available.map((employee) => (
                      <div
                        key={employee.id}
                        id={employee.id}
                        className="p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                        data-testid={`employee-available-${employee.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback>{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{employee.firstName} {employee.lastName}</div>
                            <div className="text-xs text-muted-foreground">{employee.position}</div>
                            {employee.skills && employee.skills.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {employee.skills.slice(0, 2).map((skill, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Busy Employees */}
                {employeesByAvailability.busy.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-600 mb-2">Busy ({employeesByAvailability.busy.length})</h4>
                    <div className="space-y-2">
                      {employeesByAvailability.busy.map((employee) => (
                        <div
                          key={employee.id}
                          className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg opacity-60"
                          data-testid={`employee-busy-${employee.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{employee.firstName} {employee.lastName}</div>
                              <div className="text-xs text-muted-foreground">{employee.position}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Jobs Schedule */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Today's Jobs ({todaysJobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todaysJobs.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No jobs scheduled</h3>
                    <p className="text-muted-foreground">Jobs for {format(currentDate, 'MMMM dd, yyyy')} will appear here</p>
                  </div>
                ) : (
                  <SortableContext items={todaysJobs.map(job => job.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {todaysJobs.map((job) => (
                        <div
                          key={job.id}
                          id={job.id}
                          className={`p-4 border rounded-lg cursor-move hover:shadow-md transition-shadow ${getPriorityColor(job.priority)} border-l-4`}
                          data-testid={`job-card-${job.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <h4 className="font-medium">{job.title}</h4>
                                <Badge variant="outline" className={getStatusColor(job.status)}>
                                  {job.status}
                                </Badge>
                                <Badge variant="secondary">
                                  {job.priority}
                                </Badge>
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.address}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(job.scheduledDate), 'h:mm a')} - {job.estimatedDuration}h
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {getAssignedStaffNames(job.assignedTeam || [])}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResourceAllocation(job)}
                                data-testid={`button-allocate-${job.id}`}
                              >
                                <Target className="w-4 h-4" />
                                Auto-Assign
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedJob(job)}
                                data-testid={`button-details-${job.id}`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                )}
              </CardContent>
            </Card>
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
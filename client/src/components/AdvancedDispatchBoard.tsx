import { useState, useCallback, useMemo } from "react";
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
  Edit,
  Plus,
  RotateCcw,
  MessageSquare,
  FileText,
  CheckSquare,
  Phone,
  Search,
  CalendarDays,
  MoreHorizontal
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, addDays, subDays, startOfDay, addHours, isSameDay, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';

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
  const [draggedJob, setDraggedJob] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch real data from APIs
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
  });

  const jobsQuery = useQuery({
    queryKey: ['/api/jobs'],
  });
  const jobsData = jobsQuery.data;

  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
  });

  // Time slots from 7 AM to 4 PM (10 hours) to match ServiceM8
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < 10; i++) {
      const time = addHours(startOfDay(currentDate).setHours(7), i);
      slots.push(time);
    }
    return slots;
  }, [currentDate]);

  // Get staff members from employees data (limit to first 5 for display)
  const staff = useMemo(() => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];
    return (employeesData as any)?.data?.slice(0, 5).map((emp: any, index: number) => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      firstName: emp.firstName,
      role: emp.position,
      status: emp.status === 'active' ? 'available' : 'offline',
      color: colors[index % colors.length] // Deterministic color based on index
    })) || [];
  }, [employeesData]);

  // Get all jobs (not just today's)
  const allJobsRaw = (jobsData as any)?.data || [];
  
  // Filter jobs based on status
  const allJobs = useMemo(() => {
    if (statusFilter === 'all') {
      return allJobsRaw;
    }
    return allJobsRaw.filter((job: any) => job.status === statusFilter);
  }, [allJobsRaw, statusFilter]);
  
  // Status options for dropdown
  const statusOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'lead', label: 'Lead' },
    { value: 'quote', label: 'Quote' },
    { value: 'work_order', label: 'Work Order' },
    { value: 'completed', label: 'Completed' },
    { value: 'unsuccessful', label: 'Unsuccessful' },
  ];


  // Handle job card click
  const handleJobCardClick = (job: any) => {
    setJobToEdit(job);
    setShowGlobalJobCardEdit(true);
  };

  // Handle drag and drop with useCallback to prevent useLayoutEffect warnings
  const handleDragStart = useCallback((event: any) => {
    setDraggedJob(event.active.data.current);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggedJob(null);
    // Handle job reassignment here if needed
  }, []);

  // Get customer name
  const getCustomerName = (customerId: string) => {
    const customer = (customersData as any)?.data?.find((c: any) => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  // Generate calendar days for mini calendar
  const generateCalendarDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const days = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  // Render mini job card for right sidebar
  const renderJobSidebarCard = (job: any, index: number) => {
    const customer = getCustomerName(job.customerId);
    const colors = ['bg-orange-100 border-orange-300', 'bg-blue-100 border-blue-300', 'bg-green-100 border-green-300'];
    const indicators = ['bg-orange-400', 'bg-blue-400', 'bg-green-400'];
    
    return (
      <Button
        key={job.id}
        variant="ghost"
        className={`border rounded-lg p-3 mb-3 hover:shadow-md transition-shadow ${colors[index % 3]} h-auto text-left justify-start w-full`}
        onClick={() => handleJobCardClick(job)}
        data-testid={`job-sidebar-card-${job.id}`}
        aria-label={`View job for ${customer}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className={`w-3 h-3 rounded-full ${indicators[index % 3]} mt-1`}></div>
          <span className="text-xs text-gray-500 font-medium">#{job.id.slice(-4)}</span>
        </div>
        <h4 className="font-semibold text-sm text-gray-900 mb-1">{customer}</h4>
        <p className="text-xs text-gray-600 mb-2">{job.address}</p>
        <p className="text-xs text-gray-700">{job.title}</p>
      </Button>
    );
  };

  // Render job block in time grid
  const renderJobBlock = (job: any, timeSlot: Date, staffMember: any) => {
    if (!job.scheduledTime) return null;
    
    const jobTime = new Date(`${format(currentDate, 'yyyy-MM-dd')} ${job.scheduledTime}`);
    const slotHour = timeSlot.getHours();
    
    if (jobTime.getHours() === slotHour && job.assignedTo === staffMember.id) {
      return (
        <div 
          key={job.id}
          className="bg-blue-500 text-white text-xs p-1 rounded mb-1 cursor-pointer hover:bg-blue-600"
          onClick={() => handleJobCardClick(job)}
          style={{ backgroundColor: staffMember.color }}
        >
          <div className="font-medium">{jobTime.getHours()}:{jobTime.getMinutes().toString().padStart(2, '0')}</div>
          <div className="truncate">{getCustomerName(job.customerId)}</div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col bg-gray-50" data-testid="advanced-dispatch-board">
        {/* Staff Members Bar */}
        <div className="bg-white border-b p-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 mr-4">Staff Members</span>
            {staff.map((member: any) => (
              <div key={member.id} className="flex flex-col items-center gap-1">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="text-sm font-medium">
                    {member.firstName.charAt(0)}{member.name.split(' ')[1]?.charAt(0) || ''}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-700 font-medium">{member.firstName}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1 ml-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <Plus className="w-4 h-4 text-gray-500" />
              </div>
              <span className="text-xs text-gray-500">2 more</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Calendar and Incoming Calls */}
          <div className="w-60 bg-white border-r overflow-y-auto">
            {/* Mini Calendar */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(subDays(currentDate, 30))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium">{format(currentDate, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 30))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-xs">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <div key={`weekday-${index}`} className="text-center font-medium text-gray-500 p-1">{day}</div>
                ))}
                {generateCalendarDays().map((day) => (
                  <div 
                    key={`day-${day}`} 
                    className={`text-center p-1 cursor-pointer hover:bg-gray-100 rounded ${
                      day === currentDate.getDate() ? 'bg-blue-500 text-white' : ''
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            {/* Date Navigation */}
            <div className="p-4 border-b">
              <div className="text-center text-green-600 font-medium text-sm mb-2">
                Tuesday, September 23, 2025 — Today <span className="text-xs bg-gray-100 px-1 rounded">10:31am</span>
              </div>
            </div>

            {/* Incoming Calls Section */}
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900">Incoming Office Call</div>
                    <div className="text-xs text-green-700">027 222 0936</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900">Incoming Office Call</div>
                    <div className="text-xs text-green-700">020 4180 5398</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Time Grid */}
          <div className="flex-1 overflow-auto bg-white">
            {/* Grid Header */}
            <div className="sticky top-0 bg-white border-b z-10">
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(${staff.length}, 1fr)` }}>
                <div className="p-2 text-sm font-medium border-r bg-gray-50"></div>
                {staff.map((member: any) => (
                  <div key={member.id} className="p-2 text-sm font-medium border-r text-center bg-gray-50">
                    {member.firstName}
                  </div>
                ))}
              </div>
            </div>

            {/* Time Slots Grid */}
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot.toString()} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${staff.length}, 1fr)`, minHeight: '60px' }}>
                {/* Time Label */}
                <div className="p-2 border-r bg-gray-50 flex items-start">
                  <span className="text-sm font-medium">
                    {format(timeSlot, 'h:mma').toLowerCase()}
                  </span>
                </div>

                {/* Staff Columns */}
                {staff.map((member: any) => (
                  <div 
                    key={`${timeSlot}-${member.id}`}
                    className="border-r p-2 hover:bg-gray-50 min-h-[60px]"
                    data-testid={`time-slot-${member.id}-${format(timeSlot, 'HH:mm')}`}
                  >
                    {/* Render job blocks for this time slot and staff member */}
                    {allJobs
                      .filter((job: any) => {
                        if (!job.scheduledDate || !job.scheduledTime) return false;
                        const jobDate = new Date(job.scheduledDate);
                        const jobTime = new Date(`${format(currentDate, 'yyyy-MM-dd')} ${job.scheduledTime}`);
                        const slotHour = timeSlot.getHours();
                        return isSameDay(jobDate, currentDate) && 
                               jobTime.getHours() === slotHour && 
                               job.assignedTo === member.id;
                      })
                      .map((job: any) => renderJobBlock(job, timeSlot, member))
                    }
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Right Sidebar - Jobs List */}
          <div className="w-72 bg-white border-l overflow-y-auto">
            {/* Search Bar */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Job Search..." 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                  aria-label="Search jobs"
                  data-testid="input-job-search"
                />
              </div>
            </div>

            {/* Jobs Header */}
            <div className="p-3 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Jobs</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Jobs List */}
            <div className="p-3 space-y-3">
              {allJobs.slice(0, 6).map((job: any, index: number) => renderJobSidebarCard(job, index))}
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
            jobsQuery.refetch();
          }}
        />
      </div>
    </DndContext>
  );
}
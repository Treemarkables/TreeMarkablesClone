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
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers'],
  });

  // Time slots for full 24-hour day
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
      const time = addHours(startOfDay(currentDate), i);
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
  
  // Filter jobs based on status and search query
  const allJobs = useMemo(() => {
    let filtered = allJobsRaw;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((job: any) => job.status === statusFilter);
    }
    
    // Filter by search query (customer name, job number, address, description)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((job: any) => {
        const customer = (customersData as any)?.data?.find((c: any) => c.id === job.customerId);
        const customerName = customer?.name?.toLowerCase() || '';
        const jobNumber = job.jobNumber?.toLowerCase() || '';
        const address = job.address?.toLowerCase() || '';
        const description = job.description?.toLowerCase() || '';
        const title = job.title?.toLowerCase() || '';
        
        return customerName.includes(query) ||
               jobNumber.includes(query) ||
               address.includes(query) ||
               description.includes(query) ||
               title.includes(query);
      });
    }
    
    // Sort by job number (descending - highest job number first)
    const sorted = [...filtered].sort((a: any, b: any) => {
      const numA = parseInt(a.jobNumber || '0', 10);
      const numB = parseInt(b.jobNumber || '0', 10);
      return numB - numA; // Descending order
    });
    
    // Debug logging
    console.log('🔍 Dispatch Board Debug:', {
      totalJobs: sorted.length,
      statusFilter,
      searchQuery,
      top10Jobs: sorted.slice(0, 10).map((j: any) => ({ jobNumber: j.jobNumber, title: j.title }))
    });
    
    return sorted;
  }, [allJobsRaw, statusFilter, searchQuery, customersData]);
  
  // Component render debug
  console.log('⚡ AdvancedDispatchBoard RENDER - Raw Jobs:', allJobsRaw?.length, 'Sorted Jobs:', allJobs?.length);
  
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

  // Get customer name with enhanced display logic
  const getCustomerName = (customerId: string, jobData?: any) => {
    // Return placeholder if customers data hasn't loaded yet
    if (!customersData || customersLoading) {
      return 'Loading...';
    }
    
    const customer = (customersData as any)?.data?.find((c: any) => c.id === customerId);
    const job = jobData || (jobsData as any)?.data?.find((j: any) => j.customerId === customerId);
    
    // Priority 1: Use customer name if available (even if generic)
    if (customer?.name) {
      // Remove generic "Customer-" prefix if present, otherwise use full name
      if (customer.name.startsWith('Customer-')) {
        const cleanName = customer.name.replace('Customer-', '').trim();
        return cleanName || customer.name;
      }
      return customer.name;
    }
    
    // Priority 2: If job has proper address, use street address
    if (job?.address && job.address !== 'Address not specified' && job.address.trim()) {
      const addressParts = job.address.split(',');
      if (addressParts.length > 0) {
        const streetAddress = addressParts[0].trim();
        if (streetAddress && streetAddress !== 'Address not specified') {
          return streetAddress;
        }
      }
    }
    
    // Priority 3: For jobs with description, use part of it as identifier
    if (job?.description && job.description.trim() && job.description !== null) {
      const desc = job.description.trim();
      // Extract first meaningful part of description (up to 40 chars)
      const shortDesc = desc.split('\n')[0].substring(0, 40);
      if (shortDesc.length > 10) {
        return `${shortDesc}...`;
      }
    }
    
    // Priority 4: For quote/lead jobs without other info, show status with job number
    if (job?.status === 'lead' || job?.status === 'quote') {
      return `${job.status.charAt(0).toUpperCase() + job.status.slice(1)} #${job.jobNumber || ''}`;
    }
    
    return 'Unknown Customer';
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

  // Get status-specific styling
  const getStatusStyling = (status: string) => {
    switch (status) {
      case 'lead':
        return {
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-700',
          indicatorColor: 'bg-blue-500',
          label: 'Lead',
          dotColor: 'bg-blue-400',
          hexColor: '#3b82f6'
        };
      case 'quote':
        return {
          bgColor: 'bg-purple-50 border-purple-200',
          textColor: 'text-purple-700',
          indicatorColor: 'bg-purple-500',
          label: 'Quote',
          dotColor: 'bg-purple-400',
          hexColor: '#8b5cf6'
        };
      case 'work_order':
        return {
          bgColor: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-700',
          indicatorColor: 'bg-orange-500',
          label: 'Work Order',
          dotColor: 'bg-orange-400',
          hexColor: '#f59e0b'
        };
      case 'completed':
        return {
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-700',
          indicatorColor: 'bg-green-500',
          label: 'Completed',
          dotColor: 'bg-green-400',
          hexColor: '#10b981'
        };
      case 'unsuccessful':
        return {
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-700',
          indicatorColor: 'bg-red-500',
          label: 'Unsuccessful',
          dotColor: 'bg-red-400',
          hexColor: '#ef4444'
        };
      default:
        return {
          bgColor: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-700',
          indicatorColor: 'bg-gray-500',
          label: 'Unknown',
          dotColor: 'bg-gray-400',
          hexColor: '#6b7280'
        };
    }
  };

  // Render mini job card for right sidebar - ServiceM8 style
  const renderJobSidebarCard = (job: any, index: number) => {
    const customer = getCustomerName(job.customerId, job);
    const styling = getStatusStyling(job.status);
    
    // ServiceM8-style letter mapping based on status
    const getStatusLetter = (status: string) => {
      switch (status) {
        case 'quote': return 'Q';
        case 'work_order': return 'W';
        case 'completed': return 'C';
        case 'lead': return 'L';
        case 'unsuccessful': return 'U';
        default: return 'J';
      }
    };
    
    return (
      <div
        key={job.id}
        className="flex items-start gap-3 py-3 px-2 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 min-h-[120px]"
        style={{ borderLeftColor: styling.hexColor }}
        onClick={() => handleJobCardClick(job)}
        data-testid={`job-sidebar-card-${job.id}`}
      >
        {/* Status circle with letter */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: styling.hexColor }}
        >
          {getStatusLetter(job.status)}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Customer name */}
          <h4 className="font-semibold text-base text-gray-900 mb-1">{customer}</h4>
          
          {/* Address */}
          <p className="text-sm text-gray-600 mb-2 break-words line-clamp-2">{job.address}</p>
          
          {/* Job description */}
          <p className="text-sm text-gray-800 break-words line-clamp-2">{job.title || '\u00A0'}</p>
        </div>
        
        {/* Job number */}
        <div className="flex-shrink-0">
          <span className="text-sm text-gray-400 font-mono">#{job.id.slice(-4)}</span>
        </div>
      </div>
    );
  };

  // Render job block in time grid
  const renderJobBlock = (job: any, timeSlot: Date, staffMember: any) => {
    if (!job.scheduledStartTime) return null;
    
    const jobTime = new Date(`${format(currentDate, 'yyyy-MM-dd')} ${job.scheduledStartTime}`);
    const slotHour = timeSlot.getHours();
    
    // Check if staffMember is assigned to this job (handle both single ID and array)
    const isAssigned = Array.isArray(job.assignedTo) 
      ? job.assignedTo.includes(staffMember.id)
      : job.assignedTo === staffMember.id;
    
    if (jobTime.getHours() === slotHour && isAssigned) {
      return (
        <div 
          key={job.id}
          className="bg-blue-500 text-white text-xs p-1 rounded mb-1 cursor-pointer hover:bg-blue-600"
          onClick={() => handleJobCardClick(job)}
          style={{ backgroundColor: staffMember.color }}
        >
          <div className="font-medium">{jobTime.getHours()}:{jobTime.getMinutes().toString().padStart(2, '0')}</div>
          <div className="truncate">{getCustomerName(job.customerId, job)}</div>
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
        {/* Top Navigation Header */}
        <div className="bg-white border-b">
          <div className="flex items-center justify-between p-3">
            {/* Left Navigation */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Right View Controls */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-sm">Day</Button>
              <Button variant="ghost" size="sm" className="text-sm">Week</Button>
              <Button variant="ghost" size="sm" className="text-sm">2 Weeks</Button>
              <Button variant="ghost" size="sm" className="text-sm">Month</Button>
            </div>
          </div>

          {/* Date Display */}
          <div className="px-3 pb-3">
            <div className="text-center">
              <span className="text-green-600 font-medium text-lg">
                {format(currentDate, 'EEEE, MMMM d, yyyy')} — Today 
                <span className="text-sm ml-1">{format(new Date(), 'h:mmaaaa').toLowerCase()}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center - Time Grid */}
          <div className="flex-1 overflow-auto bg-white">
            {/* Time Slots Grid */}
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot.toString()} className="grid border-b" style={{ gridTemplateColumns: `80px repeat(${staff.length}, 1fr)`, minHeight: '60px' }}>
                {/* Time Label */}
                <div className="p-2 border-r bg-gray-50 flex items-start">
                  <span className="text-sm font-medium text-gray-600">
                    {format(timeSlot, 'haaa').toLowerCase()}
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
                        if (!job.scheduledDate || !job.scheduledStartTime) return false;
                        const jobDate = new Date(job.scheduledDate);
                        const jobTime = new Date(`${format(currentDate, 'yyyy-MM-dd')} ${job.scheduledStartTime}`);
                        const slotHour = timeSlot.getHours();
                        
                        // Check if member is assigned to this job (handle both single ID and array)
                        const isAssigned = Array.isArray(job.assignedTo) 
                          ? job.assignedTo.includes(member.id)
                          : job.assignedTo === member.id;
                        
                        return isSameDay(jobDate, currentDate) && 
                               jobTime.getHours() === slotHour && 
                               isAssigned;
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
                  placeholder="Search by customer, job #, address..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                  <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
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
            <div className="p-3 pb-8 space-y-3">
              {allJobs.map((job: any, index: number) => renderJobSidebarCard(job, index))}
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
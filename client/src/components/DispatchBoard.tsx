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
  Move,
  SearchX,
  Clipboard
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format, addDays, subDays, startOfDay, addHours, isSameDay, parseISO, isWithinInterval, addMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { JobTemplate } from "@shared/schema";
import { GlobalJobCard } from '@/components/GlobalJobCard';
import { CustomerAvatar } from '@/components/CustomerAvatar';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
}
import { GrossMarginCalculator } from '@/components/GrossMarginCalculator';
import { StaffTimeTracker } from '@/components/StaffTimeTracker';
import { CalendarGrid } from '@/components/CalendarGrid';
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

interface StaffMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  status: 'available' | 'busy' | 'offline';
  color: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  teamLeaderId: string;
  members: string[]; // Staff IDs
  specialties: string[];
  maxCapacity: number;
  status: 'available' | 'busy' | 'offline';
  color: string;
}

interface JobAssignment {
  id: string;
  jobId: string;
  jobNumber?: string; // Job number for sorting and display
  customerId?: string; // Added for compatibility with GlobalJobCard
  teamId?: string; // Optional for team mode
  staffId?: string; // Optional for individual mode
  assignedTeam: string[]; // Array of staff member IDs (used in team mode)
  customerName: string;
  customerPhone: string;
  address: string;
  serviceType: string;
  description?: string; // Added for proper job descriptions
  startTime: string;
  endTime: string;
  duration: number; // hours
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  specialInstructions?: string; // Added for compatibility with GlobalJobCard
  lastActivityAt?: string; // For activity-based sorting
}

type AssignmentMode = 'teams' | 'individual';

interface DispatchBoardProps {
  compact?: boolean;
}

// Interface for real Employee from API
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position: string;
  role: string; // admin, crew
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

// Unique color palette for each staff member
const staffColorPalette = [
  'bg-emerald-500',  // Green
  'bg-blue-500',     // Blue
  'bg-purple-500',   // Purple
  'bg-orange-500',   // Orange
  'bg-teal-500',     // Teal
  'bg-pink-500',     // Pink
  'bg-indigo-500',   // Indigo
  'bg-rose-500',     // Rose
  'bg-cyan-500',     // Cyan
  'bg-amber-500',    // Amber
  'bg-violet-500',   // Violet
  'bg-lime-500',     // Lime
];

// Function to transform Employee data to StaffMember format for dispatch board
const transformEmployeeToStaffMember = (employee: Employee, index: number): StaffMember => {
  // Assign unique color to each staff member
  const color = staffColorPalette[index % staffColorPalette.length];

  // Map status from employee to dispatch format
  const getDispatchStatus = (status: string): 'available' | 'busy' | 'offline' => {
    switch (status) {
      case 'active': return 'available';
      case 'inactive': return 'offline';
      case 'on_leave': return 'offline';
      default: return 'available';
    }
  };

  return {
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    role: employee.position || 'crew',
    skills: employee.skills || [],
    status: getDispatchStatus(employee.status),
    color: color
  };
};

// Real employee IDs from API for proper dispatch integration
const JAKE_ID = '3e147247-e94d-4f2f-8425-91a13826de93';
const MARIA_ID = '8ec7a4c0-393c-4b00-964b-2fa596974eaf';
const TOM_ID = 'd5a24642-8d11-47ae-acd6-7ae466a78992'; // Tom Bradley ID from API

const mockTeams: Team[] = [
  {
    id: 'team1',
    name: 'Alpha Crew',
    description: 'Emergency response and hazardous removals',
    teamLeaderId: JAKE_ID,
    members: [JAKE_ID, MARIA_ID],
    specialties: ['Crane Operation', 'Hazardous Removal', 'Emergency Response'],
    maxCapacity: 3,
    status: 'busy',
    color: 'bg-red-500'
  },
  {
    id: 'team2',
    name: 'Beta Crew',
    description: 'General tree services and maintenance',
    teamLeaderId: TOM_ID,
    members: [TOM_ID],
    specialties: ['Tree Pruning', 'Cleanup', 'Customer Service'],
    maxCapacity: 4,
    status: 'available',
    color: 'bg-green-500'
  },
  {
    id: 'team3',
    name: 'Equipment Team',
    description: 'Heavy machinery and specialized equipment jobs',
    teamLeaderId: JAKE_ID,
    members: [JAKE_ID],
    specialties: ['Heavy Machinery', 'Equipment Operation', 'Maintenance'],
    maxCapacity: 2,
    status: 'available',
    color: 'bg-purple-500'
  }
];

const mockJobAssignments: JobAssignment[] = [
  {
    id: '1',
    jobId: 'J001',
    teamId: 'team1',
    assignedTeam: [JAKE_ID, MARIA_ID],
    customerName: 'Stephanie Syre',
    customerPhone: '(555) 123-4567',
    address: '123 Norfolk Pine Ave',
    serviceType: 'Tree Removal',
    startTime: '2024-12-20T09:00:00',
    endTime: '2024-12-20T12:00:00',
    duration: 3,
    status: 'scheduled',
    priority: 'high',
    notes: 'Large oak near power lines'
  },
  {
    id: '2',
    jobId: 'J002',
    teamId: 'team1',
    assignedTeam: [JAKE_ID, MARIA_ID],
    customerName: 'Dave Tarry',
    customerPhone: '(555) 234-5678',
    address: '33 Wellington St, Gisborne',
    serviceType: 'Emergency Removal',
    startTime: '2024-12-20T07:30:00',
    endTime: '2024-12-20T10:30:00',
    duration: 3,
    status: 'in_progress',
    priority: 'urgent'
  },
  {
    id: '3',
    jobId: 'J003',
    staffId: TOM_ID, // Individual assignment - Tom Bradley
    assignedTeam: [TOM_ID],
    customerName: 'Johnson, Sarah',
    customerPhone: '(555) 345-6789',
    address: '456 Elm Street',
    serviceType: 'Tree Pruning',
    startTime: '2024-12-20T13:00:00',
    endTime: '2024-12-20T15:00:00',
    duration: 2,
    status: 'scheduled',
    priority: 'medium',
    notes: 'Quote for removing large oak tree'
  },
  {
    id: '4',
    jobId: 'J004',
    staffId: JAKE_ID, // Individual assignment - Jake Morrison
    assignedTeam: [JAKE_ID],
    customerName: 'Gray, Alex',
    customerPhone: '(555) 456-7890',
    address: '789 Pine Avenue',
    serviceType: 'Equipment Setup',
    startTime: '2024-12-20T15:45:00',
    endTime: '2024-12-20T16:15:00',
    duration: 0.5,
    status: 'scheduled',
    priority: 'low',
    notes: 'Heavy equipment positioning'
  },
  {
    id: '5',
    jobId: 'J005',
    staffId: MARIA_ID, // Individual assignment - Maria Silva
    assignedTeam: [MARIA_ID],
    customerName: 'Baty, Katrina',
    customerPhone: '(555) 567-8901',
    address: '321 Maple Drive',
    serviceType: 'Quote',
    startTime: '2024-12-20T10:00:00',
    endTime: '2024-12-20T11:00:00',
    duration: 1,
    status: 'scheduled',
    priority: 'medium'
  }
];

const timeSlots = [
  '6:00', '7:00', '8:00', '9:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
];

// Job filter options similar to ServiceM8
const jobFilterOptions = [
  { value: 'all', label: 'All Jobs', icon: List, description: 'Jobs with a Quote or Work Order status, or recently Completed/Unsuccessful.' },
  { value: 'action_required', label: 'Action Required', icon: AlertTriangle, description: 'Jobs that need to be scheduled, sent to a Queue, or actioned in some way.' },
  { value: 'for_review', label: 'For My Review', icon: Target, description: 'Jobs that specifically need your attention.' },
  { value: 'leads', label: 'Leads', icon: User, description: 'Potential customers and job inquiries.' },
  { value: 'quotes', label: 'Quotes', icon: MessageSquare, description: 'Jobs with a Quote status.' },
  { value: 'work_orders', label: 'Work Orders', icon: Settings, description: 'Confirmed jobs with work order status.' },
  { value: 'unscheduled', label: 'Unscheduled Jobs', icon: Calendar, description: 'Jobs without a future booking and not in a Queue.' },
  { value: 'in_progress', label: 'In Progress Jobs', icon: Zap, description: 'Jobs with a future booking.' },
  { value: 'completed', label: 'Completed Jobs', icon: Check, description: 'Jobs recently updated to a Completed or Unsuccessful status.' }
];

export function DispatchBoard({ compact = false }: DispatchBoardProps) {
  const { toast } = useToast();

  // Fetch employees from staff management system
  const { data: employeesData } = useQuery<{ success: boolean; data: Employee[] }>({
    queryKey: ['/api/employees'],
  });

  const employees = employeesData?.data || [];
  
  // Transform employees to staff members for dispatch board
  const staffMembers = useMemo(() => {
    return employees
      .filter(emp => emp.isActive === true) // Only show active employees
      .map((emp, index) => transformEmployeeToStaffMember(emp, index));
  }, [employees]);

  // Fetch job templates for template selection
  const { data: templatesResponse } = useQuery<ApiResponse<JobTemplate>>({
    queryKey: ['/api/job-templates'],
  });
  const templates = templatesResponse?.data || [];

  // Handle template selection and auto-populate form
  const handleTemplateSelection = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (!templateId) return;
    
    const template = templates.find((t: JobTemplate) => t.id === templateId);
    if (!template) return;

    // Auto-populate form fields based on template
    setNewJobFormData(prev => ({
      ...prev,
      serviceType: template.category || template.serviceType || prev.serviceType,
      priority: template.riskLevel === 'High Risk' ? 'high' : 
                template.riskLevel === 'Medium Risk' ? 'medium' : 'low',
      notes: template.description || prev.notes,
      // Set estimated start/end times based on template duration
      startTime: prev.startTime || '09:00',
      endTime: template.estimatedDuration ? 
        calculateEndTime('09:00', template.estimatedDuration) : 
        prev.endTime || '17:00',
      // Copy equipment checklist from template with normalization
      equipmentChecklist: (template.equipmentChecklist || []).map((item, index) => {
        // Normalize: handle string[], partial objects, or full EquipmentChecklistItem[]
        const equipmentName = typeof item === 'string' ? item : (item.equipment || item.name || `Item ${index + 1}`);
        return {
          id: `equipment-${Date.now()}-${index}`,
          equipment: equipmentName,
          checked: false
          // checkedAt and checkedBy are undefined (not null) for unchecked items
        };
      })
    }));

    toast({
      title: 'Template Applied',
      description: `Applied "${template.name}" template settings.`,
    });
  };

  // Helper function to calculate end time based on duration
  const calculateEndTime = (startTime: string, durationHours: number): string => {
    if (!startTime) return '';
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000));
    
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day
    return today;
  });
  const [selectedJob, setSelectedJob] = useState<JobAssignment | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDeepSearchActive, setIsDeepSearchActive] = useState<boolean>(false);
  const [deepSearchResults, setDeepSearchResults] = useState<JobAssignment[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('individual');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [showJobCreationModal, setShowJobCreationModal] = useState(false);
  const [showGlobalJobCard, setShowGlobalJobCard] = useState(false);
  const [globalJobCardMode, setGlobalJobCardMode] = useState<'create' | 'edit'>('create');
  const [jobToEdit, setJobToEdit] = useState<JobAssignment | null>(null);
  const [newJobFormData, setNewJobFormData] = useState({
    customerName: '',
    customerPhone: '',
    address: '',
    serviceType: '',
    startTime: '',
    endTime: '',
    priority: 'medium' as JobAssignment['priority'],
    notes: '',
    assignedTo: '' // Will hold teamId or staffId based on mode
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [jobToSchedule, setJobToSchedule] = useState<JobAssignment | null>(null);
  const [schedulingData, setSchedulingData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    assignedTo: '',
    notes: ''
  });

  // Fetch jobs from backend API
  const { data: jobsData, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ['/api/jobs'],
  });

  // Fetch customers for name lookup
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
  });

  // Fetch staff assignments for dispatch board
  const { data: staffAssignmentsData } = useQuery({
    queryKey: ['/api/staff-assignments'],
  });

  // Create customer lookup map
  const customerMap = useMemo(() => {
    const map = new Map();
    if (customersData?.data) {
      customersData.data.forEach((customer: any) => {
        map.set(customer.id, customer.name);
      });
    }
    return map;
  }, [customersData]);

  // Create job lookup map
  const jobMap = useMemo(() => {
    const map = new Map();
    if (jobsData?.data) {
      jobsData.data.forEach((job: any) => {
        map.set(job.id, job);
      });
    }
    return map;
  }, [jobsData]);

  // Create staff assignment lookup by job ID
  const staffAssignmentsByJob = useMemo(() => {
    const map = new Map<string, any[]>();
    if (staffAssignmentsData?.data) {
      staffAssignmentsData.data.forEach((assignment: any) => {
        if (!map.has(assignment.jobId)) {
          map.set(assignment.jobId, []);
        }
        map.get(assignment.jobId)?.push(assignment);
      });
    }
    return map;
  }, [staffAssignmentsData]);

  // Convert staff assignments to JobAssignment format for dispatch board
  const jobs: JobAssignment[] = useMemo(() => {
    const jobAssignments: JobAssignment[] = [];
    const processedJobs = new Set<string>();

    // First, process all jobs with staff assignments
    if (staffAssignmentsData?.data && staffAssignmentsData.data.length > 0) {
      // Group assignments by job and date
      const assignmentsByJobAndDate = new Map<string, any[]>();
      
      staffAssignmentsData.data.forEach((assignment: any) => {
        // Safari-safe date parsing
        const startDate = new Date(assignment.startTime);
        if (isNaN(startDate.getTime())) return; // Skip invalid dates
        const dateKey = startDate.toDateString();
        const key = `${assignment.jobId}-${dateKey}`;
        
        if (!assignmentsByJobAndDate.has(key)) {
          assignmentsByJobAndDate.set(key, []);
        }
        const dateArray = assignmentsByJobAndDate.get(key);
        if (dateArray) {
          dateArray.push(assignment);
        }
      });

      // Create job assignments for each unique job-date combination
      assignmentsByJobAndDate.forEach((assignments, key) => {
        const firstAssignment = assignments[0];
        const apiJob = jobMap.get(firstAssignment.jobId);
        if (!apiJob) return;

        processedJobs.add(firstAssignment.jobId);

        // Collect all employee IDs for this job-date
        const assignedTeam = assignments.map((a: any) => a.employeeId);

        // Determine teamId and staffId based on assignment mode
        let teamId = undefined;
        let staffId = undefined;

        if (assignedTeam.length > 0) {
          if (assignmentMode === 'teams') {
            const matchingTeam = mockTeams.find(team =>
              assignedTeam.some((assignedId: string) => team.members.includes(assignedId))
            );
            teamId = matchingTeam?.id;
          } else {
            staffId = assignedTeam[0];
          }
        }

        // Safari-safe date parsing for duration calculation
        const startDateTime = new Date(firstAssignment.startTime);
        const endDateTime = new Date(firstAssignment.endTime);
        const calculatedDuration = !isNaN(startDateTime.getTime()) && !isNaN(endDateTime.getTime())
          ? (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60)
          : 2; // Default to 2 hours if parsing fails

        // Safari-safe customer name lookup
        const customerName = apiJob.customerId && customerMap.has(apiJob.customerId)
          ? customerMap.get(apiJob.customerId)
          : apiJob.title || 'Unknown Customer';

        jobAssignments.push({
          id: apiJob.id,
          jobId: apiJob.jobNumber,
          jobNumber: apiJob.jobNumber,
          customerId: apiJob.customerId,
          customerName: customerName,
          customerPhone: '',
          address: apiJob.address,
          serviceType: apiJob.serviceType || '',
          description: apiJob.description || '',
          status: 'scheduled', // Jobs with staff assignments are scheduled
          priority: apiJob.priority,
          startTime: firstAssignment.startTime,
          endTime: firstAssignment.endTime,
          duration: calculatedDuration,
          notes: firstAssignment.notes || apiJob.specialInstructions || apiJob.notes || '',
          assignedTeam: assignedTeam,
          teamId: teamId,
          staffId: staffId,
          specialInstructions: apiJob.specialInstructions,
          lastActivityAt: apiJob.lastActivityAt
        });
      });
    }

    // Also include jobs without assignments (for display in unscheduled jobs list)
    if (jobsData?.data) {
      jobsData.data.forEach((apiJob: any) => {
        // Skip if already processed with staff assignment
        if (processedJobs.has(apiJob.id)) return;

        // Safari-safe date handling
        const estimatedDuration = apiJob.estimatedDuration || 2;
        let startTime: string;
        let endTime: string;
        
        if (apiJob.scheduledDate) {
          // Validate the scheduled date
          const scheduledDateTime = new Date(apiJob.scheduledDate);
          if (!isNaN(scheduledDateTime.getTime())) {
            startTime = apiJob.scheduledDate;
            endTime = new Date(scheduledDateTime.getTime() + (estimatedDuration * 60 * 60 * 1000)).toISOString();
          } else {
            // Invalid date, use current time
            startTime = new Date().toISOString();
            endTime = new Date(Date.now() + (estimatedDuration * 60 * 60 * 1000)).toISOString();
          }
        } else {
          // No scheduled date, use current time
          startTime = new Date().toISOString();
          endTime = new Date(Date.now() + (estimatedDuration * 60 * 60 * 1000)).toISOString();
        }

        // Safari-safe customer name lookup
        const customerName = apiJob.customerId && customerMap.has(apiJob.customerId)
          ? customerMap.get(apiJob.customerId)
          : apiJob.title || 'Unknown Customer';

        jobAssignments.push({
          id: apiJob.id,
          jobId: apiJob.jobNumber,
          jobNumber: apiJob.jobNumber,
          customerId: apiJob.customerId,
          customerName: customerName,
          customerPhone: '',
          address: apiJob.address,
          serviceType: apiJob.serviceType || '',
          description: apiJob.description || '',
          status: apiJob.status,
          priority: apiJob.priority,
          startTime: startTime,
          endTime: endTime,
          duration: estimatedDuration,
          notes: apiJob.specialInstructions || apiJob.notes || '',
          assignedTeam: apiJob.assignedTeam || [],
          teamId: undefined,
          staffId: undefined,
          specialInstructions: apiJob.specialInstructions,
          lastActivityAt: apiJob.lastActivityAt
        });
      });
    }

    return jobAssignments;
  }, [jobsData, staffAssignmentsData, customerMap, assignmentMode, jobMap]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Check if job has recent activity (within last hour)
  const hasRecentActivity = (job: JobAssignment) => {
    if (!job.lastActivityAt) return false;
    // Safari-safe date parsing
    const lastActivity = new Date(job.lastActivityAt);
    if (isNaN(lastActivity.getTime())) return false;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastActivity > oneHourAgo;
  };

  // Get status initials for job circles
  const getStatusInitials = (job: JobAssignment) => {
    // Check service type first for leads and quotes
    const serviceType = job.serviceType?.toLowerCase() || '';
    if (serviceType.includes('lead') || serviceType.includes('inquiry')) return 'L';
    if (serviceType.includes('quote') || serviceType.includes('proposal')) return 'Q';
    
    // Handle actual API status values
    switch (job.status) {
      case 'completed': return 'C';
      case 'unsuccessful': return 'U';
      case 'scheduled': return 'S';
      case 'work_order': return 'WO';
      case 'work order': return 'WO';
      case 'quote': return 'Q';
      case 'lead': return 'L';
      default: return 'WO';
    }
  };

  // Get status color for job circles
  const getJobStatusColor = (job: JobAssignment) => {
    const serviceType = job.serviceType?.toLowerCase() || '';
    if (serviceType.includes('lead') || serviceType.includes('inquiry')) return 'bg-cyan-600';
    if (serviceType.includes('quote') || serviceType.includes('proposal')) return 'bg-orange-600';
    
    switch (job.status) {
      case 'completed': return 'bg-green-600';
      case 'unsuccessful': return 'bg-red-600';
      case 'work_order': return 'bg-blue-600';
      case 'work order': return 'bg-blue-600';
      case 'scheduled': return 'bg-orange-600';
      case 'quote': return 'bg-orange-600';
      case 'lead': return 'bg-cyan-600';
      default: return 'bg-gray-600';
    }
  };

  // Get actual color values for inline styles (matching desktop style)
  const getJobStatusColorValue = (job: JobAssignment) => {
    const serviceType = job.serviceType?.toLowerCase() || '';
    if (serviceType.includes('lead') || serviceType.includes('inquiry')) return '#06b6d4'; // cyan-500
    if (serviceType.includes('quote') || serviceType.includes('proposal')) return '#f97316'; // orange-500
    
    // Handle actual API status values
    switch (job.status) {
      case 'completed': return '#22c55e'; // green-500
      case 'unsuccessful': return '#ef4444'; // red-500
      case 'work_order': return '#3b82f6'; // blue-500
      case 'work order': return '#3b82f6'; // blue-500
      case 'scheduled': return '#3b82f6'; // blue-500 (same as work order)
      case 'quote': return '#f97316'; // orange-500
      case 'lead': return '#06b6d4'; // cyan-500
      default: return '#6b7280'; // gray-500
    }
  };

  const getJobsForTeam = (teamId: string) => {
    return jobs.filter(job => {
      // Check if any team member is assigned to this job
      const teamMembers = getTeamMembers(teamId);
      const hasTeamMember = job.assignedTeam?.some(assignedId => 
        teamMembers.some(member => member.id === assignedId)
      );
      if (!hasTeamMember && job.teamId !== teamId) return false;
      return true;
    });
  };


  const getJobsForStaff = (staffId: string) => {
    return jobs.filter(job => {
      // Check if staff member is in assigned team or directly assigned
      const isAssigned = job.assignedTeam?.includes(staffId);
      if (!isAssigned && job.staffId !== staffId) return false;
      return true;
    });
  };

  const getTeamMembers = (teamId: string) => {
    const team = mockTeams.find(t => t.id === teamId);
    if (!team) return [];
    return team.members.map(memberId => ({ id: memberId, name: `Staff ${memberId}`, role: 'Unknown', skills: [], status: 'available', color: 'bg-gray-500' } as StaffMember)).filter(Boolean) as StaffMember[];
  };

  // Deep search function that searches ALL jobs without date/status filtering
  const performDeepSearch = (query: string) => {
    if (!query.trim()) {
      setIsDeepSearchActive(false);
      setDeepSearchResults([]);
      return;
    }

    const searchQuery = query.toLowerCase().trim();
    const allMatchingJobs = jobs.filter(job => {
      const customerName = job.customerName?.toLowerCase() || '';
      const address = job.address?.toLowerCase() || '';
      const serviceType = job.serviceType?.toLowerCase() || '';
      const description = job.description?.toLowerCase() || '';
      const jobId = job.id?.toLowerCase() || '';
      const notes = job.notes?.toLowerCase() || '';
      const specialInstructions = job.specialInstructions?.toLowerCase() || '';

      return customerName.includes(searchQuery) ||
             address.includes(searchQuery) ||
             serviceType.includes(searchQuery) ||
             description.includes(searchQuery) ||
             jobId.includes(searchQuery) ||
             notes.includes(searchQuery) ||
             specialInstructions.includes(searchQuery);
    });

    setIsDeepSearchActive(true);
    setDeepSearchResults(allMatchingJobs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())); // Sort by newest first
  };

  const getTodaysJobs = () => {
    // If deep search is active, return deep search results
    if (isDeepSearchActive) {
      return deepSearchResults;
    }

    const sorted = jobs
      .filter(job => {
        // Show all jobs including completed (only exclude unsuccessful)
        return job.status !== 'unsuccessful';
      })
      .filter(job => {
        // Apply search filter
        if (!searchQuery.trim()) return true;
        
        const query = searchQuery.toLowerCase().trim();
        const customerName = job.customerName?.toLowerCase() || '';
        const address = job.address?.toLowerCase() || '';
        const serviceType = job.serviceType?.toLowerCase() || '';
        const description = job.description?.toLowerCase() || '';
        const jobId = job.id?.toLowerCase() || '';
        
        return customerName.includes(query) ||
               address.includes(query) ||
               serviceType.includes(query) ||
               description.includes(query) ||
               jobId.includes(query);
      })
      .sort((a, b) => {
        // First, prioritize jobs with recent activity (lastActivityAt)
        const hasActivityA = !!a.lastActivityAt;
        const hasActivityB = !!b.lastActivityAt;
        
        // Jobs with activity come before jobs without activity
        if (hasActivityA && !hasActivityB) return -1;
        if (!hasActivityA && hasActivityB) return 1;
        
        // If both have activity, sort by most recent first
        if (hasActivityA && hasActivityB) {
          const activityA = new Date(a.lastActivityAt!).getTime();
          const activityB = new Date(b.lastActivityAt!).getTime();
          if (activityA !== activityB) {
            return activityB - activityA; // Most recent first
          }
        }
        
        // Then sort by highest job number (descending)
        const jobNumberA = parseInt(a.jobNumber || '0', 10);
        const jobNumberB = parseInt(b.jobNumber || '0', 10);
        return jobNumberB - jobNumberA;
      })
      .slice(0, 60); // Limit to 60 latest jobs - completed jobs included until they age out
    
    return sorted;
  };

  const getUnscheduledJobs = () => {
    return jobs.filter(job => 
      job.status === 'quote' || 
      job.status === 'lead' || 
      !job.startTime || 
      job.startTime.includes('0000-00-00')
    ).sort((a, b) => {
      const jobNumberA = parseInt(a.jobNumber || '0', 10);
      const jobNumberB = parseInt(b.jobNumber || '0', 10);
      return jobNumberB - jobNumberA;
    });
  };

  // Job Mutations
  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/jobs', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setShowJobCreationModal(false);
      setNewJobFormData({
        customerName: '',
        customerPhone: '',
        address: '',
        serviceType: '',
        startTime: '',
        endTime: '',
        priority: 'medium',
        notes: '',
        assignedTo: ''
      });
      toast({
        title: "Job Created Successfully",
        description: "Job has been scheduled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create job: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const response = await apiRequest('PUT', `/api/jobs/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update job: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Job Management Functions
  const createNewJob = () => {
    if (!newJobFormData.customerName || !newJobFormData.customerPhone || !newJobFormData.address || !newJobFormData.serviceType || !newJobFormData.startTime || !newJobFormData.endTime || !newJobFormData.assignedTo) {
      toast({
        title: "Missing Information", 
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Transform form data to API format
    createJobMutation.mutate({
      jobNumber: `JOB-${Date.now()}`,
      title: newJobFormData.customerName,
      description: `${newJobFormData.serviceType} - ${newJobFormData.notes}`,
      address: newJobFormData.address,
      status: 'scheduled',
      priority: newJobFormData.priority,
      scheduledDate: `${format(selectedDate, 'yyyy-MM-dd')}T${newJobFormData.startTime}:00`,
      totalAmount: "0.00"
    });
  };

  const markJobComplete = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      updateJobMutation.mutate({
        id: jobId,
        updates: { status: 'completed', completedDate: new Date() }
      });
      toast({
        title: "Job Completed",
        description: `Job marked as complete`,
      });
    }
  };

  const cancelJob = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      updateJobMutation.mutate({
        id: jobId,
        updates: { status: 'cancelled' }
      });
      toast({
        title: "Job Cancelled",
        description: `Job has been cancelled`,
        variant: "destructive"
      });
    }
  };

  const addJobNotes = (jobId: string, notes: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      const updatedNotes = job.notes ? `${job.notes}\n${notes}` : notes;
      updateJobMutation.mutate({
        id: jobId,
        updates: { notes: updatedNotes }
      });
      toast({
        title: "Notes Added",
        description: `Notes added to job`,
      });
    }
  };

  // Handle scheduling functionality
  const handleScheduleJob = (job: JobAssignment) => {
    setJobToSchedule(job);
    // Safari-safe date parsing
    const startTime = new Date(job.startTime);
    const endTime = new Date(job.endTime);
    const now = new Date();
    
    setSchedulingData({
      date: !isNaN(startTime.getTime()) ? format(startTime, 'yyyy-MM-dd') : format(now, 'yyyy-MM-dd'),
      startTime: !isNaN(startTime.getTime()) ? format(startTime, 'HH:mm') : '09:00',
      endTime: !isNaN(endTime.getTime()) ? format(endTime, 'HH:mm') : '17:00',
      assignedTo: job.teamId || job.staffId || '',
      notes: job.notes || ''
    });
    setShowSchedulingModal(true);
    setSelectedJob(null); // Close job detail modal
  };

  const handleEditJob = (job: JobAssignment) => {
    console.log('🔵 Job card clicked:', job.jobNumber || job.id);
    setJobToEdit(job);
    setGlobalJobCardMode('edit');
    setShowGlobalJobCard(true);
    setSelectedJob(null); // Close the job details dialog
  };

  const handleCreateJob = () => {
    setJobToEdit(null);
    setGlobalJobCardMode('create');
    setShowGlobalJobCard(true);
  };

  const saveSchedule = () => {
    if (!jobToSchedule || !schedulingData.date || !schedulingData.startTime || !schedulingData.endTime || !schedulingData.assignedTo) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required scheduling fields.",
        variant: "destructive"
      });
      return;
    }

    // Create new start and end times (Safari-compatible)
    const startDateTime = new Date(`${schedulingData.date}T${schedulingData.startTime}:00`);
    const endDateTime = new Date(`${schedulingData.date}T${schedulingData.endTime}:00`);
    
    // Validate dates are valid
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      toast({
        title: "Invalid Date",
        description: "Please enter valid date and time values.",
        variant: "destructive"
      });
      return;
    }

    // Validate that end time is after start time
    if (endDateTime <= startDateTime) {
      toast({
        title: "Invalid Time Range",
        description: "End time must be after start time.",
        variant: "destructive"
      });
      return;
    }

    // Validate that scheduling is not in the past
    if (startDateTime < new Date()) {
      toast({
        title: "Invalid Date",
        description: "Cannot schedule jobs in the past.",
        variant: "destructive"
      });
      return;
    }

    // Calculate estimated duration in hours
    const durationMs = endDateTime.getTime() - startDateTime.getTime();
    const estimatedDuration = Math.round(durationMs / (1000 * 60 * 60)); // Convert to hours

    // Create updates object for backend (aligned with schema)
    const updates: any = {
      scheduledDate: startDateTime.toISOString(),
      estimatedDuration: estimatedDuration,
      specialInstructions: schedulingData.notes
    };

    // Handle assignment based on mode (aligned with schema)
    if (assignmentMode === 'teams') {
      // assignedTeam is an array of team member IDs
      const team = mockTeams.find(t => t.id === schedulingData.assignedTo);
      if (team) {
        updates.assignedTeam = getTeamMembers(team.id).map(member => member.id);
      }
    } else {
      // Individual staff assignment - use assignedTeam with single member
      updates.assignedTeam = [schedulingData.assignedTo];
    }

    // Persist the changes to backend
    updateJobMutation.mutate({
      id: jobToSchedule.id,
      updates
    }, {
      onSuccess: () => {
        toast({
          title: "Job Scheduled",
          description: `Job #${jobToSchedule.jobId} has been scheduled for ${format(startDateTime, 'MMM dd, yyyy')} at ${schedulingData.startTime}.`,
        });
        setShowSchedulingModal(false);
        setJobToSchedule(null);
        // Refresh the jobs data
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      },
      onError: () => {
        toast({
          title: "Scheduling Failed",
          description: "Failed to schedule the job. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  if (compact) {
    // Show loading state while fetching jobs
    if (jobsLoading) {
      return (
        <Card data-testid="dispatch-summary-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dispatch Board
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Show error state if jobs failed to load
    if (jobsError) {
      return (
        <Card data-testid="dispatch-summary-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dispatch Board
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground">
              Failed to load jobs. Please try again.
            </div>
          </CardContent>
        </Card>
      );
    }

    const todaysJobs = getTodaysJobs();
    const activeTeams = mockTeams.filter(team => team.status === 'available').length;
    const activeStaff = staffMembers.filter(staff => staff.status === 'available').length;
    const scheduledJobs = todaysJobs.filter(job => job.status === 'scheduled').length;

    return (
      <Card data-testid="dispatch-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dispatch Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {assignmentMode === 'teams' ? (
                  <>
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Active Teams</span>
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Active Staff</span>
                  </>
                )}
              </div>
              <Badge variant="secondary" data-testid={assignmentMode === 'teams' ? 'active-teams' : 'active-staff'}>
                {assignmentMode === 'teams' ? activeTeams : activeStaff}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm">Scheduled Jobs</span>
              </div>
              <Badge variant="outline" data-testid="scheduled-jobs">
                {scheduledJobs}
              </Badge>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Next Jobs</span>
                <span className="text-xs text-muted-foreground" data-testid="dispatch-date">
                  {format(selectedDate, 'MMM dd')}
                </span>
              </div>
              <div className="space-y-2">
                {todaysJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm"
                    data-testid={`next-job-${job.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(job.priority)}`} />
                    <div className="flex-1 truncate">
                      <div className="font-medium">{job.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {job.address || 'No address specified'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              data-testid="open-dispatch-board"
              onClick={() => {
                // Create a custom event to switch to dispatch tab
                const event = new CustomEvent('switchTab', { detail: 'dispatch' });
                window.dispatchEvent(event);
              }}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Open Dispatch Board
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <div className="flex flex-col flex-1 min-h-0">
      {/* Desktop Layout: Calendar on left, Job cards on right */}
      <div className="hidden lg:flex gap-4 flex-1 min-h-0 p-4 overflow-hidden" data-testid="dispatch-desktop-layout">
        {/* Calendar Grid - Left Side (70%) */}
        <div className="w-[70%] h-full" data-testid="calendar-grid-container">
          <Card className="h-full overflow-hidden">
            <CalendarGrid />
          </Card>
        </div>

        {/* Job Cards - Right Side (30%) */}
        <div className="w-[30%] h-full flex flex-col" data-testid="job-cards-container">
          <Card className="overflow-x-hidden flex flex-col flex-1 min-h-0">
            <CardHeader className="flex-shrink-0 border-b pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Jobs</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                    data-testid="prev-day"
                    className="h-7 w-7"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                    data-testid="next-day"
                    className="h-7 w-7"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-0">
              {/* Job Cards */}
              <div className="space-y-0 overflow-x-hidden w-full max-w-full">
                {getTodaysJobs().map((job, index) => {
                const customerName = job.customerName || 'Unknown Customer';
                
                return (
                  <div
                    key={job.id}
                    className="p-2 border-b hover:bg-gray-50 cursor-pointer transition-colors w-full max-w-full overflow-hidden"
                    onClick={() => handleEditJob(job)}
                    data-testid={`desktop-job-card-${job.id}`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Status Avatar Circle with Activity Indicator */}
                      <div className="relative flex-shrink-0">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[18px]"
                          style={{ backgroundColor: getJobStatusColorValue(job) }}
                        >
                          {getStatusInitials(job)}
                        </div>
                        {hasRecentActivity(job) && (
                          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white animate-pulse" 
                               title="Recent activity"
                               data-testid={`activity-indicator-${job.id}`} />
                        )}
                      </div>
                      
                      {/* Job Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-0.5">
                          <div className="flex-1 min-w-0 pr-2">
                            <h3 className="font-semibold text-gray-900 text-sm truncate" data-testid={`desktop-job-customer-${job.id}`}>
                              {customerName}
                            </h3>
                            <div className="text-[11px] text-gray-500 truncate">
                              #{job.jobId || '0000'}
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-600 mb-1 truncate">
                          {job.address || 'No address specified'}
                        </div>

                        
                        {/* Status, Time, and Priority */}
                        <div className="flex items-center gap-2 text-[11px]">
                          {job.startTime && !job.startTime.includes('0000-00-00') && (
                            <span className="text-gray-500">{job.startTime}</span>
                          )}
                          {(() => {
                            if (job.status === 'quote') {
                              return (
                                <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-1.5 py-0">
                                  quote
                                </Badge>
                              );
                            } else if (job.status === 'lead') {
                              return (
                                <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0">
                                  lead
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
                {/* Empty State */}
                {getTodaysJobs().length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No jobs scheduled for this date</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={handleCreateJob}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Job
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Layout: Show job cards in traditional list view */}
      <div className="lg:hidden p-4">
      <Card className="overflow-x-hidden">
        {/* Mobile Header - With Search */}
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Jobs ({getTodaysJobs().length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                data-testid="prev-day-mobile"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                data-testid="today-btn-mobile"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                data-testid="next-day-mobile"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Job Search Field for Mobile */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isDeepSearchActive ? "Deep search results..." : "Search by customer, job #, address..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isDeepSearchActive) {
                    // Normal search - let the regular filtering handle it
                  }
                }}
                className="pl-10 bg-white"
                data-testid="mobile-job-search-input"
              />
              {isDeepSearchActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 px-2"
                  onClick={() => {
                    setIsDeepSearchActive(false);
                    setDeepSearchResults([]);
                    setSearchQuery('');
                  }}
                  data-testid="btn-clear-deep-search-mobile"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {/* Deep Search Button for Mobile */}
            {searchQuery.trim() && !isDeepSearchActive && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => performDeepSearch(searchQuery)}
                data-testid="btn-deep-search-mobile"
              >
                <Search className="h-3 w-3 mr-2" />
                Deep Search All Jobs
              </Button>
            )}
            
            {/* Deep Search Status for Mobile */}
            {isDeepSearchActive && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                <SearchX className="h-3 w-3" />
                Deep search: {deepSearchResults.length} total jobs found
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Mobile Job Cards */}
          <div className="space-y-0">
            {getTodaysJobs().map((job: any) => {
              const customerName = job.customerName || 'Unknown Customer';
              
              return (
                <div
                  key={job.id}
                  className="relative bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleEditJob(job)}
                  data-testid={`job-card-${job.id}`}
                >
                  <div className="flex items-start gap-3 p-3">
                    {/* Status Avatar with Activity Indicator */}
                    <div className="relative flex-shrink-0">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[21px] relative z-10"
                        style={{ backgroundColor: getJobStatusColorValue(job) }}
                      >
                        {getStatusInitials(job)}
                      </div>
                      {hasRecentActivity(job) && (
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white animate-pulse z-20" 
                             title="Recent activity"
                             data-testid={`activity-indicator-${job.id}`} />
                      )}
                    </div>
                    
                    {/* Job Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base mb-1">
                            {customerName}
                          </h3>
                          <div className="text-xs text-gray-600 mb-1 font-semibold">
                            {job.address || 'No address specified'}
                          </div>
                          {job.description && (
                            <div className="text-xs text-gray-500 mb-2 line-clamp-2">
                              {job.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                        {job.startTime && !job.startTime.includes('0000-00-00') && (
                          <span>{job.startTime}</span>
                        )}
                        {job.assignedTo && <span>• {job.assignedTo}</span>}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const statusFormatted = job.status?.charAt(0).toUpperCase() + job.status?.slice(1);
                            if (job.status === 'quote') {
                              return (
                                <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs">
                                  quote
                                </Badge>
                              );
                            } else if (job.status === 'lead') {
                              return (
                                <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs">
                                  lead
                                </Badge>
                              );
                            } else {
                              return (
                                <span className="text-xs text-gray-500">{statusFormatted}</span>
                              );
                            }
                          })()}
                        </div>
                        <span className="text-xs text-gray-500">{job.priority}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty State */}
            {getTodaysJobs().length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No jobs scheduled for this date</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={handleCreateJob}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Job
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>

    {/* Global Job Card Modal */}
    {showGlobalJobCard && (
      <GlobalJobCard
        mode={globalJobCardMode}
        jobId={jobToEdit?.id}
        onClose={() => {
          setShowGlobalJobCard(false);
          setJobToEdit(null);
        }}
      />
    )}
  </>
  );
}

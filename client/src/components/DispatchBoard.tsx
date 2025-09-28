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
  SearchX
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
  role: string; // owner, office_staff, crew
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

// Function to transform Employee data to StaffMember format for dispatch board
const transformEmployeeToStaffMember = (employee: Employee): StaffMember => {
  // Map role-based colors
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-500';
      case 'office_staff': return 'bg-blue-500';
      case 'crew': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

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
    color: getRoleColor(employee.role || 'crew')
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
  '7:00', '8:00', '9:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
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
      .map(transformEmployeeToStaffMember);
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
        prev.endTime || '17:00'
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
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('teams');
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
    queryFn: async () => {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    }
  });

  // Fetch customers for name lookup
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: async () => {
      const response = await fetch('/api/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    }
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

  // Force refresh the cache to get corrected data mapping
  useEffect(() => {
    // Invalidate jobs cache to force refetch with corrected mapping and cleaned descriptions
    queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
  }, []); // Only run once on mount

  // Convert API jobs to DispatchBoard format
  const jobs: JobAssignment[] = (jobsData?.data || []).map((apiJob: any) => {
    // Calculate endTime from scheduledDate + estimatedDuration
    // For jobs without scheduled dates, default to today at 9 AM for dispatch board display
    const startTime = apiJob.scheduledDate || (() => {
      const today = new Date();
      today.setHours(9, 0, 0, 0); // Default to 9 AM today for unscheduled jobs
      return today;
    })();
    const estimatedDuration = apiJob.estimatedDuration || 2; // Default 2 hours
    const endTime = new Date(new Date(startTime).getTime() + (estimatedDuration * 60 * 60 * 1000));

    // Use actual assignedTeam from API, or create assignment from existing teamId/staffId
    const assignedTeam = apiJob.assignedTeam || [];
    
    // Determine teamId and staffId based on assignment mode and existing data
    let teamId = undefined;
    let staffId = undefined;
    
    if (assignedTeam.length > 0) {
      // If we have assignedTeam, derive teamId/staffId based on team membership
      if (assignmentMode === 'teams') {
        // Find which team contains these staff members
        const matchingTeam = mockTeams.find(team => 
          assignedTeam.some((assignedId: string) => team.members.includes(assignedId))
        );
        teamId = matchingTeam?.id;
      } else {
        // Individual mode - use first assigned team member as staffId
        staffId = assignedTeam[0];
      }
    }

    return {
      id: apiJob.id,
      jobId: apiJob.jobNumber,
      customerId: apiJob.customerId,
      customerName: customerMap.get(apiJob.customerId) || (() => {
        // Don't use title if it contains timestamps
        if (apiJob.title && !apiJob.title.includes('2025-') && !apiJob.title.includes('0000-00-00')) {
          return apiJob.title;
        }
        return 'Unknown Customer';
      })(),
      customerPhone: '', // Not available in API response
      address: apiJob.address,
      serviceType: apiJob.serviceType || '',
      description: apiJob.description || '',
      status: apiJob.status,
      priority: apiJob.priority,
      startTime: startTime,
      endTime: endTime.toISOString(),
      estimatedDuration: estimatedDuration,
      notes: apiJob.specialInstructions || apiJob.notes || '',
      assignedTeam: assignedTeam,
      teamId: teamId,
      staffId: staffId,
      specialInstructions: apiJob.specialInstructions
    };
  });

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

  // Get status initials for job circles
  const getStatusInitials = (job: JobAssignment) => {
    // Check service type first for leads and quotes
    const serviceType = job.serviceType?.toLowerCase() || '';
    if (serviceType.includes('lead') || serviceType.includes('inquiry')) return 'L';
    if (serviceType.includes('quote') || serviceType.includes('proposal')) return 'Q';
    
    // Handle actual API status values
    switch (job.status) {
      case 'completed': return 'C';
      case 'unsuccessful': return 'U'; // Unsuccessful
      case 'scheduled': return 'S'; // Scheduled
      case 'work_order': return 'WO'; // Work Order
      case 'quote': return 'Q'; // Quote
      case 'lead': return 'L'; // Lead
      default: return 'WO'; // Default to Work Order
    }
  };

  // Get status color for job circles
  const getJobStatusColor = (job: JobAssignment) => {
    const serviceType = job.serviceType?.toLowerCase() || '';
    if (serviceType.includes('lead') || serviceType.includes('inquiry')) return 'bg-blue-500';
    if (serviceType.includes('quote') || serviceType.includes('proposal')) return 'bg-purple-500';
    
    switch (job.status) {
      case 'completed': return 'bg-green-500';
      case 'unsuccessful': return 'bg-red-500'; // Unsuccessful
      case 'work_order': return 'bg-yellow-500';
      case 'scheduled': return 'bg-orange-500';
      case 'quote': return 'bg-purple-500';
      case 'lead': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  // Get actual color values for inline styles
  const getJobStatusColorValue = (job: JobAssignment) => {
    const serviceType = job.serviceType?.toLowerCase() || '';
    if (serviceType.includes('lead') || serviceType.includes('inquiry')) return '#3b82f6'; // blue-500
    if (serviceType.includes('quote') || serviceType.includes('proposal')) return '#8b5cf6'; // purple-500
    
    // Handle actual API status values
    switch (job.status) {
      case 'completed': return '#10b981'; // green-500
      case 'unsuccessful': return '#ef4444'; // red-500 - Unsuccessful
      case 'work_order': return '#eab308'; // yellow-500
      case 'scheduled': return '#f97316'; // orange-500
      case 'quote': return '#8b5cf6'; // purple-500  
      case 'lead': return '#3b82f6'; // blue-500
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
      return isSameDay(new Date(job.startTime), selectedDate);
    });
  };


  const getJobsForStaff = (staffId: string) => {
    return jobs.filter(job => {
      // Check if staff member is in assigned team or directly assigned
      const isAssigned = job.assignedTeam?.includes(staffId);
      if (!isAssigned && job.staffId !== staffId) return false;
      return isSameDay(new Date(job.startTime), selectedDate);
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

    return jobs
      .filter(job => {
        // For "All Jobs" filter, show jobs from different dates to ensure all jobs are visible
        const jobDate = new Date(job.startTime);
        const isValidDate = !isNaN(jobDate.getTime());
        
        // If job filter is 'all', be more inclusive with dates
        if (jobFilter === 'all') {
          // Show jobs for today, plus any jobs without valid dates or with recent dates
          const isToday = isValidDate && isSameDay(jobDate, selectedDate);
          const isRecent = isValidDate && Math.abs(jobDate.getTime() - selectedDate.getTime()) <= 7 * 24 * 60 * 60 * 1000; // Within 7 days
          if (!isToday && !isRecent && isValidDate) return false;
        } else {
          // For other filters, stick to the selected date
          const isToday = isValidDate && isSameDay(jobDate, selectedDate);
          if (!isToday && isValidDate) return false;
        }
        
        // Apply job filter based on selected filter option
        switch (jobFilter) {
          case 'all':
            // Show active jobs (exclude only completed and cancelled), be more inclusive
            return job.status !== 'completed' && job.status !== 'cancelled';
            
          case 'action_required':
            // Jobs that need scheduling, assignment, or other action
            return !job.assignedTeam?.length || job.status === 'scheduled' && !job.teamId && !job.staffId;
            
          case 'for_review':
            // Jobs that need review (high priority or specific conditions)
            return job.priority === 'urgent' || job.priority === 'high';
            
          case 'leads':
            // Jobs that are potential customers/inquiries (status = lead OR low priority OR specific service type)
            return job.status === 'lead' || job.priority === 'low' || job.serviceType?.toLowerCase().includes('lead') || job.serviceType?.toLowerCase().includes('inquiry');
            
          case 'quotes':
            // Jobs with Quote in service type
            return job.serviceType?.toLowerCase().includes('quote') || false;
            
          case 'work_orders':
            // Jobs that are confirmed work orders (scheduled/work_order status, not quotes/leads)
            return (job.status === 'scheduled' || job.status === 'work_order') && job.status !== 'lead' && !job.serviceType?.toLowerCase().includes('quote') && !job.serviceType?.toLowerCase().includes('lead');
            
          case 'unscheduled':
            // Jobs without proper scheduling or assignment
            const jobDate = new Date(job.startTime);
            const isDefaultTime = jobDate.getHours() === 9 && jobDate.getMinutes() === 0; // Default 9 AM
            return isDefaultTime || (!job.assignedTeam?.length && !job.teamId && !job.staffId);
            
          case 'in_progress':
            // Jobs currently in progress
            return job.status === 'in_progress' || job.status === 'scheduled';
            
          case 'completed':
            // Recently completed or unsuccessful jobs
            return job.status === 'completed' || job.status === 'cancelled';
            
          default:
            return true;
        }
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
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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
    setSchedulingData({
      date: format(new Date(job.startTime), 'yyyy-MM-dd'),
      startTime: format(new Date(job.startTime), 'HH:mm'),
      endTime: format(new Date(job.endTime), 'HH:mm'),
      assignedTo: job.teamId || job.staffId || '',
      notes: job.notes || ''
    });
    setShowSchedulingModal(true);
    setSelectedJob(null); // Close job detail modal
  };

  const handleEditJob = (job: JobAssignment) => {
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

    // Create new start and end times
    const startDateTime = new Date(`${schedulingData.date}T${schedulingData.startTime}`);
    const endDateTime = new Date(`${schedulingData.date}T${schedulingData.endTime}`);

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dispatch Board
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Mobile Jobs Button - Only visible on mobile when Jobs Panel is hidden */}
              <Button
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => {
                  const jobsPanel = document.getElementById('mobile-jobs-panel');
                  if (jobsPanel) {
                    jobsPanel.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                data-testid="mobile-jobs-btn"
              >
                <List className="h-4 w-4 mr-1" />
                Jobs ({getTodaysJobs().length})
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                data-testid="prev-day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium px-4" data-testid="current-date">
                {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                data-testid="next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                data-testid="today-btn"
              >
                Today
              </Button>
              <Select value={assignmentMode} onValueChange={(value: AssignmentMode) => setAssignmentMode(value)}>
                <SelectTrigger className="w-[160px]" data-testid="assignment-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teams" data-testid="teams-mode">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Teams
                    </div>
                  </SelectItem>
                  <SelectItem value="individual" data-testid="individual-mode">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Individual Staff
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  data-testid="grid-view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  data-testid="list-view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex gap-4 h-[700px]">
            {/* Team/Staff Column */}
            <div className="w-36 border-r pr-4 hidden md:block">
              <h3 className="font-semibold mb-4 text-sm text-muted-foreground">
                {assignmentMode === 'teams' ? 'TEAMS' : 'STAFF'}
              </h3>
              <div className="space-y-2">
                {assignmentMode === 'teams' ? (
                  // Teams Mode - Section Removed
                  null
                ) : (
                  // Individual Staff Mode
                  staffMembers.map((staff: StaffMember) => {
                    const staffJobs = getJobsForStaff(staff.id);
                    return (
                      <div
                        key={staff.id}
                        className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                        data-testid={`staff-${staff.id}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={`${staff.color} text-white text-xs`}>
                            {staff.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{staff.name.split(' ')[0]}</div>
                          <div className="text-xs text-muted-foreground">
                            {staff.role} • {staffJobs.length} jobs
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${getStatusColor(staff.status)}`}
                        >
                          {staff.status}
                        </Badge>
                      </div>
                    );
                  })
                )}
                
              </div>
            </div>

            {/* Time Grid */}
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Time Headers */}
                <div className="grid grid-cols-12 gap-1 mb-2 bg-white">
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      className="text-center text-xs font-medium text-gray-600 p-2 border-b border-gray-200 min-w-0"
                      data-testid={`time-slot-${time}`}
                    >
                      {time}
                    </div>
                  ))}
                </div>

                {/* Team/Staff Rows */}
                <div className="space-y-1">
                  {assignmentMode === 'teams' ? (
                    // Teams Mode
                    mockTeams.map((team) => {
                      const teamJobs = getJobsForTeam(team.id);
                      return (
                        <div key={team.id} className="relative h-11" data-testid={`team-row-${team.id}`}>
                          {/* Time Grid Background */}
                          <div className="grid grid-cols-12 gap-1 h-full absolute inset-0 z-0">
                            {timeSlots.map((time) => (
                              <div
                                key={`${team.id}-${time}`}
                                className="border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                                data-testid={`time-cell-${team.id}-${time}`}
                              />
                            ))}
                          </div>
                          
                          {/* Job Blocks */}
                          <div className="relative h-full z-10">
                            {teamJobs.map((job) => {
                              const jobStart = new Date(job.startTime);
                              const jobEnd = new Date(job.endTime);
                              const dayStart = new Date(selectedDate);
                              dayStart.setHours(7, 0, 0, 0); // 7:00 AM start
                              
                              const startHour = jobStart.getHours();
                              const startMinutes = jobStart.getMinutes();
                              const endHour = jobEnd.getHours();
                              const endMinutes = jobEnd.getMinutes();
                              
                              // Calculate position and width as percentage of the 12-hour grid (7 AM to 7 PM)
                              const totalMinutes = 12 * 60; // 7 AM to 7 PM = 12 hours = 720 minutes
                              const jobStartMinutes = (startHour - 7) * 60 + startMinutes;
                              const jobEndMinutes = (endHour - 7) * 60 + endMinutes;
                              
                              const leftPercent = Math.max(0, (jobStartMinutes / totalMinutes) * 100);
                              const widthPercent = Math.min(100 - leftPercent, ((jobEndMinutes - jobStartMinutes) / totalMinutes) * 100);
                              
                              return (
                                <div
                                  key={job.id}
                                  className={`absolute ${getPriorityColor(job.priority)} text-white rounded text-xs px-1 py-0.5 cursor-pointer hover:opacity-80 transition-opacity top-0.5 bottom-0.5`}
                                  onClick={() => handleEditJob(job)}
                                  data-testid={`job-block-${job.id}`}
                                  style={{
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    minWidth: '60px'
                                  }}
                                >
                                  <div className="font-medium truncate text-[8px]">
                                    {job.customerName}
                                  </div>
                                  <div className="truncate text-[7px] opacity-90">
                                    {job.serviceType}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Individual Staff Mode
                    staffMembers.map((staff: StaffMember) => {
                      const staffJobs = getJobsForStaff(staff.id);
                      return (
                        <div key={staff.id} className="relative h-11" data-testid={`staff-row-${staff.id}`}>
                          {/* Time Grid Background */}
                          <div className="grid grid-cols-12 gap-1 h-full absolute inset-0 z-0">
                            {timeSlots.map((time) => (
                              <div
                                key={`${staff.id}-${time}`}
                                className="border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                                data-testid={`time-cell-${staff.id}-${time}`}
                              />
                            ))}
                          </div>
                          
                          {/* Job Blocks */}
                          <div className="relative h-full z-10">
                            {staffJobs.map((job) => {
                              const jobStart = new Date(job.startTime);
                              const jobEnd = new Date(job.endTime);
                              const dayStart = new Date(selectedDate);
                              dayStart.setHours(7, 0, 0, 0); // 7:00 AM start
                              
                              const startHour = jobStart.getHours();
                              const startMinutes = jobStart.getMinutes();
                              const endHour = jobEnd.getHours();
                              const endMinutes = jobEnd.getMinutes();
                              
                              // Calculate position and width as percentage of the 12-hour grid (7 AM to 7 PM)
                              const totalMinutes = 12 * 60; // 7 AM to 7 PM = 12 hours = 720 minutes
                              const jobStartMinutes = (startHour - 7) * 60 + startMinutes;
                              const jobEndMinutes = (endHour - 7) * 60 + endMinutes;
                              
                              const leftPercent = Math.max(0, (jobStartMinutes / totalMinutes) * 100);
                              const widthPercent = Math.min(100 - leftPercent, ((jobEndMinutes - jobStartMinutes) / totalMinutes) * 100);
                              
                              return (
                                <div
                                  key={job.id}
                                  className={`absolute ${getPriorityColor(job.priority)} text-white rounded text-xs px-1 py-0.5 cursor-pointer hover:opacity-80 transition-opacity top-0.5 bottom-0.5`}
                                  onClick={() => handleEditJob(job)}
                                  data-testid={`job-block-${job.id}`}
                                  style={{
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    minWidth: '60px'
                                  }}
                                >
                                  <div className="font-medium truncate text-[8px]">
                                    {job.customerName}
                                  </div>
                                  <div className="truncate text-[7px] opacity-90">
                                    {job.serviceType}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ServiceM8 Style Jobs Panel */}
            <div className="w-80 bg-gray-50 border-l flex flex-col h-[700px] hidden md:block">
              {/* ServiceM8 Header */}
              <div className="p-4 space-y-3 flex-shrink-0">
                {/* ServiceM8 Style Filter Dropdown */}
                <Select value={jobFilter} onValueChange={setJobFilter}>
                  <SelectTrigger className="w-full bg-white" data-testid="servicem8-job-filter-select">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const selectedFilter = jobFilterOptions.find(f => f.value === jobFilter);
                          const IconComponent = selectedFilter?.icon || List;
                          return (
                            <>
                              <IconComponent className="h-4 w-4" />
                              <span>{selectedFilter?.label || 'All Jobs'}</span>
                            </>
                          );
                        })()}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {jobFilterOptions.map((option) => {
                      const IconComponent = option.icon;
                      const filteredCount = jobs.filter(job => {
                        const isToday = isSameDay(new Date(job.startTime), selectedDate);
                        if (!isToday) return false;
                        
                        switch (option.value) {
                          case 'all': return true;
                          case 'action_required': return !job.assignedTeam?.length || job.status === 'scheduled' && !job.teamId && !job.staffId;
                          case 'for_review': return job.priority === 'urgent' || job.priority === 'high';
                          case 'leads': return job.priority === 'low' || job.serviceType?.toLowerCase().includes('lead') || job.serviceType?.toLowerCase().includes('inquiry') || false;
                          case 'quotes': return job.serviceType?.toLowerCase().includes('quote') || false;
                          case 'work_orders': return (job.status === 'scheduled' || job.status === 'in_progress') && !job.serviceType?.toLowerCase().includes('quote') && !job.serviceType?.toLowerCase().includes('lead');
                          case 'unscheduled':
                            const jobDate = new Date(job.startTime);
                            const isDefaultTime = jobDate.getHours() === 9 && jobDate.getMinutes() === 0;
                            return isDefaultTime || (!job.assignedTeam?.length && !job.teamId && !job.staffId);
                          case 'in_progress': return job.status === 'in_progress' || job.status === 'scheduled';
                          case 'completed': return job.status === 'completed' || job.status === 'cancelled';
                          default: return true;
                        }
                      }).length;
                      
                      return (
                        <SelectItem key={option.value} value={option.value} data-testid={`filter-option-${option.value}`}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
                            {filteredCount > 0 && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {filteredCount}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                {/* Job Search Field */}
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
                      data-testid="job-search-input"
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
                        data-testid="btn-clear-deep-search"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Deep Search Button */}
                  {searchQuery.trim() && !isDeepSearchActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => performDeepSearch(searchQuery)}
                      data-testid="btn-deep-search"
                    >
                      <Search className="h-3 w-3 mr-2" />
                      Deep Search All Jobs
                    </Button>
                  )}
                  
                  {/* Deep Search Status */}
                  {isDeepSearchActive && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      <SearchX className="h-3 w-3" />
                      Deep search: {deepSearchResults.length} total jobs found
                    </div>
                  )}
                </div>
              </div>

              {/* ServiceM8 Style Job List */}
              <div className="flex-1 overflow-y-scroll" style={{ maxHeight: '500px' }}>
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-14 top-0 bottom-0 w-px bg-blue-200 z-0" />
                  
                  <div className="space-y-0">
                    {getTodaysJobs().map((job, index) => {
                      // Get customer from the jobs data or create a display name
                      const customerName = job.customerName || 'Unknown Customer';
                      
                      return (
                        <div
                          key={job.id}
                          className="relative bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleEditJob(job)}
                          data-testid={`servicem8-job-card-${job.id}`}
                        >
                          {/* Connection Line Dot */}
                          <div className="absolute left-14 top-6 w-2 h-2 bg-blue-400 rounded-full border-2 border-white z-10" />
                          
                          <div className="flex items-start gap-3 p-3 pl-6">
                            {/* Status Avatar */}
                            <div 
                              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm relative z-10"
                              style={{ backgroundColor: getJobStatusColorValue(job) }}
                            >
                              {getStatusInitials(job)}
                            </div>
                            
                            {/* Job Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <div>
                                  <h3 className="font-semibold text-gray-900 text-sm mb-1" data-testid={`servicem8-job-customer-${job.id}`}>
                                    {customerName}
                                  </h3>
                                  <div className="text-xs text-gray-600 mb-1">
                                    {job.address || 'No address specified'}
                                  </div>
                                  {/* Job date info */}
                                  <div className="text-xs text-gray-500">
                                    {job.startTime ? format(new Date(job.startTime), 'MMM dd, yyyy') : format(selectedDate, 'MMM dd, yyyy')}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-xs font-medium text-gray-500 mb-1" data-testid={`servicem8-job-number-${job.id}`}>
                                    #{job.jobId || '0000'}
                                  </div>
                                  {/* Status Indicator */}
                                  <div className="flex items-center justify-end gap-1">
                                    {job.status === 'completed' && (
                                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    )}
                                    {job.status === 'in_progress' && (
                                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                    )}
                                    {job.status === 'scheduled' && (
                                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                    )}
                                    {job.priority === 'urgent' && (
                                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Job Description */}
                              <div className="text-xs text-gray-700 leading-relaxed" data-testid={`servicem8-job-description-${job.id}`}>
                                {(() => {
                                  // Try job.description first (API field), then job.notes (fallback)
                                  const rawDescription = job.description || job.notes;
                                  
                                  // Handle null/empty descriptions
                                  if (!rawDescription || rawDescription === null || rawDescription.trim() === '') {
                                    // For quote/lead jobs, provide contextual message
                                    if (job.status === 'lead') {
                                      return 'New lead - details pending';
                                    }
                                    if (job.status === 'quote' || job.status === 'quoted') {
                                      return 'Quote request - description to be added';
                                    }
                                    return job.serviceType || 'Description to be added';
                                  }
                                  
                                  // Filter out placeholder dates
                                  if (rawDescription === '0000-00-00 00:00:00' || rawDescription.includes('0000-00-00')) {
                                    return job.serviceType || 'Description to be added';
                                  }
                                  
                                  // Truncate long descriptions
                                  const description = rawDescription.length > 120 
                                    ? `${rawDescription.substring(0, 120)}...`
                                    : rawDescription;
                                  
                                  return description;
                                })()
                                }
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
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Jobs Panel - Only visible on mobile */}
      <Card className="md:hidden" id="mobile-jobs-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Today's Jobs ({getTodaysJobs().length})
          </CardTitle>
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
        <CardContent className="max-h-96 overflow-y-auto">
          <div className="space-y-3">
            {getTodaysJobs().map((job, index) => {
              const customerName = job.customerName || 'Unknown Customer';
              
              return (
                <div
                  key={job.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleEditJob(job)}
                  data-testid={`mobile-job-card-${job.id}`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    {/* Status Avatar Circle */}
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ backgroundColor: getJobStatusColorValue(job) }}
                    >
                      {getStatusInitials(job)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-gray-900 text-sm" data-testid={`mobile-job-customer-${job.id}`}>
                          {customerName}
                        </h3>
                        <div className="text-xs font-medium text-gray-500" data-testid={`mobile-job-number-${job.id}`}>
                          #{job.jobId || '0000'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  
                  <div className="ml-13"> {/* Align with content next to avatar */}
                    <div className="text-xs text-gray-600 mb-2">
                      {job.address || 'No address specified'}
                    </div>
                    
                    <div className="text-xs text-gray-700 leading-relaxed mb-3" data-testid={`mobile-job-description-${job.id}`}>
                      {(() => {
                        const rawDescription = job.description || job.notes;
                        
                        if (!rawDescription || rawDescription === null || rawDescription.trim() === '') {
                          if (job.status === 'lead') {
                            return 'New lead - details pending';
                          }
                          if (job.status === 'quote' || job.status === 'quoted') {
                            return 'Quote request - description to be added';
                          }
                          return job.serviceType || 'Description to be added';
                        }
                        
                        if (rawDescription === '0000-00-00 00:00:00' || rawDescription.includes('0000-00-00')) {
                          return job.serviceType || 'Description to be added';
                        }
                        
                        const description = rawDescription.length > 100 
                          ? `${rawDescription.substring(0, 100)}...`
                          : rawDescription;
                        
                        return description;
                      })()}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 capitalize">{job.status}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {job.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Empty State for Mobile */}
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


      {/* Global Job Card */}
      <GlobalJobCard 
        isOpen={showGlobalJobCard}
        mode={globalJobCardMode}
        jobId={jobToEdit?.id || undefined}
        customerId={jobToEdit?.customerId}
        onClose={() => {
          setShowGlobalJobCard(false);
          setJobToEdit(null);
          setGlobalJobCardMode('create');
        }}
        onJobCreated={(job) => {
          // Refresh jobs data after creation/update
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          toast({
            title: globalJobCardMode === 'edit' ? "Job Updated" : "Job Created",
            description: `${job.title} has been ${globalJobCardMode === 'edit' ? 'updated' : 'added to'} the dispatch board.`,
          });
        }}
        onJobUpdated={(job) => {
          // Refresh jobs data after update
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          toast({
            title: "Job Updated",
            description: `${job.title} has been updated successfully.`,
          });
        }}
      />

      {/* Job Creation Modal */}
      {showJobCreationModal && (
        <Dialog open={showJobCreationModal} onOpenChange={setShowJobCreationModal}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Create New Job
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Template Selection */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Job Template (Optional)</h4>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Select Template to Auto-Fill Details
                  </label>
                  <Select 
                    value={selectedTemplate} 
                    onValueChange={handleTemplateSelection}
                  >
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Choose a job template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4" />
                          No Template
                        </div>
                      </SelectItem>
                      {templates.map((template: JobTemplate) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{template.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {template.category} • {template.estimatedDuration}h • ${template.basePrice}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-md">
                      <div className="text-xs text-blue-700">
                        ✓ Template applied! You can still modify any field below.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Information */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Customer Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="Enter customer name"
                      value={newJobFormData.customerName}
                      onChange={(e) => setNewJobFormData(prev => ({ ...prev, customerName: e.target.value }))}
                      data-testid="input-customer-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="(555) 123-4567"
                      value={newJobFormData.customerPhone}
                      onChange={(e) => setNewJobFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                      data-testid="input-customer-phone"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Service Address *
                    </label>
                    <AddressAutocomplete
                      value={newJobFormData.address}
                      onChange={(value) => setNewJobFormData(prev => ({ ...prev, address: value }))}
                      placeholder="123 Main St, City"
                      mode="full"
                      className="text-sm"
                      data-testid="input-address"
                    />
                  </div>
                </div>
              </div>

              {/* Job Details */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Job Details</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Service Type *
                    </label>
                    <Select 
                      value={newJobFormData.serviceType} 
                      onValueChange={(value) => setNewJobFormData(prev => ({ ...prev, serviceType: value }))}
                    >
                      <SelectTrigger data-testid="select-service-type">
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tree Removal">Tree Removal</SelectItem>
                        <SelectItem value="Tree Pruning">Tree Pruning</SelectItem>
                        <SelectItem value="Emergency Removal">Emergency Removal</SelectItem>
                        <SelectItem value="Stump Grinding">Stump Grinding</SelectItem>
                        <SelectItem value="Equipment Setup">Equipment Setup</SelectItem>
                        <SelectItem value="Quote">Site Quote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        value={newJobFormData.startTime}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        data-testid="input-start-time"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        End Time *
                      </label>
                      <input
                        type="time"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        value={newJobFormData.endTime}
                        onChange={(e) => setNewJobFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        data-testid="input-end-time"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Priority
                    </label>
                    <Select 
                      value={newJobFormData.priority} 
                      onValueChange={(value: JobAssignment['priority']) => setNewJobFormData(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Low
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            Medium
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            High
                          </div>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            Urgent
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Assignment */}
              <div>
                <h4 className="font-semibold text-sm mb-3">
                  {assignmentMode === 'teams' ? 'Team Assignment' : 'Staff Assignment'}
                </h4>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {assignmentMode === 'teams' ? 'Assign to Team' : 'Assign to Staff'}
                  </label>
                  <Select 
                    value={newJobFormData.assignedTo} 
                    onValueChange={(value) => setNewJobFormData(prev => ({ ...prev, assignedTo: value }))}
                  >
                    <SelectTrigger data-testid="select-assignment">
                      <SelectValue placeholder={`Select ${assignmentMode === 'teams' ? 'team' : 'staff member'}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignmentMode === 'teams' ? (
                        mockTeams.map(team => (
                          <SelectItem key={team.id} value={team.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${team.color}`} />
                              {team.name}
                              <Badge variant="outline" className="text-xs ml-2">
                                {getTeamMembers(team.id).length} members
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        staffMembers.map((staff: StaffMember) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className={`${staff.color} text-white text-xs`}>
                                  {staff.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              {staff.name}
                              <span className="text-xs text-muted-foreground ml-2">
                                {staff.role}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Notes (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm resize-none"
                  rows={3}
                  placeholder="Add any special instructions or notes..."
                  value={newJobFormData.notes}
                  onChange={(e) => setNewJobFormData(prev => ({ ...prev, notes: e.target.value }))}
                  data-testid="textarea-notes"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
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
                  }}
                  data-testid="btn-cancel-job"
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={createNewJob}
                  disabled={!newJobFormData.customerName || !newJobFormData.customerPhone || !newJobFormData.address || !newJobFormData.serviceType || !newJobFormData.startTime || !newJobFormData.endTime || !newJobFormData.assignedTo}
                  data-testid="btn-create-job"
                >
                  Create Job
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Job Scheduling Modal */}
      {showSchedulingModal && jobToSchedule && (
        <Dialog open={showSchedulingModal} onOpenChange={setShowSchedulingModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Schedule Job #{jobToSchedule.jobId}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Job Info */}
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(jobToSchedule.priority)}`} />
                  <span className="font-medium">{jobToSchedule.customerName}</span>
                </div>
                <p className="text-sm text-muted-foreground">{jobToSchedule.serviceType}</p>
                <p className="text-xs text-muted-foreground">{jobToSchedule.address}</p>
              </div>

              {/* Scheduling Form */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="schedule-date">Date</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={schedulingData.date}
                    onChange={(e) => setSchedulingData(prev => ({ ...prev, date: e.target.value }))}
                    data-testid="input-schedule-date"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="schedule-start-time">Start Time</Label>
                    <Input
                      id="schedule-start-time"
                      type="time"
                      value={schedulingData.startTime}
                      onChange={(e) => setSchedulingData(prev => ({ ...prev, startTime: e.target.value }))}
                      data-testid="input-schedule-start-time"
                    />
                  </div>
                  <div>
                    <Label htmlFor="schedule-end-time">End Time</Label>
                    <Input
                      id="schedule-end-time"
                      type="time"
                      value={schedulingData.endTime}
                      onChange={(e) => setSchedulingData(prev => ({ ...prev, endTime: e.target.value }))}
                      data-testid="input-schedule-end-time"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="schedule-assignment">
                    {assignmentMode === 'teams' ? 'Assign to Team' : 'Assign to Staff'}
                  </Label>
                  <Select 
                    value={schedulingData.assignedTo} 
                    onValueChange={(value) => setSchedulingData(prev => ({ ...prev, assignedTo: value }))}
                  >
                    <SelectTrigger data-testid="select-schedule-assignment">
                      <SelectValue placeholder={`Select ${assignmentMode === 'teams' ? 'team' : 'staff member'}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignmentMode === 'teams' ? (
                        mockTeams.map(team => (
                          <SelectItem key={team.id} value={team.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${team.color}`} />
                              {team.name}
                              <Badge variant="outline" className="text-xs ml-2">
                                {getTeamMembers(team.id).length} members
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        staffMembers.map((staff: StaffMember) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className={`${staff.color} text-white text-xs`}>
                                  {staff.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              {staff.name}
                              <span className="text-xs text-muted-foreground ml-2">
                                {staff.role}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="schedule-notes">Notes (Optional)</Label>
                  <Textarea
                    id="schedule-notes"
                    placeholder="Add any scheduling notes..."
                    value={schedulingData.notes}
                    onChange={(e) => setSchedulingData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    data-testid="textarea-schedule-notes"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowSchedulingModal(false);
                    setJobToSchedule(null);
                  }}
                  data-testid="btn-cancel-schedule"
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={saveSchedule}
                  disabled={!schedulingData.date || !schedulingData.startTime || !schedulingData.endTime || !schedulingData.assignedTo || updateJobMutation.isPending}
                  data-testid="btn-save-schedule"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  {updateJobMutation.isPending ? 'Scheduling...' : 'Schedule Job'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
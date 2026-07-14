import { useJobFilters, useLaneFilter, useDispatchSearchOpen, useOnlyUnconfirmed } from "@/lib/dispatchHeaderStore";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
  Clipboard,
  TreePine,
  Scissors,
  Axe,
  Sprout,
  Loader2,
  Inbox,
  ChevronDown,
  UserPlus,
  Bell,
  UserCog,
  CircleDollarSign,
  Wrench,
  CalendarCheck,
  CalendarX,
  Reply,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  addHours,
  isSameDay,
  parseISO,
  isWithinInterval,
  addMinutes,
} from "date-fns";
import {
  nzTimeToUTC,
  utcToNZTime,
  getJobScheduledNZDates,
  getNZDateString,
  hasUpcomingBookingNZ,
} from "@shared/dateUtils";
import { statusAfterBooking } from "@shared/jobStatus";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { JobTemplate } from "@shared/schema";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import { requestDiaryHighlight } from "@/components/JobDiarySection";
import { JobCardErrorBoundary } from "@/components/JobCardErrorBoundary";
import { CustomerAvatar } from "@/components/CustomerAvatar";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { CreateLeadFromMessageDialog } from "@/components/CreateLeadFromMessageDialog";
import {
  QuickAssignDialog,
  type QuickAssignResult,
} from "@/components/QuickAssignDialog";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
}
import { GrossMarginCalculator } from "@/components/GrossMarginCalculator";
import { StaffTimeTracker } from "@/components/StaffTimeTracker";
import { CalendarGrid } from "@/components/CalendarGrid";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  status: "available" | "busy" | "offline";
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
  status: "available" | "busy" | "offline";
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
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  notes?: string;
  specialInstructions?: string; // Added for compatibility with GlobalJobCard
  lastActivityAt?: string; // For activity-based sorting
  workOrderAt?: string; // Timestamp stamped once when the job first became a work order — used for FIFO sorting on the Work Order tab
  createdAt?: string; // Immutable job-creation timestamp — fallback for FIFO sorting when workOrderAt is NULL (legacy jobs)
  totalAmount?: string; // Job price for display on dispatch board (exc-GST normalised)
  subtotal?: string; // Exc-GST subtotal from job record (preferred price source)
  scheduledDate?: string; // The job's scheduled start date from the API. Used by the "Scheduled" filter post-2026-05 ('scheduled' status retired — date presence is the new signal).
  scheduledEndDate?: string; // For multi-day jobs (last day)
  scheduledDates?: string[] | null; // Explicit NZ day set for multi-day jobs that skip days (e.g. weekends)
  inQueue?: boolean; // Whether job is parked in the dispatch queue
  queueReason?: string | null; // Reason for being in queue
  laneId?: string | null; // Custom lane the job sits in (orthogonal to status)
  customerConfirmed?: boolean; // Whether the customer has confirmed the booking
  confirmationReplySentAt?: string | null; // Timestamp of our acknowledgement reply to the customer's confirmation
  customerReplyReceivedAt?: string | null; // Timestamp of most-recent inbound customer reply (any email/SMS reply tagged customer-reply)
  etaNotificationRequested?: boolean; // Whether staff need to notify this customer of arrival time
}

type AssignmentMode = "teams" | "individual";

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
  "bg-emerald-500", // Green
  "bg-blue-500", // Blue
  "bg-purple-500", // Purple
  "bg-orange-500", // Orange
  "bg-teal-500", // Teal
  "bg-pink-500", // Pink
  "bg-indigo-500", // Indigo
  "bg-rose-500", // Rose
  "bg-yellow-500", // Yellow
  "bg-amber-500", // Amber
  "bg-violet-500", // Violet
  "bg-lime-500", // Lime
];

// Format currency in NZD
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Staff accent palette — same order used in StaffSchedule Gantt view
const STAFF_PALETTE = [
  { dot: '#3b82f6' }, // blue
  { dot: '#10b981' }, // emerald
  { dot: '#f97316' }, // orange
  { dot: '#a855f7' }, // purple
  { dot: '#ec4899' }, // pink
  { dot: '#eab308' }, // yellow
  { dot: '#14b8a6' }, // teal
  { dot: '#ef4444' }, // red
];

function crewInitials(firstName?: string, lastName?: string) {
  return `${(firstName ?? '')[0] ?? ''}${(lastName ?? '')[0] ?? ''}`.toUpperCase() || '?';
}

// Calculate total price from job data
const calculateJobTotal = (job: any): number => {
  // Always use subtotal (exc GST) - never show inc GST prices
  if (job.subtotal && Number(job.subtotal) > 0) {
    return Number(job.subtotal);
  }
  // Fallback: if totalAmount exists but subtotal doesn't, derive exc GST
  if (job.totalAmount && Number(job.totalAmount) > 0) {
    // If totalAmount equals totalIncludingGst, it's inc GST - convert back
    if (
      job.totalIncludingGst &&
      Number(job.totalAmount) === Number(job.totalIncludingGst)
    ) {
      return Math.round((Number(job.totalAmount) / 1.15) * 100) / 100;
    }
    return Number(job.totalAmount);
  }
  // Fallback to calculating from line items
  const lineItems = job.lineItems;
  if (!lineItems || !Array.isArray(lineItems)) return 0;
  return lineItems.reduce((sum: number, item: any) => {
    const total =
      typeof item.total === "number"
        ? item.total
        : parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0);
    return sum + total;
  }, 0);
};

// For multi-day jobs, return the per-day share of the total price.
// Uses startOfDay (browser-local / NZ time) so the day count is calendar-accurate.
const calculateDailyTotal = (job: any): number => {
  const total = calculateJobTotal(job);
  if (!total || !job.scheduledDate || !job.scheduledEndDate) return total;
  // Divide by the actual day count — honours a non-contiguous scheduledDates set
  // so a Wed–Mon-minus-weekend job splits across the days it really runs.
  const numDays = Math.max(1, getJobScheduledNZDates(job).length);
  return numDays > 1 ? Math.round((total / numDays) * 100) / 100 : total;
};

// Function to transform Employee data to StaffMember format for dispatch board
const transformEmployeeToStaffMember = (
  employee: Employee,
  index: number,
): StaffMember => {
  // Assign unique color to each staff member
  const color = staffColorPalette[index % staffColorPalette.length];

  // Map status from employee to dispatch format
  const getDispatchStatus = (
    status: string,
  ): "available" | "busy" | "offline" => {
    switch (status) {
      case "active":
        return "available";
      case "inactive":
        return "offline";
      case "on_leave":
        return "offline";
      default:
        return "available";
    }
  };

  return {
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    role: employee.position || "crew",
    skills: employee.skills || [],
    status: getDispatchStatus(employee.status),
    color: color,
  };
};

// Real employee IDs from API for proper dispatch integration
const JAKE_ID = "3e147247-e94d-4f2f-8425-91a13826de93";
const MARIA_ID = "8ec7a4c0-393c-4b00-964b-2fa596974eaf";
const TOM_ID = "d5a24642-8d11-47ae-acd6-7ae466a78992"; // Tom Bradley ID from API

const mockTeams: Team[] = [
  {
    id: "team1",
    name: "Alpha Crew",
    description: "Emergency response and hazardous removals",
    teamLeaderId: JAKE_ID,
    members: [JAKE_ID, MARIA_ID],
    specialties: ["Crane Operation", "Hazardous Removal", "Emergency Response"],
    maxCapacity: 3,
    status: "busy",
    color: "bg-red-500",
  },
  {
    id: "team2",
    name: "Beta Crew",
    description: "General tree services and maintenance",
    teamLeaderId: TOM_ID,
    members: [TOM_ID],
    specialties: ["Tree Pruning", "Cleanup", "Customer Service"],
    maxCapacity: 4,
    status: "available",
    color: "bg-green-500",
  },
  {
    id: "team3",
    name: "Equipment Team",
    description: "Heavy machinery and specialized equipment jobs",
    teamLeaderId: JAKE_ID,
    members: [JAKE_ID],
    specialties: ["Heavy Machinery", "Equipment Operation", "Maintenance"],
    maxCapacity: 2,
    status: "available",
    color: "bg-purple-500",
  },
];

const mockJobAssignments: JobAssignment[] = [
  {
    id: "1",
    jobId: "J001",
    teamId: "team1",
    assignedTeam: [JAKE_ID, MARIA_ID],
    customerName: "Stephanie Syre",
    customerPhone: "(555) 123-4567",
    address: "123 Norfolk Pine Ave",
    serviceType: "Tree Removal",
    startTime: "2024-12-20T09:00:00",
    endTime: "2024-12-20T12:00:00",
    duration: 3,
    status: "scheduled",
    priority: "high",
    notes: "Large oak near power lines",
  },
  {
    id: "2",
    jobId: "J002",
    teamId: "team1",
    assignedTeam: [JAKE_ID, MARIA_ID],
    customerName: "Dave Tarry",
    customerPhone: "(555) 234-5678",
    address: "33 Wellington St, Gisborne",
    serviceType: "Emergency Removal",
    startTime: "2024-12-20T07:30:00",
    endTime: "2024-12-20T10:30:00",
    duration: 3,
    status: "in_progress",
    priority: "urgent",
  },
  {
    id: "3",
    jobId: "J003",
    staffId: TOM_ID, // Individual assignment - Tom Bradley
    assignedTeam: [TOM_ID],
    customerName: "Johnson, Sarah",
    customerPhone: "(555) 345-6789",
    address: "456 Elm Street",
    serviceType: "Tree Pruning",
    startTime: "2024-12-20T13:00:00",
    endTime: "2024-12-20T15:00:00",
    duration: 2,
    status: "scheduled",
    priority: "medium",
    notes: "Quote for removing large oak tree",
  },
  {
    id: "4",
    jobId: "J004",
    staffId: JAKE_ID, // Individual assignment - Jake Morrison
    assignedTeam: [JAKE_ID],
    customerName: "Gray, Alex",
    customerPhone: "(555) 456-7890",
    address: "789 Pine Avenue",
    serviceType: "Equipment Setup",
    startTime: "2024-12-20T15:45:00",
    endTime: "2024-12-20T16:15:00",
    duration: 0.5,
    status: "scheduled",
    priority: "low",
    notes: "Heavy equipment positioning",
  },
  {
    id: "5",
    jobId: "J005",
    staffId: MARIA_ID, // Individual assignment - Maria Silva
    assignedTeam: [MARIA_ID],
    customerName: "Baty, Katrina",
    customerPhone: "(555) 567-8901",
    address: "321 Maple Drive",
    serviceType: "Quote",
    startTime: "2024-12-20T10:00:00",
    endTime: "2024-12-20T11:00:00",
    duration: 1,
    status: "scheduled",
    priority: "medium",
  },
];

const timeSlots = [
  "6:00",
  "7:00",
  "8:00",
  "9:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

export function DispatchBoard({ compact = false }: DispatchBoardProps) {
  const { toast } = useToast();
  const [location] = useLocation();

  // Fetch employees from staff management system
  const { data: employeesData } = useQuery<{
    success: boolean;
    data: Employee[];
  }>({
    queryKey: ["/api/employees"],
  });

  const employees = employeesData?.data || [];

  // Transform employees to staff members for dispatch board
  const staffMembers = useMemo(() => {
    return employees
      .filter((emp) => emp.isActive === true) // Only show active employees
      .map((emp, index) => transformEmployeeToStaffMember(emp, index));
  }, [employees]);

  // Map employeeId → Employee for fast lookup in job cards
  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employees.forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);

  // Map employeeId → palette colour (sorted crew, same order as StaffSchedule).
  // Don't filter on role — owner-operators carry the 'admin' role but also need
  // a palette colour because they work jobs.
  const crewPaletteMap = useMemo(() => {
    const m = new Map<string, { dot: string }>();
    const crew = employees
      .filter(e => e.isActive)
      .sort((a, b) => (a.firstName ?? '').localeCompare(b.firstName ?? ''));
    crew.forEach((e, i) => m.set(e.id, STAFF_PALETTE[i % STAFF_PALETTE.length]));
    return m;
  }, [employees]);

  // Fetch job templates for template selection
  const { data: templatesResponse } = useQuery<ApiResponse<JobTemplate>>({
    queryKey: ["/api/job-templates"],
  });
  const templates = templatesResponse?.data || [];

  // Handle template selection and auto-populate form
  const handleTemplateSelection = (templateId: string) => {
    setSelectedTemplate(templateId);

    if (!templateId) return;

    const template = templates.find((t: JobTemplate) => t.id === templateId);
    if (!template) return;

    // Auto-populate form fields based on template
    setNewJobFormData((prev) => ({
      ...prev,
      serviceType:
        template.category || template.serviceType || prev.serviceType,
      priority:
        template.riskLevel === "High Risk"
          ? "high"
          : template.riskLevel === "Medium Risk"
            ? "medium"
            : "low",
      notes: template.description || prev.notes,
      // Set estimated start/end times based on template duration
      startTime: prev.startTime || "09:00",
      endTime: template.estimatedDuration
        ? calculateEndTime("09:00", template.estimatedDuration)
        : prev.endTime || "17:00",
      // Copy equipment checklist from template with normalization
      equipmentChecklist: (template.equipmentChecklist || []).map(
        (item, index) => {
          // Normalize: handle string[], partial objects, or full EquipmentChecklistItem[]
          const equipmentName =
            typeof item === "string"
              ? item
              : item.equipment || item.name || `Item ${index + 1}`;
          return {
            id: `equipment-${Date.now()}-${index}`,
            equipment: equipmentName,
            checked: false,
            // checkedAt and checkedBy are undefined (not null) for unchecked items
          };
        },
      ),
    }));
  };

  // Helper function to calculate end time based on duration
  const calculateEndTime = (
    startTime: string,
    durationHours: number,
  ): string => {
    if (!startTime) return "";

    const [hours, minutes] = startTime.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(
      startDate.getTime() + durationHours * 60 * 60 * 1000,
    );

    return `${endDate.getHours().toString().padStart(2, "0")}:${endDate.getMinutes().toString().padStart(2, "0")}`;
  };
  // Inner panel split: calendar vs job cards (persisted in localStorage)
  const [innerPanelSizes, setInnerPanelSizes] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("dispatch-inner-panel-sizes");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [60, 40];
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day
    return today;
  });


  const [selectedJob, setSelectedJob] = useState<JobAssignment | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDeepSearchActive, setIsDeepSearchActive] = useState<boolean>(false);
  const [showMobileSearch, setShowMobileSearch] = useDispatchSearchOpen();
  const [deepSearchResults, setDeepSearchResults] = useState<JobAssignment[]>(
    [],
  );
  const [isDeepSearchLoading, setIsDeepSearchLoading] =
    useState<boolean>(false);
  const [assignmentMode, setAssignmentMode] =
    useState<AssignmentMode>("individual");
  const [jobFilters, setJobFilters] = useJobFilters();
  const [laneFilter] = useLaneFilter();
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useOnlyUnconfirmed();

  // Lanes — custom buckets a job can sit in (orthogonal to status). Used for the optional lane
  // filter and the coloured chip on each card. Keyed map for quick lookup by id.
  const { data: lanesResp } = useQuery<{ data: { id: string; name: string; color: string }[] }>({
    queryKey: ["/api/lanes"],
  });
  const laneMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string }>();
    (lanesResp?.data || []).forEach((l) => m.set(l.id, l));
    return m;
  }, [lanesResp]);

  const countUnconfirmed = (jobs: { status: string; customerConfirmed?: boolean }[]) =>
    jobs.filter(
      // 'scheduled' status retired 2026-05 — every booked job is now a work_order.
      (j) => j.status === "work_order" && !j.customerConfirmed,
    ).length;

  const STATUS_TAB_FILTERS = [
    { value: "lead",       label: "Lead",      Icon: UserCog,         pill: "bg-blue-50 text-[#1877F2]",  pillActive: "bg-[#1877F2] text-white" },
    { value: "queue",      label: "Queue",     Icon: Inbox,           pill: "bg-blue-50 text-[#1877F2]",  pillActive: "bg-[#1877F2] text-white" },
    { value: "quote",      label: "Quote",     Icon: CircleDollarSign,pill: "bg-blue-50 text-[#1877F2]",  pillActive: "bg-[#1877F2] text-white" },
    { value: "work_order", label: "Unscheduled", Icon: CalendarX,     pill: "bg-blue-50 text-[#1877F2]",  pillActive: "bg-[#1877F2] text-white" },
    { value: "scheduled",  label: "Scheduled", Icon: CalendarCheck,   pill: "bg-blue-50 text-[#1877F2]",  pillActive: "bg-[#1877F2] text-white" },
  ];

  const filterMeta: Record<string, { title: string; subtitle: string }> = {
    all: { title: "Active Jobs", subtitle: "All upcoming jobs" },
    lead: { title: "Leads", subtitle: "Enquiries & unqualified leads" },
    queue: { title: "Dispatch Queue", subtitle: "Jobs parked and waiting" },
    quote: { title: "Quotes", subtitle: "Quote status" },
    mulch: { title: "Mulch", subtitle: "Mulch status" },
    work_order: { title: "Unscheduled", subtitle: "Work orders awaiting a booking" },
    scheduled: { title: "Scheduled", subtitle: "Booked on the calendar" },
  };

  // Panel title for the active multi-select filter set ([] = All).
  const panelTitle =
    jobFilters.length === 0
      ? "Active Jobs"
      : jobFilters.map((f) => filterMeta[f]?.title ?? f).join(" + ");

  // The awaiting-confirmation badge/toggle only makes sense on views that can
  // contain unconfirmed work orders: All, or any selection including Unscheduled or Scheduled.
  const showUnconfirmedBadge =
    jobFilters.length === 0 ||
    jobFilters.includes("scheduled") ||
    jobFilters.includes("work_order");

  const QUEUE_REASONS = [
    "Weather Hold",
    "Awaiting Permit",
    "Customer Not Ready",
    "Awaiting Quote Approval",
    "Materials Needed",
    "Crew Unavailable",
    "Other",
  ];

  const [showJobCreationModal, setShowJobCreationModal] = useState(false);
  const [showGlobalJobCard, setShowGlobalJobCard] = useState(false);
  const [globalJobCardMode, setGlobalJobCardMode] = useState<"create" | "edit">(
    "create",
  );

  // (The 100 ↔ 50 left-panel resize effect was removed alongside PR #35's
  // switch to opening the job card in a modal. The sibling right panel it
  // was balancing against is gone, so calling .resize(50) on the only
  // surviving panel made the library throw "Previous layout not found for
  // panel index -1" every time a job card opened.)

  const [jobToEdit, setJobToEdit] = useState<JobAssignment | null>(null);
  const [initialJobData, setInitialJobData] = useState<any>(null);
  // Sidebar tab to open the job card on — set from the `?tab=` URL param when
  // a push notification deep-links to a specific section (e.g. the diary).
  const [initialSidebarTab, setInitialSidebarTab] = useState<
    "details" | "billing" | "checklist" | "diary" | undefined
  >(undefined);
  const [newJobFormData, setNewJobFormData] = useState({
    customerName: "",
    customerPhone: "",
    address: "",
    serviceType: "",
    startTime: "",
    endTime: "",
    priority: "medium" as JobAssignment["priority"],
    notes: "",
    assignedTo: "", // Will hold teamId or staffId based on mode
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showCreateFromMessageDialog, setShowCreateFromMessageDialog] =
    useState(false);
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [queueTargetJob, setQueueTargetJob] = useState<JobAssignment | null>(
    null,
  );
  const [queueReasonInput, setQueueReasonInput] = useState<string>("");
  const [pendingDrop, setPendingDrop] = useState<{
    jobId: string;
    jobLabel: string;
    customerName: string;
    address: string;
    date: Date;
    hour: number;
    employeeId: string;
    defaultDurationHours: number;
  } | null>(null);
  const [isConfirmingDrop, setIsConfirmingDrop] = useState(false);
  const [draggingJob, setDraggingJob] = useState<{
    id: string;
    durationHours: number;
    customerName: string;
  } | null>(null);
  const isCreatingLeadJobRef = useRef(false);
  // Ref so event-listener closures always see the latest "actively editing a job" state
  const isActivelyEditingRef = useRef(false);

  // Swipe-to-navigate refs
  const swipeTouchStartX = useRef<number | null>(null);
  const swipeTouchStartY = useRef<number | null>(null);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || swipeTouchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - swipeTouchStartX.current;
    const deltaY = e.changedTouches[0].clientY - swipeTouchStartY.current;
    swipeTouchStartX.current = null;
    swipeTouchStartY.current = null;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        setSelectedDate(d => addDays(d, 1));
      } else {
        setSelectedDate(d => subDays(d, 1));
      }
    }
  };

  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [jobToSchedule, setJobToSchedule] = useState<JobAssignment | null>(
    null,
  );
  const [schedulingData, setSchedulingData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    assignedTo: "",
    notes: "",
  });

  // Fetch all active jobs — excludes completed and archived; limit 500 (far more than needed)
  const JOBS_QUERY_KEY =
    "/api/jobs?limit=500&offset=0&excludeCompleted=true&excludeArchived=true";
  const {
    data: jobsData,
    isLoading: jobsLoading,
    error: jobsError,
  } = useQuery({
    queryKey: [JOBS_QUERY_KEY],
    // Live board: poll explicitly. SSE broadcasts invalidate ['/api/jobs'],
    // which does not match this parameterized key, so without an interval the
    // board would only refresh on focus/navigation.
    refetchInterval: 30_000,
  });

  // Check for pending job data from conversations on mount
  useEffect(() => {
    const pendingData = localStorage.getItem("pendingJobData");
    if (pendingData) {
      try {
        const parsed = JSON.parse(pendingData);
        console.log("📋 Found pending job data from conversation:", parsed);
        setInitialJobData(parsed);
        setShowGlobalJobCard(true);
        setGlobalJobCardMode("create");
        localStorage.removeItem("pendingJobData");
      } catch (error) {
        console.error("Error parsing pending job data:", error);
        localStorage.removeItem("pendingJobData");
      }
    }

    // Open a specific job card when navigating from Create Lead flows
    const pendingJobId = sessionStorage.getItem("dispatch_open_job");
    if (pendingJobId) {
      sessionStorage.removeItem("dispatch_open_job");
      fetch(`/api/jobs/${pendingJobId}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const jobData = data?.data ?? data;
          if (jobData?.id) {
            setShowGlobalJobCard(true);
            setGlobalJobCardMode("edit");
            setJobToEdit(jobData as JobAssignment);
          }
        })
        .catch(console.error);
    }
  }, []); // Run only on mount

  // Keep the ref in sync so event-listener closures always see the latest editing state
  useEffect(() => {
    isActivelyEditingRef.current =
      showGlobalJobCard && globalJobCardMode === "edit" && !!jobToEdit?.id;
  }, [showGlobalJobCard, globalJobCardMode, jobToEdit]);

  // Clear deep search and search query whenever the user navigates away from the dispatch board,
  // so they start fresh on return instead of seeing stale deep-search results.
  useEffect(() => {
    if (!location.startsWith("/dispatch")) {
      setIsDeepSearchActive(false);
      setDeepSearchResults([]);
      setSearchQuery("");
    }
  }, [location]);

  // Handle URL parameters for opening specific jobs (e.g., from notifications)
  useEffect(() => {
    // When triggered by a notification we get the intended URL as an argument.
    // Trusting it directly is more reliable than re-reading window.location,
    // which can be raced by Wouter on same-pathname navigation or by other
    // effects that call history.replaceState before this handler runs.
    const handleUrlChange = (sourceUrl?: string) => {
      const search = sourceUrl
        ? (sourceUrl.includes("?")
            ? sourceUrl.substring(sourceUrl.indexOf("?"))
            : "")
        : window.location.search;
      const params = new URLSearchParams(search);
      const jobId = params.get("job");
      const tab = params.get("tab");
      const newJob = params.get("newJob");
      // Optional deep-link target: a specific diary entry to scroll to and
      // highlight (e.g. the email reply a notification is about).
      const entryId = params.get("entry");

      // Handle ?newJob=true — open the create job flow (same as the global
      // top-bar "+ New Job" button, which navigates here with this param).
      // Routes through createDraftMutation so the new card mounts directly.
      if (newJob === "true") {
        window.history.replaceState({}, "", "/dispatch");
        handleCreateJob();
        return;
      }

      console.log("🔔 DispatchBoard URL check:", {
        jobId,
        tab,
        hasJobsData: !!jobsData?.data,
        jobCount: jobsData?.data?.length || 0,
        location,
        windowSearch: window.location.search,
        sourceUrl,
        searchUsed: search,
        currentlyEditing: jobToEdit?.id,
      });

      // Only process if we have a jobId parameter
      if (jobId) {
        console.log("🔔 Processing job from URL parameter:", { jobId, tab });

        // Wait until jobs data is loaded before acting
        if (!jobsData?.data) {
          console.log(
            "🔔 jobsData not yet loaded — will retry when it arrives",
          );
          return;
        }

        // Find the job in the loaded data
        const job = jobsData.data.find((j: any) => j.id === jobId);

        console.log("🔔 Job search result:", { found: !!job, jobId });

        // Push notifications use ?tab=diary to deep-link a customer message
        // reply to the diary view. On mobile the Diary is its own tab; on
        // desktop the diary panel is always visible alongside Details, so the
        // job card falls back to Details there (see GlobalJobCard).
        const tabParam =
          tab === "diary" ||
          tab === "checklist" ||
          tab === "billing" ||
          tab === "details"
            ? (tab as "details" | "billing" | "checklist" | "diary")
            : undefined;

        const openJob = (jobData: any) => {
          // Already viewing this job — don't remount the card, but if the
          // notification asked for a specific tab (e.g. diary) tell the card
          // to switch to it.
          if (showGlobalJobCard && jobToEdit?.id === jobId) {
            window.history.replaceState({}, "", "/dispatch");
            if (tabParam) {
              window.dispatchEvent(
                new CustomEvent("job-card-switch-tab", { detail: tabParam }),
              );
            }
            // Card already open — the diary is mounted, so fire the highlight
            // request now; JobDiarySection's event listener picks it up.
            if (entryId) requestDiaryHighlight(entryId);
            return;
          }
          window.history.replaceState({}, "", "/dispatch");
          setInitialSidebarTab(tabParam);
          setShowGlobalJobCard(true);
          setGlobalJobCardMode("edit");
          setJobToEdit(jobData as JobAssignment);
          // Card is mounting fresh — park the highlight target so the diary
          // picks it up from the module bus the moment it mounts.
          if (entryId) requestDiaryHighlight(entryId);
        };

        if (job) {
          openJob(job);
        } else {
          // Job not in current page — fetch it directly by ID
          console.log("🔔 Job not in cache, fetching directly:", jobId);
          window.history.replaceState({}, "", "/dispatch");
          fetch(`/api/jobs/${jobId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              const fetched = data?.data ?? data;
              if (fetched?.id) {
                openJob(fetched);
              } else {
                toast({
                  title: "Job not found",
                  description: "Could not open the job from this notification.",
                  variant: "destructive",
                });
              }
            })
            .catch(() => {
              toast({
                title: "Job not found",
                description: "Could not open the job from this notification.",
                variant: "destructive",
              });
            });
        }
      }
    };

    // Run on mount and when dependencies change
    handleUrlChange();

    // Listen for notification navigation events. The event carries the URL
    // we want to land on — pass it straight through so we don't depend on
    // window.location having been updated by the time we run.
    const handleNotificationNav = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(
        "🔔 Notification navigation event received:",
        customEvent.detail,
      );
      const detailUrl: string | undefined =
        typeof customEvent.detail === "string"
          ? customEvent.detail
          : customEvent.detail?.url;
      handleUrlChange(detailUrl);
    };

    // Handle the "New Job" orange header button firing a custom event when already on /dispatch
    const handleNewJobEvent = () => {
      // Guard: never wipe out a job that is actively being edited (use ref for fresh state)
      if (isActivelyEditingRef.current) {
        return;
      }
      // Route through createDraftMutation — same path as ?newJob=true and the
      // empty-state "Create Job" button — so the card mounts the redesigned
      // JobCardDesktop/Mobile look. The old create-mode path opened against no
      // jobId and fell through to the legacy jobCardContent, which is why
      // "+ New Job" while already on /dispatch showed the old card and the raw
      // "Work_order" status badge instead of the new design.
      handleCreateJob();
    };

    // popstate fires with a PopStateEvent — pass no arg so handleUrlChange
    // falls back to reading window.location (which is what we want for
    // back/forward navigation).
    const handlePopState = () => handleUrlChange();
    window.addEventListener("notification-navigation", handleNotificationNav);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("dispatch-new-job", handleNewJobEvent);

    const handleNewLeadEvent = () => handleCreateLead();
    const handleNewQuoteEvent = () => handleCreateQuote();
    const handleNewInvoiceEvent = () => handleCreateInvoice();
    const handlePasteEvent = () => setShowCreateFromMessageDialog(true);
    window.addEventListener("dispatch-new-lead", handleNewLeadEvent);
    window.addEventListener("dispatch-new-quote", handleNewQuoteEvent);
    window.addEventListener("dispatch-new-invoice", handleNewInvoiceEvent);
    window.addEventListener("dispatch-paste", handlePasteEvent);

    return () => {
      window.removeEventListener(
        "notification-navigation",
        handleNotificationNav,
      );
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("dispatch-new-job", handleNewJobEvent);
      window.removeEventListener("dispatch-new-lead", handleNewLeadEvent);
      window.removeEventListener("dispatch-new-quote", handleNewQuoteEvent);
      window.removeEventListener("dispatch-new-invoice", handleNewInvoiceEvent);
      window.removeEventListener("dispatch-paste", handlePasteEvent);
    };
  }, [jobsData, location]); // Re-run when jobs data loads OR location changes

  // Fetch customers for name lookup
  const { data: customersData } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Fetch staff assignments for dispatch board
  const { data: staffAssignmentsData } = useQuery({
    queryKey: ["/api/staff-assignments"],
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

        // Use NZ timezone for grouping to avoid duplicates across different UTC dates
        const nzTime = utcToNZTime(startDate);
        const dateKey = nzTime.date; // YYYY-MM-DD in NZ timezone
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
          if (assignmentMode === "teams") {
            const matchingTeam = mockTeams.find((team) =>
              assignedTeam.some((assignedId: string) =>
                team.members.includes(assignedId),
              ),
            );
            teamId = matchingTeam?.id;
          } else {
            staffId = assignedTeam[0];
          }
        }

        // Safari-safe date parsing for duration calculation
        const startDateTime = new Date(firstAssignment.startTime);
        const endDateTime = new Date(firstAssignment.endTime);
        const calculatedDuration =
          !isNaN(startDateTime.getTime()) && !isNaN(endDateTime.getTime())
            ? (endDateTime.getTime() - startDateTime.getTime()) /
              (1000 * 60 * 60)
            : 2; // Default to 2 hours if parsing fails

        // Safari-safe customer name lookup - check multiple sources.
        // Prefer the name folded onto the job payload by GET /api/jobs so the
        // tile renders immediately without waiting on the separate
        // /api/customers fetch + client-side map (which caused a name flash).
        const customerName =
          apiJob.customerName ||
          (apiJob.customerId && customerMap.has(apiJob.customerId)
            ? customerMap.get(apiJob.customerId)
            : apiJob.clientName || apiJob.title || "");

        jobAssignments.push({
          id: apiJob.id,
          jobId: apiJob.id, // Use the actual job ID (UUID), not the job number
          jobNumber: apiJob.jobNumber,
          customerId: apiJob.customerId,
          customerName: customerName,
          customerPhone: "",
          address: apiJob.address,
          serviceType: apiJob.serviceType || "",
          description: apiJob.description || "",
          status: apiJob.status || "scheduled", // Use actual job status from API
          priority: apiJob.priority,
          startTime: firstAssignment.startTime,
          endTime: firstAssignment.endTime,
          duration: calculatedDuration,
          notes:
            firstAssignment.notes ||
            apiJob.specialInstructions ||
            apiJob.notes ||
            "",
          assignedTeam: assignedTeam,
          teamId: teamId,
          staffId: staffId,
          specialInstructions: apiJob.specialInstructions,
          lastActivityAt: apiJob.lastActivityAt,
          workOrderAt: apiJob.workOrderAt,
          createdAt: apiJob.createdAt,
          scheduledDate: apiJob.scheduledDate || undefined,
          scheduledEndDate: apiJob.scheduledEndDate || undefined,
          scheduledDates: apiJob.scheduledDates || null,
          inQueue: apiJob.inQueue || false,
          queueReason: apiJob.queueReason || null,
          laneId: apiJob.laneId || null,
          customerConfirmed: apiJob.customerConfirmed || false,
          confirmationReplySentAt: apiJob.confirmationReplySentAt || null,
          customerReplyReceivedAt: apiJob.customerReplyReceivedAt || null,
          etaNotificationRequested: apiJob.etaNotificationRequested || false,
          subtotal: apiJob.subtotal || "0",
          totalAmount:
            apiJob.subtotal && Number(apiJob.subtotal) > 0
              ? apiJob.subtotal
              : apiJob.totalIncludingGst && Number(apiJob.totalIncludingGst) > 0
                ? String(
                    Math.round(
                      (Number(apiJob.totalIncludingGst) / 1.15) * 100,
                    ) / 100,
                  )
                : apiJob.totalAmount && Number(apiJob.totalAmount) > 0
                  ? String(
                      Math.round((Number(apiJob.totalAmount) / 1.15) * 100) /
                        100,
                    )
                  : "0",
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
            endTime = new Date(
              scheduledDateTime.getTime() + estimatedDuration * 60 * 60 * 1000,
            ).toISOString();
          } else {
            // Invalid date, use current time
            startTime = new Date().toISOString();
            endTime = new Date(
              Date.now() + estimatedDuration * 60 * 60 * 1000,
            ).toISOString();
          }
        } else {
          // No scheduled date, use current time
          startTime = new Date().toISOString();
          endTime = new Date(
            Date.now() + estimatedDuration * 60 * 60 * 1000,
          ).toISOString();
        }

        // Safari-safe customer name lookup - check multiple sources.
        // Prefer the name folded onto the job payload by GET /api/jobs so the
        // tile renders immediately without waiting on the separate
        // /api/customers fetch + client-side map (which caused a name flash).
        const customerName =
          apiJob.customerName ||
          (apiJob.customerId && customerMap.has(apiJob.customerId)
            ? customerMap.get(apiJob.customerId)
            : apiJob.clientName || apiJob.title || "");

        jobAssignments.push({
          id: apiJob.id,
          jobId: apiJob.id, // Use the actual job ID (UUID), not the job number
          jobNumber: apiJob.jobNumber,
          customerId: apiJob.customerId,
          customerName: customerName,
          customerPhone: "",
          address: apiJob.address,
          serviceType: apiJob.serviceType || "",
          description: apiJob.description || "",
          status: apiJob.status,
          priority: apiJob.priority,
          startTime: startTime,
          endTime: endTime,
          duration: estimatedDuration,
          notes: apiJob.specialInstructions || apiJob.notes || "",
          assignedTeam: apiJob.assignedTeam || [],
          teamId: undefined,
          staffId: undefined,
          specialInstructions: apiJob.specialInstructions,
          lastActivityAt: apiJob.lastActivityAt,
          workOrderAt: apiJob.workOrderAt,
          createdAt: apiJob.createdAt,
          scheduledDate: apiJob.scheduledDate || undefined,
          scheduledEndDate: apiJob.scheduledEndDate || undefined,
          scheduledDates: apiJob.scheduledDates || null,
          inQueue: apiJob.inQueue || false,
          queueReason: apiJob.queueReason || null,
          laneId: apiJob.laneId || null,
          customerConfirmed: apiJob.customerConfirmed || false,
          confirmationReplySentAt: apiJob.confirmationReplySentAt || null,
          customerReplyReceivedAt: apiJob.customerReplyReceivedAt || null,
          etaNotificationRequested: apiJob.etaNotificationRequested || false,
          subtotal: apiJob.subtotal || "0",
          totalAmount:
            apiJob.subtotal && Number(apiJob.subtotal) > 0
              ? apiJob.subtotal
              : apiJob.totalIncludingGst && Number(apiJob.totalIncludingGst) > 0
                ? String(
                    Math.round(
                      (Number(apiJob.totalIncludingGst) / 1.15) * 100,
                    ) / 100,
                  )
                : apiJob.totalAmount && Number(apiJob.totalAmount) > 0
                  ? String(
                      Math.round((Number(apiJob.totalAmount) / 1.15) * 100) /
                        100,
                    )
                  : "0",
        });
      });
    }

    return jobAssignments;
  }, [jobsData, staffAssignmentsData, customerMap, assignmentMode, jobMap]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "busy":
        return "bg-yellow-100 text-yellow-800";
      case "offline":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  // Check if job has recent activity (since last viewed)
  const hasRecentActivity = (job: JobAssignment) => {
    if (!job.lastActivityAt) return false;
    // Safari-safe date parsing
    const lastActivity = new Date(job.lastActivityAt);
    if (isNaN(lastActivity.getTime())) return false;

    // Get last viewed timestamp from localStorage
    const lastViewedKey = `job-last-viewed-${job.id}`;
    const lastViewedStr = localStorage.getItem(lastViewedKey);

    if (lastViewedStr) {
      const lastViewed = new Date(lastViewedStr);
      if (!isNaN(lastViewed.getTime())) {
        // Show indicator only if there's activity since the job was last viewed
        return lastActivity > lastViewed;
      }
    }

    // If never viewed, show indicator if activity within last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastActivity > oneHourAgo;
  };

  // Get status initials for job circles
  const getStatusInitials = (job: JobAssignment) => {
    // Check service type first for leads and quotes
    const serviceType = job.serviceType?.toLowerCase() || "";
    if (serviceType.includes("lead") || serviceType.includes("inquiry"))
      return "L";
    if (serviceType.includes("quote") || serviceType.includes("proposal"))
      return "Q";

    // Handle actual API status values
    switch (job.status) {
      case "completed":
        return "C";
      case "unsuccessful":
        return "U";
      case "scheduled":
        return "S";
      case "invoiced":
        return "I";
      case "archived":
        return "A";
      case "work_order":
        return "WO";
      case "work order":
        return "WO";
      case "quote":
        return "Q";
      case "lead":
        return "L";
      default:
        return "WO";
    }
  };

  // Get status color for job circles
  const getJobStatusColor = (job: JobAssignment) => {
    const serviceType = job.serviceType?.toLowerCase() || "";
    if (serviceType.includes("lead") || serviceType.includes("inquiry"))
      return "bg-yellow-500";
    if (serviceType.includes("quote") || serviceType.includes("proposal"))
      return "bg-orange-600";

    switch (job.status) {
      case "completed":
        return "bg-green-600";
      case "unsuccessful":
        return "bg-red-600";
      case "invoiced":
        return "bg-purple-600";
      case "archived":
        return "bg-gray-500";
      case "work_order":
        return "bg-blue-600";
      case "work order":
        return "bg-blue-600";
      case "scheduled":
        return "bg-orange-600";
      case "quote":
        return "bg-orange-600";
      case "mulch":
        return "bg-lime-500";
      case "lead":
        return "bg-yellow-500";
      default:
        return "bg-gray-600";
    }
  };

  // Get actual color values for inline styles (matching desktop style)
  const getJobStatusColorValue = (job: JobAssignment) => {
    const serviceType = job.serviceType?.toLowerCase() || "";
    if (serviceType.includes("lead") || serviceType.includes("inquiry"))
      return "#ca8a04"; // yellow-600
    if (serviceType.includes("quote") || serviceType.includes("proposal"))
      return "#f97316"; // orange-500

    // Handle actual API status values
    switch (job.status) {
      case "completed":
        return "#22c55e"; // green-500
      case "unsuccessful":
        return "#ef4444"; // red-500
      case "invoiced":
        return "#a855f7"; // purple-500
      case "archived":
        return "#6b7280"; // gray-500
      case "work_order":
        return "#3b82f6"; // blue-500
      case "work order":
        return "#3b82f6"; // blue-500
      case "scheduled":
        return "#3b82f6"; // blue-500 (same as work order)
      case "quote":
        return "#f97316"; // orange-500
      case "mulch":
        return "#84cc16"; // lime-500
      case "lead":
        return "#ca8a04"; // yellow-600
      default:
        return "#6b7280"; // gray-500
    }
  };

  const getJobsForTeam = (teamId: string) => {
    return jobs.filter((job) => {
      // Check if any team member is assigned to this job
      const teamMembers = getTeamMembers(teamId);
      const hasTeamMember = job.assignedTeam?.some((assignedId) =>
        teamMembers.some((member) => member.id === assignedId),
      );
      if (!hasTeamMember && job.teamId !== teamId) return false;
      return true;
    });
  };

  const getJobsForStaff = (staffId: string) => {
    return jobs.filter((job) => {
      // Check if staff member is in assigned team or directly assigned
      const isAssigned = job.assignedTeam?.includes(staffId);
      if (!isAssigned && job.staffId !== staffId) return false;
      return true;
    });
  };

  const getTeamMembers = (teamId: string) => {
    const team = mockTeams.find((t) => t.id === teamId);
    if (!team) return [];
    return team.members
      .map(
        (memberId) =>
          ({
            id: memberId,
            name: `Staff ${memberId}`,
            role: "Unknown",
            skills: [],
            status: "available",
            color: "bg-gray-500",
          }) as StaffMember,
      )
      .filter(Boolean) as StaffMember[];
  };

  // Deep search function that searches ALL jobs including completed and unsuccessful
  const performDeepSearch = async (query: string) => {
    if (!query.trim()) {
      setIsDeepSearchActive(false);
      setDeepSearchResults([]);
      return;
    }

    setIsDeepSearchLoading(true);

    try {
      // Strip leading '#' so searching "#3571" finds job number 3571
      const cleanQuery = query.trim().startsWith("#")
        ? query.trim().slice(1)
        : query.trim();
      // Call the server-side search endpoint
      const response = await fetch(
        `/api/jobs/search?q=${encodeURIComponent(cleanQuery)}&limit=100&excludeArchived=true`,
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Search failed");
      }

      // Transform Job objects into JobAssignment format
      const searchResults: JobAssignment[] = result.data.map((job: any) => ({
        id: job.id,
        jobId: job.id, // Add jobId field (same as id for job assignments)
        jobNumber: job.jobNumber,
        customerName: job.customerName || "Unknown Customer",
        customerPhone: job.customerPhone || "",
        address: job.address || "",
        serviceType: job.serviceType || "",
        description: job.description || "",
        status: job.status,
        priority: job.priority || "medium",
        startTime:
          job.startTime || job.scheduledDate || new Date().toISOString(),
        endTime: job.endTime || job.scheduledDate || new Date().toISOString(),
        duration: job.duration || 2,
        assignedTeam: job.assignedStaff || [],
        notes: job.notes || "",
        specialInstructions: job.specialInstructions || "",
        estimatedValue: job.quoteAmount || 0,
        completionPercentage: job.completionPercentage || 0,
        customerId: job.customerId,
        teamId: undefined,
        staffId: undefined,
      }));

      setIsDeepSearchActive(true);
      setDeepSearchResults(searchResults);
    } catch (error) {
      console.error("Deep search error:", error);
      toast({
        title: "Search Failed",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred during search",
        variant: "destructive",
      });
      setIsDeepSearchActive(false);
      setDeepSearchResults([]);
    } finally {
      setIsDeepSearchLoading(false);
    }
  };

  // Auto fall-through: when a query has zero matches in the cached active-jobs
  // set, run Deep Search automatically so completed/invoiced jobs surface
  // without a second click. Predicate mirrors the quick-search filter below.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) return;
    if (jobsLoading) return;
    if (isDeepSearchActive || isDeepSearchLoading) return;

    const handle = setTimeout(() => {
      const rawQuery = trimmed.toLowerCase();
      const query = rawQuery.startsWith("#") ? rawQuery.slice(1) : rawQuery;

      const hasQuickHit = jobs.some((job) => {
        if (job.status === "unsuccessful" || job.status === "archived") return false;
        if (job.status === "completed" || job.status === "invoiced") return false;
        const customerName = job.customerName?.toLowerCase() || "";
        const address = job.address?.toLowerCase() || "";
        const serviceType = job.serviceType?.toLowerCase() || "";
        const description = job.description?.toLowerCase() || "";
        const jobId = job.id?.toLowerCase() || "";
        const jobNumber = String(job.jobNumber ?? "").toLowerCase();
        return (
          customerName.includes(query) ||
          address.includes(query) ||
          serviceType.includes(query) ||
          description.includes(query) ||
          jobId.includes(query) ||
          jobNumber.includes(query)
        );
      });

      if (!hasQuickHit) {
        performDeepSearch(searchQuery);
      }
    }, 400);

    return () => clearTimeout(handle);
    // performDeepSearch intentionally omitted — it's recreated each render and
    // we rely on closure-captures-latest for its dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, jobs, jobsLoading, isDeepSearchActive, isDeepSearchLoading]);

  // Memoized: this runs a 4-pass filter + dedup + sort over up to 500 jobs
  // (with per-job date parsing). Unmemoized it re-ran on every render of this
  // component — including every search keystroke — twice the work when both
  // call sites hit. Deps cover every input the pipeline reads; `jobs` gets a
  // fresh identity from the 30s poll, so the "today" date window stays fresh.
  const todaysJobs = useMemo(() => {
    // If deep search is active, return deep search results
    if (isDeepSearchActive) {
      return deepSearchResults;
    }

    const isSearching = searchQuery.trim().length > 0;

    // Boundary for the Unscheduled/Scheduled partition — computed once per
    // memo run; the 30s poll refreshes `jobs`' identity, keeping it current.
    const todayNZ = getNZDateString(new Date());

    const filtered = jobs
      .filter((job) => {
        // Always exclude terminal statuses from quick search
        if (job.status === "unsuccessful" || job.status === "archived")
          return false;

        // When searching, ignore the tab filter — search is global across all active jobs
        // (including queued jobs). Completed/invoiced are still excluded here; Deep Search
        // covers those.
        if (isSearching) {
          return job.status !== "completed" && job.status !== "invoiced";
        }

        // Lane filter takes precedence: when a lane is selected, show every active job in that
        // lane regardless of the status tab (completed/invoiced already excluded by the query).
        if (laneFilter !== "all") {
          return job.laneId === laneFilter;
        }

        // Status filters are multi-select and OR-combined — e.g. Unscheduled +
        // Scheduled together shows every work_order regardless of booking state
        // (needed when rescheduling: booked and bookable jobs side by side).
        // 'scheduled' status retired 2026-05 — the Unscheduled and Scheduled
        // filters partition work_orders by whether they have a current-or-future
        // booking, so every work_order matches exactly one of the two. A booking
        // entirely in the past (e.g. rained off) returns to Unscheduled so it
        // can be rebooked instead of hiding under Scheduled forever.
        if (jobFilters.length > 0) {
          return jobFilters.some((f) => {
            // Queued jobs belong exclusively to the Queue filter
            if (f === "queue") return job.inQueue === true;
            if (job.inQueue) return false;
            if (f === "lead") return job.status === "lead";
            if (f === "quote") return job.status === "quote";
            if (f === "mulch") return job.status === "mulch";
            if (f === "work_order") return job.status === "work_order" && !hasUpcomingBookingNZ(job, todayNZ);
            if (f === "scheduled") return job.status === "work_order" && hasUpcomingBookingNZ(job, todayNZ);
            return false;
          });
        }

        // No filter ("All"), no search: only the three most actionable statuses
        if (job.inQueue) return false;
        return (
          job.status === "lead" ||
          job.status === "quote" ||
          job.status === "work_order"
        );
      })
      .filter((job) => {
        // Awaiting-confirmation filter only applies on the tabs where the badge
        // is shown (scheduled / work_order / all). Without this scope, leaving
        // the toggle on and switching to Leads / Quotes / Queue would silently
        // hide every job in those tabs. Search bypasses the filter entirely so
        // global search results aren't truncated to scheduled/work-order jobs.
        if (!onlyUnconfirmed) return true;
        if (isSearching) return true;
        const tabSupportsFilter =
          jobFilters.length === 0 ||
          jobFilters.includes("scheduled") ||
          jobFilters.includes("work_order");
        if (!tabSupportsFilter) return true;
        // 'scheduled' status retired 2026-05 — booked work is all work_order.
        return job.status === "work_order" && !job.customerConfirmed;
      })
      .filter((job) => {
        // When searching, a specific status filter, or a lane filter is active, skip the date window
        if (isSearching || jobFilters.length > 0 || laneFilter !== "all") return true;

        // Always include work_order jobs — these are active jobs that need
        // dispatching. ('scheduled' status retired 2026-05.)
        if (job.status === "work_order") {
          return true;
        }

        // For other jobs, only show upcoming jobs (jobs with valid start time in the future or today)
        if (!job.startTime) return false;
        try {
          const jobDateUTC = parseISO(job.startTime);
          if (isNaN(jobDateUTC.getTime())) return false;

          // Convert to NZ timezone and check if job is today or in the future
          const jobDateNZ = utcToNZTime(jobDateUTC);
          const todayNZ = utcToNZTime(new Date());

          // Compare dates - show jobs from today onwards
          return jobDateNZ.date >= todayNZ.date;
        } catch {
          return false;
        }
      })
      .filter((job) => {
        // Apply search filter across all searchable fields including job number
        if (!isSearching) return true;

        const rawQuery = searchQuery.toLowerCase().trim();
        // Strip a leading '#' so typing "#3571" matches job number "3571"
        const query = rawQuery.startsWith("#") ? rawQuery.slice(1) : rawQuery;
        const customerName = job.customerName?.toLowerCase() || "";
        const address = job.address?.toLowerCase() || "";
        const serviceType = job.serviceType?.toLowerCase() || "";
        const description = job.description?.toLowerCase() || "";
        const jobId = job.id?.toLowerCase() || "";
        const jobNumber = String(job.jobNumber ?? "").toLowerCase();

        return (
          customerName.includes(query) ||
          address.includes(query) ||
          serviceType.includes(query) ||
          description.includes(query) ||
          jobId.includes(query) ||
          jobNumber.includes(query)
        );
      });

    // Deduplicate jobs by ID (keep the most recent assignment for each unique job)
    const uniqueJobs = Array.from(
      filtered
        .reduce((map, job) => {
          const existing = map.get(job.id);
          if (
            !existing ||
            new Date(job.startTime) > new Date(existing.startTime)
          ) {
            map.set(job.id, job);
          }
          return map;
        }, new Map<string, JobAssignment>())
        .values(),
    );

    const sorted = uniqueJobs.sort((a, b) => {
      // When searching, rank by relevance first
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const scoreJob = (job: JobAssignment) => {
          const name = job.customerName?.toLowerCase() || "";
          if (name.startsWith(query)) return 4;
          if (name.includes(query)) return 3;
          const addr = job.address?.toLowerCase() || "";
          const svc = job.serviceType?.toLowerCase() || "";
          if (addr.includes(query) || svc.includes(query)) return 2;
          return 1;
        };
        const diff = scoreJob(b) - scoreJob(a);
        if (diff !== 0) return diff;
      }

      // Work Order tab: FIFO by when the job first became a work order (oldest conversion at top),
      // then priority as tiebreaker. Falls back to createdAt (not lastActivityAt) for legacy
      // jobs that predate the workOrderAt column — lastActivityAt gets bumped on every email,
      // note, or edit, which caused those jobs to reshuffle whenever they were touched.
      // createdAt is immutable so positions stay stable.
      // FIFO only applies when Unscheduled is the sole active filter — mixed
      // selections (e.g. Unscheduled + Scheduled) fall through to the activity
      // sort below, since FIFO-by-conversion-time is meaningless for
      // already-booked jobs.
      if (jobFilters.length === 1 && jobFilters[0] === "work_order") {
        const getAcceptedTime = (job: JobAssignment): number => {
          if (job.workOrderAt) return new Date(job.workOrderAt).getTime();
          if (job.createdAt) return new Date(job.createdAt).getTime();
          return Infinity;
        };
        const tDiff = getAcceptedTime(a) - getAcceptedTime(b); // ASC: oldest first
        if (tDiff !== 0) return tDiff;
        const priorityRank: Record<string, number> = {
          urgent: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        const pa = priorityRank[a.priority] ?? 4;
        const pb = priorityRank[b.priority] ?? 4;
        return pa - pb; // urgent first on ties
      }

      // Default: sort by most recently active (descending) — jobs with recent messages or changes appear at top
      const getActivityTime = (job: JobAssignment): number => {
        const activity = job.lastActivityAt
          ? new Date(job.lastActivityAt).getTime()
          : 0;
        const startT = job.startTime ? new Date(job.startTime).getTime() : 0;
        return Math.max(activity, startT);
      };
      return getActivityTime(b) - getActivityTime(a);
    });

    return sorted;
  }, [
    jobs,
    isDeepSearchActive,
    deepSearchResults,
    searchQuery,
    laneFilter,
    jobFilters,
    onlyUnconfirmed,
  ]);

  // Shim so the six existing call sites keep working unchanged.
  const getTodaysJobs = () => todaysJobs;

  // Per-day price share per job — calculateDailyTotal parses the job's NZ
  // scheduled-date set on every call, so compute once per jobs refresh
  // instead of per row per render.
  const dailyTotalByJobId = useMemo(() => {
    const m = new Map<string, number>();
    for (const job of todaysJobs) m.set(job.id, calculateDailyTotal(job));
    return m;
  }, [todaysJobs]);

  // Job Mutations
  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowJobCreationModal(false);
      setNewJobFormData({
        customerName: "",
        customerPhone: "",
        address: "",
        serviceType: "",
        startTime: "",
        endTime: "",
        priority: "medium",
        notes: "",
        assignedTo: "",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create job: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest("PUT", `/api/jobs/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update job: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const queueJobMutation = useMutation({
    mutationFn: async ({
      id,
      inQueue,
      queueReason,
    }: {
      id: string;
      inQueue: boolean;
      queueReason?: string | null;
    }) => {
      const response = await apiRequest("PUT", `/api/jobs/${id}`, {
        inQueue,
        queueReason: queueReason || null,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
      setShowQueueDialog(false);
      setQueueTargetJob(null);
      setQueueReasonInput("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not update queue status",
        variant: "destructive",
      });
    },
  });

  const archiveJobQuickMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/jobs/${id}`, {
        status: "archived",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not archive job",
        variant: "destructive",
      });
    },
  });

  const confirmJobMutation = useMutation({
    mutationFn: async ({
      id,
      customerConfirmed,
    }: {
      id: string;
      customerConfirmed: boolean;
    }) => {
      const response = await apiRequest("PUT", `/api/jobs/${id}`, {
        customerConfirmed,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not update confirmation status",
        variant: "destructive",
      });
    },
  });

  // Job Management Functions
  const createNewJob = () => {
    if (
      !newJobFormData.customerName ||
      !newJobFormData.customerPhone ||
      !newJobFormData.address ||
      !newJobFormData.serviceType ||
      !newJobFormData.startTime ||
      !newJobFormData.endTime ||
      !newJobFormData.assignedTo
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Transform form data to API format
    createJobMutation.mutate({
      jobNumber: `JOB-${Date.now()}`,
      title: newJobFormData.customerName,
      description: `${newJobFormData.serviceType} - ${newJobFormData.notes}`,
      address: newJobFormData.address,
      status: "scheduled",
      priority: newJobFormData.priority,
      scheduledDate: `${format(selectedDate, "yyyy-MM-dd")}T${newJobFormData.startTime}:00`,
      totalAmount: "0.00",
    });
  };

  const markJobComplete = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      updateJobMutation.mutate({
        id: jobId,
        updates: { status: "completed", completedDate: new Date() },
      });
    }
  };

  const cancelJob = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      updateJobMutation.mutate({
        id: jobId,
        updates: { status: "cancelled" },
      });
      toast({
        title: "Job Cancelled",
        description: `Job has been cancelled`,
        variant: "destructive",
      });
    }
  };

  const addJobNotes = (jobId: string, notes: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      const updatedNotes = job.notes ? `${job.notes}\n${notes}` : notes;
      updateJobMutation.mutate({
        id: jobId,
        updates: { notes: updatedNotes },
      });
    }
  };

  // Handle scheduling functionality
  const handleScheduleJob = (job: JobAssignment) => {
    setJobToSchedule(job);

    // Convert UTC times from database to NZ local time for display
    const startTimeUTC = new Date(job.startTime);
    const endTimeUTC = new Date(job.endTime);
    const now = new Date();

    // Convert to NZ timezone for user input
    let dateStr, startTimeStr, endTimeStr;

    if (!isNaN(startTimeUTC.getTime())) {
      const nzStart = utcToNZTime(startTimeUTC);
      dateStr = nzStart.date;
      startTimeStr = nzStart.time;
    } else {
      dateStr = format(now, "yyyy-MM-dd");
      startTimeStr = "09:00";
    }

    if (!isNaN(endTimeUTC.getTime())) {
      const nzEnd = utcToNZTime(endTimeUTC);
      endTimeStr = nzEnd.time;
    } else {
      endTimeStr = "17:00";
    }

    setSchedulingData({
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      assignedTo: job.teamId || job.staffId || "",
      notes: job.notes || "",
    });
    setShowSchedulingModal(true);
    setSelectedJob(null); // Close job detail modal
  };

  const handleEditJob = (job: JobAssignment) => {
    console.log("🔵 Job card clicked:", job.jobNumber || job.id);

    // Mark job as viewed - store current timestamp
    const lastViewedKey = `job-last-viewed-${job.id}`;
    localStorage.setItem(lastViewedKey, new Date().toISOString());

    setJobToEdit(job);
    setGlobalJobCardMode("edit");
    setShowGlobalJobCard(true);
    setSelectedJob(null); // Close the job details dialog
  };

  // Called when a job is dragged from the right panel and dropped onto a specific staff row + time slot.
  // Opens the Quick Assign dialog so the user can confirm crew + duration before persisting.
  const handleCalendarJobDrop = (
    jobId: string,
    date: Date,
    hour: number,
    employeeId: string,
  ) => {
    const job = jobsData?.data?.find((j: any) => j.id === jobId);
    if (!job) {
      toast({ title: "Job not found", variant: "destructive" });
      return;
    }
    const labelParts = [
      job.jobNumber ? `#${job.jobNumber}` : "",
      job.customerName ?? "",
    ].filter(Boolean);
    setPendingDrop({
      jobId,
      jobLabel: labelParts.join(" — "),
      customerName: job.customerName ?? "",
      address: job.address ?? "",
      date,
      hour,
      employeeId,
      defaultDurationHours: job.estimatedDuration || 2,
    });
  };

  // Persists the staff assignment(s) once the user confirms the Quick Assign dialog.
  const confirmPendingDrop = async (result: QuickAssignResult) => {
    if (!pendingDrop) return;
    const { jobId, date, hour } = pendingDrop;
    const job = jobsData?.data?.find((j: any) => j.id === jobId);
    if (!job) {
      setPendingDrop(null);
      return;
    }

    const totalMinutes = result.durationHours * 60 + result.durationMinutes;
    if (totalMinutes <= 0 || result.employeeIds.length === 0) {
      setPendingDrop(null);
      return;
    }
    const fractionalDurationHours = totalMinutes / 60;

    const nzDateStr = date.toLocaleDateString("en-CA", {
      timeZone: "Pacific/Auckland",
    });
    const startTimeStr = `${String(hour).padStart(2, "0")}:00`;
    const startDateTime = nzTimeToUTC(nzDateStr, startTimeStr);
    const endDateTime = new Date(
      startDateTime.getTime() + totalMinutes * 60_000,
    );

    // Dropping onto a single dispatch cell is a single-day placement. Clear any
    // stale scheduledEndDate (and pin the new time-of-day) so the job doesn't
    // keep an old end date — a leftover scheduledDate..scheduledEndDate span
    // makes the job show on every day in the range and splits its price per day.
    const updates: any = {
      scheduledDate: startDateTime.toISOString(),
      scheduledEndDate: null,
      scheduledStartTime: startTimeStr,
      scheduledEndTime: utcToNZTime(endDateTime).time,
      estimatedDuration: fractionalDurationHours,
    };
    const next = statusAfterBooking(job.status);
    if (next && next !== job.status) {
      updates.status = next;
    }

    // Close the modal immediately — the user has provided everything we need,
    // so the rest of the work runs in the background. The dispatch board
    // refetches when the staff-assignments POST resolves; on failure we toast.
    setPendingDrop(null);

    // Optimistically apply the same updates to the cached jobs list so the
    // card moves out of the Unscheduled pile the instant the drop is
    // confirmed. Invalidating ["/api/jobs"] alone doesn't touch this list —
    // its key is the full parameterized JOBS_QUERY_KEY — so without this the
    // card lingered until the 30s poll.
    queryClient.setQueryData([JOBS_QUERY_KEY], (prev: any) =>
      prev?.data
        ? {
            ...prev,
            data: prev.data.map((j: any) =>
              j.id === jobId ? { ...j, ...updates } : j,
            ),
          }
        : prev,
    );

    (async () => {
      try {
        await fetch(`/api/jobs/${jobId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        await fetch(`/api/jobs/${jobId}/staff-assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffAssignments: result.employeeIds.map((employeeId) => ({
              employeeId,
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              notes: "",
            })),
            sendNotifications: false,
            sendClientNotification: false,
            addOnly: true,
          }),
        });

        queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
      } catch {
        // Refetch rolls the optimistic patch back to server truth.
        queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
        toast({
          title: "Scheduling Failed",
          description: "Could not schedule the job. Please try again.",
          variant: "destructive",
        });
      }
    })();
  };

  // Pre-create a blank draft job and open the new card directly in edit
  // mode. Skips the legacy "create" form entirely — the new JobCardDesktop
  // (and JobCardMobile, once its create entry points get the same
  // treatment) handles the rest via its panels, including the customer
  // picker that JobDetailsPanel shows when customerId is null.
  //
  // The afterOpen callback lets each caller apply its existing side
  // effects (e.g. setJobFilters for lead/quote) once the draft is open.
  const createDraftMutation = useMutation<
    { success?: boolean; data?: { id?: string } },
    Error,
    { status: string; afterOpen?: () => void }
  >({
    mutationFn: async ({ status }) => {
      const res = await apiRequest("POST", "/api/jobs", { status });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? `Create failed (HTTP ${res.status})`);
      }
      return json;
    },
    onSuccess: (json, vars) => {
      const newId = json?.data?.id;
      if (!newId) {
        toast({
          title: "Couldn't open the new job",
          description: "Server didn't return an id — refresh and try again.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      // Set the modal to open against the brand-new draft. GlobalJobCard's
      // layout gate sees a real jobId and mounts JobCardDesktop directly.
      setJobToEdit({ jobId: newId, id: newId } as JobAssignment);
      setInitialJobData(null);
      setGlobalJobCardMode("edit");
      setShowGlobalJobCard(true);
      vars.afterOpen?.();
    },
    onError: (error) => {
      toast({
        title: "Couldn't create job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateJob = () => {
    createDraftMutation.mutate({ status: "work_order" });
  };

  const handleCreateLead = () => {
    createDraftMutation.mutate({
      status: "lead",
      afterOpen: () => setJobFilters(["lead"]),
    });
  };

  const handleCreateQuote = () => {
    createDraftMutation.mutate({
      status: "quote",
      afterOpen: () => setJobFilters(["quote"]),
    });
  };

  const handleCreateInvoice = () => {
    createDraftMutation.mutate({ status: "invoiced" });
  };

  const saveSchedule = () => {
    if (
      !jobToSchedule ||
      !schedulingData.date ||
      !schedulingData.startTime ||
      !schedulingData.endTime
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in the date and time fields.",
        variant: "destructive",
      });
      return;
    }

    // Convert NZ local time to UTC for storage
    // User inputs NZ time, we store UTC in database
    const startDateTime = nzTimeToUTC(
      schedulingData.date,
      schedulingData.startTime,
    );
    const endDateTime = nzTimeToUTC(
      schedulingData.date,
      schedulingData.endTime,
    );

    // Validate dates are valid
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      toast({
        title: "Invalid Date",
        description: "Please enter valid date and time values.",
        variant: "destructive",
      });
      return;
    }

    // Validate that end time is after start time
    if (endDateTime <= startDateTime) {
      toast({
        title: "Invalid Time Range",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    // Validate that scheduling is not in the past (compare in NZ timezone)
    const nowNZ = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" }),
    );
    if (startDateTime < nowNZ) {
      toast({
        title: "Invalid Date",
        description: "Cannot schedule jobs in the past.",
        variant: "destructive",
      });
      return;
    }

    // Calculate estimated duration in hours
    const durationMs = endDateTime.getTime() - startDateTime.getTime();
    const estimatedDuration = Math.round(durationMs / (1000 * 60 * 60)); // Convert to hours

    // Create updates object for backend (aligned with schema)
    // Store as UTC ISO string - will be converted back to NZ time for display
    const updates: any = {
      scheduledDate: startDateTime.toISOString(),
      estimatedDuration: estimatedDuration,
      specialInstructions: schedulingData.notes,
    };

    // Booking-driven status transition: scheduling a quote advances it to
    // work_order (booking = committing to the work). statusAfterBooking
    // returns null for every other status, leaving it unchanged.
    if (jobToSchedule) {
      const next = statusAfterBooking(jobToSchedule.status);
      if (next && next !== jobToSchedule.status) {
        updates.status = next;
      }
    }

    // Handle assignment based on mode (only if staff/team was actually selected)
    if (schedulingData.assignedTo) {
      if (assignmentMode === "teams") {
        const team = mockTeams.find((t) => t.id === schedulingData.assignedTo);
        if (team) {
          updates.assignedTeam = getTeamMembers(team.id).map(
            (member) => member.id,
          );
        }
      } else {
        updates.assignedTeam = [schedulingData.assignedTo];
      }
    }

    // Persist the changes to backend
    updateJobMutation.mutate(
      {
        id: jobToSchedule.id,
        updates,
      },
      {
        onSuccess: () => {
          setShowSchedulingModal(false);
          setJobToSchedule(null);
          // Refresh the jobs data
          queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        },
        onError: () => {
          toast({
            title: "Scheduling Failed",
            description: "Failed to schedule the job. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
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
    const activeTeams = mockTeams.filter(
      (team) => team.status === "available",
    ).length;
    const activeStaff = staffMembers.filter(
      (staff) => staff.status === "available",
    ).length;
    // 'scheduled' status retired 2026-05 — today's bookings are work_orders.
    const scheduledJobs = todaysJobs.filter(
      (job) => job.status === "work_order",
    ).length;
    const unconfirmedCount = countUnconfirmed(todaysJobs);

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
                {assignmentMode === "teams" ? (
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
              <Badge
                variant="secondary"
                data-testid={
                  assignmentMode === "teams" ? "active-teams" : "active-staff"
                }
              >
                {assignmentMode === "teams" ? activeTeams : activeStaff}
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
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="dispatch-date"
                >
                  {format(selectedDate, "MMM dd")}
                </span>
              </div>
              <div className="space-y-2">
                {todaysJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm"
                    data-testid={`next-job-${job.id}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${getPriorityColor(job.priority)}`}
                    />
                    <div className="flex-1 truncate">
                      <div className="font-medium">{job.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {job.address || "No address specified"}
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
                const event = new CustomEvent("switchTab", {
                  detail: "dispatch",
                });
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

  // Show loading state for full dispatch board
  if (jobsLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <Card className="flex-1">
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state for full dispatch board
  if (jobsError) {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Dispatch Board</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground">
              Failed to load jobs. Please try again.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unconfirmedCount = countUnconfirmed(todaysJobs);

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Desktop Layout: Split Screen with Resizable Panels */}
        <div
          className="hidden lg:flex flex-1 min-h-0 p-4 overflow-hidden"
          data-testid="dispatch-desktop-layout"
        >
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            {/* Left Panel: Dispatch Board (Calendar + Job Cards).
                Sole child of the outer group since PR #35 removed the right
                inline panel. The outer group is left in place as a thin
                wrapper for layout-class continuity; deleting it would shift
                spacing without changing behaviour. */}
            <ResizablePanel minSize={30}>
              <ResizablePanelGroup
                direction="horizontal"
                className="h-full"
                onLayout={(sizes) => {
                  setInnerPanelSizes(sizes);
                  localStorage.setItem(
                    "dispatch-inner-panel-sizes",
                    JSON.stringify(sizes),
                  );
                }}
              >
                {/* Calendar Grid */}
                <ResizablePanel
                  defaultSize={innerPanelSizes[0]}
                  minSize={35}
                  data-testid="calendar-grid-container"
                >
                  <div
                    className="h-full pr-2"
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <Card
                      className="h-full overflow-hidden"
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <CalendarGrid
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        onJobDrop={handleCalendarJobDrop}
                        draggingJob={draggingJob}
                      />
                    </Card>
                  </div>
                </ResizablePanel>

                <ResizableHandle
                  withHandle
                  className="bg-transparent hover:bg-border transition-colors"
                />

                {/* Job Cards Panel */}
                <ResizablePanel defaultSize={innerPanelSizes[1]} minSize={20}>
                  <div
                    className="flex h-full flex-col pl-2"
                    data-testid="job-cards-container"
                  >
                    <Card
                      className="overflow-x-hidden flex flex-col flex-1 min-h-0"
                      style={{ pointerEvents: "auto" }}
                    >
                      <CardHeader className="flex-shrink-0 border-b pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">
                            {panelTitle}
                          </CardTitle>
                          {showUnconfirmedBadge &&
                            unconfirmedCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setOnlyUnconfirmed(!onlyUnconfirmed)}
                                aria-pressed={onlyUnconfirmed}
                                title={onlyUnconfirmed ? "Clear filter" : "Show only jobs awaiting confirmation"}
                                data-testid="badge-unconfirmed-count"
                                className={`inline-flex items-center gap-1 rounded-lg border-0 px-2 h-6 text-xs font-medium transition-colors ${
                                  onlyUnconfirmed
                                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                <span>{unconfirmedCount} awaiting confirmation</span>
                                {onlyUnconfirmed && <X className="h-3 w-3" />}
                              </button>
                            )}
                        </div>

                        {/* Search Input - Desktop */}
                        <div className="mt-3 relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <Input
                            placeholder="Search jobs..."
                            value={searchQuery}
                            autoComplete="off"
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              if (isDeepSearchActive) {
                                setIsDeepSearchActive(false);
                                setDeepSearchResults([]);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && searchQuery.trim()) {
                                performDeepSearch(searchQuery);
                              }
                            }}
                            className="pl-8 pr-8 h-8 text-sm"
                            data-testid="desktop-job-search-input"
                          />
                          {isDeepSearchActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute right-4 top-[60%] transform -translate-y-1/2 h-6 w-6 p-0"
                              onClick={() => {
                                setIsDeepSearchActive(false);
                                setDeepSearchResults([]);
                                setSearchQuery("");
                              }}
                              data-testid="btn-clear-deep-search-desktop"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        {/* Deep Search Button - Desktop */}
                        {searchQuery.trim() && !isDeepSearchActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs mt-2"
                            onClick={() => performDeepSearch(searchQuery)}
                            disabled={isDeepSearchLoading}
                            data-testid="btn-deep-search-desktop"
                          >
                            <Search className="h-3 w-3 mr-1" />
                            {isDeepSearchLoading
                              ? "Searching..."
                              : "Deep Search"}
                          </Button>
                        )}

                        {/* Deep Search Status - Desktop */}
                        {isDeepSearchActive && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-2">
                            <SearchX className="h-3 w-3" />
                            {deepSearchResults.length} results
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="flex-1 overflow-y-auto p-0">
                        {/* Job Cards - Updated to match mobile design */}
                        <div className="divide-y divide-gray-100">
                          {getTodaysJobs().map((job) => {
                            const customerName =
                              job.customerName || "Unknown Customer";
                            const total = dailyTotalByJobId.get(job.id) ?? calculateDailyTotal(job);
                            const fullAddress = job.address?.trim() || "";

                            // Get status badge styling - same as mobile
                            const getDesktopStatusBadge = () => {
                              switch (job.status) {
                                case "lead":
                                  return {
                                    label: "Lead",
                                    bg: "bg-emerald-50",
                                    text: "text-emerald-700",
                                    dot: true,
                                  };
                                case "quote":
                                  return {
                                    label: "Quote",
                                    bg: "bg-amber-50",
                                    text: "text-amber-700",
                                    icon: "≡",
                                  };
                                case "work_order":
                                  return {
                                    label: "Work Order",
                                    bg: "bg-blue-50",
                                    text: "text-blue-700",
                                    icon: "≡",
                                  };
                                case "scheduled":
                                  return {
                                    label: "Scheduled",
                                    bg: "bg-emerald-50",
                                    text: "text-emerald-700",
                                  };
                                case "completed":
                                  return {
                                    label: "Completed",
                                    bg: "bg-slate-100",
                                    text: "text-slate-700",
                                  };
                                case "unsuccessful":
                                  return {
                                    label: "Unsuccessful",
                                    bg: "bg-red-50",
                                    text: "text-red-700",
                                  };
                                default:
                                  return {
                                    label: job.status || "Job",
                                    bg: "bg-gray-100",
                                    text: "text-gray-700",
                                  };
                              }
                            };

                            const statusBadge = getDesktopStatusBadge();
                            const hasPhone =
                              job.jobContactPhone ||
                              job.jobContactMobile ||
                              job.customerPhone ||
                              job.phone;

                            return (
                              <div
                                key={job.id}
                                className="bg-white hover:bg-gray-50 cursor-pointer transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_120px]"
                                style={(() => {
                                  const firstId = job.assignedTeam?.[0];
                                  const pal = firstId ? crewPaletteMap.get(firstId) : undefined;
                                  return pal ? { borderLeft: `3px solid ${pal.dot}` } : {};
                                })()}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("jobId", job.id);
                                  e.dataTransfer.effectAllowed = "move";
                                  // Compact custom drag ghost so the cursor isn't dragging the whole job card around.
                                  const ghost = document.createElement("div");
                                  ghost.style.cssText =
                                    "position:absolute;top:-1000px;left:-1000px;padding:4px 10px;background:#1d4ed8;color:white;border-radius:6px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.2);pointer-events:none;";
                                  const label = job.jobNumber
                                    ? `#${job.jobNumber} ${job.customerName ?? ""}`
                                    : job.customerName ?? "Job";
                                  ghost.textContent = label.trim();
                                  document.body.appendChild(ghost);
                                  e.dataTransfer.setDragImage(ghost, 12, 12);
                                  setTimeout(() => {
                                    if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
                                  }, 0);
                                  setDraggingJob({
                                    id: job.id,
                                    durationHours: job.estimatedDuration || 2,
                                    customerName: job.customerName ?? "",
                                  });
                                  // Prevent click from firing after drag
                                  e.currentTarget.dataset.dragging = "true";
                                }}
                                onDragEnd={(e) => {
                                  delete e.currentTarget.dataset.dragging;
                                  setDraggingJob(null);
                                }}
                                onClick={(e) => {
                                  // Don't open job card if user just dragged
                                  if (
                                    (e.currentTarget as HTMLElement).dataset
                                      .dragging
                                  )
                                    return;
                                  handleEditJob(job);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.target !== e.currentTarget) return;
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleEditJob(job);
                                  }
                                }}
                                data-testid={`desktop-job-card-${job.id}`}
                              >
                                <div className="relative flex items-start gap-2.5 py-4 pr-4 pl-6">
                                  {/* Drag handle indicator — sits in the left gutter so it doesn't push content right */}
                                  <div className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-60 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                  {/* Customer Avatar - Large Circle */}
                                  <div className="relative flex-shrink-0">
                                    <CustomerAvatar
                                      customerName={customerName}
                                      status={job.status}
                                      size="lg"
                                    />
                                    {hasRecentActivity(job) && (
                                      <div
                                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"
                                        data-testid={`activity-indicator-${job.id}`}
                                      />
                                    )}
                                  </div>

                                  {/* Job Content */}
                                  <div className="flex-1 min-w-0">
                                    {/* Row 1: Customer Name + Job Number + Price */}
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <h3
                                        className="text-[15px] font-semibold text-slate-900 truncate flex-1"
                                        data-testid={`desktop-job-customer-${job.id}`}
                                      >
                                        {customerName}
                                      </h3>
                                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        <span className="text-sm text-slate-400">
                                          #{job.jobNumber || "0000"}
                                        </span>
                                        {total > 0 && (
                                          <span className="text-sm font-medium text-slate-900">
                                            {formatCurrency(total)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Row 2: Location + Status Badge */}
                                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-1">
                                      <div className="flex items-start gap-1.5 text-sm text-gray-500 min-w-0 grow shrink basis-36">
                                        <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <span className="whitespace-normal break-words min-w-0">
                                          {fullAddress || "No location"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <Badge
                                          className={`${statusBadge.bg} ${statusBadge.text} text-xs font-medium border-0 rounded-lg`}
                                        >
                                          {statusBadge.dot && (
                                            <span className="w-2 h-2 rounded-full mr-1.5 bg-current" />
                                          )}
                                          {statusBadge.icon && (
                                            <span className="mr-1">
                                              {statusBadge.icon}
                                            </span>
                                          )}
                                          {statusBadge.label}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* Row 2b: Queue reason badge (only when in queue) */}
                                    {job.inQueue && (
                                      <div className="mb-1">
                                        <Badge className="bg-amber-50 text-amber-700 border-0 text-xs rounded-lg">
                                          {job.queueReason || "Queued"}
                                        </Badge>
                                      </div>
                                    )}

                                    {/* Missed booking — the date passed without completion, so
                                        the job is back under Unscheduled; explain why it reappeared */}
                                    {job.status === "work_order" &&
                                      job.scheduledDate &&
                                      !hasUpcomingBookingNZ(job) && (
                                        <div className="mb-1">
                                          <Badge className="bg-amber-50 text-amber-700 border-0 text-xs rounded-lg">
                                            <CalendarX className="h-3 w-3 mr-1" />
                                            Was booked{" "}
                                            {format(new Date(job.scheduledDate), "MMM d")} — needs
                                            rebooking
                                          </Badge>
                                        </div>
                                      )}

                                    {/* Row 2d: Lane chip (when the job sits in a custom lane) */}
                                    {job.laneId && laneMap.get(job.laneId) && (
                                      <div className="mb-1">
                                        <Badge className="bg-slate-50 text-slate-700 border-0 text-xs rounded-lg">
                                          <span
                                            className="w-2 h-2 rounded-full mr-1.5"
                                            style={{ backgroundColor: laneMap.get(job.laneId)!.color }}
                                          />
                                          {laneMap.get(job.laneId)!.name}
                                        </Badge>
                                      </div>
                                    )}

                                    {/* Row 2c: Customer confirmed badge */}
                                    {(job.customerConfirmed || job.confirmationReplySentAt) && (
                                      <div className="mb-1 flex items-center gap-1 flex-wrap">
                                        {job.customerConfirmed && (
                                          <Badge className="bg-emerald-50 text-emerald-700 border-0 text-xs rounded-lg">
                                            <Check className="h-3 w-3 mr-1" />
                                            Confirmed
                                          </Badge>
                                        )}
                                        {job.confirmationReplySentAt && (
                                          <Badge className="bg-blue-50 text-blue-700 border-0 text-xs rounded-lg">
                                            <Reply className="h-3 w-3 mr-1" />
                                            Reply sent
                                          </Badge>
                                        )}
                                      </div>
                                    )}

                                    {/* Row 2d: ETA notification requested badge */}
                                    {job.etaNotificationRequested && (
                                      <div className="mb-1">
                                        <Badge className="bg-amber-50 text-amber-700 border-0 text-xs rounded-lg">
                                          <Bell className="h-3 w-3 mr-1" />
                                          Notify ETA
                                        </Badge>
                                      </div>
                                    )}

                                    {/* Row 3: Multi-day badge or description */}
                                    {job.scheduledEndDate && (
                                      <div className="flex items-center gap-1 mb-1">
                                        <Badge className="bg-amber-50 text-amber-700 border-0 text-xs rounded-lg">
                                          {format(
                                            new Date(job.startTime),
                                            "MMM d",
                                          )}{" "}
                                          –{" "}
                                          {format(
                                            new Date(job.scheduledEndDate),
                                            "MMM d",
                                          )}
                                        </Badge>
                                      </div>
                                    )}
                                    {/* Description — always reserved so every card keeps the same height
                                        regardless of whether a description is set. Clamps to 3 lines max. */}
                                    <p className="text-sm text-gray-500 line-clamp-3 mb-2 min-h-[3.75rem]">
                                      {job.description || ''}
                                    </p>

                                    {/* Crew colour indicators */}
                                    {job.assignedTeam && job.assignedTeam.length > 0 && (
                                      <div className="flex items-center gap-1 mt-1">
                                        {job.assignedTeam.slice(0, 5).map((empId: string) => {
                                          const emp = employeeMap.get(empId);
                                          const pal = crewPaletteMap.get(empId);
                                          if (!pal) return null;
                                          const label = emp ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() : empId;
                                          return (
                                            <div
                                              key={empId}
                                              title={label}
                                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ring-2 ring-white"
                                              style={{ backgroundColor: pal.dot }}
                                            >
                                              {emp ? crewInitials(emp.firstName, emp.lastName) : '?'}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </div>
                            );
                          })}

                          {/* Empty State */}
                          {getTodaysJobs().length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                              <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm">
                                No jobs scheduled for this date
                              </p>
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
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            {/* Right-side inline job panel was removed — dispatch now opens
                jobs in the same full-screen modal /all-jobs uses, mounted
                below (no longer lg:hidden). Frees the full board width and
                keeps a single job-view layout across the app. */}
          </ResizablePanelGroup>
        </div>

        {/* Mobile Layout: ServiceM8-style job cards */}
        <div
          className="lg:hidden flex flex-col flex-1 min-h-0 overflow-hidden bg-gray-50"
          onTouchStart={handleSwipeTouchStart}
          onTouchEnd={handleSwipeTouchEnd}
        >
          {/* Search strip — pinned below main header */}
          <div className="flex-shrink-0 z-50">
          {showMobileSearch && (
          <div className="bg-background border-b px-3 py-1 flex flex-col gap-1">
              <div className="flex flex-col gap-1 pb-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      autoComplete="off"
                      placeholder="Search jobs..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (isDeepSearchActive) {
                          setIsDeepSearchActive(false);
                          setDeepSearchResults([]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchQuery.trim()) {
                          performDeepSearch(searchQuery);
                        }
                      }}
                      className="pl-9 pr-9 h-9 text-sm rounded-xl"
                      data-testid="mobile-job-search-input"
                    />
                    {searchQuery && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-4 top-[60%] -translate-y-1/2 h-7 w-7"
                        onClick={() => {
                          setSearchQuery("");
                          setIsDeepSearchActive(false);
                          setDeepSearchResults([]);
                        }}
                        data-testid="btn-clear-search-mobile"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {searchQuery.trim() && !isDeepSearchActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-9 px-3"
                      onClick={() => performDeepSearch(searchQuery)}
                      disabled={isDeepSearchLoading}
                      data-testid="btn-deep-search-mobile"
                    >
                      {isDeepSearchLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5 mr-1" />
                          Deep
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {isDeepSearchActive && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    <SearchX className="h-3 w-3" />
                    {deepSearchResults.length} results found
                  </div>
                )}
              </div>
          </div>
          )}
          {showUnconfirmedBadge &&
            unconfirmedCount > 0 && (
              <div className="bg-background border-b px-3 py-2">
                <button
                  type="button"
                  onClick={() => setOnlyUnconfirmed(!onlyUnconfirmed)}
                  aria-pressed={onlyUnconfirmed}
                  data-testid="badge-unconfirmed-count-mobile"
                  className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-3 py-1.5 text-xs font-medium transition-colors ${
                    onlyUnconfirmed
                      ? "bg-amber-100 text-amber-800"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <span>{unconfirmedCount} awaiting confirmation</span>
                  {onlyUnconfirmed && <X className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>{/* end header group */}

          {/* Jobs List - scrollable area with pull-to-refresh */}
          <div className="flex-1 min-h-0">
          <PullToRefresh
            onRefresh={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["/api/jobs"] }),
                queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] }),
                queryClient.invalidateQueries({ queryKey: ["/api/customers"] }),
                queryClient.invalidateQueries({ queryKey: ["/api/employees/active"] }),
              ]);
            }}
          >
          <div className="divide-y divide-gray-100 w-full">
              {getTodaysJobs().map((job: any) => {
                const customerName = job.customerName || "Unknown Customer";
                const total = dailyTotalByJobId.get(job.id) ?? calculateDailyTotal(job);
                const suburb = job.address?.split(",")[0]?.trim() || "";

                // Get status badge styling
                const getStatusBadge = () => {
                  switch (job.status) {
                    case "lead":
                      return {
                        label: "Lead",
                        bg: "bg-emerald-50",
                        text: "text-emerald-700",
                        dot: "bg-emerald-500",
                      };
                    case "quote":
                      return {
                        label: "Quote",
                        bg: "bg-amber-50",
                        text: "text-amber-700",
                        icon: "≡",
                      };
                    case "work_order":
                      return {
                        label: "Work Order",
                        bg: "bg-blue-50",
                        text: "text-blue-700",
                        icon: "≡",
                      };
                    case "scheduled":
                      return {
                        label: "Scheduled",
                        bg: "bg-emerald-50",
                        text: "text-emerald-700",
                      };
                    case "completed":
                      return {
                        label: "Completed",
                        bg: "bg-slate-100",
                        text: "text-slate-700",
                      };
                    case "unsuccessful":
                      return {
                        label: "Unsuccessful",
                        bg: "bg-red-50",
                        text: "text-red-700",
                      };
                    default:
                      return {
                        label: job.status || "Job",
                        bg: "bg-gray-100",
                        text: "text-gray-700",
                      };
                  }
                };

                const statusBadge = getStatusBadge();
                const hasPhone =
                  job.jobContactPhone ||
                  job.jobContactMobile ||
                  job.customerPhone ||
                  job.phone;

                // Get job type icon based on service type
                const getServiceTypeIcon = () => {
                  const serviceType = (job.serviceType || "").toLowerCase();
                  if (
                    serviceType.includes("removal") ||
                    serviceType.includes("tree")
                  ) {
                    return (
                      <TreePine className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    );
                  }
                  if (
                    serviceType.includes("hedge") ||
                    serviceType.includes("prune") ||
                    serviceType.includes("trim")
                  ) {
                    return (
                      <Scissors className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    );
                  }
                  if (
                    serviceType.includes("stump") ||
                    serviceType.includes("grind")
                  ) {
                    return (
                      <Axe className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                    );
                  }
                  if (
                    serviceType.includes("plant") ||
                    serviceType.includes("garden")
                  ) {
                    return (
                      <Sprout className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    );
                  }
                  return null;
                };

                return (
                  <div
                    key={job.id}
                    className="bg-white hover:bg-gray-50 cursor-pointer transition-colors w-full overflow-hidden [content-visibility:auto] [contain-intrinsic-size:auto_130px]"
                    style={(() => {
                      const firstId = job.assignedTeam?.[0];
                      const pal = firstId ? crewPaletteMap.get(firstId) : undefined;
                      return pal ? { borderLeft: `3px solid ${pal.dot}` } : {};
                    })()}
                    onClick={() => handleEditJob(job)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleEditJob(job);
                      }
                    }}
                    data-testid={`job-card-${job.id}`}
                  >
                    <div className="flex items-start gap-3 p-4 min-w-0 overflow-hidden">
                      {/* Customer Avatar - Large Circle */}
                      <div className="relative flex-shrink-0">
                        <CustomerAvatar
                          customerName={customerName}
                          status={job.status}
                          size="lg"
                        />
                        {hasRecentActivity(job) && (
                          <div
                            className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"
                            data-testid={`activity-indicator-${job.id}`}
                          />
                        )}
                      </div>

                      {/* Job Content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Customer Name + Job Number + Price */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-[15px] font-semibold text-slate-900 truncate flex-1">
                            {customerName}
                          </h3>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <span className="text-sm text-slate-400">
                              #{job.jobNumber || "0000"}
                            </span>
                            {total > 0 && (
                              <span className="text-sm font-medium text-slate-900">
                                {formatCurrency(total)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Location + Service Type with Icon + Status Badge */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 text-sm min-w-0">
                            <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-semibold text-gray-800 line-clamp-1">
                              {job.address || "No location"}
                            </span>
                            {job.serviceType && (
                              <>
                                <span className="text-gray-300 flex-shrink-0">|</span>
                                {getServiceTypeIcon()}
                                <span className="truncate text-gray-500">
                                  {job.serviceType}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                            {job.customerConfirmed && (
                              <Badge className="bg-emerald-50 text-emerald-700 border-0 text-xs rounded-lg">
                                <Check className="h-3 w-3 mr-1" />
                                Confirmed
                              </Badge>
                            )}
                            {job.confirmationReplySentAt && (
                              <Badge className="bg-blue-50 text-blue-700 border-0 text-xs rounded-lg">
                                <Reply className="h-3 w-3 mr-1" />
                                Reply sent
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Queue reason row — own line so it never blocks the address */}
                        {job.inQueue && job.queueReason && (
                          <div className="mb-1.5">
                            <Badge className="bg-amber-50 text-amber-700 border-0 text-xs rounded-lg">
                              {job.queueReason}
                            </Badge>
                          </div>
                        )}

                        {/* Missed booking — the date passed without completion, so the
                            job is back under Unscheduled; explain why it reappeared */}
                        {job.status === "work_order" &&
                          job.scheduledDate &&
                          !hasUpcomingBookingNZ(job) && (
                            <div className="mb-1.5">
                              <Badge className="bg-amber-50 text-amber-700 border-0 text-xs rounded-lg">
                                <CalendarX className="h-3 w-3 mr-1" />
                                Was booked{" "}
                                {format(new Date(job.scheduledDate), "MMM d")} — needs
                                rebooking
                              </Badge>
                            </div>
                          )}

                        {/* Row 3: Description snippet — always 1 line for consistent card height */}
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2 min-h-5">
                          {job.description || ""}
                        </p>

                        {/* Row 4: Action indicators */}
                        <div className="flex items-center gap-2">
                          {job.priority === "urgent" && (
                            <Badge className="bg-orange-500 text-white text-xs border-0">
                              <Zap className="h-3 w-3 mr-1" />
                              Urgent
                            </Badge>
                          )}
                          {job.scheduledEndDate ? (
                            <Badge className="bg-amber-50 text-amber-700 border-0 text-xs rounded-lg">
                              {format(new Date(job.startTime), "MMM d")} –{" "}
                              {format(new Date(job.scheduledEndDate), "MMM d")}
                            </Badge>
                          ) : job.startTime ? (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(job.startTime), "MMM d")}
                            </span>
                          ) : null}
                        </div>

                        {/* Crew colour indicators */}
                        {job.assignedTeam && job.assignedTeam.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            {job.assignedTeam.slice(0, 5).map((empId: string) => {
                              const emp = employeeMap.get(empId);
                              const pal = crewPaletteMap.get(empId);
                              if (!pal) return null;
                              return (
                                <div
                                  key={empId}
                                  title={emp ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() : empId}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ring-2 ring-white"
                                  style={{ backgroundColor: pal.dot }}
                                >
                                  {emp ? crewInitials(emp.firstName, emp.lastName) : '?'}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty State */}
              {getTodaysJobs().length === 0 && (
                <div className="p-8 text-center text-gray-500 bg-white">
                  <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-base mb-1">No jobs found</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Create your first job to get started
                  </p>
                  <Button size="default" onClick={handleCreateJob}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </div>
              )}
            </div>
          </PullToRefresh>
          </div>
        </div>
      </div>

      {/* Modal version — mounts on all screen sizes now (mobile already
          mounted it here; desktop used to dock GlobalJobCard inline in a
          ResizablePanel above, which was removed when we switched dispatch
          to use the same modal /all-jobs uses). The modal itself routes
          through GlobalJobCard's layout gate: mobile gets JobCardMobile,
          desktop gets JobCardDesktop. */}
      {showGlobalJobCard && (
        <JobCardErrorBoundary onClose={() => { setShowGlobalJobCard(false); setJobToEdit(null); setInitialJobData(null); }}>
          <GlobalJobCard
            isOpen={true}
            mode={globalJobCardMode}
            jobId={jobToEdit?.jobId || jobToEdit?.id}
            initialData={initialJobData}
            initialSidebarTab={initialSidebarTab}
            onClose={() => {
              setShowGlobalJobCard(false);
              setJobToEdit(null);
              setInitialJobData(null);
              setInitialSidebarTab(undefined);
            }}
          />
        </JobCardErrorBoundary>
      )}

      {/* Create Lead from Message Dialog */}
      <CreateLeadFromMessageDialog
        open={showCreateFromMessageDialog}
        onOpenChange={setShowCreateFromMessageDialog}
        onLeadCreated={async (data) => {
          // Prevent duplicate job creation from double-clicks
          if (isCreatingLeadJobRef.current) {
            console.log(
              "📸 Already creating a lead job, ignoring duplicate call",
            );
            return;
          }
          isCreatingLeadJobRef.current = true;
          setShowCreateFromMessageDialog(false);

          // Automatically create the job from extracted data
          try {
            console.log("📸 Creating job from extracted data:", data);
            // Detect if phone is a mobile number (NZ mobile prefixes: 21, 22, 27, 29)
            const phone = data.phone || "";
            const isMobile =
              /^\+?64\s?(2[1279])/.test(phone.replace(/\s/g, "")) ||
              /^0?2[1279]/.test(phone.replace(/\s/g, ""));

            const nameParts = (data.name || "New Lead").trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            const res = await apiRequest("POST", "/api/jobs", {
              newCustomerName: data.name || "New Lead",
              newCustomerPhone: isMobile ? "" : phone,
              newCustomerMobile: isMobile ? phone : "",
              newCustomerEmail: data.email || "",
              address: data.address || "",
              description: data.description || "",
              leadSource: "sms",
              status: "quote",
              isNewCustomer: true,
              jobContactFirstName: firstName,
              jobContactLastName: lastName,
              jobContactPhone: isMobile ? "" : phone,
              jobContactMobile: isMobile ? phone : "",
              jobContactEmail: data.email || "",
            });
            const response = await res.json();
            console.log("📸 Job creation response:", response);

            if (response.success && response.data) {
              // Refresh jobs and customers lists
              queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/customers"] });

              // Open the newly created job for editing
              setJobToEdit(response.data as JobAssignment);
              setGlobalJobCardMode("edit");
              setShowGlobalJobCard(true);
            }
          } catch (error) {
            console.error("Failed to create job from lead:", error);
            toast({
              title: "Error",
              description: "Failed to create job. Please try again.",
              variant: "destructive",
            });
          } finally {
            isCreatingLeadJobRef.current = false;
          }
        }}
      />

      {/* Queue Reason Dialog */}
      <Dialog
        open={showQueueDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowQueueDialog(false);
            setQueueTargetJob(null);
            setQueueReasonInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-amber-500" />
              Add to Dispatch Queue
            </DialogTitle>
            <DialogDescription>
              {queueTargetJob && (
                <span>
                  #{queueTargetJob.jobNumber} — {queueTargetJob.customerName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium mb-2 block">
              Reason for queuing
            </Label>
            <Select
              value={queueReasonInput}
              onValueChange={setQueueReasonInput}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {QUEUE_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowQueueDialog(false);
                setQueueTargetJob(null);
                setQueueReasonInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!queueReasonInput || queueJobMutation.isPending}
              onClick={() => {
                if (queueTargetJob && queueReasonInput) {
                  queueJobMutation.mutate({
                    id: queueTargetJob.id,
                    inQueue: true,
                    queueReason: queueReasonInput,
                  });
                }
              }}
            >
              {queueJobMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Inbox className="h-4 w-4 mr-1" />
              )}
              Add to Queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pendingDrop && (
        <QuickAssignDialog
          open
          jobLabel={pendingDrop.jobLabel}
          customerName={pendingDrop.customerName}
          address={pendingDrop.address}
          droppedHour={pendingDrop.hour}
          droppedEmployeeId={pendingDrop.employeeId}
          employees={employees}
          defaultDurationHours={pendingDrop.defaultDurationHours}
          isSubmitting={isConfirmingDrop}
          onCancel={() => {
            if (!isConfirmingDrop) setPendingDrop(null);
          }}
          onConfirm={confirmPendingDrop}
        />
      )}
    </>
  );
}

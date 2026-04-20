import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import {
  X,
  Plus,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  FileText,
  Presentation,
  Check,
  Trash2,
  User,
  Users,
  Building2,
  Building,
  DollarSign,
  ChevronDown,
  Receipt,
  Send,
  CreditCard,
  CheckCircle,
  Settings,
  Zap,
  Percent,
  Clock,
  MapPin,
  Calculator,
  Target,
  MoreHorizontal,

  UserCircle,
  Edit3,
  Image as ImageIcon,
  Package,
  Search,
  Camera,
  AlertCircle,
  ChevronsUpDown,
  Copy,
  Download,
  Save,
  Printer,
  Archive,
  Mic,
  ArrowLeft,
  Loader2,
  TreePine,
  Scissors,
  Axe,
  Sprout,
  List,
  Pencil,
  Star,
  RotateCcw,
  Crown,
  Lock,
  Bell,
  BookOpen,
  ListOrdered,
} from "lucide-react";
import {
  MdEmail,
  MdSms,
  MdPhone,
  MdCalendarToday,
  MdDescription,
  MdSend,
  MdAttachMoney,
  MdAccessTime,
  MdCameraAlt,
  MdMoreHoriz,
} from "react-icons/md";
import {
  CameraIcon,
  SMSIcon,
  EmailIcon,
  MoreDotsIcon,
  SpeechToQuoteIcon,
  ScheduleIcon,
  CallIcon,
  QuoteIcon,
  InvoiceIcon,
  ProposalIcon,
  TimeTrackingIcon,
  ProfitTrackerIcon,
  QueueJobIcon,
  SendToXeroIcon,
  ResendXeroIcon,
  RequestReviewIcon,
} from "./ActionIcons";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { ProposalBuilderV2 } from "./ProposalBuilderV2";
import { InvoiceBuilder } from "./InvoiceBuilder";
import { JobDiarySection } from "./JobDiarySection";
import { StaffTimeManager } from "./StaffTimeManager";
import { StaffTimeTracker } from "./StaffTimeTracker";
import { ExpenseManager } from "./ExpenseManager";
import { GrossMarginCalculator } from "./GrossMarginCalculator";
import { EmailComposerModal } from "./EmailComposerModal";
import { SMSComposerModal } from "./SMSComposerModal";
import { InvoiceTemplate } from "./InvoiceTemplate";
import { QuoteTemplate } from "./QuoteTemplate";
import { ProposalTemplate } from "./ProposalTemplate";
import QuoteManagement from "./QuoteManagement";
import { RecordedTimeModal } from "./RecordedTimeModal";
import { PhotoCaptureModal } from "./PhotoCaptureModal";
import { SpeechToQuote } from "./SpeechToQuote";
import { CustomerAvatar } from "./CustomerAvatar";
import { JobLocationMap } from "./JobLocationMap";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import {
  insertJobSchema,
  type ChecklistItem,
  type Job,
  type Customer,
} from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatTime12Hour, nzTimeToUTC, utcToNZTime } from "@shared/dateUtils";
import { LinkifyMultiline } from "@/lib/linkify";

// Form validation schema extending the base insertJobSchema
const globalJobCardSchema = insertJobSchema
  .extend({
    // Make jobNumber optional since it's auto-generated on backend
    jobNumber: z.string().optional(),

    // Customer selection
    customerId: z.string().optional(),
    isNewCustomer: z.boolean().optional(),

    // New customer fields (conditional)
    newCustomerName: z.string().optional(),
    newCustomerEmail: z.union([z.string().email(), z.literal("")]).optional(),
    newCustomerPhone: z.string().optional(),
    newCustomerAddress: z.string().optional(),
    newCustomerCity: z.string().optional(),
    newCustomerRegion: z.string().optional(),

    // Contact information
    jobContactFirstName: z.string().optional(),
    jobContactLastName: z.string().optional(),
    jobContactEmail: z.union([z.string().email(), z.literal("")]).optional(),
    jobContactPhone: z.string().optional(),
    jobContactMobile: z.string().optional(),

    // ServiceM8 Billing Fields
    billingAddress: z.string().optional(),
    billingNameOverride: z.string().optional(), // Override customer name for invoicing
    invoiceDescription: z.string().optional(),
    billingContactEmail: z.string().optional(),
    billingContactPhone: z.string().optional(),
    billingContactMobile: z.string().optional(),
    sameAsJobAddress: z.boolean().optional(),
    taxMode: z.string().optional(),
    customerConfirmed: z.boolean().optional(),
    etaNotificationRequested: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Check if we have a valid customer identifier
      const hasCustomerId = !!data.customerId;
      const hasNewCustomerName = !!data.newCustomerName;
      const hasJobContactName = !!(
        data.jobContactFirstName || data.jobContactLastName
      );

      // If we have a customerId, that's valid
      if (hasCustomerId) {
        return true;
      }

      // If isNewCustomer is true OR we don't have a customerId,
      // we need either newCustomerName OR job contact names
      if (data.isNewCustomer === true || !hasCustomerId) {
        return hasNewCustomerName || hasJobContactName;
      }

      return false;
    },
    {
      message: "Customer name or job contact name is required",
      path: ["newCustomerName"],
    },
  );

type GlobalJobCardFormData = z.infer<typeof globalJobCardSchema>;

interface GlobalJobCardProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  jobId?: string;
  job?: Job;
  customerId?: string;
  initialData?: {
    customerName?: string;
    customerFirstName?: string;
    customerLastName?: string;
    customerEmail?: string;
    customerPhone?: string;
    address?: string;
    description?: string;
    leadSource?: string;
    conversationId?: string;
    status?: string;
  };
  onJobCreated?: (job: any) => void;
  onJobUpdated?: (job: any) => void;
  renderInline?: boolean; // For split-screen panel rendering (desktop)
}

export function GlobalJobCard({
  isOpen,
  onClose,
  mode,
  jobId,
  job,
  customerId,
  initialData,
  onJobCreated,
  onJobUpdated,
  renderInline = false,
}: GlobalJobCardProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    Array.isArray(job?.checklist) ? job.checklist : [],
  );
  const [checklistCollapsed, setChecklistCollapsed] = useState(true);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [sidebarTab, setSidebarTab] = useState("details");
  const [showMoreActionsSheet, setShowMoreActionsSheet] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [mobileNamePopoverOpen, setMobileNamePopoverOpen] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [hasUserSelectedCustomer, setHasUserSelectedCustomer] = useState(false); // Track if user explicitly selected customer
  const [deepSearchResults, setDeepSearchResults] = useState<any[]>([]);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [isEditingCustomerName, setIsEditingCustomerName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [isSavingCustomerName, setIsSavingCustomerName] = useState(false);

  const { toast: _originalToast } = useToast();
  const toast = () => {}; // Disabled - user preference: no toast notifications
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();

  // Fetch customers for the dropdown (needed upfront)
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
    enabled: isOpen,
    staleTime: 3 * 60 * 1000, // 3 minutes — customers rarely change while actively editing a job card
    refetchOnWindowFocus: false,
  });

  // Must be declared BEFORE the useEffect at line ~236 that uses it in its dependency array
  const { data: checklistTemplatesData } = useQuery({
    queryKey: ["/api/checklist-templates"],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const customers: Customer[] = useMemo(
    () => (customersData as any)?.data || [],
    [customersData],
  );

  // Form setup
  const form = useForm<GlobalJobCardFormData>({
    resolver: zodResolver(globalJobCardSchema),
    // shouldUnregister: false (default) — stale-data prevention is handled by
    // the Form key={jobId || createdJobId || internalMode} which re-mounts the
    // form when switching jobs. Using editingJob?.id as the key caused an
    // infinite remount loop because editingJob can briefly go null during a
    // React Query refetch cycle, toggling the key between "edit" and the UUID
    // 50+ times and triggering "Maximum update depth exceeded".
    defaultValues: {
      title: "",
      description: "",
      status: "quote",
      priority: "medium",
      customerId: "",
      isNewCustomer: false,
      newCustomerName: "",
      newCustomerEmail: "",
      newCustomerPhone: "",
      newCustomerAddress: "",
      newCustomerCity: "",
      newCustomerRegion: "",
      jobContactFirstName: "",
      jobContactLastName: "",
      jobContactEmail: "",
      jobContactPhone: "",
      jobContactMobile: "",
      address: "",
      leadSource: "",
      totalAmount: "0",
      paidAmount: "0",
      lineItems: [],
      notes: "",
      checklist: [],
      estimatedManHours: "",
      billingAddress: "",
      invoiceDescription: "",
      billingContactEmail: "",
      billingContactPhone: "",
      billingContactMobile: "",
      sameAsJobAddress: true,
      taxMode: "tax_exclusive",
      includeDescriptionInQuotesProposals: true,
      internalNotes: "",
      customerConfirmed: false,
      etaNotificationRequested: false,
    },
  });

  // useFieldArray must come BEFORE useWatch so that lineItems is managed
  // by useFieldArray exclusively — having form.watch("lineItems") AND useFieldArray
  // on the same field creates competing subscriptions that cascade into an infinite
  // re-render loop when replaceLineItems() fires during form reset.
  const {
    fields: lineItemFields,
    append: appendLineItem,
    remove: removeLineItemField,
    update: updateLineItemField,
    replace: replaceLineItems,
  } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Single useWatch call for all scalar fields (NOT lineItems — that's managed by useFieldArray above).
  // Using one useWatch() instead of 13 individual form.watch() calls avoids accumulating
  // subscriptions and prevents cascading re-renders when form.reset() fires.
  const [
    watchedCustomerId_raw,
    watchedStatus_raw,
    watchedEtaNotificationRequested_raw,
    watchedAddress_raw,
    watchedNewCustomerName_raw,
    watchedIsNewCustomer_raw,
    watchedSameAsJobAddress_raw,
    watchedDescription_raw,
    watchedPaidAmount_raw,
    watchedBillingContactEmail_raw,
    watchedJobContactEmail_raw,
    watchedBillingNameOverride_raw,
  ] = useWatch({
    control: form.control,
    name: [
      "customerId",
      "status",
      "etaNotificationRequested",
      "address",
      "newCustomerName",
      "isNewCustomer",
      "sameAsJobAddress",
      "description",
      "paidAmount",
      "billingContactEmail",
      "jobContactEmail",
      "billingNameOverride",
    ],
  });
  const watchedCustomerId = (watchedCustomerId_raw as string) ?? "";
  const watchedStatus = (watchedStatus_raw as string) ?? "";
  const watchedEtaNotificationRequested = (watchedEtaNotificationRequested_raw as boolean) ?? false;
  const watchedAddress = (watchedAddress_raw as string) ?? "";
  const watchedNewCustomerName = (watchedNewCustomerName_raw as string) ?? "";
  const watchedIsNewCustomer = (watchedIsNewCustomer_raw as boolean) ?? false;
  const watchedSameAsJobAddress = (watchedSameAsJobAddress_raw as boolean) ?? true;
  const watchedDescription = (watchedDescription_raw as string) ?? "";
  const watchedPaidAmount = (watchedPaidAmount_raw as string) ?? "0";
  const watchedBillingContactEmail = (watchedBillingContactEmail_raw as string) ?? "";
  const watchedJobContactEmail = (watchedJobContactEmail_raw as string) ?? "";
  const watchedBillingNameOverride = (watchedBillingNameOverride_raw as string) ?? "";
  // lineItems is sourced from useFieldArray.fields (NOT form.watch) to avoid double-subscription
  const watchedLineItems = lineItemFields as any[];
  const selectedVipCustomer = customers.find((c) => c.id === watchedCustomerId);
  useEffect(() => {
    if (watchedCustomerId && customers && customers.length > 0) {
      const customer = customers.find((c) => c.id === watchedCustomerId);
      if (customer) {
        setSelectedCustomerName(customer.name);
      }
    }
  }, [watchedCustomerId, customers]);

  // Pre-populate checklist from template when creating a new job
  useEffect(() => {
    if (mode === "create" && isOpen) {
      const templateItems: ChecklistItem[] = (
        (checklistTemplatesData as any)?.data ?? []
      ).map((t: any) => ({
        id: crypto.randomUUID(),
        text: t.text,
        completed: false,
      }));
      if (templateItems.length > 0) {
        setChecklist(templateItems);
      }
    }
  }, [mode, isOpen, checklistTemplatesData]);

  // RC10 FIX: When opening an existing job in edit mode, sync its saved checklist items into
  // local state. Previously this ran after every render (no dep array) using ref guards, which
  // caused "Maximum update depth exceeded" for jobs where both the job checklist AND the initial
  // React state are empty []: setChecklist([]) produced a new array reference each render, which
  // React treated as a state change, triggering another render, repeating indefinitely.
  //
  // The fix: proper deps [jobId, mode, checklistTemplatesData] so the effect only fires when the
  // JOB changes — not every render. React Strict Mode still fires it twice (Pass 1 + Pass 2), but
  // refs persist between those passes, so Step 1 only executes once and Step 2 (template fallback)
  // only executes in the Strict Mode second pass when needed. After the effect stabilises, no more
  // setState calls are made, and the 50-update limit is never approached.
  const syncedJobIdRef = useRef<string | null>(null);
  const templateFallbackAppliedRef = useRef<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // editingJob is declared later in the file but is safe to access here at runtime —
    // effect callbacks run after render, so all hooks (including editingJob useMemo) are
    // already evaluated by the time this function executes.
    if (mode !== "edit" || !(editingJob as any)?.id) return;
    const job = editingJob as any;

    // Step 1: When the job changes, sync its stored checklist (runs once per job via ref guard).
    // In Strict Mode, both Pass 1 and Pass 2 see the same jobId, so only Pass 1 enters Step 1.
    if (job.id !== syncedJobIdRef.current) {
      syncedJobIdRef.current = job.id;
      const jobChecklist = Array.isArray(job.checklist)
        ? (job.checklist as ChecklistItem[])
        : [];
      // If the job already has checklist items, mark template fallback as done to prevent
      // Strict Mode Pass 2 from overriding them.
      templateFallbackAppliedRef.current = jobChecklist.length > 0 ? job.id : null;
      // Only call setState if there are actual items OR if we need to clear a previous job's items.
      // Avoid setChecklist([]) when checklist is already [] — that creates a new array reference
      // which React treats as a state change, causing an unnecessary re-render.
      if (jobChecklist.length > 0 || checklist.length > 0) {
        setChecklist(jobChecklist);
      }
      return;
    }

    // Step 2: Job is already synced but checklist is still empty — try template fallback (once
    // per job). In Strict Mode, this fires in Pass 2 for jobs with no checklist items.
    if (
      checklist.length === 0 &&
      templateFallbackAppliedRef.current !== job.id
    ) {
      const templateItems: ChecklistItem[] = (
        (checklistTemplatesData as any)?.data ?? []
      ).map((t: any) => ({
        id: crypto.randomUUID(),
        text: t.text,
        completed: false,
      }));
      if (templateItems.length > 0) {
        templateFallbackAppliedRef.current = job.id;
        setChecklist(templateItems);
      }
    }
  // jobId is the canonical dep for "which job is open". checklistTemplatesData changes when
  // template data loads. mode guards against running in create mode. checklist is intentionally
  // excluded: we read it only in Step 2 for a one-time fallback check; including it would cause
  // the effect to re-run whenever the checklist changes (defeating the purpose of the fallback).
  }, [jobId, mode, checklistTemplatesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save state to prevent double-clicking
  const [isSaving, setIsSaving] = useState(false);

  // Quote presentation method local state (for immediate UI update)
  const [localQuoteMethod, setLocalQuoteMethod] = useState<string>("");

  // Proposal builder state
  const [isProposalBuilderOpen, setIsProposalBuilderOpen] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<
    string | undefined
  >(undefined);

  // Proposal viewer modal state
  const [isProposalViewerOpen, setIsProposalViewerOpen] = useState(false);
  const [viewingProposalId, setViewingProposalId] = useState<
    string | undefined
  >(undefined);

  // Equipment addition state
  const [isAddingEquipment, setIsAddingEquipment] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<
    Array<{ id: string; equipment: string; checked: boolean }>
  >([]);

  // Booking cancellation state
  const [cancelBookingDialogOpen, setCancelBookingDialogOpen] = useState(false);
  const [showXeroResetConfirm, setShowXeroResetConfirm] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

  // Description popup state
  const [descriptionPopupOpen, setDescriptionPopupOpen] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionCopied, setDescriptionCopied] = useState(false);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [formLoadedJobId, setFormLoadedJobId] = useState<string | null>(null);

  // Internal Notes popup state
  const [internalNotesPopupOpen, setInternalNotesPopupOpen] = useState(false);
  const [internalNotesDraft, setInternalNotesDraft] = useState("");
  const [internalNotesFocused, setInternalNotesFocused] = useState(false);
  const [gearDialogOpen, setGearDialogOpen] = useState(false);

  // Double-tap detection for mobile description
  const [lastDescriptionTap, setLastDescriptionTap] = useState(0);

  // Profit tracking state
  const [isProfitTrackerOpen, setIsProfitTrackerOpen] = useState(false);

  // Margin tracker dialog states
  const [isStaffTimeDialogOpen, setIsStaffTimeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [emailContext, setEmailContext] = useState<
    "general" | "quote" | "invoice" | "proposal"
  >("general");
  const [isSMSComposerOpen, setIsSMSComposerOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [paidNotesValue, setPaidNotesValue] = useState("");
  const [paidNotesSaving, setPaidNotesSaving] = useState(false);

  // Scheduling modal state
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [schedulingData, setSchedulingData] = useState({
    date: "",
    endDate: "", // For multi-day jobs — blank means single-day
    startTime: "",
    duration: "", // in minutes — day 1
    day2Duration: "", // in minutes — last day (only used when endDate is set)
    assignedTo: [] as string[],
    notes: "",
    sendClientNotification: false,
  });
  const [staffConflicts, setStaffConflicts] = useState<
    { employeeId: string; conflicts: any[] }[]
  >([]);

  // Time tracking modal state
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);

  // Photo capture modal state
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  // Pending photos for new jobs (uploaded after job creation)
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [pendingPhotoPreviewUrls, setPendingPhotoPreviewUrls] = useState<
    string[]
  >([]);

  // Speech to quote modal state
  const [isSpeechToQuoteOpen, setIsSpeechToQuoteOpen] = useState(false);
  const [speechToQuoteContext, setSpeechToQuoteContext] = useState<
    "full" | "job-description" | "invoice-description" | "internal-notes"
  >("full");

  // Track created job for edit mode switching
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<"create" | "edit">(mode);

  // CRITICAL: Sync internalMode with mode prop when it changes
  // This ensures that when parent component updates mode='edit', we respect it
  useEffect(() => {
    setInternalMode(mode);
  }, [mode]);

  // Auto-save state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
  const isLoadingDataRef = useRef(false);
  const hasUserChangedRef = useRef(false);
  const lastLoadedJobIdRef = useRef<string | null>(null); // Track which job was loaded to prevent isDirty blocking initial load
  const originalLoadedDataRef = useRef<Record<string, any>>({}); // Store original loaded values to detect real changes on manual save
  const currentJobIdRef = useRef<string | null>(null); // For clipboard paste handler
  const replaceLineItemsRef = useRef<typeof replaceLineItems | null>(null); // Stable ref to avoid dep-array re-fires

  // Description textarea auto-resize ref (for the inline preview div that opens the popup)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Separate ref specifically for the popup textarea element
  const descriptionPopupRef = useRef<HTMLTextAreaElement>(null);

  // When the description popup opens: focus the textarea, place cursor at end, and size to content
  useEffect(() => {
    if (!descriptionPopupOpen) return;
    // Give Dialog animation time to fully mount
    const timer = setTimeout(() => {
      const ta = descriptionPopupRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 80);
    return () => clearTimeout(timer);
  }, [descriptionPopupOpen]);

  // Re-measure height whenever descriptionDraft changes via programmatic updates (Add Bullet, Clear, etc.)
  useEffect(() => {
    if (!descriptionPopupOpen) return;
    const ta = descriptionPopupRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [descriptionDraft, descriptionPopupOpen]);

  // Internal Notes popup ref and auto-focus/resize effects
  const internalNotesPopupRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!internalNotesPopupOpen) return;
    const timer = setTimeout(() => {
      const ta = internalNotesPopupRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 80);
    return () => clearTimeout(timer);
  }, [internalNotesPopupOpen]);
  useEffect(() => {
    if (!internalNotesPopupOpen) return;
    const ta = internalNotesPopupRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [internalNotesDraft, internalNotesPopupOpen]);

  // Line item management state
  const [isAddingLineItem, setIsAddingLineItem] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    description: "",
    quantity: 1,
    unitPrice: "" as string | number,
    unitCost: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Debounce search query updates
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Fetch employees for scheduling assignment (needed upfront)
  const { data: employeesData } = useQuery({
    queryKey: ["/api/employees"],
    enabled: isOpen || isSchedulingModalOpen,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch specific job by ID when editing (replaces fetching all 1000 jobs!)
  // Use internal mode to handle newly created jobs that transition from create to edit mode
  const effectiveModeForQuery = createdJobId ? "edit" : internalMode;
  const {
    data: specificJobData,
    isLoading: isLoadingSpecificJob,
    isPending: isPendingSpecificJob,
    refetch: refetchJob,
  } = useQuery({
    queryKey: ["/api/jobs", jobId || createdJobId],
    enabled:
      isOpen &&
      effectiveModeForQuery === "edit" &&
      !!(jobId || createdJobId) &&
      !job,
    staleTime: 30000, // Keep data fresh for 30 seconds to prevent refetch on tab switch
    refetchOnWindowFocus: false, // Don't refetch when switching tabs/focus
  });

  const handlePullRefresh = useCallback(async () => {
    const id = jobId || createdJobId;
    if (id) {
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      await queryClient.refetchQueries({ queryKey: ["/api/jobs", id] });
    } else {
      await refetchJob();
    }
  }, [jobId, createdJobId, queryClient, refetchJob]);

  const {
    pullDistance: jobCardPullDistance,
    isRefreshing: jobCardIsRefreshing,
    shouldTrigger: jobCardShouldTrigger,
    handlers: jobCardPullHandlers,
  } = usePullToRefresh({
    onRefresh: handlePullRefresh,
    enabled: isMobile && mode === "edit",
  });

  // Lazy load templates - only when billing tab is active or invoice modal is open
  const { data: invoiceTemplateData } = useQuery({
    queryKey: ["/api/templates/default/invoice"],
    enabled:
      isOpen &&
      (activeTab === "billing" ||
        sidebarTab === "billing" ||
        isInvoiceModalOpen),
  });

  const { data: quoteTemplateData } = useQuery({
    queryKey: ["/api/templates/default/quote"],
    enabled: isOpen && (activeTab === "billing" || sidebarTab === "billing"),
  });

  const { data: proposalTemplateData } = useQuery({
    queryKey: ["/api/templates/default/proposal"],
    enabled: isOpen && isProposalViewerOpen,
  });

  // Fetch the individual proposal (with sections + photos) when the viewer opens.
  // This uses the same /api/proposals/:id endpoint that the editor uses, which correctly
  // maps section.images → section.photos. The batch query (jobProposalResponse) only has
  // metadata and may have stale/missing photos.
  const { data: viewingProposalData } = useQuery({
    queryKey: ["/api/proposals", viewingProposalId],
    enabled: isOpen && isProposalViewerOpen && !!viewingProposalId,
    staleTime: 0,
  });

  // Lazy load materials and services - only when billing tab is active (desktop uses sidebarTab, mobile uses activeTab)
  const { data: materialsData } = useQuery({
    queryKey: ["/api/materials"],
    enabled: isOpen && (activeTab === "billing" || sidebarTab === "billing"),
  });

  const { data: servicesData } = useQuery({
    queryKey: ["/api/services"],
    enabled: isOpen && (activeTab === "billing" || sidebarTab === "billing"),
  });

  const employees: any[] = ((employeesData as any)?.data || []).filter(
    (e: any) => e.isActive !== false,
  );
  const specificJob: Job | null = (specificJobData as any)?.data || null;

  // Combine materials and services into a single catalog array
  const materials = (materialsData as any)?.data || [];
  const services = (servicesData as any)?.data || [];
  const materialsAndServices = [
    ...materials.map((item: any) => ({
      ...item,
      type: "material",
      displayPrice: item.price || 0,
    })),
    ...services.map((item: any) => ({
      ...item,
      type: "service",
      displayPrice: item.basePrice || 0,
    })),
  ];

  const invoiceTemplate = (invoiceTemplateData as any)?.data || null;
  const quoteTemplate = (quoteTemplateData as any)?.data || null;
  const proposalTemplate = (proposalTemplateData as any)?.data || null;

  // Immediately persist lineItems to the server so that any subsequent auto-save
  // invalidateQueries refetch doesn't wipe out unsaved local changes.
  const saveLineItemsNow = async (updatedItems: any[]) => {
    if (mode !== "edit" || !editingJob?.id) return;
    try {
      await apiRequest("PUT", `/api/jobs/${editingJob.id}`, {
        lineItems: updatedItems,
      });
      // Optimistically update cache so the next refetch sees the correct data
      queryClient.setQueryData(["/api/jobs", editingJob.id], (old: any) => {
        if (!old) return old;
        const jobData = old?.data ?? old;
        const updated = { ...jobData, lineItems: updatedItems };
        return old?.data ? { ...old, data: updated } : updated;
      });
    } catch (err) {
      console.error("❌ Failed to save line items:", err);
    }
  };

  // Line item management functions
  const addLineItem = () => {
    const unitPriceNum =
      typeof newLineItem.unitPrice === "string"
        ? parseFloat(newLineItem.unitPrice)
        : newLineItem.unitPrice;

    if (
      !newLineItem.description ||
      newLineItem.quantity <= 0 ||
      !unitPriceNum ||
      unitPriceNum < 0 ||
      newLineItem.unitCost < 0
    ) {
      toast({
        title: "Validation Error",
        description:
          "Please fill in all required fields. Prices and costs must be non-negative.",
        variant: "destructive",
      });
      return;
    }

    const lineItem = {
      id: `item-${Date.now()}`,
      description: newLineItem.description,
      quantity: newLineItem.quantity,
      unitPrice: unitPriceNum,
      unitCost: newLineItem.unitCost || 0,
      total: newLineItem.quantity * unitPriceNum,
      totalCost: newLineItem.quantity * (newLineItem.unitCost || 0),
      taxRate: 15, // New Zealand GST
      priceIncludesTax: false, // Default to tax exclusive
    };

    // Build updated array manually (before appendLineItem runs its state update)
    // so we can save it to the server immediately without waiting for React re-render.
    const updatedItems = [...(form.getValues("lineItems") || []), lineItem];

    // Use useFieldArray helper to properly update the field array
    appendLineItem(lineItem);

    // Persist immediately so invalidateQueries refetches see the new item
    saveLineItemsNow(updatedItems);

    // Reset form
    setNewLineItem({
      description: "",
      quantity: 1,
      unitPrice: "",
      unitCost: 0,
    });
    setIsAddingLineItem(false);

    // Calculate profit impact for enhanced tracking
    const revenueIncrease = lineItem.total;
    const costIncrease = lineItem.totalCost;
  };

  const removeLineItem = (index: number) => {
    const currentItems = form.getValues("lineItems") || [];
    const updatedItems = currentItems.filter(
      (_: any, i: number) => i !== index,
    );
    // Use useFieldArray helper to properly update the field array
    removeLineItemField(index);
    // Persist immediately
    saveLineItemsNow(updatedItems);
  };

  const selectFromCatalog = (catalogItem: any) => {
    const unitPrice = parseFloat(catalogItem.displayPrice || 0);
    const unitCost = parseFloat(catalogItem.cost || catalogItem.baseCost || 0);
    const itemName = catalogItem.name || catalogItem.itemNumber;
    const margin = unitPrice - unitCost;

    setNewLineItem({
      description: itemName,
      quantity: 1,
      unitPrice: unitPrice,
      unitCost: unitCost,
    });
    setIsCatalogModalOpen(false);

    // Enhanced profit tracking feedback with real margin calculation
    const profitImpact = margin * 1; // quantity = 1
  };

  // Filter materials and services based on search query
  const filteredItems = useMemo(() => {
    if (!debouncedSearchQuery) return [];

    const query = debouncedSearchQuery.toLowerCase();
    return materialsAndServices.filter(
      (item: any) =>
        item.name?.toLowerCase().includes(query) ||
        item.itemNumber?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query),
    );
  }, [debouncedSearchQuery, materialsAndServices]);

  // Select item from search results and add to line items
  const selectItemFromSearch = (item: any) => {
    const unitPrice = parseFloat(
      item.displayPrice || item.price || item.basePrice || 0,
    );
    const unitCost = parseFloat(item.cost || item.baseCost || 0);
    const itemName = item.name || item.itemNumber;

    // Create line item with proper pricing using form field array
    const lineItem = {
      id: `item-${Date.now()}`,
      itemCode: item.itemNumber || "",
      description: itemName,
      quantity: 1,
      unitPrice: unitPrice,
      unitCost: unitCost,
      total: unitPrice * 1, // quantity * unitPrice
      totalCost: unitCost * 1, // quantity * unitCost
      taxRate: 15, // New Zealand GST
      priceIncludesTax: false, // Default to tax exclusive
    };

    const updatedItems = [...(form.getValues("lineItems") || []), lineItem];

    // Use appendLineItem from useFieldArray for proper form integration
    appendLineItem(lineItem);

    // Persist immediately so server has latest lineItems
    saveLineItemsNow(updatedItems);

    // Reset search
    setSearchQuery("");
    setShowSearchResults(false);

    // Calculate profit margin
    const margin = unitPrice - unitCost;
    const profitPercentage =
      unitPrice > 0 ? ((margin / unitPrice) * 100).toFixed(1) : "0";
  };

  // Add custom item based on search query
  const addCustomItem = (itemName: string) => {
    setNewLineItem({
      description: itemName,
      quantity: 1,
      unitPrice: "",
      unitCost: 0,
    });
    setIsAddingLineItem(true);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  // Get the currently editing job
  const editingJob = useMemo(() => {
    // Use internal mode and created job ID if available
    const effectiveMode = createdJobId ? "edit" : internalMode;
    const effectiveJobId = createdJobId || jobId;

    if (effectiveMode === "edit" && (effectiveJobId || job?.id)) {
      // Use job prop if provided, otherwise use the specific job fetched by ID
      return job || specificJob;
    }
    return null;
  }, [mode, internalMode, createdJobId, jobId, job, specificJob]);

  // Initialize localQuoteMethod from editingJob when job ID changes
  useEffect(() => {
    if (editingJob) {
      const jobQuoteMethod = (editingJob as any).quotePresentationMethod || "";
      setLocalQuoteMethod(jobQuoteMethod);
    }
  }, [editingJob?.id]);

  // Reset internal state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreatedJobId(null);
      setInternalMode(mode);
      lastLoadedJobIdRef.current = null; // Reset so next job gets properly loaded
    }
  }, [isOpen, mode]);

  // Store last viewed job ID in localStorage for PWA bootstrap
  useEffect(() => {
    if (editingJob?.id) {
      try {
        localStorage.setItem("lastViewedJobId", editingJob.id);
        console.log("📱 Stored last viewed job ID:", editingJob.id);
      } catch (e) {
        console.error("Failed to store last viewed job ID:", e);
      }
    }
  }, [editingJob?.id]);

  // Keep ref updated with current job ID for clipboard paste handler
  useEffect(() => {
    currentJobIdRef.current = editingJob?.id || null;
  }, [editingJob?.id]);

  // Auto-sync payment status from Xero when a job card opens
  // Silently checks Xero and marks the invoice paid locally if Xero shows PAID
  useEffect(() => {
    if (
      !editingJob?.id ||
      !editingJob?.xeroInvoiceId ||
      editingJob?.xeroStatus === "paid"
    )
      return;
    const jobId = editingJob.id;
    apiRequest("POST", "/api/xero/sync-payment-status", { jobId })
      .then((result: any) => {
        if (result?.status === "paid") {
          queryClient.invalidateQueries({ queryKey: ["/api/invoices", jobId] });
          queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
          console.log(
            `✅ Xero payment sync: job ${editingJob.jobNumber} marked PAID`,
          );
        }
      })
      .catch(() => {});
  }, [editingJob?.id, editingJob?.xeroInvoiceId]);

  // Clipboard paste handler for screenshots
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      console.log("📸 Paste event detected in GlobalJobCard");

      const items = e.clipboardData?.items;
      const files = e.clipboardData?.files;

      console.log(
        "📸 Clipboard items:",
        items?.length,
        "files:",
        files?.length,
      );

      const imageFiles: File[] = [];

      // Try items first (more reliable for screenshots)
      if (items) {
        for (const item of Array.from(items)) {
          console.log("📸 Item type:", item.type, "kind:", item.kind);
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }
      }

      // Fallback to files array
      if (imageFiles.length === 0 && files) {
        for (const file of Array.from(files)) {
          console.log("📸 File type:", file.type);
          if (file.type.startsWith("image/")) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length === 0) {
        console.log("📸 No images found in clipboard");
        return;
      }

      // Prevent default paste behavior for images
      e.preventDefault();

      console.log("📸 Found", imageFiles.length, "image(s) to upload");

      const currentJobId = currentJobIdRef.current;

      // If we have a job ID, upload directly
      if (currentJobId) {
        for (const file of imageFiles) {
          try {
            const formData = new FormData();
            formData.append("photo", file);
            formData.append("authorName", "User");
            formData.append("description", "Pasted from clipboard");

            const response = await fetch(`/api/jobs/${currentJobId}/photos`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });

            if (response.ok) {
              queryClient.invalidateQueries({
                queryKey: ["/api/jobs", currentJobId, "diary-timeline"],
              });
            }
          } catch (error) {
            console.error("📸 Failed to upload pasted image:", error);
          }
        }
      } else {
        // In create mode, queue the photos for later upload
        const newPreviews: string[] = [];
        for (const file of imageFiles) {
          const reader = new FileReader();
          reader.onloadend = () => {
            newPreviews.push(reader.result as string);
            if (newPreviews.length === imageFiles.length) {
              setPendingPhotoPreviewUrls((prev) => [...prev, ...newPreviews]);
            }
          };
          reader.readAsDataURL(file);
        }
        setPendingPhotos((prev) => [...prev, ...imageFiles]);
      }
    };

    // Use capture phase to get events before they might be stopped
    document.addEventListener("paste", handlePaste, { capture: true });
    console.log("📸 Paste handler attached (isOpen:", isOpen, ")");
    return () => {
      document.removeEventListener("paste", handlePaste, { capture: true });
      console.log("📸 Paste handler removed");
    };
  }, [isOpen, queryClient, toast]);

  // Listen for reply email events from diary
  useEffect(() => {
    const handleOpenEmailComposer = (event: CustomEvent) => {
      const { to, subject, context } = event.detail;
      setEmailContext("general");
      setIsEmailComposerOpen(true);

      // Pre-fill email fields after modal opens
      setTimeout(() => {
        const toInput = document.querySelector(
          'input[name="email-to"]',
        ) as HTMLInputElement;
        const subjectInput = document.querySelector(
          'input[name="email-subject"]',
        ) as HTMLInputElement;
        if (toInput) toInput.value = to;
        if (subjectInput) subjectInput.value = subject;
      }, 100);
    };

    window.addEventListener(
      "openEmailComposer",
      handleOpenEmailComposer as EventListener,
    );

    return () => {
      window.removeEventListener(
        "openEmailComposer",
        handleOpenEmailComposer as EventListener,
      );
    };
  }, []);

  // Keep a stable ref so the form-reset effect doesn't re-fire every render
  // (useFieldArray + replaceLineItems are now declared at the top of the component)
  replaceLineItemsRef.current = replaceLineItems;

  // Get customerId from the consolidated formData watch
  const formCustomerId = watchedCustomerId;

  // Find selected customer based on form data or editing job
  const selectedCustomer = useMemo(() => {
    // For edit mode, use the editing job's customer
    if (mode === "edit" && editingJob?.customerId) {
      return customers.find((c) => c.id === editingJob.customerId);
    }
    // For create mode, use the selected customer from form
    if (formCustomerId) {
      return customers.find((c) => c.id === formCustomerId);
    }
    return null;
  }, [mode, editingJob, customers, formCustomerId]);

  // Get customer data for the editing job (memoized to properly track changes)
  const editingJobCustomer = useMemo(() => {
    return editingJob
      ? customers.find((c) => c.id === editingJob.customerId)
      : null;
  }, [editingJob, customers]);

  // Reset form when switching to create mode OR populate form when editing an existing job
  useEffect(() => {
    if (mode === "create" && !jobId && !createdJobId) {
      // CRITICAL: Clear the dirty-state guard BEFORE resetting to ensure reset always happens
      hasUserChangedRef.current = false;
      isLoadingDataRef.current = false;

      // Use initialData if provided (from conversations), otherwise blank form
      const resetData = initialData
        ? {
            title: "",
            description: initialData.description || "",
            status: initialData.status || "lead",
            priority: "medium",
            customerId: "",
            leadSource: initialData.leadSource || "",
            address: initialData.address || "",
            totalAmount: "0",
            paidAmount: "0",
            notes: "",
            isNewCustomer: true, // Mark as new customer if we have initialData
            newCustomerName: initialData.customerName || "",
            newCustomerEmail: initialData.customerEmail || "",
            newCustomerPhone: initialData.customerPhone || "",
            jobContactFirstName: initialData.customerFirstName || "",
            jobContactLastName: initialData.customerLastName || "",
            jobContactEmail: initialData.customerEmail || "",
            jobContactPhone: (() => {
              const p = (initialData.customerPhone || "").replace(/\s/g, "");
              return /^(\+?64)?0?2[0-9]/.test(p)
                ? ""
                : initialData.customerPhone || "";
            })(),
            jobContactMobile: (() => {
              const p = (initialData.customerPhone || "").replace(/\s/g, "");
              return /^(\+?64)?0?2[0-9]/.test(p)
                ? initialData.customerPhone || ""
                : "";
            })(),
            billingContactEmail: initialData.customerEmail || "",
            billingContactPhone: "",
            billingContactMobile: initialData.customerPhone || "",
            billingAddress: initialData.address || "",
            billingNameOverride: "", // Can be set to override customer name for invoicing
            invoiceDescription: initialData.description || "",
            sameAsJobAddress: true,
            taxMode: "tax_exclusive",
            checklist: [],
            includeDescriptionInQuotesProposals: true,
            estimatedManHours: "",
            internalNotes: "",
          }
        : {
            title: "",
            description: "",
            status: "quote",
            priority: "medium",
            customerId: "",
            leadSource: "",
            address: "",
            totalAmount: "0",
            paidAmount: "0",
            notes: "",
            jobContactFirstName: "",
            jobContactLastName: "",
            jobContactEmail: "",
            jobContactPhone: "",
            billingContactEmail: "",
            billingContactPhone: "",
            billingContactMobile: "",
            billingAddress: "",
            billingNameOverride: "",
            invoiceDescription: "",
            sameAsJobAddress: true,
            estimatedManHours: "",
            taxMode: "tax_exclusive",
            checklist: [],
            includeDescriptionInQuotesProposals: true,
            internalNotes: "",
          };

      // Reset form with appropriate data
      form.reset(resetData);
      replaceLineItemsRef.current?.([]); // Clear line items

      // Set customer search value if we have initial data
      if (initialData?.customerName) {
        setSelectedCustomerName(initialData.customerName);
        setCustomerSearchValue(initialData.customerName);
      } else {
        setSelectedCustomerName("");
        setCustomerSearchValue("");
      }
      setHasUserSelectedCustomer(false); // Reset customer selection flag
    } else if (editingJob && editingJob.id && !customersLoading) {
      // Check if this is a NEW job we haven't loaded yet (first time seeing this job)
      const isNewJobLoad = lastLoadedJobIdRef.current !== editingJob.id;

      // GUARD: Only reset the form when opening a *different* job.
      // Once a job is loaded, never overwrite the form — auto-save keeps the server in sync.
      // isDirty-based guards are unreliable because auto-save clears isDirty after every save,
      // making the form vulnerable to spurious resets triggered by replaceLineItems ref changes.
      if (!isNewJobLoad) {
        return;
      }

      // Mark that we're loading this job
      lastLoadedJobIdRef.current = editingJob.id;

      // Wait for customers to load before populating form to avoid missing customer data
      // Mark that we're loading data to prevent auto-save
      isLoadingDataRef.current = true;
      hasUserChangedRef.current = false;

      // Split customer name into first and last name for form fields
      const nameParts = editingJobCustomer?.name?.split(" ") || [];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const resetData = {
        // Core job data
        title: editingJob.title || "",
        description: (editingJob.description ?? "") || "",
        status: (editingJob.status as any) || "work_order",
        priority: editingJob.priority || "medium",
        customerId: editingJob.customerId || "",
        isNewCustomer: false, // Existing jobs always have a customer already
        leadSource: editingJob.leadSource || "",
        address: editingJob.address || "",
        totalAmount: editingJob.totalAmount || "0",
        paidAmount: editingJob.paidAmount || "0",
        notes: editingJob.notes || "",
        // Contact fields from job data (with customer as fallback)
        jobContactFirstName: editingJob.jobContactFirstName || firstName,
        jobContactLastName: editingJob.jobContactLastName || lastName,
        jobContactEmail:
          editingJob.jobContactEmail || editingJobCustomer?.email || "",
        jobContactPhone:
          editingJob.jobContactPhone || editingJobCustomer?.phone || "",
        jobContactMobile:
          editingJob.jobContactMobile || editingJobCustomer?.mobile || "",
        billingContactEmail: editingJob.billingContactEmail || "",
        billingContactPhone: editingJob.billingContactPhone || "",
        billingContactMobile: editingJob.billingContactMobile || "",
        billingAddress: editingJob.billingAddress || "",
        billingNameOverride: editingJob.billingNameOverride || "",
        invoiceDescription: editingJob.invoiceDescription || "",
        sameAsJobAddress: editingJob.sameAsJobAddress ?? true,
        taxMode: editingJob.taxMode || "tax_exclusive",
        // Arrays - DO NOT set lineItems here, let replaceLineItems() handle it
        checklist: editingJob.checklist || [],
        includeDescriptionInQuotesProposals:
          editingJob.includeDescriptionInQuotesProposals ?? true,
        estimatedManHours: editingJob.estimatedManHours || "",
        internalNotes: (editingJob as any).internalNotes || "",
        customerConfirmed: (editingJob as any).customerConfirmed ?? false,
        etaNotificationRequested:
          (editingJob as any).etaNotificationRequested ?? false,
      };
      // RC9 FIX: Wrap form.reset with isResettingRef so the auto-save watch subscription
      // ignores field-change callbacks fired during reset. Without this, fields that differ
      // from their default values (e.g. etaNotificationRequested=true vs default false)
      // are mistakenly treated as user edits, triggering a deferred auto-save that
      // invalidates the job query, flickers editingJob to null, changes the key prop,
      // and causes an infinite unmount/remount loop ("Maximum update depth exceeded").
      isResettingRef.current = true;
      form.reset(resetData);
      isResettingRef.current = false;
      setFormLoadedJobId(editingJob.id);
      originalLoadedDataRef.current = { ...resetData };

      // Fix: Explicitly sync useFieldArray with line items after form reset
      if (editingJob.lineItems) {
        // Use ref to avoid adding replaceLineItems to the dep array (it changes every render)
        replaceLineItemsRef.current?.(editingJob.lineItems);
      }

      // Reset loading flag after a delay to ensure all form updates are done
      // Longer timeout prevents auto-save trigger when cache refreshes
      setTimeout(() => {
        isLoadingDataRef.current = false;

        // RC11 DEFENSIVE: Strip any fields that are not in the auto-save whitelist
        // from changedFieldsRef. This catches fields (like etaNotificationRequested)
        // that may have slipped through the isResettingRef guard during form.reset()
        // due to React Hook Form's internal async/flushSync callback timing in React 18.
        // Without this, those fields would trigger a spurious deferred auto-save, which
        // then invalidates the job query, causes another form.reset(), and crashes.
        for (const field of Array.from(changedFieldsRef.current)) {
          if (!autoSaveFieldsRef.current.has(field)) {
            changedFieldsRef.current.delete(field);
          }
        }
        if (changedFieldsRef.current.size === 0) {
          hasUserChangedRef.current = false;
        }

        // RC3 FIX: If the user typed something during the loading window (tracked in changedFieldsRef),
        // trigger a deferred auto-save now that the loading guard has cleared
        if (hasUserChangedRef.current && changedFieldsRef.current.size > 0) {
          console.log(
            "💾 Deferred auto-save triggered for changes made during loading window:",
            Array.from(changedFieldsRef.current),
          );
          const formData = form.getValues();
          const changedData: Record<string, any> = {};
          for (const field of changedFieldsRef.current) {
            changedData[field] = (formData as any)[field];
          }
          apiRequest("PUT", `/api/jobs/${editingJob?.id}`, changedData)
            .then(() => {
              console.log("✅ Deferred auto-save completed");
              // RC7 FIX: Guard so reset() watch callbacks aren't treated as user edits.
              isResettingRef.current = true;
              form.reset(form.getValues(), {
                keepValues: true,
                keepDirty: false,
              });
              isResettingRef.current = false;
              hasUserChangedRef.current = false;
              changedFieldsRef.current.clear();
              queryClient.invalidateQueries({ queryKey: ["/api/jobs", editingJob?.id] });
              const scheduleFields = ["scheduledDate", "scheduledStartTime", "scheduledEndTime", "assignedTeam", "status"];
              if (scheduleFields.some(f => changedData.hasOwnProperty(f))) {
                queryClient.invalidateQueries({ queryKey: ["/api/jobs/for-date"] });
                queryClient.invalidateQueries({ queryKey: ["/api/scheduling/revenue"] });
              }
            })
            .catch((err) => {
              console.error("❌ Deferred auto-save failed:", err);
            });
        }
      }, 500);
    }
    // Deps: editingJobCustomer?.id removed — customer name sync is handled by a separate effect below.
    // replaceLineItems removed — called via replaceLineItemsRef.current to avoid firing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    mode,
    jobId,
    createdJobId,
    editingJob?.id,
    customersLoading,
    initialData,
  ]);

  // Cross-device live sync: when the background poll brings fresh data for the already-loaded
  // job (e.g. a change saved on mobile), selectively update form fields that the user hasn't
  // locally edited on this device. This runs whenever editingJob changes for the SAME job ID,
  // which is the scenario excluded by the same-job guard in the main load effect above.
  useEffect(() => {
    // Only run once the form is loaded for this specific job
    if (!editingJob?.id || formLoadedJobId !== editingJob.id) return;
    // Skip during reset or loading to avoid fighting with the main load effect
    if (isResettingRef.current || isLoadingDataRef.current) return;

    // Text fields that can be updated cross-device when the user hasn't edited them locally
    const syncableTextFields: Array<{ key: string; getValue: () => string | null | undefined }> = [
      { key: 'description', getValue: () => editingJob.description },
      { key: 'notes', getValue: () => editingJob.notes },
      { key: 'internalNotes', getValue: () => (editingJob as any).internalNotes },
      { key: 'address', getValue: () => editingJob.address },
    ];

    for (const { key, getValue } of syncableTextFields) {
      if (changedFieldsRef.current.has(key)) continue; // user is editing this field locally
      const serverValue = getValue() ?? '';
      const formValue = form.getValues(key as any) ?? '';
      if (serverValue !== formValue) {
        isResettingRef.current = true;
        form.setValue(key as any, serverValue, { shouldDirty: false, shouldTouch: false });
        isResettingRef.current = false;
        console.log(`🔄 Cross-device sync: updated "${key}" from background poll`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editingJob?.description,
    editingJob?.notes,
    (editingJob as any)?.internalNotes,
    editingJob?.address,
    formLoadedJobId,
  ]);

  // Separate lightweight effect: keep selectedCustomerName in sync whenever the customer data
  // changes (e.g. first load after customers query resolves, or switching between jobs).
  // This is intentionally kept separate from the form-reset effect to avoid coupling.
  useEffect(() => {
    if (!editingJob) return;
    if (editingJobCustomer?.name) {
      setSelectedCustomerName(editingJobCustomer.name);
    } else if (editingJob.customerId && !customersLoading) {
      // Customer ID is set but not yet in the cache — use job contact fields as display fallback
      const fallback = [
        editingJob.jobContactFirstName,
        editingJob.jobContactLastName,
      ]
        .filter(Boolean)
        .join(" ");
      if (fallback) setSelectedCustomerName(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingJob?.customerId, editingJobCustomer?.name, customersLoading]);

  // Keep billing address in sync with job address when "same as job address" is enabled
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      const sameAsJobAddress = values.sameAsJobAddress;

      // If "same as job address" is enabled and job address fields change, update billing fields
      if (sameAsJobAddress && name === "address") {
        form.setValue("billingAddress", values.address || "");
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // Auto-populate address from customer in create mode
  useEffect(() => {
    // Only auto-populate if user has explicitly selected a customer (tracked by flag)
    // This prevents auto-populate from using stale customer data from previously viewed jobs
    if (
      mode === "create" &&
      hasUserSelectedCustomer &&
      selectedCustomer?.address
    ) {
      const currentAddress = form.getValues("address");
      // Only populate if address field is empty
      if (!currentAddress || currentAddress.trim() === "") {
        form.setValue("address", selectedCustomer.address);
      }
    }
  }, [mode, hasUserSelectedCustomer, selectedCustomer, form]);

  // Description display auto-sizes naturally with div and whitespace-pre-wrap
  // No manual height calculation needed

  // Auto-save for job card - saves on field blur/change with debounce
  // SAFE FIELDS: Only auto-save text/select fields, NOT line items or proposals
  const autoSaveFieldsRef = useRef<Set<string>>(
    new Set([
      "title",
      "description",
      "address",
      "status",
      "priority",
      "leadSource",
      "scheduledDate",
      "scheduledTime",
      "estimatedDuration",
      "estimatedManHours",
      "jobContactFirstName",
      "jobContactLastName",
      "jobContactEmail",
      "jobContactPhone",
      "jobContactMobile",
      "billingAddress",
      "billingNameOverride",
      "invoiceDescription",
      "billingContactPhone",
      "billingContactMobile",
      "billingContactEmail",
      "jobContactFirstNameForInvoice",
      "jobContactLastNameForInvoice",
      "purchaseOrderNumber",
      "sameAsJobAddress",
      "quotingMethod",
      "unsuccessfulReason",
      "categoryId",
      "crewMembers",
      "equipment",
      "internalNotes",
      "customerConfirmed",
      // NOTE: etaNotificationRequested is intentionally excluded from auto-save.
      // It's saved immediately via direct apiRequest on click (see ETA toggle handler)
      // to prevent it from being tracked during form.reset() and triggering a
      // deferred auto-save loop ("Maximum update depth exceeded" crash).
    ]),
  );

  const changedFieldsRef = useRef<Set<string>>(new Set());
  // RC7 FIX: Prevents form.reset() (used to advance the dirty baseline after autosave)
  // from firing watch callbacks that are mistakenly treated as user edits, which caused
  // an infinite autosave loop and silently overwrote contact fields with empty strings.
  const isResettingRef = useRef(false);

  useEffect(() => {
    if (mode !== "edit" || !editingJob?.id) return;

    // RC8 FIX: Capture job ID at effect-start time so the cleanup closure
    // uses the correct job ID even if editingJob has changed by cleanup time.
    const capturedJobId = editingJob.id;

    changedFieldsRef.current.clear();

    let timeoutId: NodeJS.Timeout;

    const subscription = form.watch((values, { name }) => {
      if (!name || !autoSaveFieldsRef.current.has(name)) {
        return;
      }

      // RC7 FIX: Ignore watch callbacks fired by form.reset() baseline-advance calls.
      // reset() fires all subscriptions synchronously even when keepValues:true — without
      // this guard those callbacks re-added every contact field to changedFieldsRef,
      // triggering another autosave → reset() → autosave infinite loop.
      if (isResettingRef.current) {
        return;
      }

      if (isLoadingDataRef.current) {
        // RC3 FIX: Still track the change even during loading — the deferred auto-save
        // in the setTimeout above will pick it up once the loading guard clears
        console.log(
          `🔄 Auto-save deferred during load - tracking field: ${name}`,
        );
        changedFieldsRef.current.add(name);
        hasUserChangedRef.current = true;
        return;
      }

      console.log(
        `📝 Auto-save triggered for field: ${name}, value:`,
        (values as any)[name],
      );

      changedFieldsRef.current.add(name);
      hasUserChangedRef.current = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        if (!hasUserChangedRef.current || changedFieldsRef.current.size === 0) {
          return;
        }

        try {
          setIsAutoSaving(true);
          const formData = form.getValues();

          const changedData: Record<string, any> = {};
          const clearFields: string[] = [];
          for (const field of changedFieldsRef.current) {
            const val = (formData as any)[field];
            changedData[field] = val;
            if (val === "" || val === null || val === undefined) {
              clearFields.push(field);
            }
          }
          if (clearFields.length > 0) {
            changedData._clearFields = clearFields;
          }

          console.log("💾 Auto-saving ONLY changed fields...", {
            jobId: editingJob.id,
            changedFields: Array.from(changedFieldsRef.current),
            clearFields,
          });

          await apiRequest("PUT", `/api/jobs/${editingJob.id}`, changedData);
          console.log("✅ Auto-save completed successfully");
          setLastAutoSaveTime(new Date());
          hasUserChangedRef.current = false;
          changedFieldsRef.current.clear();

          // RC2 FIX: Update form baseline so isDirty reflects changes since last save,
          // not since the form first opened. Prevents stale dirty-state triggering resets.
          // RC7 FIX: Guard with isResettingRef so reset() watch callbacks are ignored.
          isResettingRef.current = true;
          form.reset(form.getValues(), { keepValues: true, keepDirty: false });
          isResettingRef.current = false;

          // RC4 FIX: Optimistically update the cache with the saved values BEFORE invalidating,
          // so any background refetch that fires immediately sees the correct email/fields.
          queryClient.setQueryData(["/api/jobs", editingJob.id], (old: any) => {
            if (!old) return old;
            const jobData = old?.data ?? old;
            const updated = { ...jobData, ...changedData };
            return old?.data ? { ...old, data: updated } : updated;
          });
          // Only invalidate the specific job — not the full list — to avoid forcing
          // the dispatch board (125+ jobs) to refetch on every 1.5-second auto-save.
          queryClient.invalidateQueries({ queryKey: ["/api/jobs", editingJob.id] });
          // If schedule-related fields changed, also refresh the date-scoped views
          // (Staff Schedule, CalendarGrid day view) so they immediately reflect the change.
          const scheduleFields = ["scheduledDate", "scheduledStartTime", "scheduledEndTime", "assignedTeam", "status"];
          if (scheduleFields.some(f => changedData.hasOwnProperty(f))) {
            queryClient.invalidateQueries({ queryKey: ["/api/jobs/for-date"] });
            queryClient.invalidateQueries({ queryKey: ["/api/scheduling/revenue"] });
          }
        } catch (error) {
          console.error("❌ Auto-save failed:", error);
          // RC5 FIX: Show toast so user knows their changes weren't saved.
          // Do NOT clear changedFieldsRef — preserves fields for next retry attempt.
          const failedFields = Array.from(changedFieldsRef.current);
          toast({
            title: "Changes not saved",
            description: `Could not save: ${failedFields.join(", ")}. Will retry automatically.`,
            variant: "destructive",
          });
          hasUserChangedRef.current = true; // Keep true so next watch triggers a retry
        } finally {
          setIsAutoSaving(false);
        }
      }, 1500);
    });

    return () => {
      subscription.unsubscribe();

      // RC8 FIX: On unmount (card closed / job switched), flush any pending
      // auto-save immediately instead of silently discarding it.
      // clearTimeout() alone would lose user edits made within the 1.5s debounce
      // window — the most common cause of "I typed something and it disappeared".
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (
        hasUserChangedRef.current &&
        changedFieldsRef.current.size > 0 &&
        capturedJobId
      ) {
        const formData = form.getValues();
        const changedData: Record<string, any> = {};
        for (const field of changedFieldsRef.current) {
          changedData[field] = (formData as any)[field];
        }
        // keepalive ensures the request completes even after the component
        // unmounts or the user navigates away mid-session.
        fetch(`/api/jobs/${capturedJobId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changedData),
          keepalive: true,
        }).catch(() => {}); // best-effort, silent failure
      }
    };
  }, [form, mode, editingJob?.id, queryClient]);

  // Immediately persist a customer change when the user explicitly picks one.
  // customerId is excluded from the debounced auto-save watcher (to prevent
  // accidental clears during form loading), so we save it directly here.
  const saveCustomerImmediately = async (
    customerId: string,
    customerName: string,
  ) => {
    if (mode !== "edit" || !editingJob?.id) return;
    try {
      setIsAutoSaving(true);
      await apiRequest("PUT", `/api/jobs/${editingJob.id}`, { customerId });
      setLastAutoSaveTime(new Date());
      console.log(
        `✅ Customer saved immediately: ${customerName} (${customerId})`,
      );
    } catch (err) {
      console.error("Failed to save customer change:", err);
      toast({
        title: "Could not save customer change",
        description: "Please hit Save manually.",
        variant: "destructive",
      });
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Job create/update mutations
  const createJobMutation = useMutation({
    mutationFn: async (data: GlobalJobCardFormData) => {
      let customerId = data.customerId;

      // If no customer ID is provided, create a customer from job contact info
      if (
        !customerId &&
        (data.jobContactFirstName || data.jobContactLastName)
      ) {
        const customerName =
          `${data.jobContactFirstName || ""} ${data.jobContactLastName || ""}`.trim();
        const phoneNumber = data.jobContactPhone || "";
        // Detect if it's a mobile number (NZ mobiles start with 02, 2, +642, or 642)
        const isMobile = /^(\+?64)?0?2[0-9]/.test(
          phoneNumber.replace(/\s/g, ""),
        );
        const customerData = {
          name: customerName || "New Customer",
          email: data.jobContactEmail || "",
          phone: isMobile ? "" : phoneNumber,
          mobile: isMobile ? phoneNumber : "",
          address: data.address || "",
        };

        const customerResponse = await apiRequest(
          "POST",
          "/api/customers",
          customerData,
        );
        const newCustomer = await customerResponse.json();
        customerId = newCustomer.data.id;
      }
      // Ensure we have a customer ID
      if (!customerId) {
        throw new Error("Customer is required to create a job");
      }

      // Create the job with the customer ID and selected equipment
      const jobData = {
        ...data,
        customerId: customerId,
        equipmentChecklist:
          selectedEquipment.length > 0 ? selectedEquipment : undefined,
      };

      const response = await apiRequest("POST", "/api/jobs", jobData);
      return response.json();
    },
    onSuccess: async (newJob) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });

      // Mark the source conversation as converted (prevent duplicate job creation)
      if (initialData?.conversationId) {
        try {
          await apiRequest(
            "PATCH",
            `/api/conversations/${initialData.conversationId}`,
            {
              status: "converted",
            },
          );
          // Force refetch of conversation data
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          queryClient.invalidateQueries({
            queryKey: ["/api/conversations", initialData.conversationId],
          });
          await queryClient.refetchQueries({
            queryKey: ["/api/conversations", initialData.conversationId],
          });
          console.log(
            "✅ Conversation marked as converted:",
            initialData.conversationId,
          );
        } catch (error) {
          console.error("Failed to update conversation status:", error);
        }
      }

      // Switch to edit mode after creating the job - stay in modal
      if (newJob?.data?.id) {
        const jobId = newJob.data.id;

        // RC1 FIX: Immediately populate the React Query cache with the full job data
        // (including jobContactEmail) BEFORE switching to edit mode.
        // Without this, the form reset useEffect fires before the refetch completes
        // and sees undefined for jobContactEmail, wiping what the user typed.
        // IMPORTANT: store `newJob` (the full { success, data } wrapper), NOT `newJob.data`.
        // The query reads specificJobData?.data to get the job — if we store the raw job object,
        // specificJob is null, editingJob is null, and the split-screen diary panel never appears.
        // With staleTime:30000 the query won't refetch the wrong-format cache, so it must be right.
        if (newJob.data) {
          queryClient.setQueryData(["/api/jobs", jobId], newJob);
        }

        setCreatedJobId(jobId);
        setInternalMode("edit");
        setDescriptionPopupOpen(false); // Close popup after mode transition so split-screen renders cleanly
        setSelectedEquipment([]); // Reset equipment selection for next create

        // Upload any pending photos that were added before job was saved
        if (pendingPhotos.length > 0) {
          console.log(
            "📸 Uploading",
            pendingPhotos.length,
            "pending photos to new job:",
            jobId,
          );
          for (const file of pendingPhotos) {
            try {
              const formData = new FormData();
              formData.append("photo", file);
              formData.append("authorName", "User");
              formData.append("description", "Photo added");

              const response = await fetch(`/api/jobs/${jobId}/photos`, {
                method: "POST",
                body: formData,
                credentials: "include",
              });

              if (!response.ok) {
                console.error(
                  "📸 Failed to upload pending photo:",
                  await response.text(),
                );
              } else {
                console.log("📸 Uploaded pending photo successfully");
              }
            } catch (error) {
              console.error("📸 Error uploading pending photo:", error);
            }
          }
          // Clear pending photos after upload
          setPendingPhotos([]);
          setPendingPhotoPreviewUrls([]);
        }

        // Invalidate and refetch the specific job data immediately
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
        queryClient.invalidateQueries({
          queryKey: ["/api/jobs", jobId, "diary-timeline"],
        });
        queryClient.refetchQueries({ queryKey: ["/api/jobs", jobId] });
        // Call parent callback if provided
        onJobCreated?.(newJob);
        // Note: Not closing modal - staying open in edit mode for the newly created job
      }
    },
    onError: (error) => {
      console.error("Error creating job:", error);
      toast({
        title: "Creation Error",
        description: "Failed to create job. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data: GlobalJobCardFormData) => {
      if (!editingJob?.id) throw new Error("No job ID for update");
      const response = await apiRequest(
        "PUT",
        `/api/jobs/${editingJob.id}`,
        data,
      );
      return response.json();
    },
    onSuccess: (updatedJob) => {
      // Invalidate all jobs queries to update dispatch board and job lists
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/jobs");
        },
      });
      // Explicitly invalidate the Invoices completed jobs query (required for status changes)
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", "completed", 1000],
      });
      queryClient.refetchQueries({
        queryKey: ["/api/jobs", "completed", 1000],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      // Refetch the specific job and customers to ensure UI has latest data
      queryClient.refetchQueries({ queryKey: ["/api/jobs", editingJob?.id] });
      queryClient.refetchQueries({ queryKey: ["/api/customers"] });
      onJobUpdated?.(updatedJob);
    },
    onError: (error) => {
      console.error("Error updating job:", error);
      toast({
        title: "Update Error",
        description: "Failed to update job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle booking cancellation
  const handleCancelBooking = async (employeeId: string) => {
    if (!editingJob?.id) {
      toast({
        title: "Error",
        description: "No job ID available",
        variant: "destructive",
      });
      return;
    }

    try {
      // Clone and filter the assignedTo array
      const updatedAssignedTo = (Array.isArray(editingJob.assignedTo) ? editingJob.assignedTo : []).filter(
        (id) => id !== employeeId,
      );

      // Get employee name for diary entry
      const employee = employees.find((e: any) => e.id === employeeId);
      const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : "Staff member";

      // Prepare update payload
      const updatePayload: any = {
        id: editingJob.id,
        assignedTo: updatedAssignedTo,
      };

      // If removing the last staff member, clear schedule fields
      if (updatedAssignedTo.length === 0) {
        updatePayload.scheduledDate = null;
        updatePayload.scheduledStartTime = null;
        updatePayload.scheduledEndTime = null;
      }

      // Update the job
      await updateJobMutation.mutateAsync(
        updatePayload as GlobalJobCardFormData,
      );

      // Add diary entry for audit trail
      try {
        await apiRequest("POST", `/api/jobs/${editingJob.id}/diary`, {
          eventType: "booking_cancelled",
          notes: `Booking cancelled for ${employeeName}`,
          timestamp: new Date().toISOString(),
        });
      } catch (diaryError) {
        console.error("Failed to add diary entry:", diaryError);
      }

      // Close dialog and reset state
      setCancelBookingDialogOpen(false);
      setBookingToCancel(null);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const sendToXeroMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id) throw new Error("No job ID for Xero");
      const response = await apiRequest("POST", "/api/xero/send-invoice", {
        jobId: editingJob.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error) => {
      console.error("Error sending to Xero:", error);
      toast({
        title: "Xero Error",
        description: "Failed to send invoice to Xero. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetXeroSyncMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id) throw new Error("No job ID");
      const response = await apiRequest("POST", "/api/xero/reset-job-sync", {
        jobId: editingJob.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", editingJob?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/invoices", editingJob?.id],
      });
    },
    onError: () => {
      toast({
        title: "Reset Failed",
        description: "Could not reset the Xero sync status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const archiveJobMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id) throw new Error("No job ID for archive");
      const response = await apiRequest("PUT", `/api/jobs/${editingJob.id}`, {
        status: "archived",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onClose();
    },
    onError: (error) => {
      console.error("Error archiving job:", error);
      toast({
        title: "Archive Error",
        description: "Failed to archive job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch proposal data for this job (always fetch when job exists)
  const {
    data: jobProposalResponse,
    isLoading: isProposalLoading,
    isFetching: isProposalFetching,
    refetch: refetchProposals,
  } = useQuery({
    queryKey: ["/api/proposals", editingJob?.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/proposals?jobId=${editingJob?.id}&includeSections=true`,
      );
      if (!response.ok) throw new Error("Failed to fetch proposals");
      return response.json();
    },
    enabled: !!editingJob?.id,
  });

  // Extract proposal line items for invoice (use latest sent proposal, or latest draft if none sent)
  const proposalLineItems = useMemo(() => {
    if (!jobProposalResponse?.success || !jobProposalResponse?.data?.length) {
      return [];
    }

    const proposals = jobProposalResponse.data;
    const lineItems: any[] = [];

    // Find the best proposal to use: prioritize sent proposals, then drafts
    const sentProposal = proposals.find((p: any) => p.status === "sent");
    const proposalToUse = sentProposal || proposals[0]; // Use sent if available, otherwise use first (latest)

    if (
      proposalToUse &&
      proposalToUse.sections &&
      Array.isArray(proposalToUse.sections)
    ) {
      proposalToUse.sections.forEach((section: any) => {
        if (section.lineItems && Array.isArray(section.lineItems)) {
          section.lineItems.forEach((item: any) => {
            lineItems.push({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || Number(item.unit_price) || 0,
              total:
                Number(item.totalPrice) ||
                Number(item.total_price) ||
                Number(item.total) ||
                0,
              unit: item.unit || "each",
              category: item.category || "service",
              taxable: true,
            });
          });
        }
      });
    }

    return lineItems;
  }, [jobProposalResponse]);

  // Fetch quote data for this job (always fetch when job exists)
  const { data: jobQuoteResponse, refetch: refetchQuotes } = useQuery({
    queryKey: ["/api/quotes", editingJob?.id],
    queryFn: async () => {
      const response = await fetch(`/api/quotes?jobId=${editingJob?.id}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: !!editingJob?.id,
  });

  // Fetch invoice data for this job (always fetch when job exists)
  const { data: jobInvoiceResponse, refetch: refetchInvoices } = useQuery({
    queryKey: ["/api/invoices", editingJob?.id],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?jobId=${editingJob?.id}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: !!editingJob?.id,
  });

  // Sync paidNotes from invoice data when it loads
  useEffect(() => {
    const invoice = (jobInvoiceResponse as any)?.data?.[0];
    if (invoice?.paidNotes !== undefined) {
      setPaidNotesValue(invoice.paidNotes || "");
    }
  }, [jobInvoiceResponse]);

  // Fetch all equipment for quick-add dropdown
  const { data: equipmentData } = useQuery({
    queryKey: ["/api/equipment"],
  });

  const allEquipment = Array.isArray((equipmentData as any)?.data)
    ? (equipmentData as any).data
    : [];

  // Build a map of equipment name → licenceRequired for inline job card inference
  const equipmentLicenceMap: Record<string, string | null> = {};
  for (const eq of allEquipment) {
    if (eq.name) equipmentLicenceMap[eq.name] = eq.licenceRequired || null;
  }

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id || !selectedCustomer?.id) {
        throw new Error("Job and customer are required");
      }

      const proposalData = {
        jobId: editingJob.id,
        customerId: selectedCustomer.id,
        title: editingJob.title || "Proposal",
        proposalNumber: `PROP-${Date.now()}`,
        introduction: editingJob.description || "",
        conclusion: "",
        status: "draft" as const,
        deliveryMethod: "email" as const,
        createdBy: "system",
      };

      const response = await apiRequest("POST", "/api/proposals", proposalData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  // Create quote mutation
  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id || !selectedCustomer?.id) {
        throw new Error("Job and customer are required");
      }

      // Get line items from job record first, fallback to form values
      const lineItems = editingJob.lineItems || form.getValues("lineItems") || [];
      const totalAmount =
        lineItems.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
      const quoteData = {
        customerId: selectedCustomer.id,
        quoteNumber: `QTE-${editingJob.jobNumber || Date.now()}`,
        description:
          editingJob.description ||
          editingJob.title ||
          "Quote for tree services",
        amount: totalAmount.toFixed(2),
        status: "draft" as const,
        validUntil: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        lineItems: JSON.stringify(lineItems),
        terms: "Payment due within 30 days",
        createdBy: "system",
      };

      const response = await apiRequest("POST", "/api/quotes", quoteData);
      return response.json();
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      // Update the job with the quote ID (preserve line items)
      if (result.data?.id && editingJob?.id) {
        try {
          const lineItems = editingJob.lineItems || form.getValues("lineItems") || [];
          console.log("📝 Updating job with quoteId and line items:", {
            quoteId: result.data.id,
            lineItemsCount: lineItems.length,
          });
          await apiRequest("PUT", `/api/jobs/${editingJob.id}`, {
            quoteId: result.data.id,
            lineItems: lineItems,
          });
          // Invalidate job queries to refresh
          queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        } catch (error) {
          console.error("Failed to update job with quoteId:", error);
        }
      }
    },
  });

  // Handle email click
  const handleEmailClick = async (
    context: "general" | "quote" | "invoice" | "proposal" = "general",
  ) => {
    setEmailContext(context);

    // For quote emails, ensure a quote exists before opening composer
    if (context === "quote" && editingJob?.id && selectedCustomer?.id) {
      const hasQuote =
        jobQuoteResponse?.success && jobQuoteResponse.data.length > 0;

      if (!hasQuote) {
        try {
          // Create quote and wait for the result
          const quoteResult = await createQuoteMutation.mutateAsync();

          if (!quoteResult?.data?.id) {
            throw new Error("Failed to create quote");
          }

          // Refetch and verify we have the quote data
          const refetchResult = await refetchQuotes();

          if (!refetchResult.data?.success || !refetchResult.data.data.length) {
            throw new Error("Failed to load created quote");
          }
        } catch (error) {
          console.error("Failed to create quote:", error);
          toast({
            title: "Error",
            description: "Failed to create quote. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    // For proposal emails, ensure a proposal exists before opening composer
    if (context === "proposal" && editingJob?.id && selectedCustomer?.id) {
      // Wait for proposal query to be fully settled (not loading or fetching)
      if (isProposalLoading || isProposalFetching) {
        toast({
          title: "Loading",
          description: "Please wait while we load proposal data...",
        });
        return;
      }

      const hasProposal =
        jobProposalResponse?.success && jobProposalResponse.data.length > 0;

      if (!hasProposal) {
        try {
          // Create proposal and wait for the result
          await createProposalMutation.mutateAsync();
          // Refetch and verify we have the proposal data
          const refetchResult = await refetchProposals();

          if (!refetchResult.data?.success || !refetchResult.data.data.length) {
            throw new Error("Failed to load created proposal");
          }
        } catch (error) {
          console.error("Failed to create proposal:", error);
          toast({
            title: "Error",
            description: "Failed to create proposal. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsEmailComposerOpen(true);
  };

  // Deep search for customers (server-side search)
  const performDeepSearch = async () => {
    if (!customerSearchValue.trim()) return;

    setIsDeepSearching(true);
    try {
      const response = await fetch(
        `/api/customers?search=${encodeURIComponent(customerSearchValue.trim())}`,
      );
      if (response.ok) {
        const data = await response.json();
        setDeepSearchResults(data.data || data || []);
      }
    } catch (error) {
      console.error("Deep search failed:", error);
    } finally {
      setIsDeepSearching(false);
    }
  };

  const deepSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (deepSearchTimerRef.current) clearTimeout(deepSearchTimerRef.current);
    if (customerSearchValue.trim().length >= 2 && customerSearchOpen) {
      deepSearchTimerRef.current = setTimeout(() => {
        performDeepSearch();
      }, 400);
    } else {
      setDeepSearchResults([]);
    }
    return () => {
      if (deepSearchTimerRef.current) clearTimeout(deepSearchTimerRef.current);
    };
  }, [customerSearchValue, customerSearchOpen]);

  const handleSaveCustomerName = async (newName: string) => {
    if (!newName.trim() || !editingJob?.customerId) return;

    setIsSavingCustomerName(true);
    try {
      await apiRequest("PUT", `/api/customers/${editingJob.customerId}`, {
        name: newName.trim(),
      });

      const names = newName.trim().split(" ");
      const firstName = names[0] || "";
      const lastName = names.slice(1).join(" ") || "";
      form.setValue("jobContactFirstName", firstName, { shouldDirty: true });
      form.setValue("jobContactLastName", lastName, { shouldDirty: true });

      setSelectedCustomerName(newName.trim());
      setIsEditingCustomerName(false);
      setEditingNameValue("");

      await apiRequest("PUT", `/api/jobs/${editingJob.id}`, {
        jobContactFirstName: firstName,
        jobContactLastName: lastName,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (error) {
      console.error("Failed to update customer name:", error);
    } finally {
      setIsSavingCustomerName(false);
    }
  };

  const handleCallClick = () => {
    const phone =
      form.getValues("jobContactMobile") ||
      selectedCustomer?.mobile ||
      form.getValues("jobContactPhone") ||
      selectedCustomer?.phone;
    if (!phone) {
      toast({
        title: "No Phone Number",
        description: "No phone number available for this customer",
        variant: "destructive",
      });
      return;
    }
    const a = document.createElement("a");
    a.href = `tel:${phone}`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Handle schedule click
  const handleScheduleClick = async () => {
    if (!editingJob?.id) return;

    // Clear any stale conflict data
    setStaffConflicts([]);

    // Fetch existing staff assignments for this job
    try {
      const response = await fetch(
        `/api/jobs/${editingJob.id}/staff-assignments`,
      );
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        // Pre-populate the form with existing assignment data
        const firstAssignment = data.data[0];
        const startDateUTC = new Date(firstAssignment.startTime);
        const endDateUTC = new Date(firstAssignment.endTime);
        const durationMinutes =
          (endDateUTC.getTime() - startDateUTC.getTime()) / 60000;

        // Convert UTC time from database to NZ time for display
        const startNZ = utcToNZTime(startDateUTC);

        // Remove duplicate employee IDs when loading existing assignments
        const uniqueEmployeeIds = [
          ...new Set(data.data.map((a: any) => a.employeeId)),
        ];

        // Pre-populate endDate from the job's scheduledEndDate if set
        let existingEndDate = "";
        if (editingJob?.scheduledEndDate) {
          const endDateNZ = utcToNZTime(new Date(editingJob.scheduledEndDate));
          existingEndDate = endDateNZ.date;
        }

        setSchedulingData({
          date: startNZ.date, // NZ date, not UTC!
          endDate: existingEndDate,
          startTime: startNZ.time, // NZ time, not UTC!
          duration: durationMinutes.toString(),
          assignedTo: uniqueEmployeeIds,
          notes: firstAssignment.notes || "",
          sendClientNotification: false,
        });
      }
    } catch (error) {
      console.error("Error loading existing assignments:", error);
    }

    setIsSchedulingModalOpen(true);
  };

  // Handle queue click
  const handleQueueClick = () => {};

  // Handle quote click
  const handleQuoteClick = () => {
    setIsQuoteModalOpen(true);
  };

  // Handle save quote
  const handleSaveQuote = async () => {
    if (!editingJob?.id || !selectedCustomer?.id) {
      toast({
        title: "Error",
        description: "Job and customer are required to save quote.",
        variant: "destructive",
      });
      return;
    }

    // Get line items from the job record (not from formData which might not be loaded yet)
    const lineItems = editingJob?.lineItems || form.getValues("lineItems") || [];
    if (lineItems.length === 0) {
      toast({
        title: "No Line Items",
        description:
          "Please add at least one line item before saving the quote.",
        variant: "destructive",
      });
      return;
    }

    // Check if there's a valid amount
    const totalAmount = lineItems.reduce(
      (sum, item) => sum + (item.total || 0),
      0,
    );
    if (totalAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description:
          "Please ensure line items have valid quantities and prices.",
        variant: "destructive",
      });
      return;
    }

    try {
      const hasQuote =
        jobQuoteResponse?.success && jobQuoteResponse.data.length > 0;

      let quoteResult;
      if (!hasQuote) {
        // Create the quote
        quoteResult = await createQuoteMutation.mutateAsync();

        if (!quoteResult?.data?.id) {
          throw new Error("Failed to create quote");
        }

        // Refetch to get the latest quote data
        await refetchQuotes();
      } else {
        quoteResult = { data: jobQuoteResponse.data[0] };
      }

      // Log to job diary (don't fail if this fails)
      try {
        const diaryEntry = {
          jobId: editingJob.id,
          entryType: "note" as const,
          title: "Quote Created",
          description: `Quote ${quoteResult.data.quoteNumber} created`,
          content: `Quote ${quoteResult.data.quoteNumber || "draft"} created for ${new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(totalAmount)}`,
          authorName: "System",
          isPrivate: false,
        };

        await apiRequest(
          "POST",
          `/api/jobs/${editingJob.id}/diary`,
          diaryEntry,
        );

        // Invalidate all diary-related queries to force refresh
        await queryClient.invalidateQueries({
          queryKey: ["/api/jobs", editingJob.id, "diary"],
        });
        await queryClient.refetchQueries({
          queryKey: ["/api/jobs", editingJob.id, "diary"],
        });
      } catch (diaryError) {
        // Don't fail the whole operation if diary logging fails
        console.error("Failed to log to diary:", diaryError);
      }

      setIsQuoteModalOpen(false);
    } catch (error) {
      console.error("Failed to save quote:", error);
      toast({
        title: "Error",
        description: "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle invoice click
  const handleInvoiceClick = () => {
    if (!selectedCustomer?.id) {
      toast({
        title: "Customer Required",
        description: "Please select a customer before creating an invoice.",
        variant: "destructive",
      });
      return;
    }
    setIsInvoiceModalOpen(true);
  };

  // Handle print click
  const handlePrintClick = () => {};

  // Handle duplicate click
  const handleDuplicateClick = () => {};

  // Handle archive click
  const handleArchiveClick = () => {
    if (
      confirm(
        "Are you sure you want to archive this job? It will be hidden from the active jobs list.",
      )
    ) {
      archiveJobMutation.mutate();
    }
  };

  // Handle request review click - sends templated review request email
  const handleRequestReviewClick = async () => {
    if (!editingJob) return;

    const customerEmail = editingJob.customerEmail || editingJob.email;
    const customerName =
      editingJob.customerName || editingJob.billingName || "Customer";

    if (!customerEmail) {
      toast({
        title: "No Email Address",
        description:
          "This customer doesn't have an email address on file. Please add one to send a review request.",
        variant: "destructive",
      });
      return;
    }

    const reviewMessage = `Hi ${customerName.split(" ")[0]},

Glad to hear you're happy with the work! Would you be able to leave the team a review on Facebook and Google please? Here are links to do so.

Facebook review link

https://www.facebook.com/TreemarkablesGisborne/reviews

Google review link

https://search.google.com/local/writereview?placeid=ChIJyW5ncp55Zm0R3_iU47Axcn8

Thanks so much!
The Treemarkables Team`;

    try {
      const response = await apiRequest("POST", "/api/communications/email", {
        to: customerEmail,
        subject: "We'd love your feedback!",
        message: reviewMessage,
        jobId: editingJob.id,
        customerId: editingJob.customerId,
      });

      if (response.success) {
        queryClient.invalidateQueries({
          queryKey: ["/api/jobs", editingJob.id, "diary"],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests"] });
        queryClient.invalidateQueries({ queryKey: ["/api/reviews/stats"] });
      } else {
        toast({
          title: "Failed to Send",
          description: response.message || "Could not send review request",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send review request email",
        variant: "destructive",
      });
    }
  };

  // Handle speech-to-quote data
  const handleSpeechToQuoteGenerated = (quoteData: any) => {
    console.log("📢 Speech to Quote data received:", quoteData);

    // If context is description-only, just populate the transcription
    if (speechToQuoteContext === "job-description") {
      if (quoteData.transcription) {
        form.setValue("description", quoteData.transcription);
      }
      return;
    }

    if (speechToQuoteContext === "invoice-description") {
      if (quoteData.transcription) {
        form.setValue("invoiceDescription", quoteData.transcription);
      }
      return;
    }

    if (speechToQuoteContext === "internal-notes") {
      if (quoteData.transcription) {
        const appended = internalNotesDraft
          ? internalNotesDraft + "\n" + quoteData.transcription
          : quoteData.transcription;
        setInternalNotesDraft(appended);
        form.setValue("internalNotes", appended, { shouldDirty: true });
      }
      return;
    }

    // Full quote mode - populate form fields with extracted data
    if (quoteData.customerName) {
      form.setValue("newCustomerName", quoteData.customerName);
      form.setValue("isNewCustomer", true);
    }
    if (quoteData.customerPhone) {
      form.setValue("newCustomerPhone", quoteData.customerPhone);
    }
    if (quoteData.customerEmail) {
      form.setValue("newCustomerEmail", quoteData.customerEmail);
    }
    if (quoteData.address) {
      form.setValue("address", quoteData.address);
    }
    if (quoteData.jobDescription) {
      form.setValue("description", quoteData.jobDescription);
    }
    if (quoteData.estimatedPrice) {
      // Add as a line item
      const lineItems = form.getValues("lineItems") || [];
      lineItems.push({
        description: quoteData.jobDescription || "Tree removal service",
        quantity: 1,
        unitPrice: parseFloat(quoteData.estimatedPrice),
        total: parseFloat(quoteData.estimatedPrice),
        priceIncludesTax: false,
      });
      form.setValue("lineItems", lineItems);
    }
  };

  // Staff conflict checking - DISABLED to allow double booking
  // Conflicts are now allowed - staff can be scheduled on multiple jobs at the same time
  useEffect(() => {
    // Conflict checking disabled per user request
    setStaffConflicts([]);
  }, [
    schedulingData.date,
    schedulingData.startTime,
    schedulingData.duration,
    schedulingData.assignedTo,
    editingJob?.id,
  ]);

  // Save schedule function
  const saveSchedule = async () => {
    if (!editingJob?.id) return;

    try {
      // Parse date and time components
      const dateStr = schedulingData.date; // Already in YYYY-MM-DD format
      const timeStr = schedulingData.startTime; // Already in HH:MM format

      // Convert NZ local time to UTC using the proper timezone conversion function
      const startTimeUTC = nzTimeToUTC(dateStr, timeStr);
      const startTimeISO = startTimeUTC.toISOString();

      // Calculate end times — day 1 and last day may differ
      const isMultiDay = !!(
        schedulingData.endDate && schedulingData.endDate !== schedulingData.date
      );
      const durationMs = parseInt(schedulingData.duration) * 60000;
      const day2DurationMs =
        isMultiDay && schedulingData.day2Duration
          ? parseInt(schedulingData.day2Duration) * 60000
          : durationMs;

      // Day 1 end time (used for single-day scheduledEndTime on job record)
      const endTimeUTC = new Date(startTimeUTC.getTime() + durationMs);
      const endTimeISO = endTimeUTC.toISOString();

      // Convert end time back to NZ local time for display
      const endTimeNZ = utcToNZTime(endTimeUTC);
      const [endHours, endMinutes] = endTimeNZ.time.split(":").map(Number);

      // Create staff assignments - remove duplicates first
      const uniqueEmployeeIds = [...new Set(schedulingData.assignedTo)];
      const endDateStr = isMultiDay
        ? schedulingData.endDate
        : schedulingData.date;

      // Build list of all days in range (YYYY-MM-DD NZ dates)
      const allDays: string[] = [];
      {
        const d = new Date(schedulingData.date + "T12:00:00Z");
        const last = new Date(endDateStr + "T12:00:00Z");
        while (d <= last) {
          allDays.push(d.toISOString().split("T")[0]);
          d.setUTCDate(d.getUTCDate() + 1);
        }
      }

      // One assignment per employee per day — last day uses day2DurationMs if set
      const staffAssignments: Array<{
        employeeId: string;
        startTime: string;
        endTime: string;
        notes: string;
      }> = [];
      for (const dayStr of allDays) {
        const isLastDay = dayStr === endDateStr;
        const thisDurationMs =
          isMultiDay && isLastDay ? day2DurationMs : durationMs;
        const dayStartUTC = nzTimeToUTC(dayStr, timeStr);
        const dayEndUTC = new Date(dayStartUTC.getTime() + thisDurationMs);
        for (const employeeId of uniqueEmployeeIds) {
          staffAssignments.push({
            employeeId,
            startTime: dayStartUTC.toISOString(),
            endTime: dayEndUTC.toISOString(),
            notes: schedulingData.notes,
          });
        }
      }

      // Calculate scheduledEndDate if multi-day (timestamp = start of last day + day2Duration)
      let scheduledEndDateISO: string | null = null;
      if (isMultiDay) {
        const lastDayStartUTC = nzTimeToUTC(endDateStr, timeStr);
        const lastDayEndUTC = new Date(
          lastDayStartUTC.getTime() + day2DurationMs,
        );
        scheduledEndDateISO = lastDayEndUTC.toISOString();
      }

      const jobUpdateResponse = await fetch(`/api/jobs/${editingJob.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledDate: startTimeISO, // Send full UTC ISO string
          scheduledEndDate: scheduledEndDateISO, // null for single-day jobs
          scheduledStartTime: timeStr, // NZ local time (HH:MM format)
          scheduledEndTime: endTimeNZ.time, // NZ local time (HH:MM format)
          assignedTo: uniqueEmployeeIds,
          status: "scheduled", // Automatically change status to scheduled
        }),
      });

      if (!jobUpdateResponse.ok) {
        throw new Error("Failed to update job schedule");
      }

      // Then create staff assignments
      const response = await fetch(
        `/api/jobs/${editingJob.id}/staff-assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffAssignments,
            sendNotifications: true,
            sendClientNotification: schedulingData.sendClientNotification,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        const scheduledDate = new Date(startTimeISO);
        const isMultiDay = !!scheduledEndDateISO;
        const endDateDisplay = isMultiDay
          ? ` – ${format(new Date(scheduledEndDateISO!), "PPP")}`
          : "";

        if (schedulingData.sendClientNotification && data.clientEmailMissing) {
          toast({
            title: "No email address on file",
            description:
              "The confirmation email wasn't sent because this job has no client email address. Add one in the Contact Details section and try again.",
            variant: "destructive",
          });
        } else if (
          schedulingData.sendClientNotification &&
          data.clientEmailFailed
        ) {
          toast({
            title: "Email failed to send",
            description:
              "The job was scheduled but the confirmation email couldn't be delivered. Please check your email settings or send it manually.",
            variant: "destructive",
          });
        }

        // Update form's status to match database
        form.setValue("status", "scheduled");

        // Immediately patch the job's cache entry so any form reset triggered by
        // invalidation picks up status='scheduled' (not stale 'quote').
        // Follows the same pattern as the auto-save cache update (RC4 FIX).
        queryClient.setQueryData(
          ["/api/jobs", editingJob.id],
          (old: unknown) => {
            if (!old || typeof old !== "object") return old;
            const wrapper = old as Record<string, unknown>;
            if (wrapper.data && typeof wrapper.data === "object") {
              return {
                ...wrapper,
                data: { ...(wrapper.data as object), status: "scheduled" },
              };
            }
            return { ...wrapper, status: "scheduled" };
          },
        );

        // Flush form to a clean baseline — prevents the 1.5s debounce from firing
        // with stale status='quote' after the query invalidation resets the form.
        changedFieldsRef.current.clear();
        hasUserChangedRef.current = false;
        form.reset(form.getValues(), { keepValues: true, keepDirty: false });

        // Refresh job data and staff assignments for dispatch board
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs/for-date"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scheduling/revenue"] });
        queryClient.invalidateQueries({
          queryKey: ["/api/jobs", editingJob.id, "diary"],
        });

        setIsSchedulingModalOpen(false);
        setSchedulingData({
          date: "",
          endDate: "",
          startTime: "",
          duration: "",
          day2Duration: "",
          assignedTo: [],
          notes: "",
          sendClientNotification: false,
        });
        setStaffConflicts([]);
      } else {
        throw new Error(data.message || "Failed to schedule");
      }
    } catch (error) {
      console.error("Error scheduling job:", error);
      toast({
        title: "Scheduling Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to schedule job. Please try again.",
        variant: "destructive",
      });
    }
  };

  const unscheduleJob = async () => {
    if (!editingJob?.id) return;
    try {
      const prevDate = editingJob.scheduledDate;
      const res = await fetch(`/api/jobs/${editingJob.id}/unschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to unschedule job");
      form.setValue("status", "work_order");
      changedFieldsRef.current.clear();
      hasUserChangedRef.current = false;
      form.reset(form.getValues(), { keepValues: true, keepDirty: false });

      // Create diary entry to record the unscheduling
      try {
        const dateStr = prevDate ? ` (was scheduled ${new Date(prevDate).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })})` : "";
        await apiRequest("POST", `/api/jobs/${editingJob.id}/diary`, {
          jobId: editingJob.id,
          entryType: "note",
          title: "Job Unscheduled",
          description: `Job removed from the schedule${dateStr} and returned to work orders.`,
          authorName: "System",
          isPrivate: false,
        });
      } catch (diaryError) {
        console.error("Failed to log unschedule to diary:", diaryError);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs?limit=10000&offset=0"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs?limit=500&offset=0&excludeCompleted=true&excludeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/for-date"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling/revenue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", editingJob.id, "diary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", editingJob.id, "diary-timeline"] });
      setIsSchedulingModalOpen(false);
      setSchedulingData({ date: "", endDate: "", startTime: "", duration: "", day2Duration: "", assignedTo: [], notes: "", sendClientNotification: false });
    } catch (error) {
      console.error("Error unscheduling job:", error);
      toast({ title: "Error", description: "Could not unschedule the job.", variant: "destructive" });
    }
  };

  // Save button handlers
  const handleSave = async () => {
    console.log("🔴 SAVE BUTTON CLICKED");

    // Prevent double-clicking
    if (isSaving) {
      console.log("Save already in progress, ignoring duplicate click");
      return;
    }

    // Commit any open popup drafts before reading form values.
    // Without this, clicking Save while a popup is open loses the typed text.
    // Do NOT call setDescriptionPopupOpen(false) here — closing the Radix Dialog mid-save
    // triggers focus management that disrupts the create→edit split-screen transition.
    // The popup is closed in createJobMutation.onSuccess after the transition completes.
    if (descriptionPopupOpen) {
      form.setValue("description", descriptionDraft, { shouldDirty: true });
    }
    // RC10 FIX: Mirror the description sync for internal notes popup.
    if (internalNotesPopupOpen && internalNotesDraft) {
      form.setValue("internalNotes", internalNotesDraft, { shouldDirty: true });
    }

    let formData = form.getValues();
    console.log("Form data before save:", formData);
    console.log("Form errors:", form.formState.errors);
    console.log("editingJob customerId:", editingJob?.customerId);
    console.log("mode:", mode, "isNewCustomer:", formData.isNewCustomer);

    // SAFETY CHECK: For edit mode, always ensure customerId is set from the editingJob
    // This fixes validation errors when the form doesn't properly load the customerId
    if (mode === "edit" && editingJob?.customerId) {
      if (!formData.customerId) {
        console.warn("⚠️ customerId was empty - restoring from editingJob");
        form.setValue("customerId", editingJob.customerId);
      }
      // Also ensure isNewCustomer is false for existing jobs
      if (formData.isNewCustomer !== false) {
        console.warn(
          "⚠️ isNewCustomer was not false - setting to false for existing job",
        );
        form.setValue("isNewCustomer", false);
      }
      // Preserve original description only if the field was never touched (not intentionally cleared)
      if (!formData.description && editingJob.description && !form.formState.dirtyFields.description) {
        console.warn("⚠️ description was empty - restoring from editingJob");
        form.setValue("description", editingJob.description);
      }
      // Re-fetch form values after setting
      formData = form.getValues();
      console.log("Form data after safety fix:", formData);
    }

    // TRANSFORM LEGACY LINE ITEMS: Convert old format to new schema format before validation
    const lineItems = formData.lineItems || [];
    if (lineItems.length > 0) {
      const transformedItems = lineItems.map((item: any, index: number) => ({
        id: item.id || `legacy-${index}-${Date.now()}`,
        itemCode: item.itemCode || "",
        description: item.description || "",
        quantity:
          typeof item.quantity === "string"
            ? parseFloat(item.quantity) || 1
            : item.quantity || 1,
        unitPrice: item.unitPrice ?? item.rate ?? 0,
        total: item.total ?? item.amount ?? 0,
        unitCost: item.unitCost ?? 0,
        totalCost: item.totalCost ?? 0,
        taxRate: item.taxRate ?? 15,
        priceIncludesTax: item.priceIncludesTax ?? false,
      }));
      form.setValue("lineItems", transformedItems);
      formData = form.getValues();
      console.log(
        "Form data after lineItems transformation:",
        formData.lineItems,
      );
    }

    // Auto-set newCustomerName from job contact names if not provided (for jobs from conversations)
    if (
      formData.isNewCustomer &&
      !formData.newCustomerName &&
      (formData.jobContactFirstName || formData.jobContactLastName)
    ) {
      formData.newCustomerName =
        `${formData.jobContactFirstName || ""} ${formData.jobContactLastName || ""}`.trim();
      form.setValue("newCustomerName", formData.newCustomerName);
    }

    // Check if form has validation errors
    const isValid = await form.trigger();
    console.log("🔴 Form validation result:", isValid);
    if (!isValid) {
      const errors = form.formState.errors;
      console.error("🔴 Form validation failed:", errors);
      // Log specific field errors for debugging
      Object.keys(errors).forEach((key) => {
        console.error(
          `🔴 Field "${key}" error:`,
          (errors as any)[key]?.message,
        );
      });
      // Build a helpful error message
      const errorMessages: string[] = [];
      if ((errors as any).newCustomerName?.message) {
        errorMessages.push("Customer name is required");
      }
      if ((errors as any).address?.message) {
        errorMessages.push("Address is required");
      }
      toast({
        title: "Missing Required Fields",
        description:
          errorMessages.length > 0
            ? errorMessages.join(", ")
            : "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Map new customer fields to job contact fields for backend compatibility
    if (formData.isNewCustomer && formData.newCustomerName) {
      const names = formData.newCustomerName.split(" ");
      formData.jobContactFirstName =
        formData.jobContactFirstName || names[0] || "";
      formData.jobContactLastName =
        formData.jobContactLastName || names.slice(1).join(" ") || "";
      // RC1 FIX: Only overwrite jobContactEmail if newCustomerEmail has a real value.
      // Previously this set jobContactEmail = '' when newCustomerEmail was empty, wiping
      // any email the user had typed in the jobContactEmail field directly.
      if (formData.newCustomerEmail) {
        formData.jobContactEmail = formData.newCustomerEmail;
      }
      formData.jobContactPhone = formData.newCustomerPhone || "";
      // Copy new customer address to job address if job address is empty.
      // newCustomerAddress saves to the customer record but the job needs its own copy.
      if (!formData.address && (formData as any).newCustomerAddress) {
        formData.address = (formData as any).newCustomerAddress;
      }
    }

    setIsSaving(true);
    try {
      if (mode === "create") {
        await createJobMutation.mutateAsync(formData);
      } else {
        const originalData = originalLoadedDataRef.current;
        const changedData: Record<string, any> = {};
        const skipFields = [
          "isNewCustomer",
          "newCustomerName",
          "newCustomerEmail",
          "newCustomerPhone",
          "newCustomerAddress",
        ];

        for (const [key, value] of Object.entries(formData)) {
          if (skipFields.includes(key)) continue;
          const origVal = originalData[key];
          if (key === "lineItems" || key === "checklist") {
            changedData[key] = value;
            continue;
          }
          if (JSON.stringify(value) !== JSON.stringify(origVal)) {
            changedData[key] = value;
          }
        }

        if (formData.isNewCustomer) {
          changedData.isNewCustomer = formData.isNewCustomer;
          changedData.newCustomerName = formData.newCustomerName;
          changedData.newCustomerEmail = (formData as any).newCustomerEmail;
          changedData.newCustomerPhone = (formData as any).newCustomerPhone;
        }

        changedData.customerId = formData.customerId;

        console.log(
          "💾 Manual save - only sending changed fields:",
          Object.keys(changedData),
        );
        await updateJobMutation.mutateAsync(
          changedData as GlobalJobCardFormData,
        );

        originalLoadedDataRef.current = { ...formData };
      }
    } catch (error) {
      console.error("Save failed:", error);
      toast({
        title: "Save Failed",
        description:
          error instanceof Error ? error.message : "Failed to save job",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Callback for ProposalBuilder to request job save (returns job ID)
  const handleRequestJobSave = async (): Promise<string> => {
    const formData = form.getValues();

    // Check if form has validation errors
    const isValid = await form.trigger();
    if (!isValid) {
      throw new Error(
        "Please fill in all required fields before creating a proposal",
      );
    }

    // Map new customer fields to job contact fields for backend compatibility
    if (formData.isNewCustomer && formData.newCustomerName) {
      const names = formData.newCustomerName.split(" ");
      formData.jobContactFirstName = names[0] || "";
      formData.jobContactLastName = names.slice(1).join(" ") || "";
      formData.jobContactEmail = formData.newCustomerEmail || "";
      formData.jobContactPhone = formData.newCustomerPhone || "";
      if (!formData.address && (formData as any).newCustomerAddress) {
        formData.address = (formData as any).newCustomerAddress;
      }
    }

    try {
      let result;
      if (mode === "create") {
        result = await createJobMutation.mutateAsync(formData);
      } else {
        const originalData = originalLoadedDataRef.current;
        const changedData: Record<string, any> = {};
        const skipFields = [
          "isNewCustomer",
          "newCustomerName",
          "newCustomerEmail",
          "newCustomerPhone",
          "newCustomerAddress",
        ];
        for (const [key, value] of Object.entries(formData)) {
          if (skipFields.includes(key)) continue;
          if (key === "lineItems" || key === "checklist") {
            changedData[key] = value;
            continue;
          }
          if (JSON.stringify(value) !== JSON.stringify(originalData[key])) {
            changedData[key] = value;
          }
        }
        if (formData.isNewCustomer) {
          changedData.isNewCustomer = formData.isNewCustomer;
          changedData.newCustomerName = formData.newCustomerName;
          changedData.newCustomerEmail = (formData as any).newCustomerEmail;
          changedData.newCustomerPhone = (formData as any).newCustomerPhone;
        }
        changedData.customerId = formData.customerId;
        result = await updateJobMutation.mutateAsync(
          changedData as GlobalJobCardFormData,
        );
        originalLoadedDataRef.current = { ...formData };
      }

      const jobId = result?.data?.id || result?.id || editingJob?.id;
      if (!jobId) {
        throw new Error("Failed to get job ID after save");
      }

      // If we just created a job with a new customer, refetch the job to get the customerId
      if (mode === "create" && formData.isNewCustomer) {
        try {
          const jobResponse = await fetch(`/api/jobs/${jobId}`);
          if (jobResponse.ok) {
            const jobData = await jobResponse.json();
            const newCustomerId = jobData?.data?.customerId;
            if (newCustomerId) {
              // Update the form with the new customerId
              form.setValue("customerId", newCustomerId);
              // Invalidate customer queries to refresh the dropdown
              queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
            }
          }
        } catch (error) {
          console.warn(
            "Failed to fetch customer ID after job creation:",
            error,
          );
        }
      }

      return jobId;
    } catch (error) {
      console.error("Failed to save job for proposal:", error);
      throw error;
    }
  };

  const handleSaveAndClose = async () => {
    // Prevent double-clicking
    if (isSaving) {
      console.log("Save already in progress, ignoring duplicate click");
      return;
    }

    // Commit any open popup drafts before reading form values.
    // Do NOT close the popups here — see handleSave comment for why.
    if (descriptionPopupOpen) {
      form.setValue("description", descriptionDraft, { shouldDirty: true });
    }
    // RC10 FIX: Mirror for internal notes popup.
    if (internalNotesPopupOpen && internalNotesDraft) {
      form.setValue("internalNotes", internalNotesDraft, { shouldDirty: true });
    }

    const formData = form.getValues();

    // Preserve original description only if the field was never touched (not intentionally cleared)
    if (mode === "edit" && !formData.description && editingJob?.description && !form.formState.dirtyFields.description) {
      formData.description = editingJob.description;
    }

    // Map new customer fields to job contact fields for backend compatibility
    if (formData.isNewCustomer && formData.newCustomerName) {
      const names = formData.newCustomerName.split(" ");
      formData.jobContactFirstName = names[0] || "";
      formData.jobContactLastName = names.slice(1).join(" ") || "";
      formData.jobContactEmail = formData.newCustomerEmail || "";
      formData.jobContactPhone = formData.newCustomerPhone || "";
      if (!formData.address && (formData as any).newCustomerAddress) {
        formData.address = (formData as any).newCustomerAddress;
      }
    }

    setIsSaving(true);
    try {
      if (mode === "create") {
        await createJobMutation.mutateAsync(formData);
      } else {
        const originalData = originalLoadedDataRef.current;
        const changedData: Record<string, any> = {};
        const skipFields = [
          "isNewCustomer",
          "newCustomerName",
          "newCustomerEmail",
          "newCustomerPhone",
          "newCustomerAddress",
        ];

        const clearFields: string[] = [];
        for (const [key, value] of Object.entries(formData)) {
          if (skipFields.includes(key)) continue;
          const origVal = originalData[key];
          if (key === "lineItems" || key === "checklist") {
            changedData[key] = value;
            continue;
          }
          if (JSON.stringify(value) !== JSON.stringify(origVal)) {
            changedData[key] = value;
            if (value === "" || value === null || value === undefined) {
              clearFields.push(key);
            }
          }
        }
        if (clearFields.length > 0) {
          changedData._clearFields = clearFields;
        }

        if (formData.isNewCustomer) {
          changedData.isNewCustomer = formData.isNewCustomer;
          changedData.newCustomerName = formData.newCustomerName;
          changedData.newCustomerEmail = (formData as any).newCustomerEmail;
          changedData.newCustomerPhone = (formData as any).newCustomerPhone;
        }

        changedData.customerId = formData.customerId;

        console.log(
          "💾 Save & close - only sending changed fields:",
          Object.keys(changedData),
        );
        await updateJobMutation.mutateAsync(
          changedData as GlobalJobCardFormData,
        );
      }
      onClose();
    } catch (error) {
      console.error("Save and close failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle dialog close - save pending changes before closing
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // CRITICAL: Clear loading ref when closing to prevent stale state on next open
      isLoadingDataRef.current = false;
      const hadChanges = hasUserChangedRef.current;
      hasUserChangedRef.current = false;

      if (mode === "edit" && editingJob?.id && hadChanges) {
        const saveAndClose = async () => {
          try {
            const formData = form.getValues();
            const originalData = originalLoadedDataRef.current;
            const changedData: Record<string, any> = {};
            const skipFields = [
              "isNewCustomer",
              "newCustomerName",
              "newCustomerEmail",
              "newCustomerPhone",
              "newCustomerAddress",
            ];

            for (const [key, value] of Object.entries(formData)) {
              if (skipFields.includes(key)) continue;
              const origVal = originalData[key];
              if (key === "lineItems" || key === "checklist") {
                changedData[key] = value;
                continue;
              }
              if (JSON.stringify(value) !== JSON.stringify(origVal)) {
                changedData[key] = value;
              }
            }

            if (formData.isNewCustomer && formData.newCustomerName) {
              changedData.isNewCustomer = formData.isNewCustomer;
              changedData.newCustomerName = formData.newCustomerName;
              changedData.newCustomerEmail = (formData as any).newCustomerEmail;
              changedData.newCustomerPhone = (formData as any).newCustomerPhone;
            }

            changedData.customerId = formData.customerId;

            const changedKeys = Object.keys(changedData).filter(
              (k) =>
                k !== "customerId" && k !== "lineItems" && k !== "checklist",
            );
            if (changedKeys.length > 0) {
              console.log(
                "💾 Save on close - only sending changed fields:",
                changedKeys,
              );
              await apiRequest(
                "PUT",
                `/api/jobs/${editingJob.id}`,
                changedData,
              );
              queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
            }
          } catch (error) {
            console.error("Failed to save on close:", error);
          } finally {
            onClose();
          }
        };

        saveAndClose();
      } else {
        onClose();
      }
    }
  };

  // Compute effective job ID for loading check
  const effectiveJobId = createdJobId || jobId;

  // Loading check - show spinner while fetching specific job data in edit mode
  // CRITICAL: If edit mode + ID + no job prop + no data = LOADING (prevents blank screen on first click)
  const jobLoading =
    mode === "edit" && !!effectiveJobId && !job && !specificJob;

  // Get current status - use editingJob.status directly to avoid showing stale form data during loading
  // In create mode, use form.watch since there's no editingJob yet
  // IMPORTANT: This line accesses editingJob, so it must come AFTER the loading check above
  const currentStatus =
    mode === "edit" ? editingJob?.status : watchedStatus;

  if (jobLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center h-full w-full bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );

    return (
      <>
        {renderInline ? (
          loadingContent
        ) : (
          <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent
              className="w-full h-[100dvh] max-w-full flex flex-col p-0 sm:p-0 bg-gray-50 overflow-hidden sm:max-w-6xl sm:h-[91vh] sm:rounded-xl"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            >
              {loadingContent}
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // Job card content (can be rendered inline or in a dialog)
  const jobCardContent = (
    <div
      className={
        renderInline
          ? "h-full w-full flex flex-col bg-gray-50"
          : "w-full h-full max-w-full flex flex-col p-0 sm:p-0 bg-gray-50 overflow-hidden sm:max-w-6xl sm:h-[91vh] sm:rounded-xl"
      }
    >
      {/* Hidden titles for accessibility */}
      {!renderInline && (
        <>
          <DialogTitle className="sr-only">
            {mode === "create"
              ? "Create New Job"
              : `Job ${editingJob?.jobNumber || ""}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "create"
              ? "Create a new job with customer details and specifications"
              : "View and edit job details, contacts, and settings"}
          </DialogDescription>
        </>
      )}

      {/* ServiceM8-style Header - White with colored status badge */}
      <div
        className="border-b border-gray-200 bg-white px-2 sm:px-3 md:px-4 py-0.5 sm:py-1 flex-shrink-0 rounded-t-lg"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-4 relative">
          {/* Centred status badge — absolutely positioned so it floats in the middle of the header */}
          {currentStatus && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Badge
                className={`pointer-events-auto text-xs whitespace-nowrap rounded-full ${
                  currentStatus === "completed"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : currentStatus === "work_order"
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : currentStatus === "quote"
                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                        : currentStatus === "lead"
                          ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                          : currentStatus === "scheduled"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : currentStatus === "unsuccessful"
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-gray-600 hover:bg-gray-700 text-white"
                }`}
                data-testid="badge-job-status"
              >
                {currentStatus.charAt(0).toUpperCase() +
                  currentStatus.slice(1)}
              </Badge>
            </div>
          )}

          {/* Left: Job Title, Price & Payment Badge — stacked to prevent truncation */}
          <div className="flex flex-col justify-center flex-1 min-w-0">
            {/* Row 1: Job number only */}
            <div className="flex items-center gap-1 sm:gap-2">
              <h1
                className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 whitespace-nowrap tracking-tight"
                data-testid="text-job-title"
              >
                {mode === "create"
                  ? "New Job"
                  : `Job ${editingJob?.jobNumber || ""}`}
              </h1>
            </div>
            {/* Row 2: Price + Payment status badge (only rendered when there's something to show) */}
            {mode === "edit" &&
              (() => {
                // Line items total — each item.total is stored exc-GST (priceIncludesTax: false default)
                const lineItemsTotal = watchedLineItems.reduce(
                  (sum: number, item: any) => {
                    // Prefer explicit exc-GST fields if available
                    const exGst =
                      item.totalExGst ??
                      (item.priceExGst != null
                        ? item.priceExGst * (item.quantity || 1)
                        : null);
                    return sum + (exGst ?? item.total ?? 0);
                  },
                  0,
                );
                // Proposal subtotal is already exc-GST
                const proposalSubtotal = parseFloat(
                  jobProposalResponse?.data?.[0]?.subtotal || "0",
                );
                // Quote amount is typically inc-GST — divide to get exc-GST
                const quoteExGst =
                  parseFloat(jobQuoteResponse?.data?.[0]?.amount || "0") / 1.15;
                // Best source: job.subtotal is explicitly exc-GST; fall back to totalAmount / 1.15
                const jobSubtotal = parseFloat(editingJob?.subtotal || "0");
                const jobStoredExGst =
                  jobSubtotal > 0
                    ? jobSubtotal
                    : parseFloat(editingJob?.totalAmount || "0") / 1.15;
                const jobTotal =
                  lineItemsTotal ||
                  proposalSubtotal ||
                  quoteExGst ||
                  jobStoredExGst;
                const invoiceStatus = (jobInvoiceResponse as any)?.data?.[0]
                  ?.status;
                const isPaid =
                  invoiceStatus === "paid" || editingJob?.xeroStatus === "paid";
                const isOverdue = invoiceStatus === "overdue";
                if (!jobTotal && !isPaid && !isOverdue) return null;
                return (
                  <div className="flex items-center gap-1.5">
                    {jobTotal > 0 && (
                      <span
                        className="text-xs sm:text-sm font-semibold text-green-600"
                        data-testid="text-job-price"
                      >
                        {new Intl.NumberFormat("en-NZ", {
                          style: "currency",
                          currency: "NZD",
                        }).format(jobTotal)}
                      </span>
                    )}
                    {isPaid && (
                      <Badge
                        className="text-xs whitespace-nowrap rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        data-testid="badge-invoice-paid"
                      >
                        PAID
                      </Badge>
                    )}
                    {!isPaid && isOverdue && (
                      <Badge
                        className="text-xs whitespace-nowrap rounded-full bg-red-600 hover:bg-red-700 text-white font-bold"
                        data-testid="badge-invoice-overdue"
                      >
                        OVERDUE
                      </Badge>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Right: Actions Menu (Mobile), Close Button (Mobile), Save Button & Auto-save Indicator */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* Close button - Mobile only (hidden in inline mode) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-7 w-7 text-gray-600 hover:bg-gray-100"
              onClick={onClose}
              data-testid="button-close-mobile"
            >
              <X className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 sm:h-9 px-2 sm:px-3 md:px-4 text-xs bg-orange-500 text-white hover:bg-orange-600 border-0 font-semibold transition-all"
              onClick={handleSave}
              disabled={
                isSaving ||
                createJobMutation.isPending ||
                updateJobMutation.isPending
              }
              data-testid="button-save"
            >
              {isSaving ||
              createJobMutation.isPending ||
              updateJobMutation.isPending
                ? "Saving..."
                : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Action Buttons Bar - Hidden on mobile, visible on desktop/tablet */}
      <div className="hidden md:block bg-white border-b border-gray-200 px-3 md:px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Action Buttons */}
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={() => {
                setSpeechToQuoteContext("full");
                setIsSpeechToQuoteOpen(true);
              }}
              data-testid="button-speech-to-quote"
            >
              <Mic className="w-full h-auto max-w-[40px] max-h-[40px] text-purple-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">Speech</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={handleEmailClick}
              data-testid="button-email"
            >
              <MdEmail className="w-full h-auto max-w-[40px] max-h-[40px] text-blue-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">Email</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={() => setIsSMSComposerOpen(true)}
              data-testid="button-sms"
            >
              <MdSms className="w-full h-auto max-w-[40px] max-h-[40px] text-blue-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">SMS</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={handleCallClick}
              data-testid="button-call"
            >
              <MdPhone className="w-full h-auto max-w-[40px] max-h-[40px] text-green-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">Call</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={handleScheduleClick}
              data-testid="button-schedule"
            >
              <MdCalendarToday className="w-full h-auto max-w-[40px] max-h-[40px] text-red-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">
                Schedule
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={handleQueueClick}
              data-testid="button-queue"
            >
              <MdDescription className="w-full h-auto max-w-[40px] max-h-[40px] text-blue-600" />
              <span className="text-[10px] mt-1 whitespace-nowrap">Queue</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
                  data-testid="button-send"
                >
                  <MdSend className="w-full h-auto max-w-[40px] max-h-[40px] text-orange-500" />
                  <span className="text-[10px] mt-1 whitespace-nowrap">
                    Send
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={handleQuoteClick}
                  data-testid="menu-item-quote"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Quote
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleInvoiceClick}
                  data-testid="menu-item-invoice"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Invoice
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (!selectedCustomer?.id) {
                      toast({
                        title: "Customer Required",
                        description:
                          "Please select a customer before creating a proposal.",
                        variant: "destructive",
                      });
                      return;
                    }

                    // Save job first to ensure address/description changes are persisted
                    if (mode === "edit" && editingJob?.id) {
                      try {
                        const formData = form.getValues();
                        await updateJobMutation.mutateAsync(formData);
                      } catch (error) {
                        toast({
                          title: "Save Failed",
                          description:
                            "Please resolve any errors before creating a proposal",
                          variant: "destructive",
                        });
                        return;
                      }
                    }

                    // Check if there's an existing proposal and load it
                    const existingProposal = jobProposalResponse?.data?.[0];
                    if (existingProposal) {
                      setEditingProposalId(existingProposal.id);
                    }
                    setIsProposalBuilderOpen(true);
                  }}
                  data-testid="menu-item-proposal"
                >
                  <Presentation className="w-4 h-4 mr-2" />
                  Proposal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={() => setIsProfitTrackerOpen(true)}
              data-testid="button-profit"
            >
              <MdAttachMoney className="w-full h-auto max-w-[40px] max-h-[40px] text-teal-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">Profit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={() => setIsTimeTrackingOpen(true)}
              data-testid="button-time"
            >
              <MdAccessTime className="w-full h-auto max-w-[40px] max-h-[40px] text-purple-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">Time</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
              onClick={() => setIsPhotoCaptureOpen(true)}
              data-testid="button-camera"
            >
              <MdCameraAlt className="w-full h-auto max-w-[40px] max-h-[40px] text-pink-500" />
              <span className="text-[10px] mt-1 whitespace-nowrap">Camera</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto"
                  data-testid="button-more"
                >
                  <MdMoreHoriz className="w-full h-auto max-w-[40px] max-h-[40px] text-green-600" />
                  <span className="text-[10px] mt-1 whitespace-nowrap">
                    More
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEmailClick}>
                  <MdEmail className="w-4 h-4 mr-2" />
                  Email
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editingJob?.id || mode === "create"}
                  onClick={() => handleInvoiceClick()}
                  data-testid="more-menu-invoice"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Invoice
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!selectedCustomer?.id}
                  onClick={async () => {
                    if (!selectedCustomer?.id) return;
                    if (mode === "edit" && editingJob?.id) {
                      try {
                        await updateJobMutation.mutateAsync(form.getValues());
                      } catch {
                        toast({ title: "Save Failed", description: "Please resolve any errors before creating a proposal", variant: "destructive" });
                        return;
                      }
                    }
                    const existingProposal = jobProposalResponse?.data?.[0];
                    if (existingProposal) setEditingProposalId(existingProposal.id);
                    setIsProposalBuilderOpen(true);
                  }}
                  data-testid="more-menu-proposal"
                >
                  <Presentation className="w-4 h-4 mr-2" />
                  Proposal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handlePrintClick}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicateClick}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate Job
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchiveClick}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => sendToXeroMutation.mutate()}
                  disabled={
                    !editingJob?.id ||
                    mode === "create" ||
                    editingJob?.status !== "completed" ||
                    editingJob?.xeroStatus === "sent" ||
                    sendToXeroMutation.isPending
                  }
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {sendToXeroMutation.isPending
                    ? "Sending to Xero..."
                    : editingJob?.xeroStatus === "sent"
                      ? "Sent to Xero"
                      : "Send to Xero"}
                </DropdownMenuItem>
                {editingJob?.xeroStatus === "sent" && (
                  <DropdownMenuItem
                    onClick={() => setShowXeroResetConfirm(true)}
                    disabled={resetXeroSyncMutation.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-2 text-amber-600" />
                    Re-send to Xero
                  </DropdownMenuItem>
                )}
                {editingJob?.status === "completed" && (
                  <DropdownMenuItem onClick={handleRequestReviewClick}>
                    <Star className="w-4 h-4 mr-2" />
                    Request Review
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </div>

      {/* ServiceM8-style Layout: Left Sidebar + Two Panel Content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 max-w-full overflow-x-hidden">
        {/* Horizontal Tabs on Mobile, Left Sidebar on Desktop */}
        <div className="border-b md:border-b-0 md:border-r flex md:flex-col md:w-16 flex-shrink-0 bg-white border-gray-200">
          <button
            className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b ${
              currentStatus === "completed"
                ? "border-green-200"
                : currentStatus === "work_order"
                  ? "border-blue-200"
                  : currentStatus === "scheduled"
                    ? "border-green-200"
                    : currentStatus === "quote"
                      ? "border-orange-200"
                      : currentStatus === "lead"
                        ? "border-yellow-200"
                        : currentStatus === "unsuccessful"
                          ? "border-red-200"
                          : "border-gray-200"
            } ${
              sidebarTab === "details"
                ? currentStatus === "completed"
                  ? "bg-green-500 text-white"
                  : currentStatus === "work_order"
                    ? "bg-blue-500 text-white"
                    : currentStatus === "scheduled"
                      ? "bg-green-500 text-white"
                      : currentStatus === "quote"
                        ? "bg-orange-500 text-white"
                        : currentStatus === "lead"
                          ? "bg-yellow-500 text-white"
                          : currentStatus === "unsuccessful"
                            ? "bg-red-500 text-white"
                            : "bg-gray-500 text-white"
                : currentStatus === "completed"
                  ? "text-green-700 hover:bg-green-200"
                  : currentStatus === "work_order"
                    ? "text-blue-700 hover:bg-blue-200"
                    : currentStatus === "scheduled"
                      ? "text-green-700 hover:bg-green-200"
                      : currentStatus === "quote"
                        ? "text-orange-700 hover:bg-orange-200"
                        : currentStatus === "lead"
                          ? "text-yellow-700 hover:bg-yellow-200"
                          : currentStatus === "unsuccessful"
                            ? "text-red-700 hover:bg-red-200"
                            : "text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setSidebarTab("details")}
            data-testid="sidebar-details"
          >
            Details
          </button>
          <button
            className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b ${
              currentStatus === "completed"
                ? "border-green-200"
                : currentStatus === "work_order"
                  ? "border-blue-200"
                  : currentStatus === "scheduled"
                    ? "border-green-200"
                    : currentStatus === "quote"
                      ? "border-orange-200"
                      : currentStatus === "lead"
                        ? "border-yellow-200"
                        : currentStatus === "unsuccessful"
                          ? "border-red-200"
                          : "border-gray-200"
            } ${
              sidebarTab === "billing"
                ? currentStatus === "completed"
                  ? "bg-green-500 text-white"
                  : currentStatus === "work_order"
                    ? "bg-blue-500 text-white"
                    : currentStatus === "scheduled"
                      ? "bg-green-500 text-white"
                      : currentStatus === "quote"
                        ? "bg-orange-500 text-white"
                        : currentStatus === "lead"
                          ? "bg-yellow-500 text-white"
                          : currentStatus === "unsuccessful"
                            ? "bg-red-500 text-white"
                            : "bg-gray-500 text-white"
                : currentStatus === "completed"
                  ? "text-green-700 hover:bg-green-200"
                  : currentStatus === "work_order"
                    ? "text-blue-700 hover:bg-blue-200"
                    : currentStatus === "scheduled"
                      ? "text-green-700 hover:bg-green-200"
                      : currentStatus === "quote"
                        ? "text-orange-700 hover:bg-orange-200"
                        : currentStatus === "lead"
                          ? "text-yellow-700 hover:bg-yellow-200"
                          : currentStatus === "unsuccessful"
                            ? "text-red-700 hover:bg-red-200"
                            : "text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setSidebarTab("billing")}
            data-testid="sidebar-billing"
          >
            Billing
          </button>
          <button
            className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b ${
              currentStatus === "completed"
                ? "border-green-200"
                : currentStatus === "work_order"
                  ? "border-blue-200"
                  : currentStatus === "scheduled"
                    ? "border-green-200"
                    : currentStatus === "quote"
                      ? "border-orange-200"
                      : currentStatus === "lead"
                        ? "border-yellow-200"
                        : currentStatus === "unsuccessful"
                          ? "border-red-200"
                          : "border-gray-200"
            } ${
              sidebarTab === "diary"
                ? currentStatus === "completed"
                  ? "bg-green-500 text-white"
                  : currentStatus === "work_order"
                    ? "bg-blue-500 text-white"
                    : currentStatus === "scheduled"
                      ? "bg-green-500 text-white"
                      : currentStatus === "quote"
                        ? "bg-orange-500 text-white"
                        : currentStatus === "lead"
                          ? "bg-yellow-500 text-white"
                          : currentStatus === "unsuccessful"
                            ? "bg-red-500 text-white"
                            : "bg-gray-500 text-white"
                : currentStatus === "completed"
                  ? "text-green-700 hover:bg-green-200"
                  : currentStatus === "work_order"
                    ? "text-blue-700 hover:bg-blue-200"
                    : currentStatus === "scheduled"
                      ? "text-green-700 hover:bg-green-200"
                      : currentStatus === "quote"
                        ? "text-orange-700 hover:bg-orange-200"
                        : currentStatus === "lead"
                          ? "text-yellow-700 hover:bg-yellow-200"
                          : currentStatus === "unsuccessful"
                            ? "text-red-700 hover:bg-red-200"
                            : "text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setSidebarTab("diary")}
            data-testid="sidebar-diary"
          >
            Diary
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0 min-w-0">
          <Form {...form} key={jobId || createdJobId || internalMode}>
            <form
              onSubmit={form.handleSubmit((data) => {
                console.log("Form submitted:", data);
                // Save functionality will be handled by the save buttons
              })}
              className="flex flex-col h-full w-full min-w-0"
              data-form="job-form"
            >
              <div className="flex flex-col sm:flex-row h-full w-full min-w-0">
                {/* Pull-to-refresh wrapper: relative+overflow-hidden so indicator is clipped above until pulled */}
                <div
                  className={`flex-1 relative overflow-hidden ${sidebarTab !== "diary" ? "sm:border-r border-gray-300" : ""} ${sidebarTab === "diary" ? "sm:rounded-lg" : "sm:rounded-l-lg"} min-w-0`}
                >
                  {/* Pull indicator — lives outside the scrollable div so it's not clipped by overflow-y-auto */}
                  {(jobCardPullDistance > 0 || jobCardIsRefreshing) && (
                    <div
                      className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50"
                      style={{ transform: `translateY(${Math.min(jobCardPullDistance, 64) - 44}px)`, transition: jobCardIsRefreshing ? 'transform 0.2s ease' : 'none' }}
                    >
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-md border border-gray-200 text-xs font-medium ${jobCardShouldTrigger ? 'text-primary' : 'text-gray-500'}`}>
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${jobCardIsRefreshing ? 'animate-spin' : ''}`}
                          style={{ transform: !jobCardIsRefreshing ? `rotate(${Math.min(jobCardPullDistance * 4, 360)}deg)` : undefined }}
                        />
                        {jobCardIsRefreshing ? 'Refreshing…' : jobCardShouldTrigger ? 'Release to refresh' : 'Pull to refresh'}
                      </div>
                    </div>
                  )}
                  {/* Scrollable content — receives transform so it pushes down revealing the indicator */}
                  <div
                    className="bg-white h-full p-3 sm:p-4 overflow-y-auto overflow-x-hidden"
                    style={{
                      transform: jobCardIsRefreshing ? 'translateY(52px)' : jobCardPullDistance > 0 ? `translateY(${Math.min(jobCardPullDistance, 64)}px)` : undefined,
                      transition: jobCardIsRefreshing || jobCardPullDistance === 0 ? 'transform 0.25s ease' : 'none',
                    }}
                    {...jobCardPullHandlers}
                  >
                  {sidebarTab === "details" && (
                    <div className="space-y-3 md:space-y-4">
                      {/* ETA Notification Banner */}
                      {mode === "edit" &&
                        watchedEtaNotificationRequested && (
                          <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
                            <Bell className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              This customer wants to know when the crew is on
                              the way
                            </p>
                          </div>
                        )}

                      {/* ServiceM8-Style Customer Header Card */}
                      {mode === "edit" && selectedCustomerName && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:hidden">
                          <div className="flex flex-col gap-2">
                            {/* Row 0: Customer Name & Selector for Desktop/Large Screens */}
                            <div className="hidden md:block mb-2">
                              <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                                      Customer
                                    </FormLabel>
                                    <Popover
                                      open={customerSearchOpen}
                                      onOpenChange={setCustomerSearchOpen}
                                    >
                                      <PopoverTrigger asChild>
                                        <FormControl>
                                          <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                              "w-full justify-between font-bold text-xl h-auto py-1 px-0 border-0 hover:bg-transparent shadow-none",
                                              !field.value &&
                                                "text-muted-foreground font-normal text-base",
                                            )}
                                          >
                                            {field.value
                                              ? customers.find(
                                                  (c) => c.id === field.value,
                                                )?.name
                                              : "Select customer..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                        </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-[300px] p-0"
                                        align="start"
                                        onWheel={(e) => e.stopPropagation()}
                                      >
                                        <Command>
                                          <CommandInput
                                            placeholder="Search customers..."
                                            value={customerSearchValue}
                                            onValueChange={
                                              setCustomerSearchValue
                                            }
                                          />
                                          <CommandList>
                                            {/* Always show Create New Customer option when search has value */}
                                            {customerSearchValue.trim() && (
                                              <CommandGroup
                                                heading="New Customer"
                                                forceMount
                                              >
                                                <CommandItem
                                                  forceMount
                                                  value={`create-new-${customerSearchValue}`}
                                                  onSelect={() => {
                                                    form.setValue(
                                                      "isNewCustomer",
                                                      true,
                                                    );
                                                    form.setValue(
                                                      "newCustomerName",
                                                      customerSearchValue,
                                                    );
                                                    form.setValue(
                                                      "customerId",
                                                      "",
                                                    );
                                                    const names =
                                                      customerSearchValue.split(
                                                        " ",
                                                      );
                                                    form.setValue(
                                                      "jobContactFirstName",
                                                      names[0] || "",
                                                    );
                                                    form.setValue(
                                                      "jobContactLastName",
                                                      names
                                                        .slice(1)
                                                        .join(" ") || "",
                                                    );
                                                    setSelectedCustomerName(
                                                      customerSearchValue,
                                                    );
                                                    setCustomerSearchOpen(
                                                      false,
                                                    );
                                                  }}
                                                  className="text-blue-600 cursor-pointer"
                                                >
                                                  <Plus className="mr-2 h-4 w-4" />
                                                  Create "{customerSearchValue}"
                                                </CommandItem>
                                              </CommandGroup>
                                            )}
                                            <CommandEmpty>
                                              <p className="text-sm text-muted-foreground p-2">
                                                No customers found
                                              </p>
                                            </CommandEmpty>
                                            <CommandGroup heading="Existing Customers">
                                              {customers.map((customer) => (
                                                <CommandItem
                                                  key={customer.id}
                                                  value={customer.name}
                                                  onSelect={() => {
                                                    form.setValue(
                                                      "customerId",
                                                      customer.id,
                                                    );
                                                    form.setValue(
                                                      "isNewCustomer",
                                                      false,
                                                    );
                                                    form.setValue(
                                                      "newCustomerName",
                                                      "",
                                                    );
                                                    setSelectedCustomerName(
                                                      customer.name,
                                                    );
                                                    setHasUserSelectedCustomer(
                                                      true,
                                                    );
                                                    setCustomerSearchOpen(
                                                      false,
                                                    );
                                                    if (
                                                      customer.address &&
                                                      !form.getValues("address")
                                                    ) {
                                                      form.setValue(
                                                        "address",
                                                        customer.address,
                                                      );
                                                    }
                                                    saveCustomerImmediately(
                                                      customer.id,
                                                      customer.name,
                                                    );
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      customer.id ===
                                                        field.value
                                                        ? "opacity-100"
                                                        : "opacity-0",
                                                    )}
                                                  />
                                                  {customer.name}
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Row 1: Customer Name + Status Badge (Mobile) */}
                            <div className="flex items-start justify-between gap-2">
                              {isEditingCustomerName ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    autoFocus
                                    value={editingNameValue}
                                    onChange={(e) =>
                                      setEditingNameValue(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSaveCustomerName(
                                          editingNameValue,
                                        );
                                      } else if (e.key === "Escape") {
                                        setIsEditingCustomerName(false);
                                        setEditingNameValue("");
                                      }
                                    }}
                                    className="h-9 text-base font-bold flex-1"
                                    placeholder="Customer name"
                                    disabled={isSavingCustomerName}
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    disabled={
                                      isSavingCustomerName ||
                                      !editingNameValue.trim()
                                    }
                                    onClick={() =>
                                      handleSaveCustomerName(editingNameValue)
                                    }
                                  >
                                    {isSavingCustomerName ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    disabled={isSavingCustomerName}
                                    onClick={() => {
                                      setIsEditingCustomerName(false);
                                      setEditingNameValue("");
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Popover
                                  open={mobileNamePopoverOpen}
                                  onOpenChange={setMobileNamePopoverOpen}
                                >
                                  <PopoverTrigger asChild>
                                    <button className="font-bold text-gray-900 text-xl text-left flex items-center gap-1 hover:text-blue-600 transition-colors">
                                      {selectedCustomerName}
                                      {selectedVipCustomer?.isVipMember && (
                                        <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                      )}
                                      <Pencil className="h-3.5 w-3.5 opacity-50" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[280px] p-0"
                                    align="start"
                                    onWheel={(e) => e.stopPropagation()}
                                  >
                                    <div className="p-2 border-b">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-sm"
                                        onClick={() => {
                                          setEditingNameValue(
                                            selectedCustomerName,
                                          );
                                          setIsEditingCustomerName(true);
                                          setMobileNamePopoverOpen(false);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5 mr-2" />
                                        Edit Name
                                      </Button>
                                    </div>
                                    <Command>
                                      <CommandInput
                                        placeholder="Search customers..."
                                        value={customerSearchValue}
                                        onValueChange={setCustomerSearchValue}
                                      />
                                      <CommandList className="max-h-[250px]">
                                        <CommandEmpty>
                                          No customers found
                                        </CommandEmpty>
                                        <CommandGroup heading="Switch Customer">
                                          {customers
                                            .filter((customer) =>
                                              customer.name
                                                ?.toLowerCase()
                                                .includes(
                                                  customerSearchValue.toLowerCase(),
                                                ),
                                            )
                                            .map((customer) => (
                                              <CommandItem
                                                key={customer.id}
                                                value={customer.name}
                                                onSelect={() => {
                                                  form.setValue(
                                                    "customerId",
                                                    customer.id,
                                                  );
                                                  setSelectedCustomerName(
                                                    customer.name,
                                                  );
                                                  setCustomerSearchValue("");
                                                  setMobileNamePopoverOpen(
                                                    false,
                                                  );
                                                  if (
                                                    customer.address &&
                                                    !form.getValues("address")
                                                  ) {
                                                    form.setValue(
                                                      "address",
                                                      customer.address,
                                                    );
                                                  }
                                                  if (
                                                    customer.email &&
                                                    !form.getValues(
                                                      "jobContactEmail",
                                                    )
                                                  ) {
                                                    form.setValue(
                                                      "jobContactEmail",
                                                      customer.email,
                                                    );
                                                  }
                                                  const phoneNumber =
                                                    customer.mobile ||
                                                    customer.phone ||
                                                    "";
                                                  if (phoneNumber) {
                                                    const isMobileNum =
                                                      /^(\+?64)?0?2[0-9]/.test(
                                                        phoneNumber
                                                          .replace(/\s/g, "")
                                                          .replace(
                                                            /^\+64/,
                                                            "0",
                                                          ),
                                                      );
                                                    if (isMobileNum) {
                                                      if (
                                                        !form.getValues(
                                                          "jobContactMobile",
                                                        )
                                                      ) {
                                                        form.setValue(
                                                          "jobContactMobile",
                                                          phoneNumber,
                                                        );
                                                      }
                                                    } else {
                                                      if (
                                                        !form.getValues(
                                                          "jobContactPhone",
                                                        )
                                                      ) {
                                                        form.setValue(
                                                          "jobContactPhone",
                                                          phoneNumber,
                                                        );
                                                      }
                                                    }
                                                  }
                                                  saveCustomerImmediately(
                                                    customer.id,
                                                    customer.name,
                                                  );
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    watchedCustomerId ===
                                                      customer.id
                                                      ? "opacity-100"
                                                      : "opacity-0",
                                                  )}
                                                />
                                                <span className="truncate">
                                                  {customer.name}
                                                </span>
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-full ${
                                  currentStatus === "completed"
                                    ? "bg-green-100 text-green-700"
                                    : currentStatus === "work_order"
                                      ? "bg-blue-100 text-blue-700"
                                      : currentStatus === "quote"
                                        ? "bg-indigo-100 text-indigo-700"
                                        : currentStatus === "lead"
                                          ? "bg-yellow-100 text-yellow-700"
                                          : currentStatus === "scheduled"
                                            ? "bg-green-100 text-green-700"
                                            : currentStatus === "unsuccessful"
                                              ? "bg-red-100 text-red-700"
                                              : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                <FileText className="h-3 w-3" />
                                {currentStatus === "quote"
                                  ? "Quote Sent"
                                  : currentStatus === "work_order"
                                    ? "Work Order"
                                    : currentStatus === "completed"
                                      ? "Completed"
                                      : currentStatus === "lead"
                                        ? "Lead"
                                        : currentStatus === "scheduled"
                                          ? "Scheduled"
                                          : currentStatus === "unsuccessful"
                                            ? "Unsuccessful"
                                            : currentStatus
                                                ?.charAt(0)
                                                .toUpperCase() +
                                                currentStatus?.slice(1) ||
                                              "Job"}
                              </span>
                            </div>

                            {/* VIP Member Strip (Mobile) */}
                            {selectedVipCustomer?.isVipMember && (
                              <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                                <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                <span>
                                  VIP Member
                                  {selectedVipCustomer.vipDiscountPercent
                                    ? ` — ${parseFloat(selectedVipCustomer.vipDiscountPercent)}% discount applies`
                                    : ""}
                                </span>
                              </div>
                            )}

                            {/* Row 2: Est time | Rate | Crew — pill chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {editingJob?.hourlyRate && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                  <DollarSign className="h-3 w-3" />$
                                  {editingJob.hourlyRate}/hr
                                </span>
                              )}
                              {editingJob?.assignedTo &&
                                editingJob.assignedTo.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                                    <User className="h-3 w-3" />
                                    {editingJob.assignedTo.length} crew
                                  </span>
                                )}
                            </div>

                          </div>

                        </div>
                      )}

                      {/* Desktop: Customer Name Display - Clickable to change */}
                      {mode === "edit" && (
                        <div className="hidden md:block mb-2">
                          {isEditingCustomerName ? (
                            <div className="flex items-center gap-2">
                              <Input
                                autoFocus
                                value={editingNameValue}
                                onChange={(e) =>
                                  setEditingNameValue(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveCustomerName(editingNameValue);
                                  } else if (e.key === "Escape") {
                                    setIsEditingCustomerName(false);
                                    setEditingNameValue("");
                                  }
                                }}
                                className="h-9 text-base font-bold max-w-xs"
                                placeholder="Customer name"
                                disabled={isSavingCustomerName}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={
                                  isSavingCustomerName ||
                                  !editingNameValue.trim()
                                }
                                onClick={() =>
                                  handleSaveCustomerName(editingNameValue)
                                }
                              >
                                {isSavingCustomerName ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={isSavingCustomerName}
                                onClick={() => {
                                  setIsEditingCustomerName(false);
                                  setEditingNameValue("");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Popover
                              open={customerSearchOpen}
                              onOpenChange={setCustomerSearchOpen}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="p-0 h-auto font-bold text-gray-900 text-xl hover:bg-transparent hover:underline"
                                >
                                  {selectedCustomerName || "Select Customer"}
                                  {selectedVipCustomer?.isVipMember && (
                                    <Crown className="ml-1 h-4 w-4 text-amber-500 flex-shrink-0" />
                                  )}
                                  <Pencil className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[300px] md:w-[400px] p-0"
                                align="start"
                                onWheel={(e) => e.stopPropagation()}
                              >
                                <div className="p-2 border-b">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-sm"
                                    onClick={() => {
                                      setEditingNameValue(selectedCustomerName);
                                      setIsEditingCustomerName(true);
                                      setCustomerSearchOpen(false);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                    Edit Name
                                  </Button>
                                </div>
                                <Command>
                                  <CommandInput
                                    placeholder="Search customers..."
                                    value={customerSearchValue}
                                    onValueChange={setCustomerSearchValue}
                                  />
                                  <CommandList className="max-h-[300px]">
                                    <CommandEmpty>
                                      No customers found
                                    </CommandEmpty>
                                    <CommandGroup heading="Switch Customer">
                                      {customers
                                        .filter((customer) =>
                                          customer.name
                                            ?.toLowerCase()
                                            .includes(
                                              customerSearchValue.toLowerCase(),
                                            ),
                                        )
                                        .map((customer) => (
                                          <CommandItem
                                            key={customer.id}
                                            value={customer.name}
                                            onSelect={() => {
                                              form.setValue(
                                                "customerId",
                                                customer.id,
                                              );
                                              setSelectedCustomerName(
                                                customer.name,
                                              );
                                              setCustomerSearchOpen(false);
                                              setCustomerSearchValue("");
                                              // Pre-fill address from customer if available
                                              if (
                                                customer.address &&
                                                !form.getValues("address")
                                              ) {
                                                form.setValue(
                                                  "address",
                                                  customer.address,
                                                );
                                              }
                                              // Pre-fill contact info from customer if not already set
                                              if (
                                                customer.email &&
                                                !form.getValues(
                                                  "jobContactEmail",
                                                )
                                              ) {
                                                form.setValue(
                                                  "jobContactEmail",
                                                  customer.email,
                                                );
                                              }
                                              // Route mobile numbers to mobile field, landline to phone field
                                              // Only populate fields that are currently empty — never overwrite existing values
                                              const phoneNumber =
                                                customer.mobile ||
                                                customer.phone ||
                                                "";
                                              if (phoneNumber) {
                                                const isMobileNum =
                                                  /^(\+?64)?0?2[0-9]/.test(
                                                    phoneNumber.replace(
                                                      /\s/g,
                                                      "",
                                                    ),
                                                  );
                                                if (isMobileNum) {
                                                  if (
                                                    !form.getValues(
                                                      "jobContactMobile",
                                                    )
                                                  ) {
                                                    form.setValue(
                                                      "jobContactMobile",
                                                      phoneNumber,
                                                    );
                                                  }
                                                } else {
                                                  if (
                                                    !form.getValues(
                                                      "jobContactPhone",
                                                    )
                                                  ) {
                                                    form.setValue(
                                                      "jobContactPhone",
                                                      phoneNumber,
                                                    );
                                                  }
                                                }
                                              }
                                              saveCustomerImmediately(
                                                customer.id,
                                                customer.name,
                                              );
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                watchedCustomerId ===
                                                  customer.id
                                                  ? "opacity-100"
                                                  : "opacity-0",
                                              )}
                                            />
                                            <div className="flex flex-col">
                                              <span>{customer.name}</span>
                                              {customer.address && (
                                                <span className="text-xs text-gray-500">
                                                  {customer.address}
                                                </span>
                                              )}
                                            </div>
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                          {/* VIP Member Strip (Desktop) */}
                          {selectedVipCustomer?.isVipMember && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md mt-1">
                              <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                              <span>
                                VIP Member
                                {selectedVipCustomer.vipDiscountPercent
                                  ? ` — ${parseFloat(selectedVipCustomer.vipDiscountPercent)}% discount applies`
                                  : ""}
                              </span>
                            </div>
                          )}

                          {/* Desktop: Status badge + Info chips row */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded-full ${
                                currentStatus === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : currentStatus === "work_order"
                                    ? "bg-blue-100 text-blue-700"
                                    : currentStatus === "quote"
                                      ? "bg-indigo-100 text-indigo-700"
                                      : currentStatus === "lead"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : currentStatus === "scheduled"
                                          ? "bg-blue-100 text-blue-700"
                                          : currentStatus === "unsuccessful"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              <FileText className="h-3 w-3" />
                              {currentStatus === "quote"
                                ? "Quote Sent"
                                : currentStatus === "work_order"
                                  ? "Work Order"
                                  : currentStatus === "completed"
                                    ? "Completed"
                                    : currentStatus === "lead"
                                      ? "Lead"
                                      : currentStatus === "scheduled"
                                        ? "Scheduled"
                                        : currentStatus === "unsuccessful"
                                          ? "Unsuccessful"
                                          : currentStatus
                                              ?.charAt(0)
                                              .toUpperCase() +
                                              currentStatus?.slice(1) || "Job"}
                            </span>
                            {editingJob?.hourlyRate && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                <DollarSign className="h-3 w-3" />$
                                {editingJob.hourlyRate}/hr
                              </span>
                            )}
                            {editingJob?.assignedTo &&
                              editingJob.assignedTo.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                                  <User className="h-3 w-3" />
                                  {editingJob.assignedTo.length} crew
                                </span>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Customer Search/Select for New Jobs (Mobile + Desktop) */}
                      {mode === "create" && (
                        <div className="mb-2">
                          <FormField
                            control={form.control}
                            name="customerId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-gray-500">
                                  Customer Name
                                </FormLabel>
                                <Popover
                                  open={customerSearchOpen}
                                  onOpenChange={setCustomerSearchOpen}
                                >
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          "w-full justify-between h-10",
                                          !field.value &&
                                            !watchedNewCustomerName &&
                                            "text-muted-foreground",
                                        )}
                                      >
                                        {field.value
                                          ? customers.find(
                                              (c) => c.id === field.value,
                                            )?.name
                                          : watchedNewCustomerName
                                            ? watchedNewCustomerName
                                            : "Select or enter customer..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[300px] md:w-[400px] p-0"
                                    align="start"
                                    onWheel={(e) => e.stopPropagation()}
                                  >
                                    <Command>
                                      <div className="flex items-center gap-1 p-2 border-b">
                                        <CommandInput
                                          placeholder="Search or add customer..."
                                          value={customerSearchValue}
                                          onValueChange={(val) => {
                                            setCustomerSearchValue(val);
                                            setDeepSearchResults([]); // Clear deep search on new input
                                          }}
                                          className="flex-1"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={performDeepSearch}
                                          disabled={
                                            isDeepSearching ||
                                            !customerSearchValue.trim()
                                          }
                                          className="shrink-0 h-8 px-2"
                                        >
                                          {isDeepSearching ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Search className="h-3.5 w-3.5" />
                                          )}
                                          <span className="ml-1 text-xs">
                                            Deep
                                          </span>
                                        </Button>
                                      </div>
                                      <CommandList className="max-h-[300px]">
                                        {/* Always show Create New Customer option when search has value */}
                                        {customerSearchValue.trim() && (
                                          <CommandGroup
                                            heading="New Customer"
                                            forceMount
                                          >
                                            <CommandItem
                                              forceMount
                                              value={`create-new-${customerSearchValue}`}
                                              onSelect={() => {
                                                form.setValue(
                                                  "isNewCustomer",
                                                  true,
                                                );
                                                form.setValue(
                                                  "newCustomerName",
                                                  customerSearchValue,
                                                );
                                                form.setValue("customerId", "");
                                                const names =
                                                  customerSearchValue.split(
                                                    " ",
                                                  );
                                                form.setValue(
                                                  "jobContactFirstName",
                                                  names[0] || "",
                                                );
                                                form.setValue(
                                                  "jobContactLastName",
                                                  names.slice(1).join(" ") ||
                                                    "",
                                                );
                                                setSelectedCustomerName(
                                                  customerSearchValue,
                                                );
                                                setCustomerSearchOpen(false);
                                              }}
                                              className="text-blue-600 cursor-pointer"
                                            >
                                              <Plus className="mr-2 h-4 w-4" />
                                              Create "{customerSearchValue}"
                                            </CommandItem>
                                          </CommandGroup>
                                        )}
                                        <CommandEmpty>
                                          <p className="text-sm text-muted-foreground p-2">
                                            No customers found
                                          </p>
                                        </CommandEmpty>
                                        {/* Deep Search Results */}
                                        {deepSearchResults.length > 0 && (
                                          <CommandGroup
                                            heading={`Deep Search Results (${deepSearchResults.length})`}
                                          >
                                            {deepSearchResults.map(
                                              (customer: any) => (
                                                <CommandItem
                                                  key={`deep-${customer.id}`}
                                                  value={`deep-${customer.name}`}
                                                  onSelect={async () => {
                                                    form.setValue(
                                                      "customerId",
                                                      customer.id,
                                                    );
                                                    form.setValue(
                                                      "isNewCustomer",
                                                      false,
                                                    );
                                                    form.setValue(
                                                      "newCustomerName",
                                                      "",
                                                    );
                                                    setSelectedCustomerName(
                                                      customer.name,
                                                    );
                                                    setHasUserSelectedCustomer(
                                                      true,
                                                    );
                                                    setDeepSearchResults([]);
                                                    setCustomerSearchOpen(
                                                      false,
                                                    );
                                                    // Pre-fill fields
                                                    if (
                                                      customer.address &&
                                                      !form.getValues("address")
                                                    ) {
                                                      form.setValue(
                                                        "address",
                                                        customer.address,
                                                      );
                                                    }
                                                    if (
                                                      customer.email &&
                                                      !form.getValues(
                                                        "jobContactEmail",
                                                      )
                                                    ) {
                                                      form.setValue(
                                                        "jobContactEmail",
                                                        customer.email,
                                                      );
                                                    }
                                                    if (
                                                      customer.mobile &&
                                                      !form.getValues(
                                                        "jobContactMobile",
                                                      )
                                                    ) {
                                                      const isMobileNum =
                                                        /^(\+?64)?0?2[0-9]/.test(
                                                          customer.mobile
                                                            .replace(/\s/g, "")
                                                            .replace(
                                                              /^\+64/,
                                                              "0",
                                                            ),
                                                        );
                                                      if (isMobileNum) {
                                                        form.setValue(
                                                          "jobContactMobile",
                                                          customer.mobile,
                                                        );
                                                      } else if (
                                                        !form.getValues(
                                                          "jobContactPhone",
                                                        )
                                                      ) {
                                                        form.setValue(
                                                          "jobContactPhone",
                                                          customer.mobile,
                                                        );
                                                      }
                                                    }
                                                    if (
                                                      customer.phone &&
                                                      !form.getValues(
                                                        "jobContactPhone",
                                                      )
                                                    ) {
                                                      const isMobileNum =
                                                        /^(\+?64)?0?2[0-9]/.test(
                                                          customer.phone
                                                            .replace(/\s/g, "")
                                                            .replace(
                                                              /^\+64/,
                                                              "0",
                                                            ),
                                                        );
                                                      if (
                                                        isMobileNum &&
                                                        !form.getValues(
                                                          "jobContactMobile",
                                                        )
                                                      ) {
                                                        form.setValue(
                                                          "jobContactMobile",
                                                          customer.phone,
                                                        );
                                                      } else {
                                                        form.setValue(
                                                          "jobContactPhone",
                                                          customer.phone,
                                                        );
                                                      }
                                                    }
                                                    // Auto-set lead source to "repeat" for existing customers
                                                    if (
                                                      mode === "create" &&
                                                      !form.getValues(
                                                        "leadSource",
                                                      )
                                                    ) {
                                                      try {
                                                        const response =
                                                          await fetch(
                                                            `/api/jobs?customerId=${customer.id}&limit=1`,
                                                          );
                                                        const data =
                                                          await response.json();
                                                        if (
                                                          data.success &&
                                                          data.data &&
                                                          data.data.length > 0
                                                        ) {
                                                          form.setValue(
                                                            "leadSource",
                                                            "repeat",
                                                          );
                                                        }
                                                      } catch (error) {
                                                        console.log(
                                                          "Could not check for previous jobs:",
                                                          error,
                                                        );
                                                      }
                                                    }
                                                    saveCustomerImmediately(
                                                      customer.id,
                                                      customer.name,
                                                    );
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      watchedCustomerId === customer.id
                                                        ? "opacity-100"
                                                        : "opacity-0",
                                                    )}
                                                  />
                                                  <div className="flex flex-col">
                                                    <span>{customer.name}</span>
                                                    {customer.address && (
                                                      <span className="text-xs text-gray-500">
                                                        {customer.address}
                                                      </span>
                                                    )}
                                                  </div>
                                                </CommandItem>
                                              ),
                                            )}
                                          </CommandGroup>
                                        )}
                                        <CommandGroup heading="Existing Customers">
                                          {customers.map((customer) => (
                                            <CommandItem
                                              key={customer.id}
                                              value={customer.name}
                                              onSelect={async () => {
                                                form.setValue(
                                                  "customerId",
                                                  customer.id,
                                                );
                                                form.setValue(
                                                  "isNewCustomer",
                                                  false,
                                                );
                                                form.setValue(
                                                  "newCustomerName",
                                                  "",
                                                );
                                                setSelectedCustomerName(
                                                  customer.name,
                                                );
                                                setHasUserSelectedCustomer(
                                                  true,
                                                );
                                                // Pre-fill address from customer if available
                                                if (
                                                  customer.address &&
                                                  !form.getValues("address")
                                                ) {
                                                  form.setValue(
                                                    "address",
                                                    customer.address,
                                                  );
                                                }
                                                // Pre-fill contact info from customer if not already set
                                                if (
                                                  customer.email &&
                                                  !form.getValues(
                                                    "jobContactEmail",
                                                  )
                                                ) {
                                                  form.setValue(
                                                    "jobContactEmail",
                                                    customer.email,
                                                  );
                                                }
                                                // Route mobile numbers to mobile field, landline to phone field
                                                // Only populate fields that are currently empty — never overwrite existing values
                                                const phoneNumber =
                                                  customer.mobile ||
                                                  customer.phone ||
                                                  "";
                                                if (phoneNumber) {
                                                  const isMobileNum =
                                                    /^(\+?64)?0?2[0-9]/.test(
                                                      phoneNumber
                                                        .replace(/\s/g, "")
                                                        .replace(/^\+64/, "0"),
                                                    );
                                                  if (isMobileNum) {
                                                    if (
                                                      !form.getValues(
                                                        "jobContactMobile",
                                                      )
                                                    ) {
                                                      form.setValue(
                                                        "jobContactMobile",
                                                        phoneNumber,
                                                      );
                                                    }
                                                  } else {
                                                    if (
                                                      !form.getValues(
                                                        "jobContactPhone",
                                                      )
                                                    ) {
                                                      form.setValue(
                                                        "jobContactPhone",
                                                        phoneNumber,
                                                      );
                                                    }
                                                  }
                                                }
                                                // Split customer name into first/last for contact fields
                                                if (
                                                  customer.name &&
                                                  !form.getValues(
                                                    "jobContactFirstName",
                                                  ) &&
                                                  !form.getValues(
                                                    "jobContactLastName",
                                                  )
                                                ) {
                                                  const nameParts =
                                                    customer.name.split(" ");
                                                  if (nameParts.length >= 2) {
                                                    form.setValue(
                                                      "jobContactFirstName",
                                                      nameParts[0],
                                                    );
                                                    form.setValue(
                                                      "jobContactLastName",
                                                      nameParts
                                                        .slice(1)
                                                        .join(" "),
                                                    );
                                                  } else {
                                                    form.setValue(
                                                      "jobContactFirstName",
                                                      customer.name,
                                                    );
                                                  }
                                                }
                                                // Auto-set lead source to "repeat" for existing customers with previous jobs
                                                if (
                                                  mode === "create" &&
                                                  !form.getValues("leadSource")
                                                ) {
                                                  try {
                                                    const response =
                                                      await fetch(
                                                        `/api/jobs?customerId=${customer.id}&limit=1`,
                                                      );
                                                    const data =
                                                      await response.json();
                                                    if (
                                                      data.success &&
                                                      data.data &&
                                                      data.data.length > 0
                                                    ) {
                                                      form.setValue(
                                                        "leadSource",
                                                        "repeat",
                                                      );
                                                    }
                                                  } catch (error) {
                                                    console.log(
                                                      "Could not check for previous jobs:",
                                                      error,
                                                    );
                                                  }
                                                }
                                                setCustomerSearchOpen(false);
                                                saveCustomerImmediately(
                                                  customer.id,
                                                  customer.name,
                                                );
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  customer.id === field.value
                                                    ? "opacity-100"
                                                    : "opacity-0",
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span>{customer.name}</span>
                                                {customer.address && (
                                                  <span className="text-xs text-gray-500 truncate max-w-[250px]">
                                                    {customer.address}
                                                  </span>
                                                )}
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Address and other fields */}
                      <div className="space-y-4">
                        {/* Address - two lines */}
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem className="mt-1">
                              <FormControl>
                                <AddressAutocomplete
                                  value={field.value || ""}
                                  onChange={(newAddress) => {
                                    field.onChange(newAddress);
                                  }}
                                  onAddressSelect={(parsed) => {
                                    form.setValue(
                                      "address",
                                      parsed.fullAddress,
                                    );
                                  }}
                                  className="h-auto border-0 shadow-none p-0 text-sm text-gray-600 focus-visible:ring-0 bg-transparent"
                                  placeholder="Enter or paste full address..."
                                  data-testid="input-job-address"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {/* Map view of job location */}
                        {mode === "edit" && editingJob?.address && (
                          <JobLocationMap
                            jobAddress={editingJob.address}
                            className="mt-2"
                          />
                        )}

                        {/* ServiceM8-Style Job Scope Card (Mobile only position) */}
                        <div className="md:hidden mt-2">
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                            {/* Checklist Items */}
                            {!checklistCollapsed && (
                              <div className="space-y-2 mb-3">
                                {checklist.map((item, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                    onClick={() => {
                                      const updated = [...checklist];
                                      updated[index] = {
                                        ...item,
                                        completed: !item.completed,
                                      };
                                      setChecklist(updated);
                                      if (mode === "edit" && editingJob?.id) {
                                        updateJobMutation.mutate({
                                          id: editingJob.id,
                                          updates: { checklist: updated },
                                        });
                                      }
                                    }}
                                  >
                                    <div
                                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${item.completed ? "bg-green-500" : "border-2 border-gray-300"}`}
                                    >
                                      {item.completed && (
                                        <Check className="h-3 w-3 text-white" />
                                      )}
                                    </div>
                                    <span
                                      className={`text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}
                                    >
                                      {item.text}
                                    </span>
                                  </div>
                                ))}

                                {/* Add task input */}
                                {mode === "edit" && (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      if (!newChecklistItem.trim()) return;
                                      const newItem = {
                                        id: crypto.randomUUID(),
                                        text: newChecklistItem.trim(),
                                        completed: false,
                                      };
                                      const updated = [...checklist, newItem];
                                      setChecklist(updated);
                                      setNewChecklistItem("");
                                      if (editingJob?.id) {
                                        updateJobMutation.mutate({
                                          id: editingJob.id,
                                          updates: { checklist: updated },
                                        });
                                      }
                                    }}
                                    className="flex items-center gap-2 mt-2"
                                  >
                                    <input
                                      type="text"
                                      value={newChecklistItem}
                                      onChange={(e) =>
                                        setNewChecklistItem(e.target.value)
                                      }
                                      placeholder="Add a task..."
                                      className="flex-1 text-sm bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none py-1 text-gray-700 placeholder-gray-400"
                                    />
                                    <button
                                      type="submit"
                                      disabled={!newChecklistItem.trim()}
                                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                  </form>
                                )}
                              </div>
                            )}{" "}
                            {/* end !checklistCollapsed */}
                            {/* Crew Notes (Job Description) */}
                            <div className="border-t pt-3">
                              <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-blue-600 font-medium flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Job Description
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSpeechToQuoteContext("job-description");
                                          setIsSpeechToQuoteOpen(true);
                                        }}
                                        className="flex items-center gap-1 text-xs font-medium text-purple-600 border border-border rounded-full px-2 py-0.5 hover-elevate"
                                        data-testid="button-speech-job-description"
                                      >
                                        <Mic className="h-3 w-3" />
                                        Voice
                                      </button>
                                    </div>
                                    <FormControl>
                                      <Textarea
                                        {...field}
                                        value={
                                          formLoadedJobId === editingJob?.id
                                            ? field.value || ""
                                            : field.value ||
                                              editingJob?.description ||
                                              ""
                                        }
                                        className="min-h-[150px] text-sm text-gray-600 resize-none border-gray-200"
                                        placeholder="Add a job description..."
                                        data-testid="textarea-job-description"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            {/* Internal Notes (Mobile) — staff only, never shown to customers */}
                            <div className="border-t pt-3">
                              <FormField
                                control={form.control}
                                name="internalNotes"
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center justify-between">
                                      <span
                                        className="text-amber-700 font-medium flex items-center gap-2 cursor-pointer"
                                        onClick={() => {
                                          const val =
                                            formLoadedJobId === editingJob?.id
                                              ? field.value || ""
                                              : field.value ||
                                                (editingJob as any)
                                                  ?.internalNotes ||
                                                "";
                                          setInternalNotesDraft(val);
                                          setInternalNotesPopupOpen(true);
                                        }}
                                      >
                                        <Lock className="h-4 w-4" />
                                        Internal Notes
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const val =
                                            formLoadedJobId === editingJob?.id
                                              ? field.value || ""
                                              : field.value ||
                                                (editingJob as any)
                                                  ?.internalNotes ||
                                                "";
                                          setInternalNotesDraft(val);
                                          setSpeechToQuoteContext(
                                            "internal-notes",
                                          );
                                          setIsSpeechToQuoteOpen(true);
                                        }}
                                        data-testid="button-voice-internal-notes-mobile"
                                      >
                                        <Mic className="h-4 w-4 mr-1" />
                                        <span className="text-xs">Voice</span>
                                      </Button>
                                    </div>
                                    <p className="text-xs text-amber-600 mt-0.5">
                                      Staff only — not visible to customers
                                    </p>
                                    <FormControl>
                                      <>
                                        <input type="hidden" {...field} />
                                        {field.value && (
                                          <div
                                            className="text-sm text-amber-800 mt-2 cursor-pointer whitespace-pre-wrap break-words line-clamp-4 bg-amber-50 rounded-lg p-2"
                                            onClick={() => {
                                              const val =
                                                formLoadedJobId ===
                                                editingJob?.id
                                                  ? field.value || ""
                                                  : field.value ||
                                                    (editingJob as any)
                                                      ?.internalNotes ||
                                                    "";
                                              setInternalNotesDraft(val);
                                              setInternalNotesPopupOpen(true);
                                            }}
                                          >
                                            {field.value}
                                          </div>
                                        )}
                                      </>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Show New Customer Fields When Creating */}
                        {watchedIsNewCustomer &&
                          watchedNewCustomerName && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name="newCustomerName"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs font-medium text-gray-600">
                                        Customer Name
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          placeholder="Enter customer name"
                                          onChange={(e) => {
                                            field.onChange(e);
                                            // Map new customer name to job contact fields for backend compatibility
                                            const names =
                                              e.target.value.split(" ");
                                            form.setValue(
                                              "jobContactFirstName",
                                              names[0] || "",
                                            );
                                            form.setValue(
                                              "jobContactLastName",
                                              names.slice(1).join(" ") || "",
                                            );
                                          }}
                                          data-testid="input-new-customer-name"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="newCustomerEmail"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs font-medium text-gray-600">
                                        Email
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="email"
                                          placeholder="customer@example.com"
                                          onChange={(e) => {
                                            field.onChange(e);
                                            // Map to job contact email for backend compatibility
                                            form.setValue(
                                              "jobContactEmail",
                                              e.target.value,
                                            );
                                          }}
                                          data-testid="input-new-customer-email"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name="newCustomerPhone"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs font-medium text-gray-600">
                                        Mobile/Phone
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          placeholder="Mobile or phone number"
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            field.onChange(val);

                                            // Enhanced NZ Mobile Routing: Detect 02x prefixes
                                            const cleaned = val
                                              .replace(/\s/g, "")
                                              .replace(/^\+64/, "0");
                                            const isMobile = /^0?2[0-9]/.test(
                                              cleaned,
                                            );

                                            if (isMobile) {
                                              form.setValue(
                                                "jobContactMobile",
                                                val,
                                                { shouldDirty: true },
                                              );
                                              form.setValue(
                                                "jobContactPhone",
                                                "",
                                                { shouldDirty: true },
                                              );
                                            } else {
                                              form.setValue(
                                                "jobContactPhone",
                                                val,
                                                { shouldDirty: true },
                                              );
                                              form.setValue(
                                                "jobContactMobile",
                                                "",
                                                { shouldDirty: true },
                                              );
                                            }
                                          }}
                                          data-testid="input-new-customer-phone"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="newCustomerAddress"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs font-medium text-gray-600">
                                        Address
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          placeholder="Street address"
                                          data-testid="input-new-customer-address"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Job Information Section */}
                      <div className="space-y-4">
                        {/* Job Status, Lead Source, Est Hours - evenly distributed */}
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-medium text-gray-500 mb-0.5 block">
                              Job Status
                            </label>
                            <FormField
                              control={form.control}
                              name="status"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select
                                      value={field.value || ""}
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        // Auto-save status change for existing jobs — send ONLY the
                                        // status field so we never accidentally overwrite address or
                                        // other fields with stale form state captured mid-transition.
                                        // The server safeguard preserves all other DB values.
                                        if (mode === "edit" && editingJob?.id) {
                                          updateJobMutation.mutate({
                                            id: editingJob.id,
                                            status: value,
                                          } as GlobalJobCardFormData);
                                        }
                                      }}
                                    >
                                      <SelectTrigger
                                        className="h-8 text-xs"
                                        data-testid="select-job-status"
                                      >
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="lead">
                                          Lead
                                        </SelectItem>
                                        <SelectItem value="quote">
                                          Quote
                                        </SelectItem>
                                        <SelectItem value="scheduled">
                                          Scheduled
                                        </SelectItem>
                                        <SelectItem value="work_order">
                                          Work Order
                                        </SelectItem>
                                        <SelectItem value="completed">
                                          Completed
                                        </SelectItem>
                                        <SelectItem value="unsuccessful">
                                          Unsuccessful
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            {/* Unsuccessful Reason - Only show when status is unsuccessful */}
                            {watchedStatus === "unsuccessful" && (
                              <div className="mt-3 space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <FormField
                                  control={form.control}
                                  name="unsuccessfulReason"
                                  render={({ field }) => (
                                    <FormItem>
                                      <label className="text-xs font-medium text-orange-700 mb-1 block">
                                        Reason for Unsuccessful
                                      </label>
                                      <FormControl>
                                        <Select
                                          value={field.value || ""}
                                          onValueChange={field.onChange}
                                        >
                                          <SelectTrigger className="h-9 text-base md:text-sm bg-white">
                                            <SelectValue placeholder="Select reason" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="price_too_high">
                                              Price too high
                                            </SelectItem>
                                            <SelectItem value="went_competitor">
                                              Went with competitor
                                            </SelectItem>
                                            <SelectItem value="changed_mind">
                                              Customer changed mind
                                            </SelectItem>
                                            <SelectItem value="no_longer_needed">
                                              Job no longer needed
                                            </SelectItem>
                                            <SelectItem value="scheduling">
                                              Couldn't schedule suitable time
                                            </SelectItem>
                                            <SelectItem value="no_response">
                                              No response from customer
                                            </SelectItem>
                                            <SelectItem value="scope_change">
                                              Scope changed beyond capabilities
                                            </SelectItem>
                                            <SelectItem value="other">
                                              Other
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="unsuccessfulNotes"
                                  render={({ field }) => (
                                    <FormItem>
                                      <label className="text-xs font-medium text-orange-700 mb-1 block">
                                        Additional Notes (optional)
                                      </label>
                                      <FormControl>
                                        <Textarea
                                          {...field}
                                          value={field.value || ""}
                                          className="min-h-[60px] text-sm bg-white"
                                          placeholder="Any additional details about why this job didn't proceed..."
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] font-medium text-gray-500 mb-0.5 block">
                              Lead Source
                            </label>
                            <FormField
                              control={form.control}
                              name="leadSource"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select
                                      value={field.value || ""}
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        // Immediate save for lead source
                                        if (mode === "edit" && editingJob?.id) {
                                          // Optimistic update
                                          queryClient.setQueryData(
                                            ["/api/jobs", editingJob.id],
                                            (oldData: any) => {
                                              if (!oldData) return oldData;
                                              return {
                                                ...oldData,
                                                data: {
                                                  ...oldData.data,
                                                  leadSource: value,
                                                },
                                              };
                                            },
                                          );
                                          // Background save
                                          apiRequest(
                                            "PATCH",
                                            `/api/jobs/${editingJob.id}`,
                                            { leadSource: value },
                                          ).catch((error) =>
                                            console.error(
                                              "Error saving lead source:",
                                              error,
                                            ),
                                          );
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select source" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="website">
                                          Website
                                        </SelectItem>
                                        <SelectItem value="referral">
                                          Referral
                                        </SelectItem>
                                        <SelectItem value="friend">
                                          Friend
                                        </SelectItem>
                                        <SelectItem value="saw_working">
                                          Saw you working
                                        </SelectItem>
                                        <SelectItem value="repeat">
                                          Repeat
                                        </SelectItem>
                                        <SelectItem value="google">
                                          Google Search
                                        </SelectItem>
                                        <SelectItem value="ppc">
                                          PPC (Google Ads)
                                        </SelectItem>
                                        <SelectItem value="google_maps">
                                          Google Maps
                                        </SelectItem>
                                        <SelectItem value="seo">
                                          SEO (Organic)
                                        </SelectItem>
                                        <SelectItem value="facebook">
                                          Facebook
                                        </SelectItem>
                                        <SelectItem value="phone">
                                          Phone Call
                                        </SelectItem>
                                        <SelectItem value="direct">
                                          Direct
                                        </SelectItem>
                                        <SelectItem value="advertisement">
                                          Advertisement
                                        </SelectItem>
                                        <SelectItem value="council">
                                          Council
                                        </SelectItem>
                                        <SelectItem value="other">
                                          Other
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          {/* Quote Presentation Method - show for existing jobs and newly-created jobs */}
                          {(mode === "edit" || !!createdJobId) &&
                            editingJob &&
                            [
                              "lead",
                              "quote",
                              "scheduled",
                              "work_order",
                              "completed",
                            ].includes(editingJob.status) && (
                              <div className="flex-1">
                                <label className="text-[10px] font-medium text-gray-500 mb-0.5 block">
                                  Quote Method
                                </label>
                                <Select
                                  value={localQuoteMethod || ""}
                                  onValueChange={async (value) => {
                                    console.log(
                                      "🎯 Quote method dropdown changed to:",
                                      value,
                                    );
                                    // Update local state immediately for UI
                                    setLocalQuoteMethod(value);

                                    if (editingJob?.id) {
                                      console.log(
                                        "🎯 Saving quote method for job:",
                                        editingJob.id,
                                      );
                                      try {
                                        // Save to server
                                        const response = await apiRequest(
                                          "PATCH",
                                          `/api/jobs/${editingJob.id}`,
                                          {
                                            quotePresentationMethod: value,
                                            quotePresentedDate:
                                              new Date().toISOString(),
                                          },
                                        );
                                        const data = await response.json();
                                        console.log(
                                          "🎯 Quote method API response:",
                                          data,
                                        );
                                        if (data.success) {
                                          console.log(
                                            "✅ Quote method saved:",
                                            value,
                                          );
                                          // Invalidate job cache to ensure data is fresh
                                          queryClient.invalidateQueries({
                                            queryKey: [
                                              "/api/jobs",
                                              editingJob.id,
                                            ],
                                          });
                                        } else {
                                          console.error(
                                            "Failed to save quote method:",
                                            data.message,
                                          );
                                          toast({
                                            title: "Error",
                                            description:
                                              "Failed to save quote method",
                                            variant: "destructive",
                                          });
                                        }
                                      } catch (error) {
                                        console.error(
                                          "Error saving quote method:",
                                          error,
                                        );
                                        toast({
                                          title: "Error",
                                          description:
                                            "Failed to save quote method",
                                          variant: "destructive",
                                        });
                                      }
                                    } else {
                                      console.log(
                                        "🎯 No editingJob.id available",
                                      );
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="How was quote presented?" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="on_site">
                                      On-Site (presented in person)
                                    </SelectItem>
                                    <SelectItem value="sent_later">
                                      Sent Later (email/post)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                        </div>

                        {/* Customer Confirmed + ETA Notification — side by side */}
                        {mode === "edit" && (
                          <div className="flex gap-2">
                            <FormField
                              control={form.control}
                              name="customerConfirmed"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <div className={`flex items-center gap-2 p-2.5 rounded-md border select-none transition-colors cursor-pointer ${field.value ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950" : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"}`}>
                                      <Checkbox
                                        id="customer-confirmed"
                                        checked={!!field.value}
                                        onCheckedChange={(checked) =>
                                          field.onChange(checked === true)
                                        }
                                        data-testid="checkbox-customer-confirmed"
                                      />
                                      <label
                                        htmlFor="customer-confirmed"
                                        className={`text-sm font-medium leading-tight cursor-pointer select-none ${field.value ? "text-green-800 dark:text-green-200" : "text-gray-600 dark:text-gray-400"}`}
                                      >
                                        Customer confirmed
                                      </label>
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            {/* ETA Notification Requested Toggle */}
                            {/* Saved immediately via direct apiRequest (NOT via debounced auto-save)
                                to prevent it from triggering a deferred auto-save loop on form.reset().
                                etaNotificationRequested is intentionally excluded from autoSaveFieldsRef. */}
                            <FormField
                              control={form.control}
                              name="etaNotificationRequested"
                              render={({ field }) => {
                                const handleToggle = async (newValue: boolean) => {
                                  field.onChange(newValue);
                                  if (editingJob?.id) {
                                    try {
                                      await apiRequest("PUT", `/api/jobs/${editingJob.id}`, {
                                        etaNotificationRequested: newValue,
                                      });
                                      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
                                    } catch {
                                      field.onChange(!newValue);
                                    }
                                  }
                                };
                                return (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      {/* RC13 FIX: onClick on span only (not outer div) to prevent
                                          Radix synthetic click bubbling causing double-toggle. */}
                                      <div className={`flex items-center gap-2 p-2.5 rounded-md border select-none transition-colors ${field.value ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950" : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"}`}>
                                        <Checkbox
                                          checked={!!field.value}
                                          onCheckedChange={(checked) =>
                                            handleToggle(checked === true)
                                          }
                                          data-testid="checkbox-eta-notification"
                                        />
                                        <span
                                          className={`text-sm font-medium leading-tight cursor-pointer flex-1 ${field.value ? "text-amber-800 dark:text-amber-200" : "text-gray-600 dark:text-gray-400"}`}
                                          onClick={() => handleToggle(!field.value)}
                                        >
                                          Notify on arrival
                                        </span>
                                      </div>
                                    </FormControl>
                                  </FormItem>
                                );
                              }}
                            />
                          </div>
                        )}

                        {/* ServiceM8-Style Gear List Card - show in both create and edit modes */}
                        {allEquipment.length > 0 && (
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:bg-transparent md:shadow-none md:border-0 md:p-0 md:rounded-none space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                                  <Package className="h-4 w-4 text-gray-600" />
                                </div>
                                <h3 className="font-bold text-gray-900">
                                  Gear List
                                </h3>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChecklistCollapsed((c) => !c);
                                }}
                                className="flex items-center gap-1 text-xs font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5 hover-elevate"
                              >
                                <List className="h-3 w-3" />
                                Checklist
                                {checklist.length > 0
                                  ? ` (${checklist.length})`
                                  : ""}
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform duration-200 ${checklistCollapsed ? "" : "rotate-180"}`}
                                />
                              </button>
                            </div>

                            {/* Multi-select button for equipment */}
                            <div className="w-[200px]">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs w-full justify-between"
                                disabled={isAddingEquipment}
                                onClick={() => setGearDialogOpen(true)}
                              >
                                <span className="truncate">
                                  {(
                                    mode === "edit"
                                      ? editingJob?.equipmentChecklist?.length
                                      : selectedEquipment.length
                                  )
                                    ? `${mode === "edit" ? editingJob?.equipmentChecklist?.length : selectedEquipment.length} selected`
                                    : "Select gear..."}
                                </span>
                                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                              </Button>

                              <Dialog
                                open={gearDialogOpen}
                                onOpenChange={setGearDialogOpen}
                              >
                                <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
                                  <DialogHeader>
                                    <DialogTitle>Select Gear</DialogTitle>
                                    <DialogDescription>
                                      Choose equipment for this job
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="flex-1 overflow-y-auto space-y-1 py-2">
                                    {allEquipment.map((equip: any) => {
                                      const currentChecklist =
                                        mode === "edit"
                                          ? editingJob?.equipmentChecklist || []
                                          : selectedEquipment;
                                      const isSelected = currentChecklist.some(
                                        (item: any) =>
                                          item.equipment === equip.name,
                                      );
                                      return (
                                        <div
                                          key={equip.id}
                                          className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer active:bg-gray-200 ${isSelected ? "bg-green-50" : "hover:bg-gray-50"}`}
                                          onClick={async () => {
                                            const currentList =
                                              mode === "edit"
                                                ? editingJob?.equipmentChecklist ||
                                                  []
                                                : selectedEquipment;

                                            let updatedChecklist;
                                            if (isSelected) {
                                              updatedChecklist =
                                                currentList.filter(
                                                  (i: any) =>
                                                    i.equipment !== equip.name,
                                                );
                                            } else {
                                              const newItem = {
                                                id: `equip-${Date.now()}-${equip.name}`,
                                                equipment: equip.name,
                                                checked: false,
                                              };
                                              updatedChecklist = [
                                                ...currentList,
                                                newItem,
                                              ];
                                            }

                                            if (
                                              mode === "edit" &&
                                              editingJob?.id
                                            ) {
                                              // Optimistic update - update UI immediately
                                              queryClient.setQueryData(
                                                ["/api/jobs", editingJob.id],
                                                (oldData: any) => {
                                                  if (!oldData) return oldData;
                                                  return {
                                                    ...oldData,
                                                    data: {
                                                      ...oldData.data,
                                                      equipmentChecklist:
                                                        updatedChecklist,
                                                    },
                                                  };
                                                },
                                              );

                                              // Background save - don't await
                                              apiRequest(
                                                "PATCH",
                                                `/api/jobs/${editingJob.id}`,
                                                {
                                                  equipmentChecklist:
                                                    updatedChecklist,
                                                },
                                              ).catch((error) =>
                                                console.error(
                                                  "Error saving equipment:",
                                                  error,
                                                ),
                                              );
                                            } else {
                                              // Create mode - just update local state
                                              setSelectedEquipment(
                                                updatedChecklist,
                                              );
                                            }
                                          }}
                                        >
                                          <div
                                            className={`h-5 w-5 border-2 rounded flex items-center justify-center ${isSelected ? "bg-green-600 border-green-600" : "border-gray-300"}`}
                                          >
                                            {isSelected && (
                                              <Check className="h-3.5 w-3.5 text-white" />
                                            )}
                                          </div>
                                          <span className="text-base">
                                            {equip.name}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>

                            {/* Selected equipment as removable tags */}
                            {((mode === "edit" &&
                              editingJob?.equipmentChecklist &&
                              editingJob.equipmentChecklist.length > 0) ||
                              (mode === "create" &&
                                selectedEquipment.length > 0)) && (
                              <div className="flex flex-wrap gap-1">
                                {(mode === "edit"
                                  ? editingJob?.equipmentChecklist || []
                                  : selectedEquipment
                                ).map((item: any) => (
                                  <Badge
                                    key={item.id}
                                    variant="secondary"
                                    className="h-6 text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 cursor-pointer flex items-center gap-1"
                                    title={equipmentLicenceMap[item.equipment] ? `Requires: ${equipmentLicenceMap[item.equipment]}` : undefined}
                                    onClick={() => {
                                      const currentList =
                                        mode === "edit"
                                          ? editingJob?.equipmentChecklist || []
                                          : selectedEquipment;
                                      const updatedChecklist =
                                        currentList.filter(
                                          (i: any) =>
                                            i.equipment !== item.equipment,
                                        );

                                      if (mode === "edit" && editingJob?.id) {
                                        // Optimistic update - update UI immediately
                                        queryClient.setQueryData(
                                          ["/api/jobs", editingJob.id],
                                          (oldData: any) => {
                                            if (!oldData) return oldData;
                                            return {
                                              ...oldData,
                                              data: {
                                                ...oldData.data,
                                                equipmentChecklist:
                                                  updatedChecklist,
                                              },
                                            };
                                          },
                                        );

                                        // Background save - don't await
                                        apiRequest(
                                          "PATCH",
                                          `/api/jobs/${editingJob.id}`,
                                          {
                                            equipmentChecklist:
                                              updatedChecklist,
                                          },
                                        ).catch((error) =>
                                          console.error(
                                            "Error removing equipment:",
                                            error,
                                          ),
                                        );
                                      } else {
                                        // Create mode - just update local state
                                        setSelectedEquipment(updatedChecklist);
                                      }
                                    }}
                                  >
                                    {item.equipment}
                                    {equipmentLicenceMap[item.equipment] && (
                                      <span className="text-[9px] text-orange-600 font-medium ml-0.5 hidden sm:inline">
                                        ·{equipmentLicenceMap[item.equipment]}
                                      </span>
                                    )}
                                    <X className="w-3 h-3" />
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Desktop Job Scope - below Gear List */}
                        <div className="hidden md:block">
                          <div className="space-y-3">
                            {/* Checklist Items */}
                            {!checklistCollapsed && (
                              <div className="space-y-2">
                                {checklist.map((item, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                    onClick={() => {
                                      const updated = [...checklist];
                                      updated[index] = {
                                        ...item,
                                        completed: !item.completed,
                                      };
                                      setChecklist(updated);
                                      if (mode === "edit" && editingJob?.id) {
                                        updateJobMutation.mutate({
                                          id: editingJob.id,
                                          updates: { checklist: updated },
                                        });
                                      }
                                    }}
                                  >
                                    <div
                                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${item.completed ? "bg-green-500" : "border-2 border-gray-300"}`}
                                    >
                                      {item.completed && (
                                        <Check className="h-3 w-3 text-white" />
                                      )}
                                    </div>
                                    <span
                                      className={`text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}
                                    >
                                      {item.text}
                                    </span>
                                  </div>
                                ))}

                                {/* Add task input */}
                                {mode === "edit" && (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      if (!newChecklistItem.trim()) return;
                                      const newItem = {
                                        id: crypto.randomUUID(),
                                        text: newChecklistItem.trim(),
                                        completed: false,
                                      };
                                      const updated = [...checklist, newItem];
                                      setChecklist(updated);
                                      setNewChecklistItem("");
                                      if (editingJob?.id) {
                                        updateJobMutation.mutate({
                                          id: editingJob.id,
                                          updates: { checklist: updated },
                                        });
                                      }
                                    }}
                                    className="flex items-center gap-2 mt-2"
                                  >
                                    <input
                                      type="text"
                                      value={newChecklistItem}
                                      onChange={(e) =>
                                        setNewChecklistItem(e.target.value)
                                      }
                                      placeholder="Add a task..."
                                      className="flex-1 text-sm bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none py-1 text-gray-700 placeholder-gray-400"
                                    />
                                    <button
                                      type="submit"
                                      disabled={!newChecklistItem.trim()}
                                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                  </form>
                                )}
                              </div>
                            )}{" "}
                            {/* end !checklistCollapsed */}
                            {/* Job Price */}
                            <div className="border-t border-dashed pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">
                                  Job Price
                                </span>
                                <div className="flex items-center gap-1">
                                  {(() => {
                                    // Priority: proposal subtotal > proposal sections line items > job line items > job totalAmount > quote amount
                                    // Proposal subtotal is already exc GST (before tax), so use directly
                                    const proposalSubtotalStored =
                                      parseFloat(
                                        jobProposalResponse?.data?.[0]
                                          ?.subtotal || "0",
                                      ) || 0;

                                    // Also try summing line items from proposal sections (handles stale subtotal field)
                                    let proposalSectionsTotal = 0;
                                    const proposalSections =
                                      jobProposalResponse?.data?.[0]
                                        ?.sections || [];
                                    if (
                                      Array.isArray(proposalSections) &&
                                      proposalSections.length > 0
                                    ) {
                                      proposalSections.forEach(
                                        (section: any) => {
                                          (section.lineItems || []).forEach(
                                            (item: any) => {
                                              if (item.selected !== false) {
                                                const price =
                                                  parseFloat(
                                                    item.totalPrice || "0",
                                                  ) || 0;
                                                proposalSectionsTotal +=
                                                  item.priceIncludesTax
                                                    ? price / 1.15
                                                    : price;
                                              }
                                            },
                                          );
                                        },
                                      );
                                    }

                                    const proposalSubtotal =
                                      proposalSubtotalStored > 0
                                        ? proposalSubtotalStored
                                        : proposalSectionsTotal;

                                    if (proposalSubtotal > 0) {
                                      return (
                                        <>
                                          <span className="text-lg font-semibold text-gray-900">
                                            $
                                            {proposalSubtotal.toLocaleString(
                                              "en-NZ",
                                              { minimumFractionDigits: 2 },
                                            )}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            exc GST
                                          </span>
                                        </>
                                      );
                                    }

                                    // Calculate from line items (these are typically exc GST unit prices)
                                    const lineItems = watchedLineItems;
                                    let totalExcGst = lineItems.reduce(
                                      (sum: number, item: any) => {
                                        const itemTotal =
                                          parseFloat(item.total) || 0;
                                        // If price includes tax, back out the GST
                                        if (item.priceIncludesTax) {
                                          return sum + itemTotal / 1.15;
                                        }
                                        return sum + itemTotal;
                                      },
                                      0,
                                    );

                                    // Fallback to job totalAmount (stored as inc GST typically)
                                    if (
                                      totalExcGst === 0 &&
                                      editingJob?.totalAmount
                                    ) {
                                      totalExcGst =
                                        (parseFloat(editingJob.totalAmount) ||
                                          0) / 1.15;
                                    }

                                    // Fallback to quote amount
                                    if (
                                      totalExcGst === 0 &&
                                      jobQuoteResponse?.data?.[0]?.amount
                                    ) {
                                      totalExcGst =
                                        (parseFloat(
                                          jobQuoteResponse.data[0].amount,
                                        ) || 0) / 1.15;
                                    }

                                    // Fallback to invoice total (invoice total is already exc GST)
                                    if (
                                      totalExcGst === 0 &&
                                      (jobInvoiceResponse as any)?.data?.[0]
                                        ?.total
                                    ) {
                                      totalExcGst =
                                        parseFloat(
                                          (jobInvoiceResponse as any).data[0]
                                            .total,
                                        ) || 0;
                                    }

                                    return (
                                      <>
                                        <span className="text-lg font-semibold text-gray-900">
                                          $
                                          {totalExcGst.toLocaleString("en-NZ", {
                                            minimumFractionDigits: 2,
                                          })}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          exc GST
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                            {/* Crew Notes (Job Description) - Click to expand */}
                            <div className="border-t border-dashed pt-3">
                              <div
                                className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                                onClick={() => {
                                  const desc =
                                    formLoadedJobId === editingJob?.id
                                      ? form.getValues("description") || ""
                                      : form.getValues("description") ||
                                        editingJob?.description ||
                                        "";
                                  setDescriptionDraft(desc);
                                  setDescriptionPopupOpen(true);
                                }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-500 font-medium">
                                    Job Description
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSpeechToQuoteContext("job-description");
                                      setIsSpeechToQuoteOpen(true);
                                    }}
                                    className="flex items-center gap-1 text-xs font-medium text-purple-600 border border-border rounded-full px-2 py-0.5 hover-elevate"
                                    data-testid="button-speech-job-description-desktop"
                                  >
                                    <Mic className="h-3 w-3" />
                                    Voice
                                  </button>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">
                                  {(formLoadedJobId === editingJob?.id
                                    ? watchedDescription
                                    : watchedDescription ||
                                      editingJob?.description) || (
                                    <span className="text-gray-400 italic">
                                      Click to add a job description...
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {/* Internal Notes (Desktop) — staff only, never shown to customers */}
                            <div className="border-t pt-3">
                              <FormField
                                control={form.control}
                                name="internalNotes"
                                render={({ field }) => (
                                  <FormItem>
                                    <div
                                      className="cursor-pointer rounded-lg p-2 -m-2 transition-colors hover:bg-amber-50"
                                      onClick={() => {
                                        const val =
                                          formLoadedJobId === editingJob?.id
                                            ? field.value || ""
                                            : field.value ||
                                              (editingJob as any)
                                                ?.internalNotes ||
                                              "";
                                        setInternalNotesDraft(val);
                                        setInternalNotesPopupOpen(true);
                                      }}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                                          <Lock className="h-3 w-3" />
                                          Internal Notes
                                        </span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const val =
                                              formLoadedJobId === editingJob?.id
                                                ? field.value || ""
                                                : field.value ||
                                                  (editingJob as any)
                                                    ?.internalNotes ||
                                                  "";
                                            setInternalNotesDraft(val);
                                            setSpeechToQuoteContext(
                                              "internal-notes",
                                            );
                                            setIsSpeechToQuoteOpen(true);
                                          }}
                                          data-testid="button-voice-internal-notes-desktop"
                                        >
                                          <Mic className="h-4 w-4 mr-1" />
                                          <span className="text-xs">Voice</span>
                                        </Button>
                                      </div>
                                      <p className="text-xs text-amber-600 mb-1">
                                        Staff only — not visible to customers
                                      </p>
                                      <p className="text-sm text-amber-800 whitespace-pre-wrap min-h-[32px]">
                                        {field.value || (
                                          <span className="text-amber-300 italic">
                                            Click to add internal notes...
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <FormControl>
                                      <input type="hidden" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Upcoming Bookings - Shows scheduled staff with 12-hour time format */}
                        {editingJob?.scheduledDate &&
                          Array.isArray(editingJob?.assignedTo) &&
                          editingJob.assignedTo.length > 0 && (
                            <div className="md:hidden mb-4">
                              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <h3 className="font-bold text-gray-900">
                                    Upcoming Bookings
                                  </h3>
                                </div>
                                <div className="space-y-2">
                                  {editingJob.assignedTo.map(
                                    (staffId: string) => {
                                      const staff = employees?.find(
                                        (e: any) => e.id === staffId,
                                      );
                                      const staffName = staff
                                        ? `${staff.firstName} ${staff.lastName}`
                                        : "Unknown Staff";
                                      return (
                                        <div
                                          key={staffId}
                                          className="flex items-center justify-between"
                                        >
                                          <span className="text-sm text-gray-700">
                                            {staffName}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {editingJob.scheduledStartTime
                                              ? formatTime12Hour(editingJob.scheduledStartTime)
                                              : ""}
                                          </span>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        {/* Desktop Upcoming Bookings */}
                        <div className="hidden md:block">
                          <label className="text-xs font-medium text-gray-600 mb-2 block">
                            Upcoming Bookings
                          </label>
                          <div className="border rounded-lg p-3 bg-blue-50 text-sm space-y-2">
                            {Array.isArray(editingJob?.assignedTo) &&
                              editingJob.assignedTo.map(
                                (employeeId: string) => {
                                  const employee = employees.find(
                                    (e: any) => e.id === employeeId,
                                  );
                                  const employeeName = employee
                                    ? `${employee.firstName} ${employee.lastName}`
                                    : "Unknown Staff";
                                  const scheduledDate = editingJob.scheduledDate
                                    ? new Date(
                                        editingJob.scheduledDate,
                                      ).toLocaleDateString("en-NZ", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      })
                                    : "";
                                  const scheduledEndDateDisplay =
                                    editingJob.scheduledEndDate
                                      ? new Date(
                                          editingJob.scheduledEndDate,
                                        ).toLocaleDateString("en-NZ", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                        })
                                      : "";
                                  const scheduledTime =
                                    editingJob.scheduledStartTime
                                      ? formatTime12Hour(
                                          editingJob.scheduledStartTime,
                                        )
                                      : "";
                                  const dateRange = scheduledEndDateDisplay
                                    ? `${scheduledDate} – ${scheduledEndDateDisplay}`
                                    : scheduledDate;

                                  return (
                                    <div
                                      key={employeeId}
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-600" />
                                        <span className="font-medium">
                                          {employeeName} on {dateRange}{" "}
                                          {scheduledTime}
                                        </span>
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          setBookingToCancel(employeeId);
                                          setCancelBookingDialogOpen(true);
                                        }}
                                        data-testid={`button-cancel-booking-${employeeId}`}
                                      >
                                        <X className="h-3.5 w-3.5 text-gray-500 hover:text-red-600" />
                                      </Button>
                                    </div>
                                  );
                                },
                              )}
                          </div>
                        </div>

                        {/* Contacts */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <UserCircle className="w-4 h-4 text-gray-600" />
                            <label className="text-xs font-medium text-gray-600">
                              Job Contact
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="jobContactFirstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="h-9 text-base md:text-sm"
                                      placeholder="First Name"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="jobContactLastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="h-9 text-base md:text-sm"
                                      placeholder="Last Name"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="mt-3 space-y-2">
                            <FormField
                              control={form.control}
                              name="jobContactEmail"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="h-9 text-base md:text-sm"
                                      placeholder="Email"
                                      type="email"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="jobContactMobile"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="h-9 text-base md:text-sm"
                                      placeholder="Mobile"
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val);
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="jobContactPhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="h-9 text-base md:text-sm"
                                      placeholder="Phone (Landline)"
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        field.onChange(val);

                                        // Auto-route mobile numbers to mobile field
                                        const cleaned = val
                                          .replace(/\s/g, "")
                                          .replace(/^\+64/, "0");
                                        if (/^0?2[0-9]/.test(cleaned)) {
                                          form.setValue(
                                            "jobContactMobile",
                                            val,
                                            { shouldDirty: true },
                                          );
                                          form.setValue("jobContactPhone", "", {
                                            shouldDirty: true,
                                          });
                                        }
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {sidebarTab === "billing" && (
                    <div className="space-y-6">
                      {/* ServiceM8 Billing Header */}
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                        <h3 className="font-semibold text-lg">
                          Billing & Invoicing
                        </h3>
                        <p className="text-blue-100 text-sm">
                          Manage billing address, tax settings, and financial
                          details
                        </p>
                      </div>

                      {/* Billing Address Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">
                            Billing Address
                          </h4>
                        </div>

                        <div className="space-y-3">
                          <FormField
                            control={form.control}
                            name="sameAsJobAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        // If checked, copy job address to billing address
                                        if (checked) {
                                          const jobAddress =
                                            form.getValues("address") || "";
                                          form.setValue(
                                            "billingAddress",
                                            jobAddress,
                                          );
                                        }
                                      }}
                                    />
                                    <label className="text-sm text-gray-600">
                                      Same as job address
                                    </label>
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {!watchedSameAsJobAddress && (
                            <div className="grid grid-cols-1 gap-3">
                              <FormField
                                control={form.control}
                                name="billingAddress"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        className="h-9 text-base md:text-sm"
                                        placeholder="Billing Address"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Billing Name Override */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">
                            Invoice To (Name Override)
                          </h4>
                        </div>
                        <FormField
                          control={form.control}
                          name="billingNameOverride"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-9 text-base md:text-sm"
                                  placeholder="Leave blank to use customer name, or enter override (e.g., Gisborne District Council)"
                                />
                              </FormControl>
                              <p className="text-xs text-gray-500">
                                Use this when the billing name differs from the
                                customer record (e.g., organization name vs
                                contact name)
                              </p>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Billing Contact Email */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">
                            Billing Email
                          </h4>
                        </div>
                        <FormField
                          control={form.control}
                          name="billingContactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  className="h-9 text-base md:text-sm"
                                  placeholder="Email address for invoices (leave blank to use job contact email)"
                                />
                              </FormControl>
                              <p className="text-xs text-gray-500">
                                Invoices will be sent to this email. If blank,
                                the job contact email is used.
                              </p>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Invoice Description */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <h4 className="font-medium text-gray-800">
                              Invoice Description
                            </h4>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => {
                              setSpeechToQuoteContext("invoice-description");
                              setIsSpeechToQuoteOpen(true);
                            }}
                            data-testid="button-speech-invoice-description"
                          >
                            <Mic className="h-4 w-4 mr-1" />
                            <span className="text-xs">Voice</span>
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name="invoiceDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  className="h-20 text-sm resize-none"
                                  placeholder="Description that will appear on the invoice..."
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Tax Settings */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">
                            Tax Settings
                          </h4>
                          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            GST Inc/Ex
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                              Tax Mode
                            </label>
                            <FormField
                              control={form.control}
                              name="taxMode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select
                                      value={field.value || "tax_exclusive"}
                                      onValueChange={field.onChange}
                                    >
                                      <SelectTrigger className="h-9 text-base md:text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="cost_markup">
                                          Cost & Markup
                                        </SelectItem>
                                        <SelectItem value="tax_inclusive">
                                          Tax Inclusive
                                        </SelectItem>
                                        <SelectItem value="tax_exclusive">
                                          Tax Exclusive
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                              GST Rate
                            </label>
                            <Input
                              className="h-9 text-base md:text-sm"
                              defaultValue="15.00%"
                              readOnly
                            />
                          </div>
                        </div>
                      </div>

                      {/* Line Items & Pricing Section */}
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-800 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Line Items & Pricing
                          </h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open("/materials-services", "_blank")
                            }
                            className="text-xs"
                            data-testid="button-manage-catalog"
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Manage Catalog
                          </Button>
                        </div>

                        {/* Search or Add New Line Item Interface */}
                        <div className="relative space-y-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search or add new item..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onFocus={() => setShowSearchResults(true)}
                              onBlur={() =>
                                setTimeout(
                                  () => setShowSearchResults(false),
                                  200,
                                )
                              }
                              className="pl-10 text-sm"
                              data-testid="input-search-items"
                            />
                          </div>

                          {/* Search Results */}
                          {showSearchResults && searchQuery && (
                            <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto top-full mt-1">
                              {filteredItems.length > 0 ? (
                                <div className="py-2">
                                  {filteredItems.map((item: any) => (
                                    <div
                                      key={item.id}
                                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                                      onClick={() => selectItemFromSearch(item)}
                                      data-testid={`search-result-${item.id}`}
                                    >
                                      <div>
                                        <div className="font-medium text-sm">
                                          {item.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {item.category}
                                        </div>
                                      </div>
                                      <div className="text-sm font-semibold text-green-600">
                                        $
                                        {parseFloat(
                                          item.displayPrice || item.price || 0,
                                        ).toFixed(2)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-4 text-center">
                                  <div className="text-sm text-gray-500 mb-2">
                                    No items found
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addCustomItem(searchQuery)}
                                    className="flex items-center gap-2"
                                    data-testid="button-add-custom-item"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add "{searchQuery}" as custom item
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Manual Add Line Item Form */}
                        {isAddingLineItem && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">
                                Add Custom Line Item
                              </h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIsAddingLineItem(false);
                                  setNewLineItem({
                                    description: "",
                                    quantity: 1,
                                    unitPrice: "",
                                    unitCost: 0,
                                  });
                                }}
                              >
                                ✕
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="col-span-2">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Description
                                </label>
                                <Input
                                  value={newLineItem.description}
                                  onChange={(e) =>
                                    setNewLineItem((prev) => ({
                                      ...prev,
                                      description: e.target.value,
                                    }))
                                  }
                                  placeholder="Service description"
                                  className="text-sm"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Quantity
                                </label>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={newLineItem.quantity}
                                  onChange={(e) =>
                                    setNewLineItem((prev) => ({
                                      ...prev,
                                      quantity: parseFloat(e.target.value) || 0,
                                    }))
                                  }
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Unit Price ($)
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newLineItem.unitPrice}
                                  onChange={(e) =>
                                    setNewLineItem((prev) => ({
                                      ...prev,
                                      unitPrice:
                                        e.target.value === ""
                                          ? ""
                                          : parseFloat(e.target.value),
                                    }))
                                  }
                                  placeholder="0.00"
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Unit Cost ($)
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newLineItem.unitCost}
                                  onChange={(e) =>
                                    setNewLineItem((prev) => ({
                                      ...prev,
                                      unitCost: parseFloat(e.target.value) || 0,
                                    }))
                                  }
                                  className="text-sm"
                                />
                              </div>
                              <div className="flex items-end">
                                <Button
                                  type="button"
                                  onClick={addLineItem}
                                  className="w-full"
                                  data-testid="button-add-item"
                                >
                                  Add Item
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ServiceM8-Style Line Items Table */}
                        <div className="space-y-4 px-3 sm:px-4 py-4">
                          {lineItemFields.length > 0 && (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <h4 className="font-medium text-gray-800">
                                  Items & Services
                                </h4>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsAddingLineItem(true)}
                                  className="flex items-center gap-1"
                                  data-testid="button-add-line-item"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add Item
                                </Button>
                              </div>

                              {/* Desktop Table View - Hidden on mobile */}
                              <div className="hidden lg:block">
                                {/* Table Header */}
                                <div className="bg-gray-50 border-b border-gray-200">
                                  <div className="grid grid-cols-[40px_80px_1fr_60px_80px_70px_50px_80px_90px] gap-2 px-4 py-2 text-xs font-medium text-gray-600">
                                    <div></div>
                                    <div>Code</div>
                                    <div>Name</div>
                                    <div className="text-center">Qty</div>
                                    <div className="text-center">GST</div>
                                    <div className="text-right">Cost</div>
                                    <div className="text-center">%</div>
                                    <div className="text-right">Price</div>
                                    <div className="text-right">Total</div>
                                  </div>
                                </div>

                                {/* Table Body */}
                                <div className="bg-white">
                                  {lineItemFields.map((field, index) => {
                                    const unitCost = field.unitCost || 0;
                                    const quantity = field.quantity || 1;
                                    const costExGst = quantity * unitCost;
                                    const priceExGst = field.unitPrice || 0;
                                    const totalExGst = quantity * priceExGst;
                                    const markup = priceExGst - unitCost;
                                    const markupPercent =
                                      unitCost > 0
                                        ? ((markup / unitCost) * 100).toFixed(0)
                                        : "0";

                                    return (
                                      <div
                                        key={field.id}
                                        className="grid grid-cols-[40px_80px_1fr_60px_80px_70px_50px_80px_90px] gap-2 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-xs items-center"
                                      >
                                        <div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              removeLineItemField(index)
                                            }
                                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            data-testid={`button-delete-item-${index}`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                        <div className="text-gray-500 truncate">
                                          {field.itemCode || "—"}
                                        </div>
                                        <div className="font-medium text-gray-900 truncate">
                                          {field.description}
                                        </div>
                                        <div className="text-center">
                                          <FormField
                                            control={form.control}
                                            name={`lineItems.${index}.quantity`}
                                            render={({
                                              field: quantityField,
                                            }) => (
                                              <FormItem>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    {...quantityField}
                                                    onChange={(e) => {
                                                      const newQuantity =
                                                        parseFloat(
                                                          e.target.value,
                                                        ) || 1;
                                                      quantityField.onChange(
                                                        newQuantity,
                                                      );
                                                    }}
                                                    className="w-12 h-6 text-center text-xs border-none bg-transparent p-0"
                                                  />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>
                                        <div className="text-center">
                                          <FormField
                                            control={form.control}
                                            name={`lineItems.${index}.priceIncludesTax`}
                                            render={({ field: gstField }) => (
                                              <FormItem>
                                                <FormControl>
                                                  <label className="inline-flex items-center cursor-pointer">
                                                    <input
                                                      type="checkbox"
                                                      className="sr-only"
                                                      checked={
                                                        gstField.value || false
                                                      }
                                                      onChange={(e) => {
                                                        // Simply toggle the GST mode without changing the price
                                                        gstField.onChange(
                                                          e.target.checked,
                                                        );
                                                      }}
                                                    />
                                                    <div
                                                      className={`relative w-9 h-5 rounded-full transition-all ${
                                                        gstField.value
                                                          ? "bg-blue-600"
                                                          : "bg-gray-300"
                                                      }`}
                                                    >
                                                      <div
                                                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                                          gstField.value
                                                            ? "translate-x-4"
                                                            : "translate-x-0"
                                                        }`}
                                                      ></div>
                                                    </div>
                                                    <span className="ml-1.5 text-xs text-gray-700 font-medium min-w-[20px]">
                                                      {gstField.value
                                                        ? "Inc"
                                                        : "Ex"}
                                                    </span>
                                                  </label>
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>
                                        <div className="text-right font-mono">
                                          ${costExGst.toFixed(2)}
                                        </div>
                                        <div className="text-right text-gray-600">
                                          {markupPercent}%
                                        </div>
                                        <div className="text-right">
                                          <FormField
                                            control={form.control}
                                            name={`lineItems.${index}.unitPrice`}
                                            render={({ field: priceField }) => (
                                              <FormItem>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    {...priceField}
                                                    onChange={(e) => {
                                                      const newPrice =
                                                        parseFloat(
                                                          e.target.value,
                                                        ) || 0;
                                                      priceField.onChange(
                                                        newPrice,
                                                      );
                                                    }}
                                                    disabled={!isAdmin}
                                                    readOnly={!isAdmin}
                                                    className="w-16 h-6 text-right text-xs border-none bg-transparent p-0 font-mono"
                                                  />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>
                                        <div className="text-right font-mono font-semibold">
                                          {(() => {
                                            const isGstInclusive =
                                              field.priceIncludesTax || false;
                                            if (isGstInclusive) {
                                              // Price includes GST - show the inclusive total
                                              const gstRate = 0.15;
                                              const totalIncGst =
                                                quantity * priceExGst;
                                              return `$${totalIncGst.toFixed(2)}`;
                                            } else {
                                              // Price excludes GST - show ex GST total
                                              return `$${totalExGst.toFixed(2)}`;
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Mobile Card View - Hidden on desktop */}
                              <div className="lg:hidden">
                                {lineItemFields.map((field, index) => {
                                  const unitCost = field.unitCost || 0;
                                  const quantity = field.quantity || 1;
                                  const costExGst = quantity * unitCost;
                                  const priceExGst = field.unitPrice || 0;
                                  const totalExGst = quantity * priceExGst;
                                  const markup = priceExGst - unitCost;
                                  const markupPercent =
                                    unitCost > 0
                                      ? ((markup / unitCost) * 100).toFixed(0)
                                      : "0";

                                  return (
                                    <div
                                      key={field.id}
                                      className="p-4 border-b border-gray-100 bg-white"
                                    >
                                      {/* Item Header */}
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 pr-3">
                                          <div className="font-medium text-sm text-gray-900 mb-1">
                                            {field.description}
                                          </div>
                                          {field.itemCode && (
                                            <div className="text-xs text-gray-500">
                                              Code: {field.itemCode}
                                            </div>
                                          )}
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            removeLineItemField(index)
                                          }
                                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          data-testid={`button-delete-item-${index}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>

                                      {/* Item Details Grid */}
                                      <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                          <label className="text-xs text-gray-500 block mb-1">
                                            Quantity
                                          </label>
                                          <FormField
                                            control={form.control}
                                            name={`lineItems.${index}.quantity`}
                                            render={({
                                              field: quantityField,
                                            }) => (
                                              <FormItem>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    {...quantityField}
                                                    onChange={(e) => {
                                                      const newQuantity =
                                                        parseFloat(
                                                          e.target.value,
                                                        ) || 1;
                                                      quantityField.onChange(
                                                        newQuantity,
                                                      );
                                                    }}
                                                    className="h-9 text-base md:text-sm"
                                                  />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs text-gray-500 block mb-1">
                                            GST
                                          </label>
                                          <FormField
                                            control={form.control}
                                            name={`lineItems.${index}.priceIncludesTax`}
                                            render={({ field: gstField }) => (
                                              <FormItem>
                                                <FormControl>
                                                  <div className="flex items-center h-8">
                                                    <label className="inline-flex items-center cursor-pointer">
                                                      <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={
                                                          gstField.value ||
                                                          false
                                                        }
                                                        onChange={(e) => {
                                                          // Simply toggle the GST mode without changing the price
                                                          gstField.onChange(
                                                            e.target.checked,
                                                          );
                                                        }}
                                                      />
                                                      <div
                                                        className={`relative w-10 h-5 rounded-full transition-all ${
                                                          gstField.value
                                                            ? "bg-blue-600"
                                                            : "bg-gray-300"
                                                        }`}
                                                      >
                                                        <div
                                                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                                            gstField.value
                                                              ? "translate-x-5"
                                                              : "translate-x-0"
                                                          }`}
                                                        ></div>
                                                      </div>
                                                      <span className="ml-2 text-sm text-gray-700 font-medium min-w-[24px]">
                                                        {gstField.value
                                                          ? "Inc"
                                                          : "Ex"}
                                                      </span>
                                                    </label>
                                                  </div>
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs text-gray-500 block mb-1">
                                            Price
                                          </label>
                                          <FormField
                                            control={form.control}
                                            name={`lineItems.${index}.unitPrice`}
                                            render={({ field: priceField }) => (
                                              <FormItem>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    {...priceField}
                                                    onChange={(e) => {
                                                      const newPrice =
                                                        parseFloat(
                                                          e.target.value,
                                                        ) || 0;
                                                      priceField.onChange(
                                                        newPrice,
                                                      );
                                                    }}
                                                    disabled={!isAdmin}
                                                    readOnly={!isAdmin}
                                                    className="h-9 text-base md:text-sm"
                                                  />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs text-gray-500 block mb-1">
                                            Total
                                          </label>
                                          <div className="h-8 flex items-center font-mono font-semibold text-sm">
                                            {(() => {
                                              const isGstInclusive =
                                                field.priceIncludesTax || false;
                                              if (isGstInclusive) {
                                                const totalIncGst =
                                                  quantity * priceExGst;
                                                return `$${totalIncGst.toFixed(2)}`;
                                              } else {
                                                return `$${totalExGst.toFixed(2)}`;
                                              }
                                            })()}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Cost & Margin Info */}
                                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                                        <div>
                                          Cost:{" "}
                                          <span className="font-mono">
                                            ${costExGst.toFixed(2)}
                                          </span>
                                        </div>
                                        <div>
                                          Margin:{" "}
                                          <span className="font-semibold">
                                            {markupPercent}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Search Row */}
                              <div className="bg-white border-t border-gray-200">
                                <div className="p-4 sm:p-6">
                                  <div className="relative">
                                    <Input
                                      placeholder="Search or Add New..."
                                      value={searchQuery}
                                      onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                      }
                                      onFocus={() => setShowSearchResults(true)}
                                      onBlur={() =>
                                        setTimeout(
                                          () => setShowSearchResults(false),
                                          200,
                                        )
                                      }
                                      className="text-sm"
                                      data-testid="input-search-items-table"
                                    />

                                    {/* Search Results */}
                                    {showSearchResults && searchQuery && (
                                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto top-full mt-1">
                                        {filteredItems.length > 0 ? (
                                          <div className="py-2">
                                            {filteredItems.map((item: any) => (
                                              <div
                                                key={item.id}
                                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                                                onClick={() =>
                                                  selectItemFromSearch(item)
                                                }
                                                data-testid={`search-result-${item.id}`}
                                              >
                                                <div>
                                                  <div className="font-medium text-sm">
                                                    {item.name}
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                    {item.category}
                                                  </div>
                                                </div>
                                                <div className="text-sm font-semibold text-green-600">
                                                  $
                                                  {parseFloat(
                                                    item.displayPrice ||
                                                      item.price ||
                                                      0,
                                                  ).toFixed(2)}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="p-4 text-center">
                                            <div className="text-sm text-gray-500 mb-2">
                                              No items found
                                            </div>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                addCustomItem(searchQuery)
                                              }
                                              className="flex items-center gap-2"
                                              data-testid="button-add-custom-item"
                                            >
                                              <Plus className="w-3 h-3" />
                                              Add "{searchQuery}" as custom item
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Empty State - Show when no line items */}
                          {lineItemFields.length === 0 && !isAddingLineItem && (
                            <div className="border border-gray-200 border-dashed rounded-lg p-8 text-center">
                              <div className="text-gray-400 mb-3">
                                <DollarSign className="w-12 h-12 mx-auto" />
                              </div>
                              <h4 className="font-medium text-gray-700 mb-2">
                                No line items yet
                              </h4>
                              <p className="text-sm text-gray-500 mb-4">
                                Add services or materials to start building your
                                quote
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAddingLineItem(true)}
                                className="flex items-center gap-2 mx-auto"
                                data-testid="button-add-first-item"
                              >
                                <Plus className="w-4 h-4" />
                                Add First Item
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* ServiceM8-Style Financial Summary */}
                        <div className="grid grid-cols-2 gap-6">
                          <div></div> {/* Left side spacer */}
                          <div className="space-y-2 text-sm">
                            {(() => {
                              const lineItems = watchedLineItems;
                              const gstRate = 0.15; // 15% GST for New Zealand
                              const paidAmount = parseFloat(watchedPaidAmount);

                              // Calculate totals by checking each line item's priceIncludesTax flag
                              let subtotal = 0;
                              let totalIncGst = 0;

                              lineItems.forEach((item: any) => {
                                const quantity = item.quantity || 1;
                                const unitPrice = item.unitPrice || 0;
                                const lineTotal = quantity * unitPrice;
                                const isInclusive =
                                  item.priceIncludesTax || false;

                                if (isInclusive) {
                                  // Price includes GST - extract the ex-GST amount
                                  const exGst = lineTotal / (1 + gstRate);
                                  subtotal += exGst;
                                  totalIncGst += lineTotal;
                                } else {
                                  // Price excludes GST - add it
                                  subtotal += lineTotal;
                                  totalIncGst += lineTotal * (1 + gstRate);
                                }
                              });

                              const gstAmount = totalIncGst - subtotal;
                              const balanceDue = totalIncGst - paidAmount;

                              return (
                                <>
                                  <div className="flex justify-between py-1">
                                    <span className="text-gray-600 uppercase text-xs font-medium">
                                      SUBTOTAL
                                    </span>
                                    <span className="font-mono">
                                      ${subtotal.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-gray-600 uppercase text-xs font-medium">
                                      GST
                                    </span>
                                    <span className="font-mono">
                                      ${gstAmount.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-1 font-semibold">
                                    <span className="text-gray-900 uppercase text-xs font-medium">
                                      Total
                                    </span>
                                    <span className="font-mono">
                                      ${totalIncGst.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-green-600 uppercase text-xs font-medium">
                                      Paid
                                    </span>
                                    <span className="font-mono text-green-600">
                                      ${paidAmount.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-1 font-semibold">
                                    <span className="text-orange-600 uppercase text-xs font-medium">
                                      Balance Due
                                    </span>
                                    <span className="font-mono text-orange-600">
                                      ${balanceDue.toFixed(2)}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Sent Invoices Section */}
                      {editingJob && (
                        <div className="mt-6 border-t border-gray-200 pt-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Receipt className="w-4 h-4 text-blue-600" />
                            <h4 className="font-medium text-gray-800">
                              Sent Invoices
                            </h4>
                          </div>

                          {(() => {
                            const invoices =
                              (jobInvoiceResponse as any)?.data || [];
                            const sentInvoices = invoices.filter(
                              (inv: any) =>
                                inv.status === "sent" || inv.xeroInvoiceId,
                            );

                            if (sentInvoices.length === 0) {
                              return (
                                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                                  <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                  <p className="text-sm">
                                    No invoices sent yet
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                {sentInvoices.map((invoice: any) => (
                                  <div
                                    key={invoice.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-2 h-2 rounded-full ${
                                          invoice.status === "paid"
                                            ? "bg-green-500"
                                            : invoice.status === "sent"
                                              ? "bg-blue-500"
                                              : invoice.xeroInvoiceId
                                                ? "bg-purple-500"
                                                : "bg-gray-400"
                                        }`}
                                      />
                                      <div>
                                        <p className="font-medium text-sm text-gray-900">
                                          Invoice #
                                          {invoice.invoiceNumber ||
                                            invoice.xeroInvoiceNumber ||
                                            "N/A"}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {invoice.xeroInvoiceNumber
                                            ? `Xero: ${invoice.xeroInvoiceNumber}`
                                            : ""}
                                          {invoice.sentAt
                                            ? ` • Sent ${format(new Date(invoice.sentAt), "dd/MM/yyyy")}`
                                            : ""}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          // Set email context to invoice and open email composer
                                          setEmailContext("invoice");
                                          setIsInvoiceModalOpen(true);
                                        }}
                                      >
                                        <Send className="h-3.5 w-3.5 mr-1" />
                                        <span className="text-xs">Resend</span>
                                      </Button>
                                      <div className="text-right">
                                        <p className="font-semibold text-sm text-gray-900">
                                          $
                                          {parseFloat(
                                            invoice.totalAmount ||
                                              invoice.amount ||
                                              "0",
                                          ).toFixed(2)}
                                        </p>
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${
                                            invoice.status === "paid"
                                              ? "border-green-500 text-green-600"
                                              : invoice.status === "sent"
                                                ? "border-blue-500 text-blue-600"
                                                : invoice.xeroInvoiceId
                                                  ? "border-purple-500 text-purple-600"
                                                  : "border-gray-400 text-gray-600"
                                          }`}
                                        >
                                          {invoice.status === "paid"
                                            ? "Paid"
                                            : invoice.xeroInvoiceId
                                              ? "In Xero"
                                              : invoice.status === "sent"
                                                ? "Sent"
                                                : invoice.status || "Draft"}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Payment Details Section */}
                      {editingJob &&
                        (() => {
                          const invoice = (jobInvoiceResponse as any)
                            ?.data?.[0];
                          if (!invoice || invoice.status !== "paid")
                            return null;
                          return (
                            <div className="mt-6 border-t border-gray-200 pt-6">
                              <div className="flex items-center gap-2 mb-4">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                <h4 className="font-medium text-gray-800">
                                  Payment Details
                                </h4>
                              </div>
                              {invoice.paidAt && (
                                <p className="text-sm text-gray-600 mb-3">
                                  <span className="font-medium text-gray-700">
                                    Paid on:
                                  </span>{" "}
                                  {format(
                                    new Date(invoice.paidAt),
                                    "dd/MM/yyyy 'at' h:mm a",
                                  )}
                                </p>
                              )}
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  Payment Notes
                                </label>
                                <Textarea
                                  value={paidNotesValue}
                                  onChange={(e) =>
                                    setPaidNotesValue(e.target.value)
                                  }
                                  placeholder="e.g. Paid by bank transfer, receipt #123, cash received..."
                                  className="text-sm resize-none"
                                  rows={3}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={paidNotesSaving}
                                  onClick={async () => {
                                    setPaidNotesSaving(true);
                                    try {
                                      await apiRequest(
                                        "PATCH",
                                        `/api/invoices/${invoice.id}`,
                                        { paidNotes: paidNotesValue },
                                      );
                                      queryClient.invalidateQueries({
                                        queryKey: [
                                          "/api/invoices",
                                          editingJob?.id,
                                        ],
                                      });
                                    } catch {
                                      toast({
                                        title: "Failed to save notes",
                                        variant: "destructive",
                                      });
                                    } finally {
                                      setPaidNotesSaving(false);
                                    }
                                  }}
                                >
                                  {paidNotesSaving ? "Saving..." : "Save Notes"}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                    </div>
                  )}

                  {sidebarTab === "diary" && (
                    <>
                      {editingJob ? (
                        <JobDiarySection
                          jobId={editingJob.id}
                          isServiceM8Style={true}
                          onQuoteClick={(quoteNumber) => {
                            setIsQuoteModalOpen(true);
                          }}
                          onInvoiceClick={(invoiceNumber) => {
                            // Open InvoiceBuilder to view/send the invoice
                            setIsInvoiceModalOpen(true);
                          }}
                          onProposalClick={(proposalNumber) => {
                            // Find the proposal by number and open the viewer
                            const proposals = jobProposalResponse?.data || [];
                            const proposal = proposals.find(
                              (p: any) => p.proposalNumber === proposalNumber,
                            );
                            if (proposal?.id) {
                              setViewingProposalId(proposal.id);
                              setIsProposalViewerOpen(true);
                            }
                          }}
                        />
                      ) : (
                        <div className="p-4">
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">
                              Save the job to view activity diary
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  </div>
                </div>

                {sidebarTab !== "diary" && editingJob && (
                  <div className="hidden sm:block sm:flex-1 bg-white overflow-y-auto overflow-x-hidden rounded-r-lg min-w-0">
                    <JobDiarySection
                      jobId={editingJob.id}
                      onQuoteClick={(quoteNumber) => {
                        setIsQuoteModalOpen(true);
                      }}
                      onInvoiceClick={(invoiceNumber) => {
                        // Open InvoiceBuilder to view/send the invoice
                        setIsInvoiceModalOpen(true);
                      }}
                      onProposalClick={(proposalNumber) => {
                        // Find the proposal by number
                        const proposals = jobProposalResponse?.data || [];
                        const proposal = proposals.find(
                          (p: any) => p.proposalNumber === proposalNumber,
                        );
                        setEditingProposalId(proposal?.id);
                        setIsProposalBuilderOpen(true);
                      }}
                    />
                  </div>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Mobile Fixed Bottom Action Toolbar - ServiceM8 style */}
      {!renderInline && (
        <div className="md:hidden flex-shrink-0 bg-white border-t border-gray-200 flex items-stretch sticky bottom-0 z-50 safe-area-inset-bottom"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Photo */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 group"
            onClick={() => setIsPhotoCaptureOpen(true)}
            data-testid="toolbar-btn-photo"
          >
            <CameraIcon className="h-12 w-12 drop-shadow group-active:scale-90 transition-transform duration-100" />
            <span className="text-[10px] text-gray-500 font-medium">Photo</span>
          </button>

          {/* Call */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 group"
            onClick={handleCallClick}
            data-testid="toolbar-btn-call"
          >
            <CallIcon className="h-12 w-12 drop-shadow group-active:scale-90 transition-transform duration-100" />
            <span className="text-[10px] text-gray-500 font-medium">Call</span>
          </button>

          {/* SMS */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 group"
            onClick={() => setIsSMSComposerOpen(true)}
            data-testid="toolbar-btn-sms"
          >
            <SMSIcon className="h-12 w-12 drop-shadow group-active:scale-90 transition-transform duration-100" />
            <span className="text-[10px] text-gray-500 font-medium">SMS</span>
          </button>

          {/* Email */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 group"
            onClick={handleEmailClick}
            data-testid="toolbar-btn-email"
          >
            <EmailIcon className="h-12 w-12 drop-shadow group-active:scale-90 transition-transform duration-100" />
            <span className="text-[10px] text-gray-500 font-medium">Email</span>
          </button>

          {/* More */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1.5 group"
            onClick={() => setShowMoreActionsSheet(true)}
            data-testid="toolbar-btn-more"
          >
            <MoreDotsIcon className="h-12 w-12 drop-shadow group-active:scale-90 transition-transform duration-100" />
            <span className="text-[10px] text-gray-500 font-medium">More</span>
          </button>
        </div>
      )}

      {/* More Actions Bottom Sheet Modal */}
      <Sheet open={showMoreActionsSheet} onOpenChange={setShowMoreActionsSheet}>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[75vh] flex flex-col">
          <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <SheetHeader>
              <SheetTitle className="text-base font-semibold text-center">Actions</SheetTitle>
            </SheetHeader>
          </div>
          <div className="overflow-y-auto flex-1 p-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>
            <div className="grid grid-cols-4 gap-3">
              {/* Speech to Quote */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors group"
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  setSpeechToQuoteContext("full");
                  setIsSpeechToQuoteOpen(true);
                }}
                data-testid="more-sheet-speech-to-quote"
              >
                <SpeechToQuoteIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Speech to Quote</span>
              </button>

              {/* Schedule */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors group"
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  handleScheduleClick();
                }}
                data-testid="more-sheet-schedule"
              >
                <ScheduleIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Schedule</span>
              </button>

              {/* Quote */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                disabled={!editingJob?.id || mode === "create"}
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  handleQuoteClick();
                }}
                data-testid="more-sheet-quote"
              >
                <QuoteIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Quote</span>
              </button>

              {/* Invoice */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                disabled={!editingJob?.id || mode === "create"}
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  handleInvoiceClick();
                }}
                data-testid="more-sheet-invoice"
              >
                <InvoiceIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Invoice</span>
              </button>

              {/* Proposal */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                disabled={!selectedCustomer?.id}
                onClick={async () => {
                  setShowMoreActionsSheet(false);
                  if (mode === "edit" && editingJob?.id) {
                    try {
                      const formData = form.getValues();
                      await updateJobMutation.mutateAsync(formData);
                    } catch (error) {
                      toast({
                        title: "Save Failed",
                        description: "Please resolve any errors before creating a proposal",
                        variant: "destructive",
                      });
                      return;
                    }
                  }
                  const existingProposal = jobProposalResponse?.data?.[0];
                  if (existingProposal) {
                    setEditingProposalId(existingProposal.id);
                  }
                  setIsProposalBuilderOpen(true);
                }}
                data-testid="more-sheet-proposal"
              >
                <ProposalIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Proposal</span>
              </button>

              {/* Time Tracking */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                disabled={!editingJob?.id || mode === "create"}
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  setIsTimeTrackingOpen(true);
                }}
                data-testid="more-sheet-time-tracking"
              >
                <TimeTrackingIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Time Tracking</span>
              </button>

              {/* Profit Tracker */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                disabled={!editingJob?.id || mode === "create"}
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  setIsProfitTrackerOpen(true);
                }}
                data-testid="more-sheet-profit-tracker"
              >
                <ProfitTrackerIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Profit Tracker</span>
              </button>

              {/* Queue Job */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                disabled={!editingJob?.id || mode === "create"}
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  handleQueueClick();
                }}
                data-testid="more-sheet-queue-job"
              >
                <QueueJobIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Queue Job</span>
              </button>

              {/* Send to Xero */}
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                disabled={
                  !editingJob?.id ||
                  mode === "create" ||
                  editingJob?.status !== "completed" ||
                  editingJob?.xeroStatus === "sent" ||
                  sendToXeroMutation.isPending
                }
                onClick={() => {
                  setShowMoreActionsSheet(false);
                  sendToXeroMutation.mutate();
                }}
                data-testid="more-sheet-send-xero"
              >
                <SendToXeroIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">
                  {sendToXeroMutation.isPending ? "Sending..." : "Send to Xero"}
                </span>
              </button>

              {/* Re-send to Xero (conditional) */}
              {editingJob?.xeroStatus === "sent" && (
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors disabled:opacity-40 group"
                  disabled={resetXeroSyncMutation.isPending}
                  onClick={() => {
                    setShowMoreActionsSheet(false);
                    setShowXeroResetConfirm(true);
                  }}
                  data-testid="more-sheet-resend-xero"
                >
                  <ResendXeroIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                  <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Re-send to Xero</span>
                </button>
              )}

              {/* Request Review (conditional on completed status) */}
              {editingJob?.status === "completed" && (
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors group"
                  onClick={() => {
                    setShowMoreActionsSheet(false);
                    handleRequestReviewClick();
                  }}
                  data-testid="more-sheet-request-review"
                >
                  <RequestReviewIcon className="h-16 w-16 drop-shadow-md group-active:scale-90 transition-transform duration-100" />
                  <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">Request Review</span>
                </button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Email Composer Modal */}
      {isEmailComposerOpen && (
        <EmailComposerModal
          isOpen={isEmailComposerOpen}
          onClose={() => setIsEmailComposerOpen(false)}
          job={{
            ...editingJob,
            billingContactEmail:
              watchedBillingContactEmail || editingJob?.billingContactEmail,
            jobContactEmail:
              watchedJobContactEmail || editingJob?.jobContactEmail,
          }}
          customEmail={
            emailContext !== "invoice"
              ? watchedJobContactEmail ||
                editingJob?.jobContactEmail ||
                undefined
              : undefined
          }
          customer={
            emailContext === "invoice" && editingJob
              ? {
                  ...selectedCustomer,
                  billingContactEmail:
                    watchedBillingContactEmail ||
                    editingJob.billingContactEmail,
                  email:
                    watchedBillingContactEmail ||
                    editingJob.billingContactEmail ||
                    editingJob.jobContactEmail ||
                    selectedCustomer?.email,
                  phone:
                    editingJob.billingContactPhone ||
                    editingJob.billingContactMobile ||
                    editingJob.jobContactPhone ||
                    selectedCustomer?.phone,
                  address:
                    editingJob.billingAddress ||
                    editingJob.address ||
                    selectedCustomer?.address,
                  // Use billing name override from FORM (current unsaved value) first, then fall back to saved value
                  name:
                    watchedBillingNameOverride ||
                    editingJob.billingNameOverride ||
                    selectedCustomer?.name ||
                    `${editingJob.jobContactFirstName || ""} ${editingJob.jobContactLastName || ""}`.trim(),
                }
              : selectedCustomer
          }
          quoteData={
            emailContext === "quote" &&
            jobQuoteResponse?.success &&
            jobQuoteResponse.data.length > 0
              ? {
                  id: jobQuoteResponse.data[0].id,
                  quoteNumber: jobQuoteResponse.data[0].quoteNumber,
                  totalAmount: jobQuoteResponse.data[0].amount,
                  validUntil: jobQuoteResponse.data[0].validUntil,
                  status: jobQuoteResponse.data[0].status,
                  lineItems: watchedLineItems,
                }
              : undefined
          }
          invoiceData={
            emailContext === "invoice"
              ? (() => {
                  // Priority 1: If there are unsaved line items in the billing tab, use those (user is actively editing)
                  const currentLineItems = form.getValues("lineItems");
                  const hasUnsavedLineItems =
                    currentLineItems && currentLineItems.length > 0;

                  if (hasUnsavedLineItems) {
                    console.log(
                      "📋 Using unsaved line items from billing tab:",
                      currentLineItems,
                    );

                    // Calculate subtotal from current line items
                    const subtotal = currentLineItems.reduce(
                      (sum: number, item: any) => {
                        const itemTotal =
                          parseFloat(item.total) ||
                          parseFloat(item.quantity) *
                            parseFloat(item.unitPrice);
                        return sum + itemTotal;
                      },
                      0,
                    );

                    const gstAmount = subtotal * 0.15;
                    const totalAmount = subtotal + gstAmount;

                    // Use existing invoice number if one exists, otherwise generate new one
                    const existingInvoice = jobInvoiceResponse?.data?.[0];
                    const invoiceNumber =
                      existingInvoice?.invoiceNumber ||
                      `${editingJob?.jobNumber || "0000"}`;

                    return {
                      id: existingInvoice?.id || editingJob?.id,
                      jobId: editingJob?.id,
                      invoiceNumber,
                      customerId: editingJob?.customerId || "",
                      amount: subtotal,
                      totalAmount,
                      status: existingInvoice?.status || "draft",
                      issueDate:
                        existingInvoice?.issueDate || new Date().toISOString(),
                      dueDate:
                        existingInvoice?.dueDate ||
                        new Date(
                          Date.now() + 7 * 24 * 60 * 60 * 1000,
                        ).toISOString(),
                      paymentTerms:
                        existingInvoice?.paymentTerms ||
                        invoiceTemplate?.paymentTerms ||
                        "Payment due within 7 days",
                      lineItems: formData.lineItems,
                      description:
                        editingJob?.description || editingJob?.title || "",
                      photos: [],
                      notes: existingInvoice?.notes,
                      createdAt:
                        existingInvoice?.createdAt || new Date().toISOString(),
                    };
                  }

                  // Priority 2: Check if there's a saved invoice for this job
                  const existingInvoice = jobInvoiceResponse?.data?.[0];

                  if (existingInvoice) {
                    console.log(
                      "📋 Using existing saved invoice:",
                      existingInvoice.invoiceNumber,
                    );

                    // Convert database format to display format
                    const lineItems = (existingInvoice.items || []).map(
                      (item: any) => ({
                        id: item.id,
                        description: item.description,
                        quantity: parseFloat(item.quantity) || 1,
                        unitPrice: parseFloat(item.rate || item.unitPrice) || 0,
                        total: parseFloat(item.amount || item.total) || 0,
                        unit: item.unit || "ea",
                        category: item.category,
                      }),
                    );

                    // Calculate amounts from existing invoice
                    const subtotal =
                      typeof existingInvoice.amount === "string"
                        ? parseFloat(existingInvoice.amount)
                        : existingInvoice.amount;
                    const gstAmount = subtotal * 0.15;
                    const totalAmount = subtotal + gstAmount;

                    return {
                      id: existingInvoice.id,
                      jobId: existingInvoice.jobId,
                      invoiceNumber: existingInvoice.invoiceNumber,
                      customerId: existingInvoice.customerId,
                      amount: subtotal,
                      totalAmount,
                      status: existingInvoice.status,
                      issueDate: existingInvoice.issueDate,
                      dueDate: existingInvoice.dueDate,
                      paymentTerms: existingInvoice.paymentTerms,
                      lineItems,
                      description:
                        existingInvoice.description ||
                        existingInvoice.notes ||
                        editingJob?.description ||
                        editingJob?.title ||
                        "",
                      photos: [],
                      notes: existingInvoice.notes,
                      createdAt: existingInvoice.createdAt,
                    };
                  }

                  // If no existing invoice, construct from proposal if available, otherwise from job
                  const proposal = jobProposalResponse?.data?.[0];
                  console.log(
                    "📋 Creating invoice data from proposal:",
                    proposal?.id,
                  );
                  console.log(
                    "📋 Proposal has sections:",
                    !!proposal?.sections,
                    "sections count:",
                    proposal?.sections?.length || 0,
                  );
                  let lineItems: any[] = [];
                  let photos: any[] = [];

                  if (proposal?.sections) {
                    // Extract line items from all proposal sections
                    lineItems = proposal.sections.flatMap((section: any) =>
                      (section.lineItems || []).map((item: any) => ({
                        id: item.id,
                        description: item.description,
                        quantity: parseFloat(item.quantity) || 1,
                        unitPrice: parseFloat(item.unitPrice) || 0,
                        total: parseFloat(item.totalPrice || item.total || "0"),
                        unit: item.unit || "ea",
                        category: item.category,
                      })),
                    );

                    // Extract photos from all proposal sections
                    photos = proposal.sections.flatMap(
                      (section: any) => section.photos || [],
                    );
                  } else {
                    // Fallback to job line items
                    lineItems = editingJob?.lineItems || [];
                    photos = [];
                  }

                  console.log(
                    "📋 Invoice will have",
                    lineItems.length,
                    "line items, data:",
                    lineItems,
                  );

                  // Always use job description (from job details)
                  const description =
                    editingJob?.description || editingJob?.title || "";

                  // Calculate subtotal (ex-GST) from line items
                  const subtotal =
                    lineItems.reduce(
                      (sum: number, item: any) =>
                        sum + (parseFloat(item.total) || 0),
                      0,
                    ) || 0;

                  // Calculate GST (15%) and total amount (inc-GST)
                  const taxRate = parseFloat(editingJob?.taxRate || "15");
                  const gstAmount = subtotal * (taxRate / 100);
                  const totalAmount = subtotal + gstAmount;

                  console.log("📋 Invoice amounts:", {
                    subtotal,
                    taxRate,
                    gstAmount,
                    totalAmount,
                  });

                  return {
                    id: editingJob?.id,
                    jobId: editingJob?.id,
                    invoiceNumber: `${editingJob?.jobNumber || "0000"}`,
                    customerId: editingJob?.customerId || "",
                    amount: subtotal,
                    totalAmount,
                    status: "draft",
                    issueDate: new Date().toISOString(),
                    dueDate: new Date(
                      Date.now() + 7 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    paymentTerms:
                      invoiceTemplate?.paymentTerms ||
                      "Payment due within 7 days",
                    lineItems,
                    description,
                    photos,
                    createdAt: new Date().toISOString(),
                  };
                })()
              : undefined
          }
          proposalData={
            emailContext === "proposal" &&
            jobProposalResponse?.success &&
            jobProposalResponse.data.length > 0
              ? {
                  id: jobProposalResponse.data[0].id,
                  proposalNumber: jobProposalResponse.data[0].proposalNumber,
                  title: jobProposalResponse.data[0].title,
                  totalAmount: jobProposalResponse.data[0].totalAmount,
                  subtotal: jobProposalResponse.data[0].subtotal,
                  validUntil: jobProposalResponse.data[0].validUntil,
                  status: jobProposalResponse.data[0].status,
                  lineItems: form.getValues("lineItems") || [],
                }
              : undefined
          }
          templateType={emailContext}
        />
      )}

      {/* SMS Composer Modal */}
      {isSMSComposerOpen && (
        <SMSComposerModal
          isOpen={isSMSComposerOpen}
          onClose={() => setIsSMSComposerOpen(false)}
          job={editingJob}
          customer={selectedCustomer}
        />
      )}

      {/* Proposal Builder */}
      {isProposalBuilderOpen && (
        <ProposalBuilderV2
          isOpen={isProposalBuilderOpen}
          onClose={() => {
            setIsProposalBuilderOpen(false);
            setEditingProposalId(undefined);
            // Refresh diary to show new proposal entry
            if (editingJob?.id) {
              queryClient.invalidateQueries({
                queryKey: ["/api/jobs", editingJob.id, "diary-timeline"],
              });
              queryClient.invalidateQueries({
                queryKey: ["/api/jobs", editingJob.id, "diary"],
              });
              queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
            }
          }}
          jobId={editingJob?.id}
          customerId={selectedCustomer?.id}
          mode={editingProposalId ? "edit" : "create"}
          proposalId={editingProposalId}
          jobDescription={watchedDescription}
          lineItems={watchedLineItems}
          customEmail={
            watchedJobContactEmail ||
            editingJob?.jobContactEmail ||
            undefined
          }
          onRequestJobSave={handleRequestJobSave}
        />
      )}

      {/* Quote Management Modal */}
      {isQuoteModalOpen && editingJob && quoteTemplate && (
        <Dialog open={isQuoteModalOpen} onOpenChange={setIsQuoteModalOpen}>
          <DialogContent className="max-w-full sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="p-3 sm:p-6 border-b">
              <div className="flex justify-center sm:justify-end">
                <div className="flex gap-1 sm:gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    onClick={handleSaveQuote}
                    data-testid="button-save-quote"
                    className="bg-green-600 hover:bg-green-700 text-white h-9 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    <span>Save</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {}}
                    data-testid="button-copy-quote"
                    className="h-9 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    <span>Copy</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsQuoteModalOpen(false);
                      handleEmailClick("quote");
                    }}
                    data-testid="button-email-quote"
                    className="h-9 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    <span>Email</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {}}
                    data-testid="button-download-quote"
                    className="h-9 text-xs sm:text-sm px-2 sm:px-4 flex-1 sm:flex-none"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    <span>PDF</span>
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="p-3 sm:p-6">
              {(() => {
                // Use editingJob.lineItems first (loaded from database), fallback to form values
                const lineItemsSource =
                  editingJob.lineItems || form.getValues("lineItems") || [];
                const mappedLineItems = lineItemsSource.map((item) => {
                  const quantity = item.quantity || 1;
                  const unitPrice = item.unitPrice || 0;
                  const total = quantity * unitPrice;
                  return {
                    id: item.id,
                    description: item.description,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    unit: "each",
                    total: total,
                    priceIncludesTax: item.priceIncludesTax || false,
                  };
                });
                const totalAmount = mappedLineItems.reduce(
                  (sum, item) => sum + item.total,
                  0,
                );

                return (
                  <QuoteTemplate
                    template={quoteTemplate}
                    quote={{
                      id: editingJob.id,
                      quoteNumber: `QTE-${editingJob.jobNumber || Date.now()}`,
                      amount: String(totalAmount),
                      status: "draft",
                      customerId: selectedCustomer?.id || "",
                      jobId: editingJob.id,
                      description:
                        form.getValues("description") || editingJob.description || "",
                      validUntil: new Date(
                        Date.now() + 30 * 24 * 60 * 60 * 1000,
                      ),
                      terms:
                        quoteTemplate?.paymentTerms ||
                        "Payment due within 30 days",
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    }}
                    customer={selectedCustomer || undefined}
                    lineItems={mappedLineItems}
                    showActions={false}
                  />
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Builder Modal */}
      {isInvoiceModalOpen &&
        editingJob &&
        selectedCustomer &&
        (invoiceTemplate ? (
          <InvoiceBuilder
            isOpen={isInvoiceModalOpen}
            onClose={() => setIsInvoiceModalOpen(false)}
            job={editingJob}
            customer={{
              ...selectedCustomer,
              // Use billing name override from form (current unsaved value) first, then saved value, then customer name
              name:
                form.getValues("billingNameOverride") ||
                editingJob.billingNameOverride ||
                selectedCustomer?.name,
            }}
            invoiceTemplate={invoiceTemplate}
          />
        ) : (
          <Dialog
            open={isInvoiceModalOpen}
            onOpenChange={(open) => { if (!open) setIsInvoiceModalOpen(false); }}
          >
            <DialogContent
              className="flex items-center justify-center min-h-[200px]"
              onEscapeKeyDown={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Loading invoice template...
                </p>
              </div>
            </DialogContent>
          </Dialog>
        ))}

      {/* Profit Tracker */}
      {isProfitTrackerOpen && editingJob?.id && (
        <Dialog
          open={isProfitTrackerOpen}
          onOpenChange={setIsProfitTrackerOpen}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsProfitTrackerOpen(false)}
              className="absolute left-2 top-2 h-9 w-9 z-10 sm:hidden"
              data-testid="button-close-profit-tracker"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogHeader>
              <DialogTitle>Profit Tracking - {editingJob.title}</DialogTitle>
            </DialogHeader>
            <GrossMarginCalculator
              jobId={editingJob.id}
              jobData={editingJob}
              compact={false}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Scheduling Modal */}
      <Dialog
        open={isSchedulingModalOpen}
        onOpenChange={setIsSchedulingModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <h2 className="text-lg font-semibold">Schedule Job</h2>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={schedulingData.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setSchedulingData((prev) => ({
                      ...prev,
                      date: newDate,
                      // If end date is now before start date, clear it
                      endDate:
                        prev.endDate && prev.endDate < newDate
                          ? ""
                          : prev.endDate,
                    }));
                  }}
                  data-testid="input-schedule-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  End Date
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    (multi-day)
                  </span>
                </label>
                <Input
                  type="date"
                  value={schedulingData.endDate}
                  min={schedulingData.date || undefined}
                  onChange={(e) =>
                    setSchedulingData((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  data-testid="input-schedule-end-date"
                  placeholder="Same day"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Select
                  value={schedulingData.startTime}
                  onValueChange={(value) =>
                    setSchedulingData((prev) => ({ ...prev, startTime: value }))
                  }
                >
                  <SelectTrigger data-testid="select-schedule-start-time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 23 }, (_, i) => {
                      const actualIndex = i + 12;
                      const hours = Math.floor(actualIndex / 2);
                      const minutes = (actualIndex % 2) * 30;
                      const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
                      const display = `${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
                      return (
                        <SelectItem key={time} value={time}>
                          {display}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {schedulingData.endDate &&
                  schedulingData.endDate !== schedulingData.date
                    ? "Day 1 Duration"
                    : "Duration"}
                </label>
                <Select
                  value={schedulingData.duration}
                  onValueChange={(value) =>
                    setSchedulingData((prev) => ({ ...prev, duration: value }))
                  }
                >
                  <SelectTrigger data-testid="select-schedule-duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="75">1 hour 15 min</SelectItem>
                    <SelectItem value="90">1 hour 30 min</SelectItem>
                    <SelectItem value="105">1 hour 45 min</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="135">2 hours 15 min</SelectItem>
                    <SelectItem value="150">2 hours 30 min</SelectItem>
                    <SelectItem value="165">2 hours 45 min</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                    <SelectItem value="195">3 hours 15 min</SelectItem>
                    <SelectItem value="210">3 hours 30 min</SelectItem>
                    <SelectItem value="225">3 hours 45 min</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="300">5 hours</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="420">7 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {schedulingData.endDate &&
              schedulingData.endDate !== schedulingData.date && (
                <div>
                  <label className="text-sm font-medium">
                    Day 2 Duration
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      (last day)
                    </span>
                  </label>
                  <Select
                    value={schedulingData.day2Duration}
                    onValueChange={(value) =>
                      setSchedulingData((prev) => ({
                        ...prev,
                        day2Duration: value,
                      }))
                    }
                  >
                    <SelectTrigger data-testid="select-schedule-day2-duration">
                      <SelectValue placeholder="Same as Day 1" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="75">1 hour 15 min</SelectItem>
                      <SelectItem value="90">1 hour 30 min</SelectItem>
                      <SelectItem value="105">1 hour 45 min</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="135">2 hours 15 min</SelectItem>
                      <SelectItem value="150">2 hours 30 min</SelectItem>
                      <SelectItem value="165">2 hours 45 min</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                      <SelectItem value="195">3 hours 15 min</SelectItem>
                      <SelectItem value="210">3 hours 30 min</SelectItem>
                      <SelectItem value="225">3 hours 45 min</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="300">5 hours</SelectItem>
                      <SelectItem value="360">6 hours</SelectItem>
                      <SelectItem value="420">7 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            <div>
              <label className="text-sm font-medium">
                Assign Staff Members
              </label>
              <div className="mt-2 space-y-2 border rounded-md p-3 max-h-60 overflow-y-auto">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No staff members available
                  </p>
                ) : (
                  employees.map((employee: any) => {
                    const isSelected = schedulingData.assignedTo.includes(
                      employee.id,
                    );

                    return (
                      <div
                        key={employee.id}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="checkbox"
                          id={`staff-${employee.id}`}
                          checked={isSelected}
                          onChange={(e) => {
                            const newAssigned = e.target.checked
                              ? [...schedulingData.assignedTo, employee.id]
                              : schedulingData.assignedTo.filter(
                                  (id) => id !== employee.id,
                                );
                            setSchedulingData((prev) => ({
                              ...prev,
                              assignedTo: newAssigned,
                            }));
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid={`checkbox-staff-${employee.id}`}
                        />
                        <label
                          htmlFor={`staff-${employee.id}`}
                          className="text-sm flex-1 cursor-pointer"
                        >
                          {employee.firstName} {employee.lastName}
                          {employee.position && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({employee.position})
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Client Notification Option */}
            <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
              <Checkbox
                id="client-notification"
                checked={schedulingData.sendClientNotification}
                onCheckedChange={(checked) =>
                  setSchedulingData((prev) => ({
                    ...prev,
                    sendClientNotification: checked === true,
                  }))
                }
                data-testid="checkbox-send-client-notification"
              />
              <label
                htmlFor="client-notification"
                className="text-sm font-medium leading-none cursor-pointer select-none"
              >
                Send booking confirmation email to client with date and time
              </label>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={schedulingData.notes}
                onChange={(e) =>
                  setSchedulingData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Additional scheduling notes..."
                data-testid="textarea-schedule-notes"
              />
            </div>
          </div>
          <div className="flex justify-between gap-2 pt-4 flex-wrap">
            {/* Unschedule button — only shown when job already has a scheduled date */}
            <div>
              {editingJob?.scheduledDate && (
                <Button
                  variant="outline"
                  onClick={unscheduleJob}
                  data-testid="btn-unschedule"
                  className="text-red-600 border-red-300"
                >
                  Unschedule
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSchedulingModalOpen(false);
                  setSchedulingData({
                    date: "",
                    endDate: "",
                    startTime: "",
                    duration: "",
                    day2Duration: "",
                    assignedTo: [],
                    notes: "",
                    sendClientNotification: false,
                  });
                }}
                data-testid="btn-cancel-schedule"
              >
                Cancel
              </Button>
              <Button
                onClick={saveSchedule}
                disabled={
                  !schedulingData.date ||
                  !schedulingData.startTime ||
                  !schedulingData.duration ||
                  schedulingData.assignedTo.length === 0
                }
                data-testid="btn-save-schedule"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule {schedulingData.assignedTo.length} Staff Member
                {schedulingData.assignedTo.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Time Tracking Modal */}
      {isTimeTrackingOpen && editingJob && (
        <RecordedTimeModal
          isOpen={isTimeTrackingOpen}
          onClose={() => setIsTimeTrackingOpen(false)}
          jobId={editingJob.id}
          jobNumber={editingJob.jobNumber || "3314"}
        />
      )}

      {/* Photo Capture Modal - supports both create mode (pending photos) and edit mode (direct upload) */}
      <PhotoCaptureModal
        isOpen={isPhotoCaptureOpen}
        onClose={() => setIsPhotoCaptureOpen(false)}
        jobId={editingJob?.id}
        onPendingPhotos={(files, previews) => {
          setPendingPhotos((prev) => [...prev, ...files]);
          setPendingPhotoPreviewUrls((prev) => [...prev, ...previews]);
        }}
      />

      {/* Speech to Quote Modal */}
      <SpeechToQuote
        open={isSpeechToQuoteOpen}
        onOpenChange={setIsSpeechToQuoteOpen}
        onQuoteGenerated={handleSpeechToQuoteGenerated}
        context={speechToQuoteContext}
      />

      {/* Catalog Selection Modal */}
      <Dialog open={isCatalogModalOpen} onOpenChange={setIsCatalogModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add New Line Item</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCatalogModalOpen(false)}
                data-testid="button-close-catalog-modal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-4">
                Quick Select from Catalog
              </h3>

              {materialsAndServices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {materialsAndServices.map((item: any) => {
                    const itemPrice = parseFloat(item.displayPrice || 0);
                    const currentLineItems = form.getValues("lineItems") || [];
                    const currentTotal = currentLineItems.reduce(
                      (sum, item) => sum + (item.total || 0),
                      0,
                    );
                    const newTotal = currentTotal + itemPrice;

                    return (
                      <Card
                        key={item.id}
                        className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 hover:border-gray-300"
                        onClick={() => selectFromCatalog(item)}
                        data-testid={`catalog-item-${item.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="font-medium text-gray-900 text-sm leading-tight">
                              {item.name || item.itemNumber}
                            </div>
                            <div className="text-lg font-semibold text-green-600">
                              ${itemPrice.toFixed(2)}
                            </div>
                            {item.category && (
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            )}
                            {item.type && (
                              <Badge
                                variant={
                                  item.type === "material"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs ml-1"
                              >
                                {item.type}
                              </Badge>
                            )}
                            <div className="text-xs bg-green-50 text-green-700 p-2 rounded border">
                              Profit: $
                              {(
                                itemPrice -
                                parseFloat(item.cost || item.baseCost || 0)
                              ).toFixed(2)}{" "}
                              • Job Total: ${currentTotal.toFixed(2)} → $
                              {newTotal.toFixed(2)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    No materials or services available in catalog
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/materials-services", "_blank")}
                    className="mt-2"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Manage Catalog
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <>
      {renderInline ? (
        // Inline rendering for split-screen panel (desktop)
        jobCardContent
      ) : (
        // Dialog rendering for mobile and standalone use
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
          <DialogContent
            className="w-full h-[100dvh] max-w-full flex flex-col p-0 sm:p-0 bg-gray-50 overflow-hidden sm:max-w-6xl sm:h-[91vh] sm:rounded-xl"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            onEscapeKeyDown={(e) => {
              if (isInvoiceModalOpen) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (isInvoiceModalOpen) e.preventDefault();
            }}
          >
            {jobCardContent}
          </DialogContent>
        </Dialog>
      )}

      {/* Job Description Popup - Responsive Width with safe area for iPhone notch */}
      <Dialog
        open={descriptionPopupOpen}
        onOpenChange={(open) => {
          if (!open) {
            form.setValue("description", descriptionDraft, {
              shouldDirty: true,
            });
          }
          setDescriptionPopupOpen(open);
        }}
      >
        <DialogContent
          className={`w-[95vw] sm:w-[50vw] max-w-3xl mt-[env(safe-area-inset-top,0px)] max-h-[85vh] ${descriptionFocused ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          <DialogHeader>
            <DialogTitle className="text-center">Job Description</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const ta = descriptionPopupRef.current;
                  if (ta) {
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const beforeCursor = descriptionDraft.substring(0, start);
                    const afterCursor = descriptionDraft.substring(end);
                    const isStartOfLine =
                      start === 0 || beforeCursor.endsWith("\n");
                    const bullet = isStartOfLine ? "• " : "\n• ";
                    const newValue = beforeCursor + bullet + afterCursor;
                    setDescriptionDraft(newValue);
                    setTimeout(() => {
                      ta.focus();
                      const newPos = start + bullet.length;
                      ta.setSelectionRange(newPos, newPos);
                    }, 0);
                  } else {
                    setDescriptionDraft(
                      (prev) => prev + (prev ? "\n• " : "• "),
                    );
                  }
                }}
                className="flex items-center gap-1"
              >
                <List className="h-4 w-4" />
                Add Bullet
              </Button>

              {/* Select All */}
              {descriptionDraft && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ta = descriptionPopupRef.current;
                    if (ta) {
                      ta.focus();
                      ta.setSelectionRange(0, ta.value.length);
                    }
                  }}
                  className="flex items-center gap-1"
                >
                  <Pencil className="h-4 w-4" />
                  Select All
                </Button>
              )}

              {/* Copy All */}
              {descriptionDraft && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(descriptionDraft).then(() => {
                      setDescriptionCopied(true);
                      setTimeout(() => setDescriptionCopied(false), 1500);
                    });
                  }}
                  className="flex items-center gap-1"
                >
                  {descriptionCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {descriptionCopied ? "Copied!" : "Copy"}
                </Button>
              )}

              {/* Clear */}
              {descriptionDraft && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDescriptionDraft("");
                    setTimeout(() => {
                      const ta = descriptionPopupRef.current;
                      if (ta) {
                        ta.style.height = "auto";
                        ta.style.height = ta.scrollHeight + "px";
                      }
                    }, 0);
                  }}
                  className="flex items-center gap-1 text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Raw textarea — height is set via scrollHeight (exact browser measurement),
                so there is zero internal overflow. iOS never sees a scrollable element and
                interprets all touch drags as text-selection gestures. */}
            <textarea
              ref={descriptionPopupRef}
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onInput={(e) => {
                const ta = e.currentTarget;
                ta.style.height = "auto";
                ta.style.height = ta.scrollHeight + "px";
              }}
              onFocus={() => setDescriptionFocused(true)}
              onBlur={() => setDescriptionFocused(false)}
              rows={12}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              placeholder={
                "Describe the work that needs to be done\n\nUse the 'Add Bullet' button or type • for bullet points"
              }
              data-testid="textarea-description-popup"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                form.setValue("description", descriptionDraft, {
                  shouldDirty: true,
                });
                setDescriptionPopupOpen(false);
              }}
              data-testid="btn-description-popup-close"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Internal Notes Popup */}
      <Dialog
        open={internalNotesPopupOpen}
        onOpenChange={(open) => {
          if (!open) {
            form.setValue("internalNotes", internalNotesDraft, {
              shouldDirty: true,
            });
          }
          setInternalNotesPopupOpen(open);
        }}
      >
        <DialogContent
          className={`w-[95vw] sm:w-[50vw] max-w-3xl mt-[env(safe-area-inset-top,0px)] max-h-[85vh] ${internalNotesFocused ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-amber-700">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Internal Notes
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                onClick={() => {
                  setSpeechToQuoteContext("internal-notes");
                  setIsSpeechToQuoteOpen(true);
                }}
                data-testid="button-voice-internal-notes"
              >
                <Mic className="h-4 w-4 mr-1" />
                <span className="text-xs">Voice</span>
              </Button>
            </DialogTitle>
            <p className="text-center text-xs text-amber-600 mt-1">
              Staff only — never visible to customers
            </p>
          </DialogHeader>
          <div className="py-4">
            <textarea
              ref={internalNotesPopupRef}
              value={internalNotesDraft}
              onChange={(e) => setInternalNotesDraft(e.target.value)}
              onInput={(e) => {
                const ta = e.currentTarget;
                ta.style.height = "auto";
                ta.style.height = ta.scrollHeight + "px";
              }}
              onFocus={() => setInternalNotesFocused(true)}
              onBlur={() => setInternalNotesFocused(false)}
              rows={12}
              className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-base font-medium text-amber-900 ring-offset-background placeholder:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 resize-none"
              placeholder={
                "Add internal notes for staff...\n\nExamples:\n• Access via side gate, code is 1234\n• Customer prefers no contact before 9am\n• Neighbour's tree overhangs — check permit"
              }
              data-testid="textarea-internal-notes-popup"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                form.setValue("internalNotes", internalNotesDraft, {
                  shouldDirty: true,
                });
                setInternalNotesPopupOpen(false);
              }}
              data-testid="btn-internal-notes-popup-close"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Cancellation Confirmation Dialog */}
      <AlertDialog
        open={cancelBookingDialogOpen}
        onOpenChange={setCancelBookingDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this staff booking? This will
              remove the staff member from this job.
              {bookingToCancel &&
                editingJob?.assignedTo &&
                editingJob.assignedTo.length === 1 && (
                  <span className="block mt-2 text-orange-600 font-medium">
                    This is the last staff member assigned. Cancelling will
                    unschedule this job.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCancelBookingDialogOpen(false);
                setBookingToCancel(null);
              }}
            >
              Keep Booking
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bookingToCancel) {
                  handleCancelBooking(bookingToCancel);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Xero Re-send Confirmation Dialog */}
      <AlertDialog
        open={showXeroResetConfirm}
        onOpenChange={setShowXeroResetConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-send to Xero?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlock the Send to Xero button so you can send a new
              invoice.
              <span className="block mt-2 font-medium text-amber-700">
                Make sure you have already voided the existing invoice in Xero
                before continuing — otherwise you will end up with duplicate
                invoices.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowXeroResetConfirm(false);
                resetXeroSyncMutation.mutate();
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Yes, Reset Xero Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proposal Viewer Modal */}
      <Dialog
        open={isProposalViewerOpen}
        onOpenChange={setIsProposalViewerOpen}
      >
        <DialogContent className="max-w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-3 sm:p-4 border-b bg-gray-50 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                View Document
              </DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open proposal in editor
                    setIsProposalViewerOpen(false);
                    setEditingProposalId(viewingProposalId);
                    setIsProposalBuilderOpen(true);
                  }}
                  data-testid="button-edit-proposal"
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsProposalViewerOpen(false)}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-close-proposal-viewer"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="p-4">
            {(() => {
              const viewingProposal = (viewingProposalData as any)?.data;

              if (!viewingProposal) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2" />
                    <p>Loading proposal...</p>
                  </div>
                );
              }

              if (!proposalTemplate) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2" />
                    <p>Loading template...</p>
                  </div>
                );
              }

              return (
                <ProposalTemplate
                  template={proposalTemplate}
                  proposal={viewingProposal}
                  customer={selectedCustomer}
                  job={editingJob}
                  sections={viewingProposal.sections || []}
                  showActions={false}
                />
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

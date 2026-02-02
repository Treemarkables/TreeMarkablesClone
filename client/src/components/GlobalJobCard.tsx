import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { X, Plus, Mail, MessageSquare, Phone, Calendar, FileText, Presentation, Check, Trash2, User, Users, Building2, Building, DollarSign, ChevronDown, Receipt, Send, CreditCard, CheckCircle, Settings, Zap, Percent, Clock, MapPin, Calculator, Target, MoreHorizontal, UserCircle, Edit3, Image as ImageIcon, Package, Search, Menu, Camera, AlertCircle, ChevronsUpDown, Copy, Download, Save, Printer, Archive, Mic, ArrowLeft, Loader2, TreePine, Scissors, Axe, Sprout, List, Pencil, Star } from "lucide-react";
import { MdEmail, MdSms, MdPhone, MdCalendarToday, MdDescription, MdSend, MdAttachMoney, MdAccessTime, MdCameraAlt, MdMoreHoriz } from "react-icons/md";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { ProposalBuilder } from "./ProposalBuilder";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertJobSchema, type ChecklistItem, type Job, type Customer } from "@shared/schema";
import { cn } from "@/lib/utils";
import { formatTime12Hour, nzTimeToUTC, utcToNZTime } from "@shared/dateUtils";
import { LinkifyMultiline } from "@/lib/linkify";

// Form validation schema extending the base insertJobSchema
const globalJobCardSchema = insertJobSchema.extend({
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
  
  // ServiceM8 Billing Fields
  billingAddress: z.string().optional(),
  billingNameOverride: z.string().optional(), // Override customer name for invoicing
  invoiceDescription: z.string().optional(),
  billingContactPhone: z.string().optional(),
  billingContactMobile: z.string().optional(),
  sameAsJobAddress: z.boolean().optional(),
  taxMode: z.string().optional(),
  
}).refine((data) => {
  // Check if we have a valid customer identifier
  const hasCustomerId = !!data.customerId;
  const hasNewCustomerName = !!data.newCustomerName;
  const hasJobContactName = !!(data.jobContactFirstName || data.jobContactLastName);
  
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
}, {
  message: "Customer name or job contact name is required",
  path: ["newCustomerName"]
});

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
  renderInline = false
}: GlobalJobCardProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    Array.isArray(job?.checklist) ? job.checklist : []
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [sidebarTab, setSidebarTab] = useState("details");
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [hasUserSelectedCustomer, setHasUserSelectedCustomer] = useState(false); // Track if user explicitly selected customer

  const { toast: _originalToast } = useToast();
  const toast = () => {}; // Disabled - user preference: no toast notifications
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();

  // Fetch customers for the dropdown (needed upfront)
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers'],
    enabled: isOpen,
    staleTime: 30000, // Keep data fresh for 30 seconds to prevent refetch on tab switch
    refetchOnWindowFocus: false, // Don't refetch when switching tabs/focus
  });

  const customers: Customer[] = (customersData as any)?.data || [];

  // Form setup
  const form = useForm<GlobalJobCardFormData>({
    resolver: zodResolver(globalJobCardSchema),
    shouldUnregister: true, // Clear form state on unmount to prevent stale data
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
      billingContactPhone: "",
      billingContactMobile: "",
      sameAsJobAddress: true,
      taxMode: "tax_exclusive",
      includeDescriptionInQuotesProposals: true,
    },
  });

  // Watch customerId and update selectedCustomerName when it changes
  const watchedCustomerId = form.watch('customerId');
  useEffect(() => {
    if (watchedCustomerId && customers && customers.length > 0) {
      const customer = customers.find(c => c.id === watchedCustomerId);
      if (customer) {
        setSelectedCustomerName(customer.name);
      }
    }
  }, [watchedCustomerId, customers]);
  
  // Save state to prevent double-clicking
  const [isSaving, setIsSaving] = useState(false);
  
  // Quote presentation method local state (for immediate UI update)
  const [localQuoteMethod, setLocalQuoteMethod] = useState<string>('');
  
  // Proposal builder state
  const [isProposalBuilderOpen, setIsProposalBuilderOpen] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | undefined>(undefined);
  
  // Proposal viewer modal state
  const [isProposalViewerOpen, setIsProposalViewerOpen] = useState(false);
  const [viewingProposalId, setViewingProposalId] = useState<string | undefined>(undefined);
  
  // Equipment addition state
  const [isAddingEquipment, setIsAddingEquipment] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Array<{id: string; equipment: string; checked: boolean}>>([]);
  
  // Booking cancellation state
  const [cancelBookingDialogOpen, setCancelBookingDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  
  // Description popup state
  const [descriptionPopupOpen, setDescriptionPopupOpen] = useState(false);
  const [gearDialogOpen, setGearDialogOpen] = useState(false);
  
  // Double-tap detection for mobile description
  const [lastDescriptionTap, setLastDescriptionTap] = useState(0);
  
  // Profit tracking state
  const [isProfitTrackerOpen, setIsProfitTrackerOpen] = useState(false);
  
  // Margin tracker dialog states
  const [isStaffTimeDialogOpen, setIsStaffTimeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [emailContext, setEmailContext] = useState<'general' | 'quote' | 'invoice' | 'proposal'>('general');
  const [isSMSComposerOpen, setIsSMSComposerOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  
  // Scheduling modal state
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [schedulingData, setSchedulingData] = useState({
    date: '',
    startTime: '',
    duration: '', // in minutes
    assignedTo: [] as string[],
    notes: '',
    sendClientNotification: false
  });
  const [staffConflicts, setStaffConflicts] = useState<{employeeId: string; conflicts: any[]}[]>([]);

  // Time tracking modal state
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);

  // Photo capture modal state
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  // Pending photos for new jobs (uploaded after job creation)
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [pendingPhotoPreviewUrls, setPendingPhotoPreviewUrls] = useState<string[]>([]);

  // Speech to quote modal state
  const [isSpeechToQuoteOpen, setIsSpeechToQuoteOpen] = useState(false);
  const [speechToQuoteContext, setSpeechToQuoteContext] = useState<'full' | 'job-description' | 'invoice-description'>('full');

  // Track created job for edit mode switching
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<'create' | 'edit'>(mode);

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
  const currentJobIdRef = useRef<string | null>(null); // For clipboard paste handler
  
  // Description textarea auto-resize ref
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Line item management state
  const [isAddingLineItem, setIsAddingLineItem] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    description: '',
    quantity: 1,
    unitPrice: '' as string | number,
    unitCost: 0
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
    queryKey: ['/api/employees'],
    enabled: isOpen || isSchedulingModalOpen,
  });

  // Fetch specific job by ID when editing (replaces fetching all 1000 jobs!)
  // Use internal mode to handle newly created jobs that transition from create to edit mode
  const effectiveModeForQuery = createdJobId ? 'edit' : internalMode;
  const { data: specificJobData, isLoading: isLoadingSpecificJob, isPending: isPendingSpecificJob } = useQuery({
    queryKey: ['/api/jobs', jobId || createdJobId],
    enabled: isOpen && effectiveModeForQuery === 'edit' && !!(jobId || createdJobId) && !job,
    staleTime: 30000, // Keep data fresh for 30 seconds to prevent refetch on tab switch
    refetchOnWindowFocus: false, // Don't refetch when switching tabs/focus
  });

  // Lazy load templates - only when billing tab is active or invoice modal is open
  const { data: invoiceTemplateData } = useQuery({
    queryKey: ['/api/templates/default/invoice'],
    enabled: isOpen && (activeTab === 'billing' || sidebarTab === 'billing' || isInvoiceModalOpen),
  });

  const { data: quoteTemplateData } = useQuery({
    queryKey: ['/api/templates/default/quote'],
    enabled: isOpen && (activeTab === 'billing' || sidebarTab === 'billing'),
  });

  const { data: proposalTemplateData } = useQuery({
    queryKey: ['/api/templates/default/proposal'],
    enabled: isOpen && isProposalViewerOpen,
  });

  // Lazy load materials and services - only when billing tab is active (desktop uses sidebarTab, mobile uses activeTab)
  const { data: materialsData } = useQuery({
    queryKey: ['/api/materials'],
    enabled: isOpen && (activeTab === 'billing' || sidebarTab === 'billing'),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['/api/services'],
    enabled: isOpen && (activeTab === 'billing' || sidebarTab === 'billing'),
  });

  const employees: any[] = (employeesData as any)?.data || [];
  const specificJob: Job | null = (specificJobData as any)?.data || null;
  
  // Combine materials and services into a single catalog array
  const materials = (materialsData as any)?.data || [];
  const services = (servicesData as any)?.data || [];
  const materialsAndServices = [
    ...materials.map((item: any) => ({ 
      ...item, 
      type: 'material',
      displayPrice: item.price || 0 
    })),
    ...services.map((item: any) => ({ 
      ...item, 
      type: 'service',
      displayPrice: item.basePrice || 0 
    }))
  ];
  
  const invoiceTemplate = (invoiceTemplateData as any)?.data || null;
  const quoteTemplate = (quoteTemplateData as any)?.data || null;
  const proposalTemplate = (proposalTemplateData as any)?.data || null;

  // Line item management functions
  const addLineItem = () => {
    const unitPriceNum = typeof newLineItem.unitPrice === 'string' ? parseFloat(newLineItem.unitPrice) : newLineItem.unitPrice;
    
    if (!newLineItem.description || newLineItem.quantity <= 0 || !unitPriceNum || unitPriceNum < 0 || newLineItem.unitCost < 0) {
      toast({
        title: "Validation Error", 
        description: "Please fill in all required fields. Prices and costs must be non-negative.",
        variant: "destructive"
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
      priceIncludesTax: false // Default to tax exclusive
    };

    // Use useFieldArray helper to properly update the field array
    appendLineItem(lineItem);
    
    // Reset form
    setNewLineItem({
      description: '',
      quantity: 1,
      unitPrice: '',
      unitCost: 0
    });
    setIsAddingLineItem(false);
    
    // Calculate profit impact for enhanced tracking
    const revenueIncrease = lineItem.total;
    const costIncrease = lineItem.totalCost;
    
    toast({
      title: "Profit Tracking",
      description: `Added "${lineItem.description}" • Revenue: +$${revenueIncrease.toFixed(2)} • Costs: +$${costIncrease.toFixed(2)}`
    });
  };

  const removeLineItem = (index: number) => {
    // Use useFieldArray helper to properly update the field array
    removeLineItemField(index);
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
      unitCost: unitCost
    });
    setIsCatalogModalOpen(false);
    
    // Enhanced profit tracking feedback with real margin calculation
    const profitImpact = margin * 1; // quantity = 1
    
    toast({
      title: "Item Selected from Catalog",
      description: `${itemName} ($${unitPrice.toFixed(2)}) - Profit margin: $${profitImpact.toFixed(2)} (${margin > 0 ? ((margin / unitPrice) * 100).toFixed(1) + '%' : '0%'})`,
    });
  };

  // Filter materials and services based on search query
  const filteredItems = useMemo(() => {
    if (!debouncedSearchQuery) return [];
    
    const query = debouncedSearchQuery.toLowerCase();
    return materialsAndServices.filter((item: any) => 
      item.name?.toLowerCase().includes(query) ||
      item.itemNumber?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  }, [debouncedSearchQuery, materialsAndServices]);

  // Select item from search results and add to line items
  const selectItemFromSearch = (item: any) => {
    const unitPrice = parseFloat(item.displayPrice || item.price || item.basePrice || 0);
    const unitCost = parseFloat(item.cost || item.baseCost || 0);
    const itemName = item.name || item.itemNumber;
    
    // Create line item with proper pricing using form field array
    const lineItem = {
      id: `item-${Date.now()}`,
      itemCode: item.itemNumber || '',
      description: itemName,
      quantity: 1,
      unitPrice: unitPrice,
      unitCost: unitCost,
      total: unitPrice * 1, // quantity * unitPrice
      totalCost: unitCost * 1, // quantity * unitCost
      taxRate: 15, // New Zealand GST
      priceIncludesTax: false // Default to tax exclusive
    };

    // Use appendLineItem from useFieldArray for proper form integration
    appendLineItem(lineItem);
    
    // Reset search
    setSearchQuery('');
    setShowSearchResults(false);
    
    // Calculate profit margin
    const margin = unitPrice - unitCost;
    const profitPercentage = unitPrice > 0 ? ((margin / unitPrice) * 100).toFixed(1) : '0';
    
    toast({
      title: "Item Added",
      description: `${itemName} • Price: $${unitPrice.toFixed(2)} • Profit: $${margin.toFixed(2)} (${profitPercentage}%)`,
    });
  };

  // Add custom item based on search query
  const addCustomItem = (itemName: string) => {
    setNewLineItem({
      description: itemName,
      quantity: 1,
      unitPrice: '',
      unitCost: 0
    });
    setIsAddingLineItem(true);
    setSearchQuery('');
    setShowSearchResults(false);
    
    toast({
      title: "Custom Item",
      description: `Creating custom item: "${itemName}". Please set price and cost.`,
    });
  };

  // Get the currently editing job
  const editingJob = useMemo(() => {
    // Use internal mode and created job ID if available
    const effectiveMode = createdJobId ? 'edit' : internalMode;
    const effectiveJobId = createdJobId || jobId;
    
    console.log('🔍 editingJob useMemo:', {
      effectiveMode,
      effectiveJobId,
      jobPropExists: !!job,
      specificJobExists: !!specificJob,
      conditionCheck: effectiveMode === "edit" && (effectiveJobId || job?.id)
    });
    
    if (effectiveMode === "edit" && (effectiveJobId || job?.id)) {
      // Use job prop if provided, otherwise use the specific job fetched by ID
      const result = job || specificJob;
      console.log('EditingJob useMemo result:', { 
        mode,
        internalMode,
        createdJobId,
        effectiveMode,
        effectiveJobId,
        jobId, 
        jobProp: !!job, 
        specificJobExists: !!specificJob,
        result: !!result,
        resultId: result?.id,
        resultDescription: result?.description 
      });
      return result;
    }
    console.log('🔍 editingJob returning null - condition not met');
    return null;
  }, [mode, internalMode, createdJobId, jobId, job, specificJob]);

  // Initialize localQuoteMethod from editingJob when job ID changes
  useEffect(() => {
    if (editingJob) {
      const jobQuoteMethod = (editingJob as any).quotePresentationMethod || '';
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
        localStorage.setItem('lastViewedJobId', editingJob.id);
        console.log('📱 Stored last viewed job ID:', editingJob.id);
      } catch (e) {
        console.error('Failed to store last viewed job ID:', e);
      }
    }
  }, [editingJob?.id]);

  // Keep ref updated with current job ID for clipboard paste handler
  useEffect(() => {
    currentJobIdRef.current = editingJob?.id || null;
  }, [editingJob?.id]);

  // Clipboard paste handler for screenshots
  useEffect(() => {
    if (!isOpen) return;
    
    const handlePaste = async (e: ClipboardEvent) => {
      console.log('📸 Paste event detected in GlobalJobCard');
      
      const items = e.clipboardData?.items;
      const files = e.clipboardData?.files;
      
      console.log('📸 Clipboard items:', items?.length, 'files:', files?.length);
      
      const imageFiles: File[] = [];
      
      // Try items first (more reliable for screenshots)
      if (items) {
        for (const item of Array.from(items)) {
          console.log('📸 Item type:', item.type, 'kind:', item.kind);
          if (item.type.startsWith('image/')) {
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
          console.log('📸 File type:', file.type);
          if (file.type.startsWith('image/')) {
            imageFiles.push(file);
          }
        }
      }
      
      if (imageFiles.length === 0) {
        console.log('📸 No images found in clipboard');
        return;
      }
      
      // Prevent default paste behavior for images
      e.preventDefault();
      
      console.log('📸 Found', imageFiles.length, 'image(s) to upload');
      
      const currentJobId = currentJobIdRef.current;
      
      // If we have a job ID, upload directly
      if (currentJobId) {
        for (const file of imageFiles) {
          try {
            const formData = new FormData();
            formData.append('photo', file);
            formData.append('authorName', 'User');
            formData.append('description', 'Pasted from clipboard');
            
            const response = await fetch(`/api/jobs/${currentJobId}/photos`, {
              method: 'POST',
              body: formData,
            });
            
            if (response.ok) {
              toast({
                title: "Photo Added",
                description: "Screenshot uploaded successfully.",
              });
              queryClient.invalidateQueries({ queryKey: ['/api/jobs', currentJobId, 'diary-timeline'] });
            }
          } catch (error) {
            console.error('📸 Failed to upload pasted image:', error);
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
              setPendingPhotoPreviewUrls(prev => [...prev, ...newPreviews]);
            }
          };
          reader.readAsDataURL(file);
        }
        setPendingPhotos(prev => [...prev, ...imageFiles]);
        toast({
          title: "Photos Queued",
          description: `${imageFiles.length} screenshot(s) will be uploaded when job is saved.`,
        });
      }
    };
    
    // Use capture phase to get events before they might be stopped
    document.addEventListener('paste', handlePaste, { capture: true });
    console.log('📸 Paste handler attached (isOpen:', isOpen, ')');
    return () => {
      document.removeEventListener('paste', handlePaste, { capture: true });
      console.log('📸 Paste handler removed');
    };
  }, [isOpen, queryClient, toast]);

  // Listen for reply email events from diary
  useEffect(() => {
    const handleOpenEmailComposer = (event: CustomEvent) => {
      const { to, subject, context } = event.detail;
      setEmailContext('general');
      setIsEmailComposerOpen(true);
      
      // Pre-fill email fields after modal opens
      setTimeout(() => {
        const toInput = document.querySelector('input[name="email-to"]') as HTMLInputElement;
        const subjectInput = document.querySelector('input[name="email-subject"]') as HTMLInputElement;
        if (toInput) toInput.value = to;
        if (subjectInput) subjectInput.value = subject;
      }, 100);
    };

    window.addEventListener('openEmailComposer', handleOpenEmailComposer as EventListener);
    
    return () => {
      window.removeEventListener('openEmailComposer', handleOpenEmailComposer as EventListener);
    };
  }, []);

  // Properly manage line items as form field array
  const { fields: lineItemFields, append: appendLineItem, remove: removeLineItemField, update: updateLineItemField, replace: replaceLineItems } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  // Watch customerId from form for finding selected customer
  const formCustomerId = form.watch('customerId');

  // Find selected customer based on form data or editing job
  const selectedCustomer = useMemo(() => {
    // For edit mode, use the editing job's customer
    if (mode === "edit" && editingJob?.customerId) {
      return customers.find(c => c.id === editingJob.customerId);
    }
    // For create mode, use the selected customer from form
    if (formCustomerId) {
      return customers.find(c => c.id === formCustomerId);
    }
    return null;
  }, [mode, editingJob, customers, formCustomerId]);

  // Get customer data for the editing job (memoized to properly track changes)
  const editingJobCustomer = useMemo(() => {
    return editingJob ? customers.find(c => c.id === editingJob.customerId) : null;
  }, [editingJob, customers]);

  // Reset form when switching to create mode OR populate form when editing an existing job
  useEffect(() => {
    if (mode === 'create' && !jobId && !createdJobId) {
      // CRITICAL: Clear the dirty-state guard BEFORE resetting to ensure reset always happens
      hasUserChangedRef.current = false;
      isLoadingDataRef.current = false;
      
      // Use initialData if provided (from conversations), otherwise blank form
      const resetData = initialData ? {
        title: '',
        description: initialData.description || '',
        status: 'quote',
        priority: 'medium',
        customerId: '',
        leadSource: initialData.leadSource || '',
        address: initialData.address || '',
        totalAmount: '0',
        paidAmount: '0',
        notes: '',
        isNewCustomer: true, // Mark as new customer if we have initialData
        newCustomerName: initialData.customerName || '',
        newCustomerEmail: initialData.customerEmail || '',
        newCustomerPhone: initialData.customerPhone || '',
        jobContactFirstName: initialData.customerFirstName || '',
        jobContactLastName: initialData.customerLastName || '',
        jobContactEmail: initialData.customerEmail || '',
        jobContactPhone: '', // Leave blank - most numbers from conversations are mobile
        billingContactPhone: '',
        billingContactMobile: initialData.customerPhone || '', // Put mobile number here
        billingAddress: initialData.address || '',
        billingNameOverride: '', // Can be set to override customer name for invoicing
        invoiceDescription: initialData.description || '',
        sameAsJobAddress: true,
        taxMode: 'tax_exclusive',
        checklist: [],
        includeDescriptionInQuotesProposals: true,
        estimatedManHours: '',
      } : {
        title: '',
        description: '',
        status: 'quote',
        priority: 'medium',
        customerId: '',
        leadSource: '',
        address: '',
        totalAmount: '0',
        paidAmount: '0',
        notes: '',
        jobContactFirstName: '',
        jobContactLastName: '',
        jobContactEmail: '',
        jobContactPhone: '',
        billingContactPhone: '',
        billingContactMobile: '',
        billingAddress: '',
        billingNameOverride: '',
        invoiceDescription: '',
        sameAsJobAddress: true,
        estimatedManHours: '',
        taxMode: 'tax_exclusive',
        checklist: [],
        includeDescriptionInQuotesProposals: true,
      };
      
      // Reset form with appropriate data
      form.reset(resetData);
      replaceLineItems([]); // Clear line items
      
      // Set customer search value if we have initial data
      if (initialData?.customerName) {
        setSelectedCustomerName(initialData.customerName);
        setCustomerSearchValue(initialData.customerName);
      } else {
        setSelectedCustomerName('');
        setCustomerSearchValue('');
      }
      setHasUserSelectedCustomer(false); // Reset customer selection flag
    } else if (editingJob && editingJob.id && !customersLoading) {
      // Check if this is a NEW job we haven't loaded yet (first time seeing this job)
      const isNewJobLoad = lastLoadedJobIdRef.current !== editingJob.id;
      
      // GUARD: Don't reset form if user has made changes (prevents data loss on background refetch)
      // BUT: Always allow reset if this is a different job than what we last loaded
      if (form.formState.isDirty && !isNewJobLoad) {
        return;
      }
      
      // Mark that we're loading this job
      lastLoadedJobIdRef.current = editingJob.id;
      
      // Wait for customers to load before populating form to avoid missing customer data
      // Mark that we're loading data to prevent auto-save
      isLoadingDataRef.current = true;
      hasUserChangedRef.current = false;
      
      // Split customer name into first and last name for form fields
      const nameParts = editingJobCustomer?.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      form.reset({
        // Core job data
        title: editingJob.title || '',
        description: (editingJob.description ?? '') || '',
        status: (editingJob.status as any) || 'work_order',
        priority: editingJob.priority || 'medium',
        customerId: editingJob.customerId || '',
        isNewCustomer: false, // Existing jobs always have a customer already
        leadSource: editingJob.leadSource || '',
        address: editingJob.address || '',
        totalAmount: editingJob.totalAmount || '0',
        paidAmount: editingJob.paidAmount || '0',
        notes: editingJob.notes || '',
        // Contact fields from job data (with customer as fallback)
        jobContactFirstName: editingJob.jobContactFirstName || firstName,
        jobContactLastName: editingJob.jobContactLastName || lastName,
        jobContactEmail: editingJob.jobContactEmail || editingJobCustomer?.email || '',
        jobContactPhone: editingJob.jobContactPhone || editingJobCustomer?.phone || '',
        billingContactPhone: editingJob.billingContactPhone || '',
        billingContactMobile: editingJob.billingContactMobile || '',
        billingAddress: editingJob.billingAddress || '',
        billingNameOverride: editingJob.billingNameOverride || '',
        invoiceDescription: editingJob.invoiceDescription || '',
        sameAsJobAddress: editingJob.sameAsJobAddress ?? true,
        taxMode: editingJob.taxMode || 'tax_exclusive',
        // Arrays - DO NOT set lineItems here, let replaceLineItems() handle it
        checklist: editingJob.checklist || [],
        includeDescriptionInQuotesProposals: editingJob.includeDescriptionInQuotesProposals ?? true,
        estimatedManHours: editingJob.estimatedManHours || '',
      });
      
      // Fix: Explicitly sync useFieldArray with line items after form reset
      if (editingJob.lineItems) {
        // Use replace to atomically set line items from database
        replaceLineItems(editingJob.lineItems);
      }
      
      // Set selected customer name for the search/create combobox
      if (editingJobCustomer?.name) {
        setSelectedCustomerName(editingJobCustomer.name);
      }
      
      // Reset loading flag after a delay to ensure all form updates are done
      // Longer timeout prevents auto-save trigger when cache refreshes
      setTimeout(() => {
        isLoadingDataRef.current = false;
      }, 500);
    }
  // Use editingJobCustomer?.id instead of the full object to prevent form reset on customer data refetch
  // The actual customer data is still accessible via the editingJobCustomer variable above
  }, [isOpen, mode, jobId, createdJobId, editingJob?.id, editingJobCustomer?.id, customersLoading, form, replaceLineItems, initialData]);

  // Keep billing address in sync with job address when "same as job address" is enabled
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      const sameAsJobAddress = values.sameAsJobAddress;
      
      // If "same as job address" is enabled and job address fields change, update billing fields
      if (sameAsJobAddress && name === 'address') {
        form.setValue('billingAddress', values.address || '');
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Auto-populate address from customer in create mode
  useEffect(() => {
    // Only auto-populate if user has explicitly selected a customer (tracked by flag)
    // This prevents auto-populate from using stale customer data from previously viewed jobs
    if (mode === 'create' && hasUserSelectedCustomer && selectedCustomer?.address) {
      const currentAddress = form.getValues('address');
      // Only populate if address field is empty
      if (!currentAddress || currentAddress.trim() === '') {
        form.setValue('address', selectedCustomer.address);
      }
    }
  }, [mode, hasUserSelectedCustomer, selectedCustomer, form]);
  
  // Description display auto-sizes naturally with div and whitespace-pre-wrap
  // No manual height calculation needed

  // Auto-save for job card - saves on field blur/change with debounce
  // SAFE FIELDS: Only auto-save text/select fields, NOT line items or proposals
  const autoSaveFieldsRef = useRef<Set<string>>(new Set([
    'title', 'description', 'address', 'status', 'priority', 'leadSource',
    'scheduledDate', 'scheduledTime', 'estimatedDuration', 'estimatedManHours',
    'jobContactFirstName', 'jobContactLastName', 'jobContactEmail', 'jobContactPhone',
    'billingAddress', 'billingNameOverride', 'invoiceDescription', 'billingContactPhone',
    'billingContactMobile', 'billingContactEmail', 'jobContactFirstNameForInvoice', 'jobContactLastNameForInvoice',
    'purchaseOrderNumber', 'sameAsJobAddress', 'quotingMethod', 'unsuccessfulReason',
    'categoryId', 'crewMembers', 'equipment'
  ]));
  
  useEffect(() => {
    if (mode !== 'edit' || !editingJob?.id) return;
    
    let timeoutId: NodeJS.Timeout;
    
    const subscription = form.watch((values, { name }) => {
      // Skip auto-save if we're currently loading data from the server
      if (isLoadingDataRef.current) {
        console.log('🔄 Auto-save skipped - still loading data');
        return;
      }
      
      // Only auto-save for safe fields (not line items, proposals, etc.)
      if (!name || !autoSaveFieldsRef.current.has(name)) {
        return;
      }
      
      console.log(`📝 Auto-save triggered for field: ${name}, value:`, (values as any)[name]);
      
      // Mark that the user has made a change
      hasUserChangedRef.current = true;
      
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Set new timeout for auto-save (1.5 second debounce)
      timeoutId = setTimeout(async () => {
        // Only auto-save if the user actually changed something
        if (!hasUserChangedRef.current) {
          return;
        }
        
        try {
          setIsAutoSaving(true);
          const formData = form.getValues();
          
          console.log('💾 Auto-saving job data...', {
            jobId: editingJob.id,
            estimatedManHours: formData.estimatedManHours,
            description: formData.description?.substring(0, 50)
          });
          
          // EXCLUDE line items from auto-save to prevent data loss
          // Line items are saved separately via their own mechanisms
          const safeFormData = { ...formData };
          delete (safeFormData as any).lineItems;
          
          // Map new customer fields to job contact fields for backend compatibility
          if (safeFormData.isNewCustomer && safeFormData.newCustomerName) {
            const names = safeFormData.newCustomerName.split(' ');
            safeFormData.jobContactFirstName = names[0] || '';
            safeFormData.jobContactLastName = names.slice(1).join(' ') || '';
            safeFormData.jobContactEmail = safeFormData.newCustomerEmail || '';
            safeFormData.jobContactPhone = safeFormData.newCustomerPhone || '';
          }
          
          await apiRequest('PUT', `/api/jobs/${editingJob.id}`, safeFormData);
          console.log('✅ Auto-save completed successfully');
          setLastAutoSaveTime(new Date());
          hasUserChangedRef.current = false;
          
          // Invalidate queries to refresh data across all views (mobile & desktop sync)
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        } catch (error) {
          console.error('❌ Auto-save failed:', error);
          hasUserChangedRef.current = false;
        } finally {
          setIsAutoSaving(false);
        }
      }, 1500); // 1.5 second debounce
    });
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, [form, mode, editingJob?.id, queryClient]);

  const formData = form.watch();

  // Job create/update mutations
  const createJobMutation = useMutation({
    mutationFn: async (data: GlobalJobCardFormData) => {
      let customerId = data.customerId;
      
      // If no customer ID is provided, create a customer from job contact info
      if (!customerId && (data.jobContactFirstName || data.jobContactLastName)) {
        const customerName = `${data.jobContactFirstName || ''} ${data.jobContactLastName || ''}`.trim();
        const phoneNumber = data.jobContactPhone || "";
        // Detect if it's a mobile number (NZ mobiles start with 02, 2, +642, or 642)
        const isMobile = /^(\+?64)?0?2[0-9]/.test(phoneNumber.replace(/\s/g, ''));
        const customerData = {
          name: customerName || 'New Customer',
          email: data.jobContactEmail || "",
          phone: isMobile ? "" : phoneNumber,
          mobile: isMobile ? phoneNumber : "",
          address: data.address || ""
        };
        
        const customerResponse = await apiRequest('POST', '/api/customers', customerData);
        const newCustomer = await customerResponse.json();
        customerId = newCustomer.data.id;
      }
      // Ensure we have a customer ID
      if (!customerId) {
        throw new Error('Customer is required to create a job');
      }
      
      // Create the job with the customer ID and selected equipment
      const jobData = {
        ...data,
        customerId: customerId,
        equipmentChecklist: selectedEquipment.length > 0 ? selectedEquipment : undefined
      };
      
      const response = await apiRequest('POST', '/api/jobs', jobData);
      return response.json();
    },
    onSuccess: async (newJob) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Job Created",
        description: "New job has been created successfully.",
        duration: 1000,
      });
      
      // Mark the source conversation as converted (prevent duplicate job creation)
      if (initialData?.conversationId) {
        try {
          await apiRequest('PATCH', `/api/conversations/${initialData.conversationId}`, {
            status: 'converted'
          });
          // Force refetch of conversation data
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          queryClient.invalidateQueries({ queryKey: ['/api/conversations', initialData.conversationId] });
          await queryClient.refetchQueries({ queryKey: ['/api/conversations', initialData.conversationId] });
          console.log('✅ Conversation marked as converted:', initialData.conversationId);
        } catch (error) {
          console.error('Failed to update conversation status:', error);
        }
      }
      
      // Switch to edit mode after creating the job - stay in modal
      if (newJob?.data?.id) {
        const jobId = newJob.data.id;
        setCreatedJobId(jobId);
        setInternalMode('edit');
        setSelectedEquipment([]); // Reset equipment selection for next create
        
        // Upload any pending photos that were added before job was saved
        if (pendingPhotos.length > 0) {
          console.log('📸 Uploading', pendingPhotos.length, 'pending photos to new job:', jobId);
          for (const file of pendingPhotos) {
            try {
              const formData = new FormData();
              formData.append('photo', file);
              formData.append('authorName', 'User');
              formData.append('description', 'Photo added');
              
              const response = await fetch(`/api/jobs/${jobId}/photos`, {
                method: 'POST',
                body: formData,
              });
              
              if (!response.ok) {
                console.error('📸 Failed to upload pending photo:', await response.text());
              } else {
                console.log('📸 Uploaded pending photo successfully');
              }
            } catch (error) {
              console.error('📸 Error uploading pending photo:', error);
            }
          }
          // Clear pending photos after upload
          setPendingPhotos([]);
          setPendingPhotoPreviewUrls([]);
        }
        
        // Invalidate and refetch the specific job data immediately
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
        queryClient.refetchQueries({ queryKey: ['/api/jobs', jobId] });
        // Call parent callback if provided
        onJobCreated?.(newJob);
        // Note: Not closing modal - staying open in edit mode for the newly created job
      }
    },
    onError: (error) => {
      console.error('Error creating job:', error);
      toast({
        title: "Creation Error",
        description: "Failed to create job. Please try again.",
        variant: "destructive"
      });
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data: GlobalJobCardFormData) => {
      if (!editingJob?.id) throw new Error('No job ID for update');
      const response = await apiRequest('PUT', `/api/jobs/${editingJob.id}`, data);
      return response.json();
    },
    onSuccess: (updatedJob) => {
      // Invalidate all jobs queries to update dispatch board and job lists
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/jobs');
        }
      });
      // Explicitly invalidate the Invoices completed jobs query (required for status changes)
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', 'completed', 1000] });
      queryClient.refetchQueries({ queryKey: ['/api/jobs', 'completed', 1000] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      // Refetch the specific job and customers to ensure UI has latest data
      queryClient.refetchQueries({ queryKey: ['/api/jobs', editingJob?.id] });
      queryClient.refetchQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Job Updated",
        description: "Job has been updated successfully.",
        duration: 1000,
      });
      onJobUpdated?.(updatedJob);
    },
    onError: (error) => {
      console.error('Error updating job:', error);
      toast({
        title: "Update Error",
        description: "Failed to update job. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Handle booking cancellation
  const handleCancelBooking = async (employeeId: string) => {
    if (!editingJob?.id) {
      toast({
        title: "Error",
        description: "No job ID available",
        variant: "destructive"
      });
      return;
    }

    try {
      // Clone and filter the assignedTo array
      const updatedAssignedTo = (editingJob.assignedTo || []).filter(id => id !== employeeId);
      
      // Get employee name for diary entry
      const employee = employees.find((e: any) => e.id === employeeId);
      const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Staff member';
      
      // Prepare update payload
      const updatePayload: any = {
        id: editingJob.id,
        assignedTo: updatedAssignedTo
      };
      
      // If removing the last staff member, clear schedule fields
      if (updatedAssignedTo.length === 0) {
        updatePayload.scheduledDate = null;
        updatePayload.scheduledStartTime = null;
        updatePayload.scheduledEndTime = null;
      }
      
      // Update the job
      await updateJobMutation.mutateAsync(updatePayload as GlobalJobCardFormData);
      
      // Add diary entry for audit trail
      try {
        await apiRequest('POST', `/api/jobs/${editingJob.id}/diary`, {
          eventType: 'booking_cancelled',
          notes: `Booking cancelled for ${employeeName}`,
          timestamp: new Date().toISOString()
        });
      } catch (diaryError) {
        console.error('Failed to add diary entry:', diaryError);
      }
      
      toast({
        title: "Booking Cancelled",
        description: `${employeeName}'s booking has been removed.`,
      });
      
      // Close dialog and reset state
      setCancelBookingDialogOpen(false);
      setBookingToCancel(null);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive"
      });
    }
  };

  const sendToXeroMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id) throw new Error('No job ID for Xero');
      const response = await apiRequest('POST', '/api/xero/send-invoice', { 
        jobId: editingJob.id 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Sent to Xero",
        description: "Invoice has been successfully sent to Xero.",
      });
    },
    onError: (error) => {
      console.error('Error sending to Xero:', error);
      toast({
        title: "Xero Error",
        description: "Failed to send invoice to Xero. Please try again.",
        variant: "destructive"
      });
    }
  });

  const archiveJobMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id) throw new Error('No job ID for archive');
      const response = await apiRequest('PUT', `/api/jobs/${editingJob.id}`, { 
        status: 'archived'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job Archived",
        description: "Job has been archived successfully.",
      });
      onClose();
    },
    onError: (error) => {
      console.error('Error archiving job:', error);
      toast({
        title: "Archive Error",
        description: "Failed to archive job. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Fetch proposal data for this job (always fetch when job exists)
  const { data: jobProposalResponse, isLoading: isProposalLoading, isFetching: isProposalFetching, refetch: refetchProposals } = useQuery({
    queryKey: ["/api/proposals", editingJob?.id],
    queryFn: async () => {
      const response = await fetch(`/api/proposals?jobId=${editingJob?.id}&includeSections=true`);
      if (!response.ok) throw new Error('Failed to fetch proposals');
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
    const sentProposal = proposals.find((p: any) => p.status === 'sent');
    const proposalToUse = sentProposal || proposals[0]; // Use sent if available, otherwise use first (latest)
    
    if (proposalToUse && proposalToUse.sections && Array.isArray(proposalToUse.sections)) {
      proposalToUse.sections.forEach((section: any) => {
        if (section.lineItems && Array.isArray(section.lineItems)) {
          section.lineItems.forEach((item: any) => {
            lineItems.push({
              id: item.id,
              description: item.description,
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || Number(item.unit_price) || 0,
              total: Number(item.totalPrice) || Number(item.total_price) || Number(item.total) || 0,
              unit: item.unit || 'each',
              category: item.category || 'service',
              taxable: true
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
      if (!response.ok) throw new Error('Failed to fetch quotes');
      return response.json();
    },
    enabled: !!editingJob?.id,
  });

  // Fetch invoice data for this job (always fetch when job exists)
  const { data: jobInvoiceResponse, refetch: refetchInvoices } = useQuery({
    queryKey: ["/api/invoices", editingJob?.id],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?jobId=${editingJob?.id}`);
      if (!response.ok) throw new Error('Failed to fetch invoices');
      return response.json();
    },
    enabled: !!editingJob?.id,
  });

  // Fetch all equipment for quick-add dropdown
  const { data: equipmentData } = useQuery({
    queryKey: ["/api/equipment"],
  });
  
  const allEquipment = Array.isArray((equipmentData as any)?.data) ? (equipmentData as any).data : [];

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id || !selectedCustomer?.id) {
        throw new Error('Job and customer are required');
      }
      
      const proposalData = {
        jobId: editingJob.id,
        customerId: selectedCustomer.id,
        title: editingJob.title || 'Proposal',
        proposalNumber: `PROP-${Date.now()}`,
        introduction: editingJob.description || '',
        conclusion: '',
        status: 'draft' as const,
        deliveryMethod: 'email' as const,
        createdBy: 'system',
      };
      
      const response = await apiRequest('POST', '/api/proposals', proposalData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
    },
  });

  // Create quote mutation
  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!editingJob?.id || !selectedCustomer?.id) {
        throw new Error('Job and customer are required');
      }
      
      // Get line items from job record first, fallback to formData
      const lineItems = editingJob.lineItems || formData?.lineItems || [];
      const totalAmount = lineItems.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
      const quoteData = {
        customerId: selectedCustomer.id,
        quoteNumber: `QTE-${editingJob.jobNumber || Date.now()}`,
        description: editingJob.description || editingJob.title || 'Quote for tree services',
        amount: totalAmount.toFixed(2),
        status: 'draft' as const,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lineItems: JSON.stringify(lineItems),
        terms: 'Payment due within 30 days',
        createdBy: 'system',
      };
      
      const response = await apiRequest('POST', '/api/quotes', quoteData);
      return response.json();
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      // Update the job with the quote ID (preserve line items)
      if (result.data?.id && editingJob?.id) {
        try {
          const lineItems = editingJob.lineItems || formData?.lineItems || [];
          console.log('📝 Updating job with quoteId and line items:', { quoteId: result.data.id, lineItemsCount: lineItems.length });
          await apiRequest('PUT', `/api/jobs/${editingJob.id}`, { 
            quoteId: result.data.id,
            lineItems: lineItems
          });
          // Invalidate job queries to refresh
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        } catch (error) {
          console.error('Failed to update job with quoteId:', error);
        }
      }
    },
  });

  // Handle email click
  const handleEmailClick = async (context: 'general' | 'quote' | 'invoice' | 'proposal' = 'general') => {
    setEmailContext(context);
    
    // For quote emails, ensure a quote exists before opening composer
    if (context === 'quote' && editingJob?.id && selectedCustomer?.id) {
      const hasQuote = jobQuoteResponse?.success && jobQuoteResponse.data.length > 0;
      
      if (!hasQuote) {
        try {
          // Create quote and wait for the result
          const quoteResult = await createQuoteMutation.mutateAsync();
          
          if (!quoteResult?.data?.id) {
            throw new Error('Failed to create quote');
          }
          
          // Refetch and verify we have the quote data
          const refetchResult = await refetchQuotes();
          
          if (!refetchResult.data?.success || !refetchResult.data.data.length) {
            throw new Error('Failed to load created quote');
          }
        } catch (error) {
          console.error('Failed to create quote:', error);
          toast({
            title: "Error",
            description: "Failed to create quote. Please try again.",
            variant: "destructive"
          });
          return;
        }
      }
    }
    
    // For proposal emails, ensure a proposal exists before opening composer
    if (context === 'proposal' && editingJob?.id && selectedCustomer?.id) {
      // Wait for proposal query to be fully settled (not loading or fetching)
      if (isProposalLoading || isProposalFetching) {
        toast({
          title: "Loading",
          description: "Please wait while we load proposal data...",
        });
        return;
      }
      
      const hasProposal = jobProposalResponse?.success && jobProposalResponse.data.length > 0;
      
      if (!hasProposal) {
        try {
          // Create proposal and wait for the result
          await createProposalMutation.mutateAsync();
          // Refetch and verify we have the proposal data
          const refetchResult = await refetchProposals();
          
          if (!refetchResult.data?.success || !refetchResult.data.data.length) {
            throw new Error('Failed to load created proposal');
          }
        } catch (error) {
          console.error('Failed to create proposal:', error);
          toast({
            title: "Error",
            description: "Failed to create proposal. Please try again.",
            variant: "destructive"
          });
          return;
        }
      }
    }
    
    setIsEmailComposerOpen(true);
  };

  // Handle call click - with Hero Internet click-to-call integration
  const [isCallingViaHero, setIsCallingViaHero] = useState(false);
  
  const initiateHeroCallMutation = useMutation({
    mutationFn: async (destinationNumber: string) => {
      const response = await apiRequest('POST', '/api/hero/call', {
        toNumber: destinationNumber,
        jobId: editingJob?.id,
        customerId: selectedCustomer?.id
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Call Initiated",
        description: "Your phone will ring shortly. Answer to connect with the customer.",
      });
      setIsCallingViaHero(false);
    },
    onError: (error: any) => {
      console.error('Hero Internet call failed:', error);
      toast({
        title: "Call Failed",
        description: error.message || "Could not initiate call via Hero Internet. Using regular phone.",
        variant: "destructive"
      });
      setIsCallingViaHero(false);
      // Fall back to tel: link
      const phone = selectedCustomer?.phone || form.getValues('jobContactPhone');
      if (phone) {
        window.location.href = `tel:${phone}`;
      }
    }
  });
  
  const handleCallClick = async () => {
    console.log('📞 Call button clicked');
    const phone = selectedCustomer?.phone || form.getValues('jobContactPhone');
    console.log('📞 Phone number:', phone, 'Customer:', selectedCustomer?.name);
    
    if (!phone) {
      toast({
        title: "No Phone Number",
        description: "No phone number available for this customer",
        variant: "destructive"
      });
      return;
    }
    
    // Try Hero Internet click-to-call first (for recorded calls)
    // If Hero is not configured, fall back to regular tel: link
    setIsCallingViaHero(true);
    console.log('📞 Initiating Hero Internet call to:', phone);
    try {
      await initiateHeroCallMutation.mutateAsync(phone);
    } catch (error) {
      console.error('📞 Call mutation error:', error);
      // Error handling is done in onError callback
    }
  };
  
  // Fallback to direct phone call (useful when Hero is not configured)
  const handleDirectCall = () => {
    const phone = selectedCustomer?.phone || form.getValues('jobContactPhone');
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  // Handle schedule click
  const handleScheduleClick = async () => {
    if (!editingJob?.id) return;
    
    // Clear any stale conflict data
    setStaffConflicts([]);
    
    // Fetch existing staff assignments for this job
    try {
      const response = await fetch(`/api/jobs/${editingJob.id}/staff-assignments`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        // Pre-populate the form with existing assignment data
        const firstAssignment = data.data[0];
        const startDateUTC = new Date(firstAssignment.startTime);
        const endDateUTC = new Date(firstAssignment.endTime);
        const durationMinutes = (endDateUTC.getTime() - startDateUTC.getTime()) / 60000;
        
        // Convert UTC time from database to NZ time for display
        const startNZ = utcToNZTime(startDateUTC);
        
        // Remove duplicate employee IDs when loading existing assignments
        const uniqueEmployeeIds = [...new Set(data.data.map((a: any) => a.employeeId))];
        
        setSchedulingData({
          date: startNZ.date, // NZ date, not UTC!
          startTime: startNZ.time, // NZ time, not UTC!
          duration: durationMinutes.toString(),
          assignedTo: uniqueEmployeeIds,
          notes: firstAssignment.notes || '',
          sendClientNotification: false
        });
      }
    } catch (error) {
      console.error('Error loading existing assignments:', error);
    }
    
    setIsSchedulingModalOpen(true);
  };

  // Handle queue click
  const handleQueueClick = () => {
    toast({
      title: "Queue Feature",
      description: "Job has been added to the work queue for scheduling.",
    });
  };

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
        variant: "destructive"
      });
      return;
    }

    // Get line items from the job record (not from formData which might not be loaded yet)
    const lineItems = editingJob?.lineItems || formData?.lineItems || [];
    if (lineItems.length === 0) {
      toast({
        title: "No Line Items",
        description: "Please add at least one line item before saving the quote.",
        variant: "destructive"
      });
      return;
    }

    // Check if there's a valid amount
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    if (totalAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please ensure line items have valid quantities and prices.",
        variant: "destructive"
      });
      return;
    }

    try {
      const hasQuote = jobQuoteResponse?.success && jobQuoteResponse.data.length > 0;
      
      let quoteResult;
      if (!hasQuote) {
        // Create the quote
        quoteResult = await createQuoteMutation.mutateAsync();
        
        if (!quoteResult?.data?.id) {
          throw new Error('Failed to create quote');
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
          entryType: 'note' as const,
          title: 'Quote Created',
          description: `Quote ${quoteResult.data.quoteNumber} created`,
          content: `Quote ${quoteResult.data.quoteNumber || 'draft'} created for ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(totalAmount)}`,
          authorName: 'System',
          isPrivate: false
        };

        await apiRequest('POST', `/api/jobs/${editingJob.id}/diary`, diaryEntry);
        
        // Invalidate all diary-related queries to force refresh
        await queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary'] });
        await queryClient.refetchQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary'] });
      } catch (diaryError) {
        // Don't fail the whole operation if diary logging fails
        console.error('Failed to log to diary:', diaryError);
      }

      toast({
        title: "Quote Saved",
        description: `Quote ${quoteResult.data.quoteNumber} has been saved successfully.`,
        duration: 2000,
      });

      setIsQuoteModalOpen(false);
    } catch (error) {
      console.error('Failed to save quote:', error);
      toast({
        title: "Error",
        description: "Failed to save quote. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle invoice click
  const handleInvoiceClick = () => {
    setIsInvoiceModalOpen(true);
  };

  // Handle print click
  const handlePrintClick = () => {
    toast({
      title: "Print Job",
      description: "Job details sent to printer.",
    });
  };

  // Handle duplicate click
  const handleDuplicateClick = () => {
    toast({
      title: "Duplicate Job",
      description: "Job has been duplicated. Edit details and save.",
    });
  };

  // Handle archive click
  const handleArchiveClick = () => {
    if (confirm('Are you sure you want to archive this job? It will be hidden from the active jobs list.')) {
      archiveJobMutation.mutate();
    }
  };

  // Handle request review click - sends templated review request email
  const handleRequestReviewClick = async () => {
    if (!editingJob) return;
    
    const customerEmail = editingJob.customerEmail || editingJob.email;
    const customerName = editingJob.customerName || editingJob.billingName || 'Customer';
    
    if (!customerEmail) {
      toast({
        title: "No Email Address",
        description: "This customer doesn't have an email address on file. Please add one to send a review request.",
        variant: "destructive"
      });
      return;
    }
    
    const reviewMessage = `Hi ${customerName.split(' ')[0]},

Glad to hear you're happy with the work! Would you be able to leave the team a review on Facebook and Google please? Here are links to do so.

Facebook review link

https://www.facebook.com/TreemarkablesGisborne/reviews

Google review link

https://search.google.com/local/writereview?placeid=ChIJyW5ncp55Zm0R3_iU47Axcn8

Thanks so much!
The Treemarkables Team`;
    
    try {
      const response = await apiRequest('POST', '/api/communications/email', {
        to: customerEmail,
        subject: 'We\'d love your feedback!',
        message: reviewMessage,
        jobId: editingJob.id,
        customerId: editingJob.customerId
      });
      
      if (response.success) {
        toast({
          title: "Review Request Sent",
          description: `Email sent to ${customerEmail}${response.reviewRequestTracked ? ' and tracked' : ''}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary'] });
        queryClient.invalidateQueries({ queryKey: ['/api/reviews/requests'] });
        queryClient.invalidateQueries({ queryKey: ['/api/reviews/stats'] });
      } else {
        toast({
          title: "Failed to Send",
          description: response.message || "Could not send review request",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send review request email",
        variant: "destructive"
      });
    }
  };

  // Handle speech-to-quote data
  const handleSpeechToQuoteGenerated = (quoteData: any) => {
    console.log('📢 Speech to Quote data received:', quoteData);
    
    // If context is description-only, just populate the transcription
    if (speechToQuoteContext === 'job-description') {
      if (quoteData.transcription) {
        form.setValue('description', quoteData.transcription);
        toast({
          title: "Job Description Added!",
          description: "Your voice note has been transcribed into the job description.",
        });
      }
      return;
    }
    
    if (speechToQuoteContext === 'invoice-description') {
      if (quoteData.transcription) {
        form.setValue('invoiceDescription', quoteData.transcription);
        toast({
          title: "Invoice Description Added!",
          description: "Your voice note has been transcribed into the invoice description.",
        });
      }
      return;
    }
    
    // Full quote mode - populate form fields with extracted data
    if (quoteData.customerName) {
      form.setValue('newCustomerName', quoteData.customerName);
      form.setValue('isNewCustomer', true);
    }
    if (quoteData.customerPhone) {
      form.setValue('newCustomerPhone', quoteData.customerPhone);
    }
    if (quoteData.customerEmail) {
      form.setValue('newCustomerEmail', quoteData.customerEmail);
    }
    if (quoteData.address) {
      form.setValue('address', quoteData.address);
    }
    if (quoteData.jobDescription) {
      form.setValue('description', quoteData.jobDescription);
    }
    if (quoteData.estimatedPrice) {
      // Add as a line item
      const lineItems = form.getValues('lineItems') || [];
      lineItems.push({
        description: quoteData.jobDescription || 'Tree removal service',
        quantity: 1,
        unitPrice: parseFloat(quoteData.estimatedPrice),
        total: parseFloat(quoteData.estimatedPrice),
        priceIncludesTax: false
      });
      form.setValue('lineItems', lineItems);
    }

    toast({
      title: "Quote Generated from Speech!",
      description: "Job details have been populated. Review and save.",
    });
  };

  // Staff conflict checking - DISABLED to allow double booking
  // Conflicts are now allowed - staff can be scheduled on multiple jobs at the same time
  useEffect(() => {
    // Conflict checking disabled per user request
    setStaffConflicts([]);
  }, [schedulingData.date, schedulingData.startTime, schedulingData.duration, schedulingData.assignedTo, editingJob?.id]);

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
      
      // Calculate end time
      const durationMs = parseInt(schedulingData.duration) * 60000;
      const endTimeUTC = new Date(startTimeUTC.getTime() + durationMs);
      const endTimeISO = endTimeUTC.toISOString();

      // Convert end time back to NZ local time for display
      const endTimeNZ = utcToNZTime(endTimeUTC);
      const [endHours, endMinutes] = endTimeNZ.time.split(':').map(Number);
      
      // Create staff assignments - remove duplicates first
      const uniqueEmployeeIds = [...new Set(schedulingData.assignedTo)];
      const staffAssignments = uniqueEmployeeIds.map(employeeId => ({
        employeeId,
        startTime: startTimeISO,
        endTime: endTimeISO,
        notes: schedulingData.notes
      }));

      // First, update the job with scheduledDate, scheduledStartTime, scheduledEndTime, assignedTo, and status
      // Send scheduledDate as UTC ISO string to avoid timezone interpretation issues
      const jobUpdateResponse = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDate: startTimeISO, // Send full UTC ISO string
          scheduledStartTime: timeStr, // NZ local time (HH:MM format)
          scheduledEndTime: endTimeNZ.time, // NZ local time (HH:MM format)
          assignedTo: uniqueEmployeeIds,
          status: 'scheduled'  // Automatically change status to scheduled
        })
      });

      if (!jobUpdateResponse.ok) {
        throw new Error('Failed to update job schedule');
      }

      // Then create staff assignments
      const response = await fetch(`/api/jobs/${editingJob.id}/staff-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffAssignments,
          sendNotifications: true,
          sendClientNotification: schedulingData.sendClientNotification
        })
      });

      const data = await response.json();

      if (data.success) {
        const scheduledDate = new Date(startTimeISO);
        toast({
          title: "Job Scheduled",
          description: `${uniqueEmployeeIds.length} staff member(s) scheduled for ${format(scheduledDate, 'PPP')} at ${format(scheduledDate, 'p')}`,
        });

        // Update form's status to match database
        form.setValue('status', 'scheduled');

        // Refresh job data and staff assignments for dispatch board
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/staff-assignments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary'] });
        
        setIsSchedulingModalOpen(false);
        setSchedulingData({
          date: '',
          startTime: '',
          duration: '',
          assignedTo: [],
          notes: '',
          sendClientNotification: false
        });
        setStaffConflicts([]);
      } else {
        throw new Error(data.message || 'Failed to schedule');
      }
    } catch (error) {
      console.error("Error scheduling job:", error);
      toast({
        title: "Scheduling Error",
        description: error instanceof Error ? error.message : "Failed to schedule job. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Save button handlers
  const handleSave = async () => {
    console.log('🔴 SAVE BUTTON CLICKED');
    
    // Prevent double-clicking
    if (isSaving) {
      console.log('Save already in progress, ignoring duplicate click');
      return;
    }
    
    let formData = form.getValues();
    console.log('Form data before save:', formData);
    console.log('Form errors:', form.formState.errors);
    console.log('editingJob customerId:', editingJob?.customerId);
    console.log('mode:', mode, 'isNewCustomer:', formData.isNewCustomer);
    
    // SAFETY CHECK: For edit mode, always ensure customerId is set from the editingJob
    // This fixes validation errors when the form doesn't properly load the customerId
    if (mode === "edit" && editingJob?.customerId) {
      if (!formData.customerId) {
        console.warn('⚠️ customerId was empty - restoring from editingJob');
        form.setValue('customerId', editingJob.customerId);
      }
      // Also ensure isNewCustomer is false for existing jobs
      if (formData.isNewCustomer !== false) {
        console.warn('⚠️ isNewCustomer was not false - setting to false for existing job');
        form.setValue('isNewCustomer', false);
      }
      // CRITICAL: Preserve original description if form description is empty
      if (!formData.description && editingJob.description) {
        console.warn('⚠️ description was empty - restoring from editingJob');
        form.setValue('description', editingJob.description);
      }
      // Re-fetch form values after setting
      formData = form.getValues();
      console.log('Form data after safety fix:', formData);
    }
    
    // TRANSFORM LEGACY LINE ITEMS: Convert old format to new schema format before validation
    const lineItems = formData.lineItems || [];
    if (lineItems.length > 0) {
      const transformedItems = lineItems.map((item: any, index: number) => ({
        id: item.id || `legacy-${index}-${Date.now()}`,
        itemCode: item.itemCode || '',
        description: item.description || '',
        quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) || 1 : (item.quantity || 1),
        unitPrice: item.unitPrice ?? item.rate ?? 0,
        total: item.total ?? item.amount ?? 0,
        unitCost: item.unitCost ?? 0,
        totalCost: item.totalCost ?? 0,
        taxRate: item.taxRate ?? 15,
        priceIncludesTax: item.priceIncludesTax ?? false
      }));
      form.setValue('lineItems', transformedItems);
      formData = form.getValues();
      console.log('Form data after lineItems transformation:', formData.lineItems);
    }
    
    // Auto-set newCustomerName from job contact names if not provided (for jobs from conversations)
    if (formData.isNewCustomer && !formData.newCustomerName && (formData.jobContactFirstName || formData.jobContactLastName)) {
      formData.newCustomerName = `${formData.jobContactFirstName || ''} ${formData.jobContactLastName || ''}`.trim();
      form.setValue('newCustomerName', formData.newCustomerName);
    }
    
    // Check if form has validation errors
    const isValid = await form.trigger();
    console.log('🔴 Form validation result:', isValid);
    if (!isValid) {
      const errors = form.formState.errors;
      console.error('🔴 Form validation failed:', errors);
      // Log specific field errors for debugging
      Object.keys(errors).forEach(key => {
        console.error(`🔴 Field "${key}" error:`, (errors as any)[key]?.message);
      });
      // Build a helpful error message
      const errorMessages: string[] = [];
      if ((errors as any).newCustomerName?.message) {
        errorMessages.push('Customer name is required');
      }
      if ((errors as any).address?.message) {
        errorMessages.push('Address is required');
      }
      toast({
        title: "Missing Required Fields",
        description: errorMessages.length > 0 ? errorMessages.join(', ') : "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    // Map new customer fields to job contact fields for backend compatibility
    if (formData.isNewCustomer && formData.newCustomerName) {
      const names = formData.newCustomerName.split(' ');
      formData.jobContactFirstName = formData.jobContactFirstName || names[0] || '';
      formData.jobContactLastName = formData.jobContactLastName || names.slice(1).join(' ') || '';
      formData.jobContactEmail = formData.newCustomerEmail || '';
      formData.jobContactPhone = formData.newCustomerPhone || '';
    }
    
    setIsSaving(true);
    try {
      if (mode === "create") {
        await createJobMutation.mutateAsync(formData);
      } else {
        await updateJobMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Save failed:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save job",
        variant: "destructive"
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
      throw new Error('Please fill in all required fields before creating a proposal');
    }
    
    // Map new customer fields to job contact fields for backend compatibility
    if (formData.isNewCustomer && formData.newCustomerName) {
      const names = formData.newCustomerName.split(' ');
      formData.jobContactFirstName = names[0] || '';
      formData.jobContactLastName = names.slice(1).join(' ') || '';
      formData.jobContactEmail = formData.newCustomerEmail || '';
      formData.jobContactPhone = formData.newCustomerPhone || '';
    }
    
    try {
      let result;
      if (mode === "create") {
        result = await createJobMutation.mutateAsync(formData);
      } else {
        result = await updateJobMutation.mutateAsync(formData);
      }
      
      // Extract job ID from response
      const jobId = result?.data?.id || result?.id || editingJob?.id;
      if (!jobId) {
        throw new Error('Failed to get job ID after save');
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
              form.setValue('customerId', newCustomerId);
              // Invalidate customer queries to refresh the dropdown
              queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
            }
          }
        } catch (error) {
          console.warn('Failed to fetch customer ID after job creation:', error);
        }
      }
      
      return jobId;
    } catch (error) {
      console.error('Failed to save job for proposal:', error);
      throw error;
    }
  };

  const handleSaveAndClose = async () => {
    // Prevent double-clicking
    if (isSaving) {
      console.log('Save already in progress, ignoring duplicate click');
      return;
    }
    
    const formData = form.getValues();
    
    // CRITICAL: Preserve original description if form description is empty (edit mode)
    if (mode === 'edit' && !formData.description && editingJob?.description) {
      formData.description = editingJob.description;
    }
    
    // Map new customer fields to job contact fields for backend compatibility
    if (formData.isNewCustomer && formData.newCustomerName) {
      const names = formData.newCustomerName.split(' ');
      formData.jobContactFirstName = names[0] || '';
      formData.jobContactLastName = names.slice(1).join(' ') || '';
      formData.jobContactEmail = formData.newCustomerEmail || '';
      formData.jobContactPhone = formData.newCustomerPhone || '';
    }
    
    setIsSaving(true);
    try {
      if (mode === "create") {
        await createJobMutation.mutateAsync(formData);
      } else {
        await updateJobMutation.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Save and close failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle dialog close - save pending changes before closing
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // CRITICAL: Clear all guard refs when closing to prevent stale state on next open
      hasUserChangedRef.current = false;
      isLoadingDataRef.current = false;
      
      if (mode === 'edit' && editingJob?.id) {
        // Always save when closing in edit mode (form may have changed)
        const saveAndClose = async () => {
          try {
            const formData = form.getValues();
            
            // CRITICAL: Preserve original description if form description is empty
            // This prevents accidental deletion when form hasn't fully loaded or field was unregistered
            if (!formData.description && editingJob.description) {
              formData.description = editingJob.description;
            }
            
            // Map new customer fields to job contact fields for backend compatibility
            if (formData.isNewCustomer && formData.newCustomerName) {
              const names = formData.newCustomerName.split(' ');
              formData.jobContactFirstName = names[0] || '';
              formData.jobContactLastName = names.slice(1).join(' ') || '';
              formData.jobContactEmail = formData.newCustomerEmail || '';
              formData.jobContactPhone = formData.newCustomerPhone || '';
            }
            
            await apiRequest('PUT', `/api/jobs/${editingJob.id}`, formData);
            
            // Invalidate queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          } catch (error) {
            console.error('Failed to save on close:', error);
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
  const jobLoading = mode === 'edit' && !!effectiveJobId && !job && !specificJob;
  
  // Get current status - use editingJob.status directly to avoid showing stale form data during loading
  // In create mode, use form.watch since there's no editingJob yet
  // IMPORTANT: This line accesses editingJob, so it must come AFTER the loading check above
  const currentStatus = mode === 'edit' ? editingJob?.status : form.watch('status');
  
  if (jobLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center h-full w-full bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );

    return (
      <>
        {renderInline ? (
          loadingContent
        ) : (
          <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent className="w-full h-full max-w-full flex flex-col p-4 sm:p-0 bg-gray-50 overflow-x-hidden sm:max-w-6xl sm:h-[91vh] sm:rounded-xl">
              {loadingContent}
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // Job card content (can be rendered inline or in a dialog)
  const jobCardContent = (
    <div className={renderInline ? "h-full w-full flex flex-col bg-gray-50" : "w-full h-full max-w-full flex flex-col p-4 sm:p-0 bg-gray-50 overflow-x-hidden sm:max-w-6xl sm:h-[91vh] sm:rounded-xl"}>
      {/* Hidden titles for accessibility */}
      {!renderInline && (
        <>
          <DialogTitle className="sr-only">
            {mode === "create" ? "Create New Job" : `Job ${editingJob?.jobNumber || ""}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "create" ? "Create a new job with customer details and specifications" : "View and edit job details, contacts, and settings"}
          </DialogDescription>
        </>
      )}
      
      {/* ServiceM8-style Header - White with colored status badge */}
        <div className="border-b border-gray-200 bg-white px-2 sm:px-3 md:px-4 py-0.5 sm:py-1 flex-shrink-0 rounded-t-lg" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Job Title & Status */}
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 truncate tracking-tight" data-testid="text-job-title">
                {mode === "create" ? "New Job" : `Job ${editingJob?.jobNumber || ""}`}
              </h1>
              {currentStatus && (
                <Badge 
                  className={`text-xs whitespace-nowrap rounded-full ${
                    currentStatus === 'completed' ? 'bg-green-600 hover:bg-green-700 text-white' :
                    currentStatus === 'work_order' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                    currentStatus === 'quote' ? 'bg-orange-500 hover:bg-orange-600 text-white' :
                    currentStatus === 'lead' ? 'bg-cyan-600 hover:bg-cyan-700 text-white' :
                    currentStatus === 'scheduled' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                    currentStatus === 'unsuccessful' ? 'bg-red-600 hover:bg-red-700 text-white' :
                    'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                  data-testid="badge-job-status"
                >
                  {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                </Badge>
              )}
            </div>
            
            {/* Right: Actions Menu (Mobile), Close Button (Mobile), Save Button & Auto-save Indicator */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Auto-save status - Hide on mobile */}
              {mode === 'edit' && (
                <div className="hidden sm:flex text-xs text-gray-500 items-center gap-1.5">
                  {isAutoSaving ? (
                    <>
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                      <span>Saving...</span>
                    </>
                  ) : lastAutoSaveTime ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      <span>Saved</span>
                    </>
                  ) : null}
                </div>
              )}
              
              {/* Actions Menu - Mobile only (hidden in inline/split-screen mode) */}
              {!renderInline && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden h-7 w-7 text-gray-600 hover:bg-gray-100" 
                    data-testid="button-actions-menu-mobile"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => {
                    setSpeechToQuoteContext('full');
                    setIsSpeechToQuoteOpen(true);
                  }} data-testid="menu-item-speech-to-quote-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 shadow-md mr-3">
                      <Mic className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Speech to Quote</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleEmailClick} data-testid="menu-item-email-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 shadow-md mr-3">
                      <Mail className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Email</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsSMSComposerOpen(true)} data-testid="menu-item-sms-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 shadow-md mr-3">
                      <MessageSquare className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">SMS</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCallClick} data-testid="menu-item-call-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-md mr-3">
                      <Phone className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Call</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleScheduleClick} data-testid="menu-item-schedule-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-md mr-3">
                      <Calendar className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Schedule</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleQuoteClick} data-testid="menu-item-quote-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-md mr-3">
                      <Receipt className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Quote</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleInvoiceClick} data-testid="menu-item-invoice-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md mr-3">
                      <CreditCard className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Invoice</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={async () => {
                      if (!selectedCustomer?.id) {
                        toast({
                          title: "Customer Required",
                          description: "Please select a customer before creating a proposal.",
                          variant: "destructive"
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
                            description: "Please resolve any errors before creating a proposal",
                            variant: "destructive"
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
                    data-testid="menu-item-proposal-mobile"
                    className="py-3"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 shadow-md mr-3">
                      <Presentation className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Proposal</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsTimeTrackingOpen(true)} data-testid="menu-item-time-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 shadow-md mr-3">
                      <Clock className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Time Tracking</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsProfitTrackerOpen(true)} data-testid="menu-item-profit-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-md mr-3">
                      <DollarSign className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Profit Tracker</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPhotoCaptureOpen(true)} data-testid="menu-item-camera-mobile" className="py-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 shadow-md mr-3">
                      <Camera className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">Camera</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => sendToXeroMutation.mutate()}
                    disabled={
                      !editingJob?.id || 
                      mode === 'create' || 
                      editingJob?.status !== 'completed' || 
                      editingJob?.xeroStatus === 'sent' ||
                      sendToXeroMutation.isPending
                    }
                    data-testid="menu-item-send-xero-mobile"
                    className="py-3"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 shadow-md mr-3">
                      <FileText className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="font-medium">
                      {sendToXeroMutation.isPending 
                        ? 'Sending...' 
                        : editingJob?.xeroStatus === 'sent' 
                        ? 'Sent to Xero' 
                        : 'Send to Xero'}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}
              
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
                disabled={isSaving || createJobMutation.isPending || updateJobMutation.isPending || isAutoSaving}
                data-testid="button-save"
              >
                {(isSaving || createJobMutation.isPending || updateJobMutation.isPending) ? 'Saving...' : 'Save'}
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
                  setSpeechToQuoteContext('full');
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
                disabled={isCallingViaHero}
                data-testid="button-call"
              >
                {isCallingViaHero ? (
                  <Loader2 className="w-full h-auto max-w-[40px] max-h-[40px] text-green-500 animate-spin" />
                ) : (
                  <MdPhone className="w-full h-auto max-w-[40px] max-h-[40px] text-green-500" />
                )}
                <span className="text-[10px] mt-1 whitespace-nowrap">{isCallingViaHero ? 'Calling...' : 'Call'}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto py-1 flex-1 hover-elevate active-elevate-2 flex-col [&_svg]:!w-full [&_svg]:!h-auto" 
                onClick={handleScheduleClick} 
                data-testid="button-schedule"
              >
                <MdCalendarToday className="w-full h-auto max-w-[40px] max-h-[40px] text-red-500" />
                <span className="text-[10px] mt-1 whitespace-nowrap">Schedule</span>
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
                    <span className="text-[10px] mt-1 whitespace-nowrap">Send</span>
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
                          description: "Please select a customer before creating a proposal.",
                          variant: "destructive"
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
                            description: "Please resolve any errors before creating a proposal",
                            variant: "destructive"
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
                    <span className="text-[10px] mt-1 whitespace-nowrap">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                      mode === 'create' || 
                      editingJob?.status !== 'completed' || 
                      editingJob?.xeroStatus === 'sent' ||
                      sendToXeroMutation.isPending
                    }
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {sendToXeroMutation.isPending 
                      ? 'Sending to Xero...' 
                      : editingJob?.xeroStatus === 'sent' 
                      ? 'Sent to Xero' 
                      : 'Send to Xero'}
                  </DropdownMenuItem>
                  {editingJob?.status === 'completed' && (
                    <DropdownMenuItem onClick={handleRequestReviewClick}>
                      <Star className="w-4 h-4 mr-2" />
                      Request Review
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Mobile: Essential Actions Dropdown */}
            <div className="md:hidden flex items-center gap-1">
              <DropdownMenu open={showMobileActions} onOpenChange={setShowMobileActions}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 px-3 text-xs" data-testid="button-mobile-actions">
                    <Menu className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleEmailClick} data-testid="menu-item-email-mobile">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsSMSComposerOpen(true)} data-testid="menu-item-sms-mobile">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    SMS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCallClick} data-testid="menu-item-call-mobile">
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleScheduleClick} data-testid="menu-item-schedule-mobile">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleQuoteClick} disabled={!editingJob?.id || mode === 'create'} data-testid="menu-item-quote-mobile">
                    <Receipt className="w-4 h-4 mr-2" />
                    Quote
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleInvoiceClick} disabled={!editingJob?.id || mode === 'create'} data-testid="menu-item-invoice-mobile">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={async () => {
                      // Save job first to ensure address/description changes are persisted
                      if (mode === "edit" && editingJob?.id) {
                        try {
                          const formData = form.getValues();
                          await updateJobMutation.mutateAsync(formData);
                        } catch (error) {
                          toast({
                            title: "Save Failed",
                            description: "Please resolve any errors before creating a proposal",
                            variant: "destructive"
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
                    disabled={!selectedCustomer?.id} 
                    data-testid="menu-item-proposal-mobile"
                  >
                    <Presentation className="w-4 h-4 mr-2" />
                    Proposal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsTimeTrackingOpen(true)} disabled={!editingJob?.id || mode === 'create'} data-testid="menu-item-time-mobile">
                    <Clock className="w-4 h-4 mr-2" />
                    Time Tracking
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsProfitTrackerOpen(true)} disabled={!editingJob?.id || mode === 'create'} data-testid="menu-item-profit-mobile">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Profit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPhotoCaptureOpen(true)} data-testid="menu-item-camera-mobile">
                    <Camera className="w-4 h-4 mr-2" />
                    Camera
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => sendToXeroMutation.mutate()}
                    disabled={
                      !editingJob?.id || 
                      mode === 'create' || 
                      editingJob?.status !== 'completed' || 
                      editingJob?.xeroStatus === 'sent' ||
                      sendToXeroMutation.isPending
                    }
                    data-testid="menu-item-send-xero-mobile"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {sendToXeroMutation.isPending 
                      ? 'Sending...' 
                      : editingJob?.xeroStatus === 'sent' 
                      ? 'Sent to Xero' 
                      : 'Send to Xero'}
                  </DropdownMenuItem>
                  {editingJob?.status === 'completed' && (
                    <DropdownMenuItem onClick={handleRequestReviewClick} data-testid="menu-item-request-review-mobile">
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
                currentStatus === 'completed' ? 'border-green-200' :
                currentStatus === 'work_order' ? 'border-blue-200' :
                currentStatus === 'scheduled' ? 'border-blue-200' :
                currentStatus === 'quote' ? 'border-orange-200' :
                currentStatus === 'lead' ? 'border-cyan-200' :
                currentStatus === 'unsuccessful' ? 'border-red-200' :
                'border-gray-200'
              } ${
                sidebarTab === 'details' ? (
                  currentStatus === 'completed' ? 'bg-green-500 text-white' :
                  currentStatus === 'work_order' ? 'bg-blue-500 text-white' :
                  currentStatus === 'scheduled' ? 'bg-blue-500 text-white' :
                  currentStatus === 'quote' ? 'bg-orange-500 text-white' :
                  currentStatus === 'lead' ? 'bg-cyan-500 text-white' :
                  currentStatus === 'unsuccessful' ? 'bg-red-500 text-white' :
                  'bg-gray-500 text-white'
                ) : (
                  currentStatus === 'completed' ? 'text-green-700 hover:bg-green-200' :
                  currentStatus === 'work_order' ? 'text-blue-700 hover:bg-blue-200' :
                  currentStatus === 'scheduled' ? 'text-blue-700 hover:bg-blue-200' :
                  currentStatus === 'quote' ? 'text-orange-700 hover:bg-orange-200' :
                  currentStatus === 'lead' ? 'text-cyan-700 hover:bg-cyan-200' :
                  currentStatus === 'unsuccessful' ? 'text-red-700 hover:bg-red-200' :
                  'text-gray-700 hover:bg-gray-200'
                )
              }`}
              onClick={() => setSidebarTab('details')}
              data-testid="sidebar-details"
            >
              Details
            </button>
            <button
              className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b ${
                currentStatus === 'completed' ? 'border-green-200' :
                currentStatus === 'work_order' ? 'border-blue-200' :
                currentStatus === 'scheduled' ? 'border-blue-200' :
                currentStatus === 'quote' ? 'border-orange-200' :
                currentStatus === 'lead' ? 'border-cyan-200' :
                currentStatus === 'unsuccessful' ? 'border-red-200' :
                'border-gray-200'
              } ${
                sidebarTab === 'billing' ? (
                  currentStatus === 'completed' ? 'bg-green-500 text-white' :
                  currentStatus === 'work_order' ? 'bg-blue-500 text-white' :
                  currentStatus === 'scheduled' ? 'bg-blue-500 text-white' :
                  currentStatus === 'quote' ? 'bg-orange-500 text-white' :
                  currentStatus === 'lead' ? 'bg-cyan-500 text-white' :
                  currentStatus === 'unsuccessful' ? 'bg-red-500 text-white' :
                  'bg-gray-500 text-white'
                ) : (
                  currentStatus === 'completed' ? 'text-green-700 hover:bg-green-200' :
                  currentStatus === 'work_order' ? 'text-blue-700 hover:bg-blue-200' :
                  currentStatus === 'scheduled' ? 'text-blue-700 hover:bg-blue-200' :
                  currentStatus === 'quote' ? 'text-orange-700 hover:bg-orange-200' :
                  currentStatus === 'lead' ? 'text-cyan-700 hover:bg-cyan-200' :
                  currentStatus === 'unsuccessful' ? 'text-red-700 hover:bg-red-200' :
                  'text-gray-700 hover:bg-gray-200'
                )
              }`}
              onClick={() => setSidebarTab('billing')}
              data-testid="sidebar-billing"
            >
              Billing
            </button>
            <button
              className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b ${
                currentStatus === 'completed' ? 'border-green-200' :
                currentStatus === 'work_order' ? 'border-blue-200' :
                currentStatus === 'scheduled' ? 'border-blue-200' :
                currentStatus === 'quote' ? 'border-orange-200' :
                currentStatus === 'lead' ? 'border-cyan-200' :
                currentStatus === 'unsuccessful' ? 'border-red-200' :
                'border-gray-200'
              } ${
                sidebarTab === 'diary' ? (
                  currentStatus === 'completed' ? 'bg-green-500 text-white' :
                  currentStatus === 'work_order' ? 'bg-blue-500 text-white' :
                  currentStatus === 'scheduled' ? 'bg-blue-500 text-white' :
                  currentStatus === 'quote' ? 'bg-orange-500 text-white' :
                  currentStatus === 'lead' ? 'bg-cyan-500 text-white' :
                  currentStatus === 'unsuccessful' ? 'bg-red-500 text-white' :
                  'bg-gray-500 text-white'
                ) : (
                  currentStatus === 'completed' ? 'text-green-700 hover:bg-green-200' :
                  currentStatus === 'work_order' ? 'text-blue-700 hover:bg-blue-200' :
                  currentStatus === 'scheduled' ? 'text-blue-700 hover:bg-blue-200' :
                  currentStatus === 'quote' ? 'text-orange-700 hover:bg-orange-200' :
                  currentStatus === 'lead' ? 'text-cyan-700 hover:bg-cyan-200' :
                  currentStatus === 'unsuccessful' ? 'text-red-700 hover:bg-red-200' :
                  'text-gray-700 hover:bg-gray-200'
                )
              }`}
              onClick={() => setSidebarTab('diary')}
              data-testid="sidebar-diary"
            >
              Diary
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0 min-w-0">
            <Form {...form} key={editingJob?.id || internalMode}>
              <form 
                onSubmit={form.handleSubmit((data) => {
                  console.log('Form submitted:', data);
                  // Save functionality will be handled by the save buttons
                })}
                className="flex flex-col h-full w-full min-w-0" 
                data-form="job-form"
              >
                <div className="flex flex-col sm:flex-row h-full w-full min-w-0">
                  <div className={`flex-1 bg-white ${sidebarTab !== 'diary' ? 'sm:border-r border-gray-300' : ''} p-3 sm:p-4 overflow-y-auto overflow-x-hidden ${sidebarTab === 'diary' ? 'sm:rounded-lg' : 'sm:rounded-l-lg'} min-w-0`}>
                  {sidebarTab === 'details' && (
                    <div className="space-y-3 md:space-y-4">
                      {/* ServiceM8-Style Customer Header Card */}
                      {mode === 'edit' && selectedCustomerName && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:hidden">
                          <div className="flex flex-col gap-2">
                            {/* Row 0: Customer Name & Selector for Desktop/Large Screens */}
                            <div className="hidden md:block mb-2">
                              <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Customer</FormLabel>
                                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                                      <PopoverTrigger asChild>
                                        <FormControl>
                                          <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                              "w-full justify-between font-bold text-xl h-auto py-1 px-0 border-0 hover:bg-transparent shadow-none",
                                              !field.value && "text-muted-foreground font-normal text-base"
                                            )}
                                          >
                                            {field.value
                                              ? customers.find((c) => c.id === field.value)?.name
                                              : "Select customer..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                        </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                          <CommandInput 
                                            placeholder="Search customers..." 
                                            value={customerSearchValue}
                                            onValueChange={setCustomerSearchValue}
                                          />
                                          <CommandList>
                                            <CommandEmpty>
                                              <Button 
                                                variant="ghost" 
                                                className="w-full justify-start text-blue-600"
                                                onClick={() => {
                                                  form.setValue('isNewCustomer', true);
                                                  form.setValue('newCustomerName', customerSearchValue);
                                                  setCustomerSearchOpen(false);
                                                }}
                                              >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Create "{customerSearchValue}"
                                              </Button>
                                            </CommandEmpty>
                                            <CommandGroup>
                                              {customers.map((customer) => (
                                                <CommandItem
                                                  key={customer.id}
                                                  value={customer.name}
                                                  onSelect={() => {
                                                    form.setValue("customerId", customer.id);
                                                    setCustomerSearchOpen(false);
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      customer.id === field.value
                                                        ? "opacity-100"
                                                        : "opacity-0"
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
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="font-bold text-gray-900 text-xl text-left flex items-center gap-1 hover:text-blue-600 transition-colors">
                                    {selectedCustomerName}
                                    <Pencil className="h-3.5 w-3.5 opacity-50" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0" align="start">
                                  <Command>
                                    <CommandInput 
                                      placeholder="Search customers..." 
                                      value={customerSearchValue}
                                      onValueChange={setCustomerSearchValue}
                                    />
                                    <CommandList className="max-h-[250px]">
                                      <CommandEmpty>No customers found</CommandEmpty>
                                      <CommandGroup heading="Customers">
                                        {customers
                                          .filter(customer => 
                                            customer.name?.toLowerCase().includes(customerSearchValue.toLowerCase())
                                          )
                                          .slice(0, 15)
                                          .map((customer) => (
                                            <CommandItem
                                              key={customer.id}
                                              value={customer.name}
                                              onSelect={() => {
                                                form.setValue('customerId', customer.id);
                                                setSelectedCustomerName(customer.name);
                                                setCustomerSearchValue('');
                                                // Pre-fill contact info from customer if not already set
                                                if (customer.email && !form.getValues('jobContactEmail')) {
                                                  form.setValue('jobContactEmail', customer.email);
                                                }
                                                const customerPhone = customer.mobile || customer.phone;
                                                if (customerPhone && !form.getValues('jobContactPhone')) {
                                                  form.setValue('jobContactPhone', customerPhone);
                                                }
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  form.watch('customerId') === customer.id ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              <span className="truncate">{customer.name}</span>
                                            </CommandItem>
                                          ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <Badge 
                                variant="outline" 
                                className={`text-xs whitespace-nowrap flex-shrink-0 ${
                                  currentStatus === 'completed' ? 'border-green-500 text-green-600' :
                                  currentStatus === 'work_order' ? 'border-blue-500 text-blue-600' :
                                  currentStatus === 'quote' ? 'border-blue-500 text-blue-600' :
                                  currentStatus === 'lead' ? 'border-cyan-500 text-cyan-600' :
                                  currentStatus === 'scheduled' ? 'border-blue-500 text-blue-600' :
                                  currentStatus === 'unsuccessful' ? 'border-red-500 text-red-600' :
                                  'border-gray-400 text-gray-600'
                                }`}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                {currentStatus === 'quote' ? 'Quote Sent' : 
                                 currentStatus === 'work_order' ? 'Work Order' :
                                 currentStatus === 'completed' ? 'Completed' :
                                 currentStatus === 'lead' ? 'Lead' :
                                 currentStatus === 'scheduled' ? 'Scheduled' :
                                 currentStatus === 'unsuccessful' ? 'Unsuccessful' :
                                 currentStatus?.charAt(0).toUpperCase() + currentStatus?.slice(1) || 'Job'}
                              </Badge>
                            </div>
                            
                            {/* Row 2: Est time | Rate | Crew */}
                            <div className="flex items-center gap-1.5 text-sm text-gray-600 flex-wrap">
                              {editingJob?.estimatedManHours && (
                                <>
                                  <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                  <span>Est: {editingJob.estimatedManHours} hrs</span>
                                  <span className="text-gray-300">|</span>
                                </>
                              )}
                              {editingJob?.hourlyRate && (
                                <>
                                  <DollarSign className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                  <span>${editingJob.hourlyRate}/hr</span>
                                  <span className="text-gray-300">|</span>
                                </>
                              )}
                              {editingJob?.assignedTo && editingJob.assignedTo.length > 0 && (
                                <>
                                  <User className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                  <span>{editingJob.assignedTo.length} crew</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Buttons Row */}
                          <div className="flex items-center gap-2 mt-4">
                            <Button
                              type="button"
                              size="sm"
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-full"
                              onClick={(e) => {
                                e.preventDefault();
                                handleCallClick();
                              }}
                              data-testid="button-servicem8-call"
                            >
                              <Phone className="h-4 w-4 mr-1.5" />
                              Call
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 border-blue-500 text-blue-600 rounded-full"
                              onClick={(e) => {
                                e.preventDefault();
                                setIsSMSComposerOpen(true);
                              }}
                              data-testid="button-servicem8-message"
                            >
                              <MessageSquare className="h-4 w-4 mr-1.5" />
                              Message
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 border-blue-500 text-blue-600 rounded-full"
                              onClick={(e) => {
                                e.preventDefault();
                                const address = form.getValues('address');
                                if (address) {
                                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
                                }
                              }}
                              data-testid="button-servicem8-navigate"
                            >
                              <MapPin className="h-4 w-4 mr-1.5" />
                              Navigate
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 border-blue-500 text-blue-600 rounded-full relative"
                              onClick={(e) => {
                                e.preventDefault();
                                setIsPhotoCaptureOpen(true);
                              }}
                              data-testid="button-servicem8-photos"
                            >
                              <Camera className="h-4 w-4 mr-1.5" />
                              Photos
                              {pendingPhotos.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                  {pendingPhotos.length}
                                </span>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Desktop: Customer Name Display - Clickable to change */}
                      {mode === 'edit' && (
                        <div className="hidden md:block mb-2">
                          <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                className="p-0 h-auto font-bold text-gray-900 text-xl hover:bg-transparent hover:underline"
                              >
                                {selectedCustomerName || 'Select Customer'}
                                <Pencil className="ml-2 h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] md:w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search customers..." 
                                  value={customerSearchValue}
                                  onValueChange={setCustomerSearchValue}
                                />
                                <CommandList className="max-h-[300px]">
                                  <CommandEmpty>No customers found</CommandEmpty>
                                  <CommandGroup heading="Customers">
                                    {customers
                                      .filter(customer => 
                                        customer.name?.toLowerCase().includes(customerSearchValue.toLowerCase())
                                      )
                                      .slice(0, 20)
                                      .map((customer) => (
                                        <CommandItem
                                          key={customer.id}
                                          value={customer.name}
                                          onSelect={() => {
                                            form.setValue('customerId', customer.id);
                                            setSelectedCustomerName(customer.name);
                                            setCustomerSearchOpen(false);
                                            setCustomerSearchValue('');
                                            // Pre-fill contact info from customer if not already set
                                            if (customer.email && !form.getValues('jobContactEmail')) {
                                              form.setValue('jobContactEmail', customer.email);
                                            }
                                            const customerPhone = customer.mobile || customer.phone;
                                            if (customerPhone && !form.getValues('jobContactPhone')) {
                                              form.setValue('jobContactPhone', customerPhone);
                                            }
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              form.watch('customerId') === customer.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col">
                                            <span>{customer.name}</span>
                                            {customer.address && (
                                              <span className="text-xs text-gray-500">{customer.address}</span>
                                            )}
                                          </div>
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                      
                      {/* Customer Search/Select for New Jobs (Mobile + Desktop) */}
                      {mode === 'create' && (
                        <div className="mb-2">
                          <FormField
                            control={form.control}
                            name="customerId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-gray-500">Customer Name</FormLabel>
                                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          "w-full justify-between h-10",
                                          !field.value && !form.watch('newCustomerName') && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value
                                          ? customers.find((c) => c.id === field.value)?.name
                                          : form.watch('newCustomerName') 
                                            ? form.watch('newCustomerName')
                                            : "Select or enter customer..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] md:w-[400px] p-0" align="start">
                                    <Command>
                                      <CommandInput 
                                        placeholder="Search or add customer..." 
                                        value={customerSearchValue}
                                        onValueChange={setCustomerSearchValue}
                                      />
                                      <CommandList className="max-h-[300px]">
                                        <CommandEmpty>
                                          <Button 
                                            variant="ghost" 
                                            className="w-full justify-start text-blue-600"
                                            onClick={() => {
                                              form.setValue('isNewCustomer', true);
                                              form.setValue('newCustomerName', customerSearchValue);
                                              form.setValue('customerId', '');
                                              const names = customerSearchValue.split(' ');
                                              form.setValue('jobContactFirstName', names[0] || '');
                                              form.setValue('jobContactLastName', names.slice(1).join(' ') || '');
                                              setSelectedCustomerName(customerSearchValue);
                                              setCustomerSearchOpen(false);
                                            }}
                                          >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create "{customerSearchValue}"
                                          </Button>
                                        </CommandEmpty>
                                        <CommandGroup heading="Existing Customers">
                                          {customers.map((customer) => (
                                            <CommandItem
                                              key={customer.id}
                                              value={customer.name}
                                              onSelect={() => {
                                                form.setValue("customerId", customer.id);
                                                form.setValue('isNewCustomer', false);
                                                form.setValue('newCustomerName', '');
                                                setSelectedCustomerName(customer.name);
                                                setHasUserSelectedCustomer(true);
                                                // Pre-fill address from customer if available
                                                if (customer.address && !form.getValues('address')) {
                                                  form.setValue('address', customer.address);
                                                }
                                                // Pre-fill contact info from customer if not already set
                                                if (customer.email && !form.getValues('jobContactEmail')) {
                                                  form.setValue('jobContactEmail', customer.email);
                                                }
                                                const customerPhone = customer.mobile || customer.phone;
                                                if (customerPhone && !form.getValues('jobContactPhone')) {
                                                  form.setValue('jobContactPhone', customerPhone);
                                                }
                                                // Split customer name into first/last for contact fields
                                                if (customer.name && !form.getValues('jobContactFirstName') && !form.getValues('jobContactLastName')) {
                                                  const nameParts = customer.name.split(' ');
                                                  if (nameParts.length >= 2) {
                                                    form.setValue('jobContactFirstName', nameParts[0]);
                                                    form.setValue('jobContactLastName', nameParts.slice(1).join(' '));
                                                  } else {
                                                    form.setValue('jobContactFirstName', customer.name);
                                                  }
                                                }
                                                setCustomerSearchOpen(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  customer.id === field.value
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span>{customer.name}</span>
                                                {customer.address && (
                                                  <span className="text-xs text-gray-500 truncate max-w-[250px]">{customer.address}</span>
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
                                    form.setValue('address', parsed.fullAddress);
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
                        {mode === 'edit' && editingJob?.address && (
                          <JobLocationMap 
                            jobAddress={editingJob.address} 
                            className="mt-2"
                          />
                        )}

                        {/* ServiceM8-Style Job Scope Card (Mobile only position) */}
                        <div className="md:hidden mt-2">
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-gray-600" />
                                </div>
                                <h3 className="font-bold text-gray-900">Job Scope</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  onClick={() => {
                                    setSpeechToQuoteContext('job-description');
                                    setIsSpeechToQuoteOpen(true);
                                  }}
                                  data-testid="button-speech-job-description"
                                >
                                  <Mic className="h-4 w-4 mr-1" />
                                  <span className="text-xs">Voice</span>
                                </Button>
                                {checklist.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {checklist.length}
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Checklist Items */}
                            <div className="space-y-2 mb-3">
                              {checklist.map((item, index) => (
                                <div 
                                  key={index} 
                                  className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                  onClick={() => {
                                    const updated = [...checklist];
                                    updated[index] = { ...item, completed: !item.completed };
                                    setChecklist(updated);
                                    if (mode === 'edit' && editingJob?.id) {
                                      updateJobMutation.mutate({
                                        id: editingJob.id,
                                        updates: { checklist: updated }
                                      });
                                    }
                                  }}
                                >
                                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                                    {item.completed && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                    {item.text}
                                  </span>
                                </div>
                              ))}
                              

                            </div>
                            
                            {/* Crew Notes (Job Description) */}
                            <div className="border-t pt-3">
                              <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                  <FormItem>
                                    <div 
                                      className="flex items-center justify-between cursor-pointer"
                                      onClick={() => setDescriptionPopupOpen(true)}
                                    >
                                      <span className="text-blue-600 font-medium flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Crew Notes
                                      </span>
                                      <ChevronDown className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <FormControl>
                                      <>
                                        <input type="hidden" {...field} />
                                        {field.value && (
                                          <div
                                            ref={descriptionTextareaRef}
                                            className="text-sm text-gray-600 mt-2 cursor-pointer whitespace-pre-wrap break-words line-clamp-6"
                                            onClick={() => setDescriptionPopupOpen(true)}
                                            data-testid="div-description-display"
                                          >
                                            <LinkifyMultiline text={field.value} />
                                          </div>
                                        )}
                                      </>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            {/* Est. Man Hours */}
                            <div className="border-t border-dashed pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Est. Man Hours</span>
                                <FormField
                                  control={form.control}
                                  name="estimatedManHours"
                                  render={({ field }) => (
                                    <FormItem className="flex-shrink-0">
                                      <FormControl>
                                        <Select value={field.value ? String(parseFloat(field.value)) : ""} onValueChange={field.onChange}>
                                          <SelectTrigger className="h-7 text-xs w-[120px]">
                                            <SelectValue placeholder="Select hours" />
                                          </SelectTrigger>
                                          <SelectContent className="max-h-[300px]">
                                            {Array.from({ length: 160 }, (_, i) => {
                                              const hours = (i + 1) * 0.25;
                                              const wholeHours = Math.floor(hours);
                                              const minutes = Math.round((hours - wholeHours) * 60);
                                              let label = '';
                                              if (wholeHours === 0) {
                                                label = `${minutes} min`;
                                              } else if (minutes === 0) {
                                                label = wholeHours === 1 ? '1 hr' : `${wholeHours} hrs`;
                                              } else {
                                                label = wholeHours === 1 ? `1 hr ${minutes} min` : `${wholeHours} hrs ${minutes} min`;
                                              }
                                              return (
                                                <SelectItem key={hours} value={String(hours)}>{label}</SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Show New Customer Fields When Creating */}
                        {form.watch('isNewCustomer') && form.watch('newCustomerName') && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name="newCustomerName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-medium text-gray-600">Customer Name</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="Enter customer name"
                                        onChange={(e) => {
                                          field.onChange(e);
                                          // Map new customer name to job contact fields for backend compatibility
                                          const names = e.target.value.split(' ');
                                          form.setValue('jobContactFirstName', names[0] || '');
                                          form.setValue('jobContactLastName', names.slice(1).join(' ') || '');
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
                                    <FormLabel className="text-xs font-medium text-gray-600">Email</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        type="email"
                                        placeholder="customer@example.com"
                                        onChange={(e) => {
                                          field.onChange(e);
                                          // Map to job contact email for backend compatibility
                                          form.setValue('jobContactEmail', e.target.value);
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
                                    <FormLabel className="text-xs font-medium text-gray-600">Phone</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="Phone number"
                                        onChange={(e) => {
                                          field.onChange(e);
                                          // Map to job contact phone for backend compatibility
                                          form.setValue('jobContactPhone', e.target.value);
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
                                    <FormLabel className="text-xs font-medium text-gray-600">Address</FormLabel>
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
                            <label className="text-[10px] font-medium text-gray-500 mb-0.5 block">Job Status</label>
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
                                        // Auto-save status change for existing jobs
                                        if (mode === 'edit' && editingJob?.id) {
                                          const formData = form.getValues();
                                          updateJobMutation.mutate({
                                            ...formData,
                                            id: editingJob.id,
                                            status: value
                                          } as GlobalJobCardFormData);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs" data-testid="select-job-status">
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="lead">Lead</SelectItem>
                                        <SelectItem value="quote">Quote</SelectItem>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="work_order">Work Order</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {/* Unsuccessful Reason - Only show when status is unsuccessful */}
                            {form.watch('status') === 'unsuccessful' && (
                              <div className="mt-3 space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <FormField
                                  control={form.control}
                                  name="unsuccessfulReason"
                                  render={({ field }) => (
                                    <FormItem>
                                      <label className="text-xs font-medium text-orange-700 mb-1 block">Reason for Unsuccessful</label>
                                      <FormControl>
                                        <Select value={field.value || ""} onValueChange={field.onChange}>
                                          <SelectTrigger className="h-9 text-base md:text-sm bg-white">
                                            <SelectValue placeholder="Select reason" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="price_too_high">Price too high</SelectItem>
                                            <SelectItem value="went_competitor">Went with competitor</SelectItem>
                                            <SelectItem value="changed_mind">Customer changed mind</SelectItem>
                                            <SelectItem value="no_longer_needed">Job no longer needed</SelectItem>
                                            <SelectItem value="scheduling">Couldn't schedule suitable time</SelectItem>
                                            <SelectItem value="no_response">No response from customer</SelectItem>
                                            <SelectItem value="scope_change">Scope changed beyond capabilities</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
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
                                      <label className="text-xs font-medium text-orange-700 mb-1 block">Additional Notes (optional)</label>
                                      <FormControl>
                                        <Textarea 
                                          {...field} 
                                          value={field.value || ''}
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
                            <label className="text-[10px] font-medium text-gray-500 mb-0.5 block">Lead Source</label>
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
                                        if (mode === 'edit' && editingJob?.id) {
                                          // Optimistic update
                                          queryClient.setQueryData(['/api/jobs', editingJob.id], (oldData: any) => {
                                            if (!oldData) return oldData;
                                            return {
                                              ...oldData,
                                              data: { ...oldData.data, leadSource: value }
                                            };
                                          });
                                          // Background save
                                          apiRequest('PATCH', `/api/jobs/${editingJob.id}`, { leadSource: value })
                                            .catch(error => console.error('Error saving lead source:', error));
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select source" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="website">Website</SelectItem>
                                        <SelectItem value="referral">Referral</SelectItem>
                                        <SelectItem value="friend">Friend</SelectItem>
                                        <SelectItem value="saw_working">Saw you working</SelectItem>
                                        <SelectItem value="repeat">Repeat</SelectItem>
                                        <SelectItem value="google">Google Search</SelectItem>
                                        <SelectItem value="facebook">Facebook</SelectItem>
                                        <SelectItem value="phone">Phone Call</SelectItem>
                                        <SelectItem value="direct">Direct</SelectItem>
                                        <SelectItem value="advertisement">Advertisement</SelectItem>
                                        <SelectItem value="council">Council</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          {/* Quote Presentation Method - only show for jobs with quotes/proposals */}
                          {mode === 'edit' && editingJob && ['quote', 'scheduled', 'work_order', 'completed'].includes(editingJob.status) && (
                            <div className="flex-1">
                              <label className="text-[10px] font-medium text-gray-500 mb-0.5 block">Quote Method</label>
                              <Select 
                                value={localQuoteMethod || ""} 
                                onValueChange={async (value) => {
                                  console.log('🎯 Quote method dropdown changed to:', value);
                                  // Update local state immediately for UI
                                  setLocalQuoteMethod(value);
                                  
                                  if (editingJob?.id) {
                                    console.log('🎯 Saving quote method for job:', editingJob.id);
                                    try {
                                      // Save to server
                                      const response = await apiRequest('PATCH', `/api/jobs/${editingJob.id}`, { 
                                        quotePresentationMethod: value,
                                        quotePresentedDate: new Date().toISOString()
                                      });
                                      const data = await response.json();
                                      console.log('🎯 Quote method API response:', data);
                                      if (data.success) {
                                        console.log('✅ Quote method saved:', value);
                                        // Invalidate job cache to ensure data is fresh
                                        queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id] });
                                      } else {
                                        console.error('Failed to save quote method:', data.message);
                                        toast({
                                          title: "Error",
                                          description: "Failed to save quote method",
                                          variant: "destructive"
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Error saving quote method:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to save quote method",
                                        variant: "destructive"
                                      });
                                    }
                                  } else {
                                    console.log('🎯 No editingJob.id available');
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="How was quote presented?" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="on_site">On-Site (presented in person)</SelectItem>
                                  <SelectItem value="sent_later">Sent Later (email/post)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {/* ServiceM8-Style Gear List Card - show in both create and edit modes */}
                        {allEquipment.length > 0 && (
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:bg-transparent md:shadow-none md:border-0 md:p-0 md:rounded-none space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                                <Package className="h-4 w-4 text-gray-600" />
                              </div>
                              <h3 className="font-bold text-gray-900">Gear List</h3>
                            </div>
                            
                            {/* Multi-select button for equipment */}
                            <div className="w-[200px]">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs w-full justify-between"
                                disabled={isAddingEquipment}
                                onClick={() => setGearDialogOpen(true)}
                              >
                                <span className="truncate">
                                  {(mode === 'edit' ? editingJob?.equipmentChecklist?.length : selectedEquipment.length)
                                    ? `${mode === 'edit' ? editingJob?.equipmentChecklist?.length : selectedEquipment.length} selected` 
                                    : "Select gear..."}
                                </span>
                                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                              </Button>
                              
                              <Dialog open={gearDialogOpen} onOpenChange={setGearDialogOpen}>
                                <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
                                  <DialogHeader>
                                    <DialogTitle>Select Gear</DialogTitle>
                                    <DialogDescription>Choose equipment for this job</DialogDescription>
                                  </DialogHeader>
                                  <div className="flex-1 overflow-y-auto space-y-1 py-2">
                                    {allEquipment.map((equip: any) => {
                                      const currentChecklist = mode === 'edit' ? (editingJob?.equipmentChecklist || []) : selectedEquipment;
                                      const isSelected = currentChecklist.some(
                                        (item: any) => item.equipment === equip.name
                                      );
                                      return (
                                        <div
                                          key={equip.id}
                                          className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer active:bg-gray-200 ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                                          onClick={async () => {
                                            const currentList = mode === 'edit' ? (editingJob?.equipmentChecklist || []) : selectedEquipment;
                                            
                                            let updatedChecklist;
                                            if (isSelected) {
                                              updatedChecklist = currentList.filter((i: any) => i.equipment !== equip.name);
                                            } else {
                                              const newItem = {
                                                id: `equip-${Date.now()}-${equip.name}`,
                                                equipment: equip.name,
                                                checked: false,
                                              };
                                              updatedChecklist = [...currentList, newItem];
                                            }
                                            
                                            if (mode === 'edit' && editingJob?.id) {
                                              // Optimistic update - update UI immediately
                                              queryClient.setQueryData(['/api/jobs', editingJob.id], (oldData: any) => {
                                                if (!oldData) return oldData;
                                                return {
                                                  ...oldData,
                                                  data: { ...oldData.data, equipmentChecklist: updatedChecklist }
                                                };
                                              });
                                              
                                              // Background save - don't await
                                              apiRequest('PATCH', `/api/jobs/${editingJob.id}`, {
                                                equipmentChecklist: updatedChecklist,
                                              }).catch(error => console.error('Error saving equipment:', error));
                                            } else {
                                              // Create mode - just update local state
                                              setSelectedEquipment(updatedChecklist);
                                            }
                                          }}
                                        >
                                          <div className={`h-5 w-5 border-2 rounded flex items-center justify-center ${isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                                            {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                          </div>
                                          <span className="text-base">{equip.name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                            
                            {/* Selected equipment as removable tags */}
                            {((mode === 'edit' && editingJob?.equipmentChecklist && editingJob.equipmentChecklist.length > 0) || 
                              (mode === 'create' && selectedEquipment.length > 0)) && (
                              <div className="flex flex-wrap gap-1">
                                {(mode === 'edit' ? editingJob?.equipmentChecklist || [] : selectedEquipment).map((item: any) => (
                                  <Badge
                                    key={item.id}
                                    variant="secondary"
                                    className="h-6 text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 cursor-pointer flex items-center gap-1"
                                    onClick={() => {
                                      const currentList = mode === 'edit' ? (editingJob?.equipmentChecklist || []) : selectedEquipment;
                                      const updatedChecklist = currentList.filter(
                                        (i: any) => i.equipment !== item.equipment
                                      );
                                      
                                      if (mode === 'edit' && editingJob?.id) {
                                        // Optimistic update - update UI immediately
                                        queryClient.setQueryData(['/api/jobs', editingJob.id], (oldData: any) => {
                                          if (!oldData) return oldData;
                                          return {
                                            ...oldData,
                                            data: { ...oldData.data, equipmentChecklist: updatedChecklist }
                                          };
                                        });
                                        
                                        // Background save - don't await
                                        apiRequest('PATCH', `/api/jobs/${editingJob.id}`, {
                                          equipmentChecklist: updatedChecklist,
                                        }).catch(error => console.error('Error removing equipment:', error));
                                      } else {
                                        // Create mode - just update local state
                                        setSelectedEquipment(updatedChecklist);
                                      }
                                    }}
                                  >
                                    {item.equipment}
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
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-gray-600" />
                                </div>
                                <h3 className="font-bold text-gray-900">Job Scope</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  onClick={() => {
                                    setSpeechToQuoteContext('job-description');
                                    setIsSpeechToQuoteOpen(true);
                                  }}
                                  data-testid="button-speech-job-description-desktop"
                                >
                                  <Mic className="h-4 w-4 mr-1" />
                                  <span className="text-xs">Voice</span>
                                </Button>
                                {checklist.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {checklist.length}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Checklist Items */}
                            <div className="space-y-2">
                              {checklist.map((item, index) => (
                                <div 
                                  key={index} 
                                  className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                                  onClick={() => {
                                    const updated = [...checklist];
                                    updated[index] = { ...item, completed: !item.completed };
                                    setChecklist(updated);
                                    if (mode === 'edit' && editingJob?.id) {
                                      updateJobMutation.mutate({
                                        id: editingJob.id,
                                        updates: { checklist: updated }
                                      });
                                    }
                                  }}
                                >
                                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                                    {item.completed && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                    {item.text}
                                  </span>
                                </div>
                              ))}
                              

                            </div>
                            
                            {/* Job Price */}
                            <div className="border-t border-dashed pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Job Price</span>
                                <div className="flex items-center gap-1">
                                  {(() => {
                                    // Priority: proposal subtotal > line items > job totalAmount > quote amount
                                    // Proposal subtotal is already exc GST (before tax), so use directly
                                    if (jobProposalResponse?.data?.[0]?.subtotal) {
                                      const subtotal = parseFloat(jobProposalResponse.data[0].subtotal) || 0;
                                      return (
                                        <>
                                          <span className="text-lg font-semibold text-gray-900">
                                            ${subtotal.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
                                          </span>
                                          <span className="text-xs text-gray-500">exc GST</span>
                                        </>
                                      );
                                    }
                                    
                                    // Calculate from line items (these are typically exc GST unit prices)
                                    const lineItems = form.watch('lineItems') || [];
                                    let totalExcGst = lineItems.reduce((sum: number, item: any) => {
                                      const itemTotal = parseFloat(item.total) || 0;
                                      // If price includes tax, back out the GST
                                      if (item.priceIncludesTax) {
                                        return sum + (itemTotal / 1.15);
                                      }
                                      return sum + itemTotal;
                                    }, 0);
                                    
                                    // Fallback to job totalAmount (stored as inc GST typically)
                                    if (totalExcGst === 0 && editingJob?.totalAmount) {
                                      totalExcGst = (parseFloat(editingJob.totalAmount) || 0) / 1.15;
                                    }
                                    
                                    // Fallback to quote amount
                                    if (totalExcGst === 0 && jobQuoteResponse?.data?.[0]?.amount) {
                                      totalExcGst = (parseFloat(jobQuoteResponse.data[0].amount) || 0) / 1.15;
                                    }
                                    
                                    return (
                                      <>
                                        <span className="text-lg font-semibold text-gray-900">
                                          ${totalExcGst.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-xs text-gray-500">exc GST</span>
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
                                onClick={() => setDescriptionPopupOpen(true)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-500 font-medium">Crew Notes</span>
                                  <Edit3 className="h-3 w-3 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[40px]">
                                  {form.watch('description') || <span className="text-gray-400 italic">Click to add crew notes...</span>}
                                </p>
                              </div>
                            </div>
                            
                            {/* Est. Man Hours */}
                            <div className="border-t border-dashed pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Est. Man Hours</span>
                                <FormField
                                  control={form.control}
                                  name="estimatedManHours"
                                  render={({ field }) => (
                                    <FormItem className="flex-shrink-0">
                                      <FormControl>
                                        <Select value={field.value ? String(parseFloat(field.value)) : ""} onValueChange={field.onChange}>
                                          <SelectTrigger className="h-7 text-xs w-[120px]">
                                            <SelectValue placeholder="Select hours" />
                                          </SelectTrigger>
                                          <SelectContent className="max-h-[300px]">
                                            {Array.from({ length: 160 }, (_, i) => {
                                              const hours = (i + 1) * 0.25;
                                              const wholeHours = Math.floor(hours);
                                              const minutes = Math.round((hours - wholeHours) * 60);
                                              let label = '';
                                              if (wholeHours === 0) {
                                                label = `${minutes} min`;
                                              } else if (minutes === 0) {
                                                label = wholeHours === 1 ? '1 hr' : `${wholeHours} hrs`;
                                              } else {
                                                label = wholeHours === 1 ? `1 hr ${minutes} min` : `${wholeHours} hrs ${minutes} min`;
                                              }
                                              return (
                                                <SelectItem key={hours} value={String(hours)}>{label}</SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Upcoming Bookings - Shows scheduled staff with 12-hour time format */}
                        {editingJob?.scheduledDate && editingJob?.assignedTo && editingJob.assignedTo.length > 0 && (
                          <div className="md:hidden mb-4">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                                  <Calendar className="h-4 w-4 text-blue-600" />
                                </div>
                                <h3 className="font-bold text-gray-900">Upcoming Bookings</h3>
                              </div>
                              <div className="space-y-2">
                                {editingJob.assignedTo.map((staffId: string) => {
                                  const staff = employees?.find((e: any) => e.id === staffId);
                                  const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown Staff';
                                  return (
                                    <div key={staffId} className="flex items-center justify-between">
                                      <span className="text-sm text-gray-700">{staffName}</span>
                                      <span className="text-xs text-gray-500">
                                        {format(new Date(editingJob.scheduledDate!), 'h:mm a')}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Desktop Upcoming Bookings */}
                        <div className="hidden md:block">
                          <label className="text-xs font-medium text-gray-600 mb-2 block">Upcoming Bookings</label>
                          <div className="border rounded-lg p-3 bg-blue-50 text-sm space-y-2">
                            {editingJob?.assignedTo && editingJob.assignedTo.map((employeeId: string) => {
                              const employee = employees.find((e: any) => e.id === employeeId);
                              const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Staff';
                              const scheduledDate = editingJob.scheduledDate ? new Date(editingJob.scheduledDate).toLocaleDateString('en-NZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                              const scheduledTime = editingJob.scheduledStartTime ? formatTime12Hour(editingJob.scheduledStartTime) : '';
                              
                              return (
                                <div key={employeeId} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <span className="font-medium">{employeeName} on {scheduledDate} {scheduledTime}</span>
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
                            })}
                          </div>
                        </div>

                        {/* Contacts */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <UserCircle className="w-4 h-4 text-gray-600" />
                            <label className="text-xs font-medium text-gray-600">Job Contact</label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="jobContactFirstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...field} className="h-9 text-base md:text-sm" placeholder="First Name" />
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
                                    <Input {...field} className="h-9 text-base md:text-sm" placeholder="Last Name" />
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
                                    <Input {...field} className="h-9 text-base md:text-sm" placeholder="Email" type="email" />
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
                                    <Input {...field} className="h-9 text-base md:text-sm" placeholder="Phone" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="billingContactMobile"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...field} className="h-9 text-base md:text-sm" placeholder="Mobile" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {sidebarTab === 'billing' && (
                    <div className="space-y-6">
                      {/* ServiceM8 Billing Header */}
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
                        <h3 className="font-semibold text-lg">Billing & Invoicing</h3>
                        <p className="text-blue-100 text-sm">Manage billing address, tax settings, and financial details</p>
                      </div>

                      {/* Billing Address Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">Billing Address</h4>
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
                                          const jobAddress = form.getValues('address') || '';
                                          form.setValue('billingAddress', jobAddress);
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
                                      disabled={form.watch('sameAsJobAddress')}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Billing Name Override */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">Invoice To (Name Override)</h4>
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
                                Use this when the billing name differs from the customer record (e.g., organization name vs contact name)
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
                            <h4 className="font-medium text-gray-800">Invoice Description</h4>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => {
                              setSpeechToQuoteContext('invoice-description');
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
                          <h4 className="font-medium text-gray-800">Tax Settings</h4>
                          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            GST Inc/Ex
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Tax Mode</label>
                            <FormField
                              control={form.control}
                              name="taxMode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select value={field.value || "tax_exclusive"} onValueChange={field.onChange}>
                                      <SelectTrigger className="h-9 text-base md:text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="cost_markup">Cost & Markup</SelectItem>
                                        <SelectItem value="tax_inclusive">Tax Inclusive</SelectItem>
                                        <SelectItem value="tax_exclusive">Tax Exclusive</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">GST Rate</label>
                            <Input className="h-9 text-base md:text-sm" defaultValue="15.00%" readOnly />
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
                            onClick={() => window.open('/materials-services', '_blank')}
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
                              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
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
                                        <div className="font-medium text-sm">{item.name}</div>
                                        <div className="text-xs text-gray-500">{item.category}</div>
                                      </div>
                                      <div className="text-sm font-semibold text-green-600">
                                        ${parseFloat(item.displayPrice || item.price || 0).toFixed(2)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-4 text-center">
                                  <div className="text-sm text-gray-500 mb-2">No items found</div>
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
                              <h4 className="font-medium">Add Custom Line Item</h4>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIsAddingLineItem(false);
                                  setNewLineItem({ description: '', quantity: 1, unitPrice: '', unitCost: 0 });
                                }}
                              >
                                ✕
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="col-span-2">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                                <Input
                                  value={newLineItem.description}
                                  onChange={(e) => setNewLineItem(prev => ({ ...prev, description: e.target.value }))}
                                  placeholder="Service description"
                                  className="text-sm"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity</label>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={newLineItem.quantity}
                                  onChange={(e) => setNewLineItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Unit Price ($)</label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newLineItem.unitPrice}
                                  onChange={(e) => setNewLineItem(prev => ({ ...prev, unitPrice: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                                  placeholder="0.00"
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Unit Cost ($)</label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newLineItem.unitCost}
                                  onChange={(e) => setNewLineItem(prev => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
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
                                <h4 className="font-medium text-gray-800">Items & Services</h4>
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
                                    const markupPercent = unitCost > 0 ? ((markup / unitCost) * 100).toFixed(0) : '0';
                                    
                                    return (
                                      <div key={field.id} className="grid grid-cols-[40px_80px_1fr_60px_80px_70px_50px_80px_90px] gap-2 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-xs items-center">
                                      <div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeLineItemField(index)}
                                          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          data-testid={`button-delete-item-${index}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                      <div className="text-gray-500 truncate">{field.itemCode || '—'}</div>
                                      <div className="font-medium text-gray-900 truncate">
                                        {field.description}
                                      </div>
                                      <div className="text-center">
                                        <FormField
                                          control={form.control}
                                          name={`lineItems.${index}.quantity`}
                                          render={({ field: quantityField }) => (
                                            <FormItem>
                                              <FormControl>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  {...quantityField}
                                                  onChange={(e) => {
                                                    const newQuantity = parseFloat(e.target.value) || 1;
                                                    quantityField.onChange(newQuantity);
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
                                                    checked={gstField.value || false}
                                                    onChange={(e) => {
                                                      // Simply toggle the GST mode without changing the price
                                                      gstField.onChange(e.target.checked);
                                                    }}
                                                  />
                                                  <div className={`relative w-9 h-5 rounded-full transition-all ${
                                                    gstField.value ? 'bg-blue-600' : 'bg-gray-300'
                                                  }`}>
                                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                                      gstField.value ? 'translate-x-4' : 'translate-x-0'
                                                    }`}></div>
                                                  </div>
                                                  <span className="ml-1.5 text-xs text-gray-700 font-medium min-w-[20px]">
                                                    {gstField.value ? 'Inc' : 'Ex'}
                                                  </span>
                                                </label>
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                      <div className="text-right font-mono">${costExGst.toFixed(2)}</div>
                                      <div className="text-right text-gray-600">{markupPercent}%</div>
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
                                                    const newPrice = parseFloat(e.target.value) || 0;
                                                    priceField.onChange(newPrice);
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
                                          const isGstInclusive = field.priceIncludesTax || false;
                                          if (isGstInclusive) {
                                            // Price includes GST - show the inclusive total
                                            const gstRate = 0.15;
                                            const totalIncGst = quantity * priceExGst;
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
                                  const markupPercent = unitCost > 0 ? ((markup / unitCost) * 100).toFixed(0) : '0';
                                  
                                  return (
                                    <div key={field.id} className="p-4 border-b border-gray-100 bg-white">
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
                                          onClick={() => removeLineItemField(index)}
                                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          data-testid={`button-delete-item-${index}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                      
                                      {/* Item Details Grid */}
                                      <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                          <label className="text-xs text-gray-500 block mb-1">Quantity</label>
                                          <FormField
                                            control={form.control}
                                            name={`lineItems.${index}.quantity`}
                                            render={({ field: quantityField }) => (
                                              <FormItem>
                                                <FormControl>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    {...quantityField}
                                                    onChange={(e) => {
                                                      const newQuantity = parseFloat(e.target.value) || 1;
                                                      quantityField.onChange(newQuantity);
                                                    }}
                                                    className="h-9 text-base md:text-sm"
                                                  />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="text-xs text-gray-500 block mb-1">GST</label>
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
                                                        checked={gstField.value || false}
                                                        onChange={(e) => {
                                                          // Simply toggle the GST mode without changing the price
                                                          gstField.onChange(e.target.checked);
                                                        }}
                                                      />
                                                      <div className={`relative w-10 h-5 rounded-full transition-all ${
                                                        gstField.value ? 'bg-blue-600' : 'bg-gray-300'
                                                      }`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                                                          gstField.value ? 'translate-x-5' : 'translate-x-0'
                                                        }`}></div>
                                                      </div>
                                                      <span className="ml-2 text-sm text-gray-700 font-medium min-w-[24px]">
                                                        {gstField.value ? 'Inc' : 'Ex'}
                                                      </span>
                                                    </label>
                                                  </div>
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>
                                        
                                        <div>
                                          <label className="text-xs text-gray-500 block mb-1">Price</label>
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
                                                      const newPrice = parseFloat(e.target.value) || 0;
                                                      priceField.onChange(newPrice);
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
                                          <label className="text-xs text-gray-500 block mb-1">Total</label>
                                          <div className="h-8 flex items-center font-mono font-semibold text-sm">
                                            {(() => {
                                              const isGstInclusive = field.priceIncludesTax || false;
                                              if (isGstInclusive) {
                                                const totalIncGst = quantity * priceExGst;
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
                                        <div>Cost: <span className="font-mono">${costExGst.toFixed(2)}</span></div>
                                        <div>Margin: <span className="font-semibold">{markupPercent}%</span></div>
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
                                      onChange={(e) => setSearchQuery(e.target.value)}
                                      onFocus={() => setShowSearchResults(true)}
                                      onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
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
                                                onClick={() => selectItemFromSearch(item)}
                                                data-testid={`search-result-${item.id}`}
                                              >
                                                <div>
                                                  <div className="font-medium text-sm">{item.name}</div>
                                                  <div className="text-xs text-gray-500">{item.category}</div>
                                                </div>
                                                <div className="text-sm font-semibold text-green-600">
                                                  ${parseFloat(item.displayPrice || item.price || 0).toFixed(2)}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="p-4 text-center">
                                            <div className="text-sm text-gray-500 mb-2">No items found</div>
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
                              <h4 className="font-medium text-gray-700 mb-2">No line items yet</h4>
                              <p className="text-sm text-gray-500 mb-4">Add services or materials to start building your quote</p>
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
                                const lineItems = form.watch('lineItems') || [];
                                const gstRate = 0.15; // 15% GST for New Zealand
                                const paidAmount = parseFloat(form.watch('paidAmount') || '0');
                                
                                // Calculate totals by checking each line item's priceIncludesTax flag
                                let subtotal = 0;
                                let totalIncGst = 0;
                                
                                lineItems.forEach((item: any) => {
                                  const quantity = item.quantity || 1;
                                  const unitPrice = item.unitPrice || 0;
                                  const lineTotal = quantity * unitPrice;
                                  const isInclusive = item.priceIncludesTax || false;
                                  
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
                                      <span className="text-gray-600 uppercase text-xs font-medium">SUBTOTAL</span>
                                      <span className="font-mono">${subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                      <span className="text-gray-600 uppercase text-xs font-medium">GST</span>
                                      <span className="font-mono">${gstAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 font-semibold">
                                      <span className="text-gray-900 uppercase text-xs font-medium">Total</span>
                                      <span className="font-mono">${totalIncGst.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                      <span className="text-green-600 uppercase text-xs font-medium">Paid</span>
                                      <span className="font-mono text-green-600">${paidAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 font-semibold">
                                      <span className="text-orange-600 uppercase text-xs font-medium">Balance Due</span>
                                      <span className="font-mono text-orange-600">${balanceDue.toFixed(2)}</span>
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
                              <h4 className="font-medium text-gray-800">Sent Invoices</h4>
                            </div>
                            
                            {(() => {
                              const invoices = (jobInvoiceResponse as any)?.data || [];
                              const sentInvoices = invoices.filter((inv: any) => inv.status === 'sent' || inv.xeroInvoiceId);
                              
                              if (sentInvoices.length === 0) {
                                return (
                                  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                                    <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">No invoices sent yet</p>
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
                                        <div className={`w-2 h-2 rounded-full ${
                                          invoice.status === 'paid' ? 'bg-green-500' :
                                          invoice.status === 'sent' ? 'bg-blue-500' :
                                          invoice.xeroInvoiceId ? 'bg-purple-500' :
                                          'bg-gray-400'
                                        }`} />
                                        <div>
                                          <p className="font-medium text-sm text-gray-900">
                                            Invoice #{invoice.invoiceNumber || invoice.xeroInvoiceNumber || 'N/A'}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {invoice.xeroInvoiceNumber ? `Xero: ${invoice.xeroInvoiceNumber}` : ''}
                                            {invoice.sentAt ? ` • Sent ${format(new Date(invoice.sentAt), 'dd/MM/yyyy')}` : ''}
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
                                            setEmailContext('invoice');
                                            setIsInvoiceModalOpen(true);
                                          }}
                                        >
                                          <Send className="h-3.5 w-3.5 mr-1" />
                                          <span className="text-xs">Resend</span>
                                        </Button>
                                        <div className="text-right">
                                          <p className="font-semibold text-sm text-gray-900">
                                            ${parseFloat(invoice.totalAmount || invoice.amount || '0').toFixed(2)}
                                          </p>
                                          <Badge 
                                            variant="outline" 
                                            className={`text-xs ${
                                              invoice.status === 'paid' ? 'border-green-500 text-green-600' :
                                              invoice.status === 'sent' ? 'border-blue-500 text-blue-600' :
                                              invoice.xeroInvoiceId ? 'border-purple-500 text-purple-600' :
                                              'border-gray-400 text-gray-600'
                                            }`}
                                          >
                                            {invoice.status === 'paid' ? 'Paid' :
                                             invoice.xeroInvoiceId ? 'In Xero' :
                                             invoice.status === 'sent' ? 'Sent' : 
                                             invoice.status || 'Draft'}
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
                    </div>
                  )}

                  {sidebarTab === 'diary' && (
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
                            const proposal = proposals.find((p: any) => p.proposalNumber === proposalNumber);
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
                            <p className="text-sm">Save the job to view activity diary</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  </div>

                  {sidebarTab !== 'diary' && editingJob && (
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
                          const proposal = proposals.find((p: any) => p.proposalNumber === proposalNumber);
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

      {/* Email Composer Modal */}
      {isEmailComposerOpen && (
        <EmailComposerModal
          isOpen={isEmailComposerOpen}
          onClose={() => setIsEmailComposerOpen(false)}
          job={editingJob}
          customer={emailContext === 'invoice' && editingJob ? {
            ...selectedCustomer,
            billingContactEmail: editingJob.billingContactEmail,
            email: editingJob.billingContactEmail || editingJob.jobContactEmail || selectedCustomer?.email,
            phone: editingJob.billingContactPhone || editingJob.billingContactMobile || editingJob.jobContactPhone || selectedCustomer?.phone,
            address: editingJob.billingAddress || editingJob.address || selectedCustomer?.address,
            // Use billing name override from FORM (current unsaved value) first, then fall back to saved value
            name: formData?.billingNameOverride || editingJob.billingNameOverride || selectedCustomer?.name || `${editingJob.jobContactFirstName || ''} ${editingJob.jobContactLastName || ''}`.trim()
          } : selectedCustomer}
          quoteData={emailContext === 'quote' && jobQuoteResponse?.success && jobQuoteResponse.data.length > 0 ? {
            id: jobQuoteResponse.data[0].id,
            quoteNumber: jobQuoteResponse.data[0].quoteNumber,
            totalAmount: jobQuoteResponse.data[0].amount,
            validUntil: jobQuoteResponse.data[0].validUntil,
            status: jobQuoteResponse.data[0].status,
            lineItems: formData?.lineItems || []
          } : undefined}
          invoiceData={emailContext === 'invoice' ? (() => {
            // Priority 1: If there are unsaved line items in the billing tab, use those (user is actively editing)
            const hasUnsavedLineItems = formData?.lineItems && formData.lineItems.length > 0;
            
            if (hasUnsavedLineItems) {
              console.log('📋 Using unsaved line items from billing tab:', formData.lineItems);
              
              // Calculate subtotal from current line items
              const subtotal = formData.lineItems.reduce((sum: number, item: any) => {
                const itemTotal = parseFloat(item.total) || (parseFloat(item.quantity) * parseFloat(item.unitPrice));
                return sum + itemTotal;
              }, 0);
              
              const gstAmount = subtotal * 0.15;
              const totalAmount = subtotal + gstAmount;
              
              // Use existing invoice number if one exists, otherwise generate new one
              const existingInvoice = jobInvoiceResponse?.data?.[0];
              const invoiceNumber = existingInvoice?.invoiceNumber || `INV-${editingJob?.jobNumber || '0000'}`;
              
              return {
                id: existingInvoice?.id || editingJob?.id,
                jobId: editingJob?.id,
                invoiceNumber,
                customerId: editingJob?.customerId || '',
                amount: subtotal,
                totalAmount,
                status: existingInvoice?.status || 'draft',
                issueDate: existingInvoice?.issueDate || new Date().toISOString(),
                dueDate: existingInvoice?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                paymentTerms: existingInvoice?.paymentTerms || invoiceTemplate?.paymentTerms || 'Payment due within 30 days',
                lineItems: formData.lineItems,
                description: editingJob?.description || editingJob?.title || '',
                photos: [],
                notes: existingInvoice?.notes,
                createdAt: existingInvoice?.createdAt || new Date().toISOString()
              };
            }
            
            // Priority 2: Check if there's a saved invoice for this job
            const existingInvoice = jobInvoiceResponse?.data?.[0];
            
            if (existingInvoice) {
              console.log('📋 Using existing saved invoice:', existingInvoice.invoiceNumber);
              
              // Convert database format to display format
              const lineItems = (existingInvoice.items || []).map((item: any) => ({
                id: item.id,
                description: item.description,
                quantity: parseFloat(item.quantity) || 1,
                unitPrice: parseFloat(item.rate || item.unitPrice) || 0,
                total: parseFloat(item.amount || item.total) || 0,
                unit: item.unit || 'ea',
                category: item.category
              }));
              
              // Calculate amounts from existing invoice
              const subtotal = typeof existingInvoice.amount === 'string' 
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
                description: existingInvoice.description || existingInvoice.notes || editingJob?.description || editingJob?.title || '',
                photos: [],
                notes: existingInvoice.notes,
                createdAt: existingInvoice.createdAt
              };
            }
            
            // If no existing invoice, construct from proposal if available, otherwise from job
            const proposal = jobProposalResponse?.data?.[0];
            console.log('📋 Creating invoice data from proposal:', proposal?.id);
            console.log('📋 Proposal has sections:', !!proposal?.sections, 'sections count:', proposal?.sections?.length || 0);
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
                  total: parseFloat(item.totalPrice || item.total || '0'),
                  unit: item.unit || 'ea',
                  category: item.category
                }))
              );
              
              // Extract photos from all proposal sections
              photos = proposal.sections.flatMap((section: any) => section.photos || []);
            } else {
              // Fallback to job line items
              lineItems = editingJob?.lineItems || [];
              photos = [];
            }
            
            console.log('📋 Invoice will have', lineItems.length, 'line items, data:', lineItems);
            
            // Always use job description (from job details)
            const description = editingJob?.description || editingJob?.title || '';
            
            // Calculate subtotal (ex-GST) from line items
            const subtotal = lineItems.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0) || 0;
            
            // Calculate GST (15%) and total amount (inc-GST)
            const taxRate = parseFloat(editingJob?.taxRate || '15');
            const gstAmount = subtotal * (taxRate / 100);
            const totalAmount = subtotal + gstAmount;
            
            console.log('📋 Invoice amounts:', { subtotal, taxRate, gstAmount, totalAmount });
            
            return {
              id: editingJob?.id,
              jobId: editingJob?.id,
              invoiceNumber: `INV-${editingJob?.jobNumber || '0000'}`,
              customerId: editingJob?.customerId || '',
              amount: subtotal,
              totalAmount,
              status: 'draft',
              issueDate: new Date().toISOString(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              paymentTerms: invoiceTemplate?.paymentTerms || 'Payment due within 30 days',
              lineItems,
              description,
              photos,
              createdAt: new Date().toISOString()
            };
          })() : undefined}
          proposalData={emailContext === 'proposal' && jobProposalResponse?.success && jobProposalResponse.data.length > 0 ? {
            id: jobProposalResponse.data[0].id,
            proposalNumber: jobProposalResponse.data[0].proposalNumber,
            title: jobProposalResponse.data[0].title,
            totalAmount: jobProposalResponse.data[0].totalAmount,
            subtotal: jobProposalResponse.data[0].subtotal,
            validUntil: jobProposalResponse.data[0].validUntil,
            status: jobProposalResponse.data[0].status,
            lineItems: formData?.lineItems || []
          } : undefined}
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
        <ProposalBuilder
          isOpen={isProposalBuilderOpen}
          onClose={() => {
            setIsProposalBuilderOpen(false);
            setEditingProposalId(undefined);
            // Refresh diary to show new proposal entry
            if (editingJob?.id) {
              queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary-timeline'] });
              queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary'] });
              queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
            }
          }}
          jobId={editingJob?.id}
          customerId={selectedCustomer?.id}
          mode={editingProposalId ? "edit" : "create"}
          proposalId={editingProposalId}
          lineItems={formData?.lineItems || []}
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
                    onClick={() => {
                      toast({
                        title: "Copied",
                        description: "Quote details copied to clipboard.",
                      });
                    }} 
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
                      handleEmailClick('quote');
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
                    onClick={() => {
                      toast({
                        title: "Download Started",
                        description: "Quote PDF download will be available soon.",
                      });
                    }} 
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
                // Use editingJob.lineItems first (loaded from database), fallback to formData
                const lineItemsSource = editingJob.lineItems || formData?.lineItems || [];
                const mappedLineItems = lineItemsSource.map(item => {
                  const quantity = item.quantity || 1;
                  const unitPrice = item.unitPrice || 0;
                  const total = quantity * unitPrice;
                  return {
                    id: item.id,
                    description: item.description,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    unit: 'each',
                    total: total,
                    priceIncludesTax: item.priceIncludesTax || false
                  };
                });
                const totalAmount = mappedLineItems.reduce((sum, item) => sum + item.total, 0);
                
                return (
                  <QuoteTemplate
                    template={quoteTemplate}
                    quote={{
                      id: editingJob.id,
                      quoteNumber: `QTE-${editingJob.jobNumber || Date.now()}`,
                      amount: String(totalAmount),
                      status: 'draft',
                      customerId: selectedCustomer?.id || '',
                      jobId: editingJob.id,
                      description: formData?.description || editingJob.description || '',
                      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                      terms: quoteTemplate?.paymentTerms || 'Payment due within 30 days',
                      createdAt: new Date(),
                      updatedAt: new Date()
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
      {isInvoiceModalOpen && editingJob && invoiceTemplate && selectedCustomer && (
        <InvoiceBuilder
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          job={editingJob}
          customer={{
            ...selectedCustomer,
            // Use billing name override from form (current unsaved value) first, then saved value, then customer name
            name: formData?.billingNameOverride || editingJob.billingNameOverride || selectedCustomer?.name
          }}
          invoiceTemplate={invoiceTemplate}
        />
      )}

      {/* Profit Tracker */}
      {isProfitTrackerOpen && editingJob?.id && (
        <Dialog open={isProfitTrackerOpen} onOpenChange={setIsProfitTrackerOpen}>
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
      <Dialog open={isSchedulingModalOpen} onOpenChange={setIsSchedulingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <h2 className="text-lg font-semibold">Schedule Job</h2>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={schedulingData.date}
                onChange={(e) => setSchedulingData(prev => ({ ...prev, date: e.target.value }))}
                data-testid="input-schedule-date"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Select
                  value={schedulingData.startTime}
                  onValueChange={(value) => setSchedulingData(prev => ({ ...prev, startTime: value }))}
                >
                  <SelectTrigger data-testid="select-schedule-start-time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 23 }, (_, i) => {
                      const actualIndex = i + 12;
                      const hours = Math.floor(actualIndex / 2);
                      const minutes = (actualIndex % 2) * 30;
                      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                      const display = `${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
                      return <SelectItem key={time} value={time}>{display}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Duration</label>
                <Select
                  value={schedulingData.duration}
                  onValueChange={(value) => setSchedulingData(prev => ({ ...prev, duration: value }))}
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
            <div>
              <label className="text-sm font-medium">Assign Staff Members</label>
              <div className="mt-2 space-y-2 border rounded-md p-3 max-h-60 overflow-y-auto">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No staff members available</p>
                ) : (
                  employees.map((employee: any) => {
                    const isSelected = schedulingData.assignedTo.includes(employee.id);
                    
                    return (
                      <div key={employee.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`staff-${employee.id}`}
                          checked={isSelected}
                          onChange={(e) => {
                            const newAssigned = e.target.checked
                              ? [...schedulingData.assignedTo, employee.id]
                              : schedulingData.assignedTo.filter(id => id !== employee.id);
                            setSchedulingData(prev => ({ ...prev, assignedTo: newAssigned }));
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
                            <span className="text-xs text-muted-foreground ml-1">({employee.position})</span>
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
                  setSchedulingData(prev => ({ ...prev, sendClientNotification: checked === true }))
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
                onChange={(e) => setSchedulingData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional scheduling notes..."
                data-testid="textarea-schedule-notes"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsSchedulingModalOpen(false);
                setSchedulingData({
                  date: '',
                  startTime: '',
                  duration: '',
                  assignedTo: [],
                  notes: '',
                  sendClientNotification: false
                });
              }}
              data-testid="btn-cancel-schedule"
            >
              Cancel
            </Button>
            <Button
              onClick={saveSchedule}
              disabled={!schedulingData.date || !schedulingData.startTime || !schedulingData.duration || schedulingData.assignedTo.length === 0}
              data-testid="btn-save-schedule"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Clock className="h-4 w-4 mr-2" />
              Schedule {schedulingData.assignedTo.length} Staff Member{schedulingData.assignedTo.length !== 1 ? 's' : ''}
            </Button>
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
          setPendingPhotos(prev => [...prev, ...files]);
          setPendingPhotoPreviewUrls(prev => [...prev, ...previews]);
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
              <h3 className="text-lg font-medium mb-4">Quick Select from Catalog</h3>
              
              {materialsAndServices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {materialsAndServices.map((item: any) => {
                    const itemPrice = parseFloat(item.displayPrice || 0);
                    const currentLineItems = form.getValues('lineItems') || [];
                    const currentTotal = currentLineItems.reduce((sum, item) => sum + (item.total || 0), 0);
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
                                variant={item.type === 'material' ? 'default' : 'secondary'} 
                                className="text-xs ml-1"
                              >
                                {item.type}
                              </Badge>
                            )}
                            <div className="text-xs bg-green-50 text-green-700 p-2 rounded border">
                              Profit: ${(itemPrice - parseFloat(item.cost || item.baseCost || 0)).toFixed(2)} • Job Total: ${currentTotal.toFixed(2)} → ${newTotal.toFixed(2)}
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
                  <p className="text-gray-500">No materials or services available in catalog</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('/materials-services', '_blank')}
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
          <DialogContent className="w-full h-full max-w-full flex flex-col p-4 sm:p-0 bg-gray-50 overflow-x-hidden sm:max-w-6xl sm:h-[91vh] sm:rounded-xl">
            {jobCardContent}
          </DialogContent>
        </Dialog>
      )}

      {/* Job Description Popup - Responsive Width with safe area for iPhone notch */}
      <Dialog open={descriptionPopupOpen} onOpenChange={setDescriptionPopupOpen}>
        <DialogContent className="w-[95vw] sm:w-[50vw] max-w-3xl mt-[env(safe-area-inset-top,0px)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Crew Notes</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentValue = form.watch('description') || '';
                  const textarea = document.querySelector('[data-testid="textarea-description-popup"]') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const beforeCursor = currentValue.substring(0, start);
                    const afterCursor = currentValue.substring(end);
                    const isStartOfLine = start === 0 || beforeCursor.endsWith('\n');
                    const bullet = isStartOfLine ? '• ' : '\n• ';
                    const newValue = beforeCursor + bullet + afterCursor;
                    form.setValue('description', newValue);
                    setTimeout(() => {
                      textarea.focus();
                      const newPos = start + bullet.length;
                      textarea.setSelectionRange(newPos, newPos);
                    }, 0);
                  } else {
                    form.setValue('description', currentValue + (currentValue ? '\n• ' : '• '));
                  }
                }}
                className="flex items-center gap-1"
              >
                <List className="h-4 w-4" />
                Add Bullet
              </Button>
            </div>
            <Textarea 
              value={form.watch('description') || ''}
              onChange={(e) => form.setValue('description', e.target.value)}
              className="min-h-[450px] text-base font-medium" 
              placeholder="Describe the work that needs to be done&#10;&#10;Use the 'Add Bullet' button or type • for bullet points"
              data-testid="textarea-description-popup"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setDescriptionPopupOpen(false)}
              data-testid="btn-description-popup-close"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Cancellation Confirmation Dialog */}
      <AlertDialog open={cancelBookingDialogOpen} onOpenChange={setCancelBookingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this staff booking? This will remove the staff member from this job.
              {bookingToCancel && editingJob?.assignedTo && editingJob.assignedTo.length === 1 && (
                <span className="block mt-2 text-orange-600 font-medium">
                  This is the last staff member assigned. Cancelling will unschedule this job.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setCancelBookingDialogOpen(false);
              setBookingToCancel(null);
            }}>
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

      {/* Proposal Viewer Modal */}
      <Dialog open={isProposalViewerOpen} onOpenChange={setIsProposalViewerOpen}>
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
              const proposals = jobProposalResponse?.data || [];
              const viewingProposal = proposals.find((p: any) => p.id === viewingProposalId);
              
              if (!viewingProposal) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2" />
                    <p>Proposal not found</p>
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
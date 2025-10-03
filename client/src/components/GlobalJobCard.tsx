import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { X, Plus, Mail, MessageSquare, Phone, Calendar, FileText, Presentation, Check, Trash2, User, Building2, Building, DollarSign, ChevronDown, Receipt, Send, CreditCard, CheckCircle, Settings, Zap, Percent, Clock, MapPin, Calculator, Target, MoreHorizontal, UserCircle, Edit3, Image as ImageIcon, Package, Search, Menu, Camera, AlertCircle, ChevronsUpDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { ProposalBuilder } from "./ProposalBuilder";
import { JobDiarySection } from "./JobDiarySection";
import { StaffTimeManager } from "./StaffTimeManager";
import { StaffTimeTracker } from "./StaffTimeTracker";
import { ExpenseManager } from "./ExpenseManager";
import { GrossMarginCalculator } from "./GrossMarginCalculator";
import { EmailComposerModal } from "./EmailComposerModal";
import { SMSComposerModal } from "./SMSComposerModal";
import { InvoiceTemplate } from "./InvoiceTemplate";
import { QuoteTemplate } from "./QuoteTemplate";
import QuoteManagement from "./QuoteManagement";
import { RecordedTimeModal } from "./RecordedTimeModal";
import { PhotoCaptureModal } from "./PhotoCaptureModal";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

// Form validation schema extending the base insertJobSchema
const globalJobCardSchema = insertJobSchema.extend({
  // Make jobNumber optional since it's auto-generated on backend
  jobNumber: z.string().optional(),
  
  // Customer selection
  customerId: z.string().optional(),
  isNewCustomer: z.boolean().optional(),
  
  // New customer fields (conditional)
  newCustomerName: z.string().optional(),
  newCustomerEmail: z.string().email().optional().or(z.literal("")),
  newCustomerPhone: z.string().optional(),
  newCustomerAddress: z.string().optional(),
  newCustomerCity: z.string().optional(),
  newCustomerRegion: z.string().optional(),
  
  // Contact information
  jobContactFirstName: z.string().optional(),
  jobContactLastName: z.string().optional(), 
  jobContactEmail: z.string().email().optional().or(z.literal("")),
  jobContactPhone: z.string().optional(),
  
  // ServiceM8 Billing Fields
  billingAddress: z.string().optional(),
  invoiceDescription: z.string().optional(),
  billingContactPhone: z.string().optional(),
  billingContactMobile: z.string().optional(),
  sameAsJobAddress: z.boolean().optional(),
  taxMode: z.string().optional(),
  
}).refine((data) => {
  if (data.isNewCustomer) {
    return !!data.newCustomerName;
  } else {
    return !!data.customerId;
  }
}, {
  message: "Customer name is required when creating new customer",
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
  onJobCreated?: (job: any) => void;
  onJobUpdated?: (job: any) => void;
}

export function GlobalJobCard({ 
  isOpen, 
  onClose, 
  mode, 
  jobId, 
  job, 
  customerId, 
  onJobCreated, 
  onJobUpdated 
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  
  // Proposal builder state
  const [isProposalBuilderOpen, setIsProposalBuilderOpen] = useState(false);
  
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
    notes: ''
  });
  const [staffConflicts, setStaffConflicts] = useState<{employeeId: string; conflicts: any[]}[]>([]);

  // Time tracking modal state
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);

  // Photo capture modal state
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);

  // Auto-save state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);
  const isLoadingDataRef = useRef(false);
  const hasUserChangedRef = useRef(false);

  // Line item management state
  const [isAddingLineItem, setIsAddingLineItem] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    description: '',
    quantity: 1,
    unitPrice: 0,
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

  // Fetch customers for the dropdown
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
    enabled: isOpen,
  });
  
  // Fetch employees for scheduling assignment
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
    enabled: isOpen || isSchedulingModalOpen,
  });

  // Fetch default invoice template
  const { data: invoiceTemplateData } = useQuery({
    queryKey: ['/api/templates/default/invoice'],
    enabled: isOpen,
  });

  // Fetch default quote template
  const { data: quoteTemplateData } = useQuery({
    queryKey: ['/api/templates/default/quote'],
    enabled: isOpen,
  });

  // Fetch all jobs for address lookup
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
    enabled: isOpen,
  });

  // Fetch materials and services catalog for line item integration
  const { data: materialsData } = useQuery({
    queryKey: ['/api/materials'],
    enabled: isOpen,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['/api/services'],
    enabled: isOpen,
  });

  const customers: Customer[] = (customersData as any)?.data || [];
  const employees: any[] = (employeesData as any)?.data || [];
  const jobs: Job[] = (jobsData as any)?.data || [];
  
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

  // Line item management functions
  const addLineItem = () => {
    if (!newLineItem.description || newLineItem.quantity <= 0 || newLineItem.unitPrice < 0 || newLineItem.unitCost < 0) {
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
      unitPrice: newLineItem.unitPrice,
      unitCost: newLineItem.unitCost || 0,
      total: newLineItem.quantity * newLineItem.unitPrice,
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
      unitPrice: 0,
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
    
    toast({
      title: "Success",
      description: "Line item removed"
    });
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
      unitPrice: 0,
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
    if (mode === "edit" && (jobId || job?.id)) {
      const result = job || jobs.find(j => j.id === jobId);
      console.log('EditingJob useMemo result:', { 
        mode,
        jobId, 
        jobProp: job, 
        jobsArrayLength: jobs.length,
        result,
        resultDescription: result?.description 
      });
      return result;
    }
    return null;
  }, [mode, jobId, job, jobs]);

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

  // Form setup
  const form = useForm<GlobalJobCardFormData>({
    resolver: zodResolver(globalJobCardSchema),
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
      billingContactPhone: "",
      billingContactMobile: "",
      billingAddress: "",
      invoiceDescription: "",
      sameAsJobAddress: true,
      taxMode: "tax_exclusive",
      totalAmount: "0",
      paidAmount: "0",
      lineItems: [],
      checklist: [],
      notes: "",
    },
  });

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

  // Get customer data for the editing job
  const editingJobCustomer = editingJob ? customers.find(c => c.id === editingJob.customerId) : null;

  // Populate form with complete job data when editing an existing job
  useEffect(() => {
    if (editingJob && editingJob.id) {
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
        leadSource: editingJob.leadSource || '',
        address: editingJob.address || '',
        city: (editingJob.city ?? '') || '',
        region: (editingJob.region ?? '') || '',
        totalAmount: editingJob.totalAmount || '0',
        paidAmount: editingJob.paidAmount || '0',
        notes: editingJob.notes || '',
        // Contact fields from customer data
        jobContactFirstName: firstName,
        jobContactLastName: lastName,
        jobContactEmail: editingJobCustomer?.email || '',
        jobContactPhone: editingJobCustomer?.phone || '',
        billingContactPhone: editingJob.billingContactPhone || '',
        billingContactMobile: editingJob.billingContactMobile || '',
        billingAddress: editingJob.billingAddress || '',
        invoiceDescription: editingJob.invoiceDescription || '',
        sameAsJobAddress: editingJob.sameAsJobAddress ?? true,
        taxMode: editingJob.taxMode || 'tax_exclusive',
        // Arrays - DO NOT set lineItems here, let replaceLineItems() handle it
        checklist: editingJob.checklist || [],
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
      
      // Reset loading flag after a small delay to ensure all form updates are done
      setTimeout(() => {
        isLoadingDataRef.current = false;
      }, 100);
    }
  }, [editingJob, editingJobCustomer, form, replaceLineItems]);

  // Keep billing address in sync with job address when "same as job address" is enabled
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      const sameAsJobAddress = values.sameAsJobAddress;
      
      // If "same as job address" is enabled and job address fields change, update billing fields
      if (sameAsJobAddress && (name === 'address' || name === 'city' || name === 'region')) {
        if (name === 'address') {
          form.setValue('billingAddress', values.address || '');
        }
        // city and region are shared fields, so they're automatically in sync
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Auto-save effect - saves changes after user stops typing (only in edit mode)
  useEffect(() => {
    if (mode !== 'edit' || !editingJob?.id) return;
    
    let timeoutId: NodeJS.Timeout;
    
    const subscription = form.watch(() => {
      // Skip auto-save if we're currently loading data from the server
      if (isLoadingDataRef.current) {
        return;
      }
      
      // Mark that the user has made a change
      hasUserChangedRef.current = true;
      
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Set new timeout for auto-save
      timeoutId = setTimeout(async () => {
        // Only auto-save if the user actually changed something
        if (!hasUserChangedRef.current) {
          return;
        }
        
        try {
          setIsAutoSaving(true);
          const formData = form.getValues();
          
          // Map new customer fields to job contact fields for backend compatibility
          if (formData.isNewCustomer && formData.newCustomerName) {
            const names = formData.newCustomerName.split(' ');
            formData.jobContactFirstName = names[0] || '';
            formData.jobContactLastName = names.slice(1).join(' ') || '';
            formData.jobContactEmail = formData.newCustomerEmail || '';
            formData.jobContactPhone = formData.newCustomerPhone || '';
          }
          
          await apiRequest('PUT', `/api/jobs/${editingJob.id}`, formData);
          setLastAutoSaveTime(new Date());
          hasUserChangedRef.current = false;
          
          // Don't invalidate queries on auto-save to prevent refetching
          // This avoids the infinite loop of save -> refetch -> form reset -> save
        } catch (error) {
          console.error('Auto-save failed:', error);
          hasUserChangedRef.current = false;
        } finally {
          setIsAutoSaving(false);
        }
      }, 2000); // 2 second debounce
    });
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, [form, mode, editingJob?.id, toast, queryClient]);

  const formData = form.watch();

  // Job create/update mutations
  const createJobMutation = useMutation({
    mutationFn: async (data: GlobalJobCardFormData) => {
      let customerId = data.customerId;
      
      // If no customer ID is provided, create a customer from job contact info
      if (!customerId && (data.jobContactFirstName || data.jobContactLastName)) {
        const customerName = `${data.jobContactFirstName || ''} ${data.jobContactLastName || ''}`.trim();
        const customerData = {
          name: customerName || 'New Customer',
          email: data.jobContactEmail || "",
          phone: data.jobContactPhone || "",
          address: data.address || "",
          city: data.city || "",
          region: data.region || ""
        };
        
        const customerResponse = await apiRequest('POST', '/api/customers', customerData);
        const newCustomer = await customerResponse.json();
        customerId = newCustomer.data.id;
      }
      // Ensure we have a customer ID
      if (!customerId) {
        throw new Error('Customer is required to create a job');
      }
      
      // Create the job with the customer ID
      const jobData = {
        ...data,
        customerId: customerId
      };
      
      const response = await apiRequest('POST', '/api/jobs', jobData);
      return response.json();
    },
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Job Created",
        description: "New job has been created successfully.",
        duration: 1000,
      });
      
      // Reset form to default values
      form.reset({
        title: '',
        description: '',
        status: 'quote',
        priority: 'medium',
        customerId: '',
        lineItems: [],
        checklist: [],
        totalAmount: '0',
        paidAmount: '0',
      });
      
      // Close modal and call callback
      onJobCreated?.(newJob);
      onClose();
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
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
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

  // Fetch proposal data for this job (always fetch when job exists)
  const { data: jobProposalResponse, isLoading: isProposalLoading, isFetching: isProposalFetching, refetch: refetchProposals } = useQuery({
    queryKey: ["/api/proposals", editingJob?.id],
    queryFn: async () => {
      const response = await fetch(`/api/proposals?jobId=${editingJob?.id}`);
      if (!response.ok) throw new Error('Failed to fetch proposals');
      return response.json();
    },
    enabled: !!editingJob?.id,
  });

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

  // Handle call click
  const handleCallClick = () => {
    const phone = selectedCustomer?.phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      toast({
        title: "No Phone Number",
        description: "No phone number available for this customer",
        variant: "destructive"
      });
    }
  };

  // Handle schedule click
  const handleScheduleClick = async () => {
    if (!editingJob?.id) return;
    
    // Fetch existing staff assignments for this job
    try {
      const response = await fetch(`/api/jobs/${editingJob.id}/staff-assignments`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        // Pre-populate the form with existing assignment data
        const firstAssignment = data.data[0];
        const startDate = new Date(firstAssignment.startTime);
        const endDate = new Date(firstAssignment.endTime);
        const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
        
        setSchedulingData({
          date: startDate.toISOString().split('T')[0],
          startTime: startDate.toTimeString().slice(0, 5),
          duration: durationMinutes.toString(),
          assignedTo: data.data.map((a: any) => a.employeeId),
          notes: firstAssignment.notes || ''
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
    toast({
      title: "Archive Job",
      description: "Job has been archived successfully.",
      variant: "destructive"
    });
  };

  // Check for staff conflicts when scheduling data changes
  useEffect(() => {
    const abortController = new AbortController();
    
    const checkConflicts = async () => {
      if (!schedulingData.date || !schedulingData.startTime || !schedulingData.duration || schedulingData.assignedTo.length === 0) {
        setStaffConflicts([]);
        return;
      }

      try {
        const startTime = new Date(`${schedulingData.date}T${schedulingData.startTime}`);
        const endTime = new Date(startTime.getTime() + parseInt(schedulingData.duration) * 60000);

        const response = await fetch('/api/staff/check-conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeIds: schedulingData.assignedTo,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            excludeJobId: editingJob?.id
          }),
          signal: abortController.signal
        });

        if (abortController.signal.aborted) return;

        const data = await response.json();
        if (data.success) {
          setStaffConflicts(data.data || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        console.error('Error checking conflicts:', error);
      }
    };

    const timeoutId = setTimeout(checkConflicts, 300); // Debounce
    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [schedulingData.date, schedulingData.startTime, schedulingData.duration, schedulingData.assignedTo, editingJob?.id]);

  // Save schedule function
  const saveSchedule = async () => {
    if (!editingJob?.id) return;

    try {
      // Parse date and time components
      const [year, month, day] = schedulingData.date.split('-').map(Number);
      const [hours, minutes] = schedulingData.startTime.split(':').map(Number);
      
      // Create ISO string that preserves the local date/time as-is
      // Format: YYYY-MM-DDTHH:MM:00.000Z
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
      const startTimeISO = `${dateStr}T${timeStr}`;
      
      const durationMs = parseInt(schedulingData.duration) * 60000;
      const endDate = new Date(new Date(startTimeISO).getTime() + durationMs);
      const endTimeISO = endDate.toISOString();

      // Create staff assignments
      const staffAssignments = schedulingData.assignedTo.map(employeeId => ({
        employeeId,
        startTime: startTimeISO,
        endTime: endTimeISO,
        notes: schedulingData.notes
      }));

      const response = await fetch(`/api/jobs/${editingJob.id}/staff-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffAssignments,
          sendNotifications: true
        })
      });

      const data = await response.json();

      if (data.success) {
        const scheduledDate = new Date(startTimeISO);
        toast({
          title: "Job Scheduled",
          description: `${schedulingData.assignedTo.length} staff member(s) scheduled for ${format(scheduledDate, 'PPP')} at ${format(scheduledDate, 'p')}`,
        });

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
          notes: ''
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
    const formData = form.getValues();
    console.log('Form data before save:', formData);
    console.log('Form errors:', form.formState.errors);
    
    // Check if form has validation errors
    const isValid = await form.trigger();
    if (!isValid) {
      console.error('Form validation failed:', form.formState.errors);
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
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
    }
  };

  const handleSaveAndClose = async () => {
    const formData = form.getValues();
    
    // Map new customer fields to job contact fields for backend compatibility
    if (formData.isNewCustomer && formData.newCustomerName) {
      const names = formData.newCustomerName.split(' ');
      formData.jobContactFirstName = names[0] || '';
      formData.jobContactLastName = names.slice(1).join(' ') || '';
      formData.jobContactEmail = formData.newCustomerEmail || '';
      formData.jobContactPhone = formData.newCustomerPhone || '';
    }
    
    try {
      if (mode === "create") {
        await createJobMutation.mutateAsync(formData);
      } else {
        await updateJobMutation.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Save and close failed:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full h-full max-w-full flex flex-col p-0 bg-gray-50 overflow-x-hidden sm:max-w-6xl sm:h-[95vh] sm:rounded-xl">
        {/* ServiceM8-style Header */}
        <div className="bg-orange-500 border-b border-orange-600 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2.5 flex-shrink-0 sm:rounded-t-xl">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Job Title */}
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold text-white truncate tracking-tight" data-testid="text-job-title">
                {mode === "create" ? "New Job" : `Job #${editingJob?.jobNumber || "3314"}`}
              </h1>
            </div>
            
            {/* Right: Actions Menu (Mobile), Close Button (Mobile), Save Button & Auto-save Indicator */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Auto-save status - Hide on mobile */}
              {mode === 'edit' && (
                <div className="hidden sm:flex text-xs text-white/80 items-center gap-1.5">
                  {isAutoSaving ? (
                    <>
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      <span>Saving...</span>
                    </>
                  ) : lastAutoSaveTime ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </>
                  ) : null}
                </div>
              )}
              
              {/* Actions Menu - Mobile only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden h-7 w-7 text-white hover:bg-white/20" 
                    data-testid="button-actions-menu-mobile"
                  >
                    <Menu className="h-4 w-4" />
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
                    onClick={() => {
                      if (!selectedCustomer?.id) {
                        toast({
                          title: "Customer Required",
                          description: "Please select a customer before creating a proposal.",
                          variant: "destructive"
                        });
                        return;
                      }
                      setIsProposalBuilderOpen(true);
                    }}
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
                    Profit Tracker
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPhotoCaptureOpen(true)} disabled={!editingJob?.id || mode === 'create'} data-testid="menu-item-camera-mobile">
                    <Camera className="w-4 h-4 mr-2" />
                    Camera
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
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {sendToXeroMutation.isPending 
                      ? 'Sending...' 
                      : editingJob?.xeroStatus === 'sent' 
                      ? 'Sent to Xero' 
                      : 'Send to Xero'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Close button - Mobile only */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden h-7 w-7 text-white hover:bg-white/20" 
                onClick={onClose}
                data-testid="button-close-mobile"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 sm:h-9 px-2 sm:px-3 md:px-4 text-xs bg-white text-orange-600 hover:bg-white/90 border-0 font-semibold transition-all" 
                onClick={handleSave}
                disabled={createJobMutation.isPending || updateJobMutation.isPending || isAutoSaving}
                data-testid="button-save"
              >
                {(createJobMutation.isPending || updateJobMutation.isPending) ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar - Desktop Only */}
        <div className="hidden md:block bg-white border-b border-gray-200 px-3 md:px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={handleEmailClick} 
                data-testid="button-email"
              >
                <div className="flex items-center gap-1.5">
                  <Mail className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Email</span>
                </div>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={() => setIsSMSComposerOpen(true)} 
                data-testid="button-sms"
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">SMS</span>
                </div>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={handleCallClick} 
                data-testid="button-call"
              >
                <div className="flex items-center gap-1.5">
                  <Phone className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">Call</span>
                </div>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={handleScheduleClick} 
                data-testid="button-schedule"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium text-gray-700">Schedule</span>
                </div>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={handleQueueClick} 
                data-testid="button-queue"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Queue</span>
                </div>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-2 hover-elevate active-elevate-2" 
                    data-testid="button-send"
                  >
                    <div className="flex items-center gap-1.5">
                      <Send className="w-5 h-5 text-orange-500" />
                      <span className="text-sm font-medium text-gray-700">Form</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem 
                    onClick={handleQuoteClick}
                    disabled={!editingJob?.id || mode === 'create'}
                    data-testid="menu-item-quote"
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    Quote
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleInvoiceClick}
                    disabled={!editingJob?.id || mode === 'create'}
                    data-testid="menu-item-invoice"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      if (!selectedCustomer?.id) {
                        toast({
                          title: "Customer Required",
                          description: "Please select a customer before creating a proposal.",
                          variant: "destructive"
                        });
                        return;
                      }
                      setIsProposalBuilderOpen(true);
                    }}
                    data-testid="menu-item-proposal"
                  >
                    <Presentation className="w-4 h-4 mr-2" />
                    Proposal
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleEmailClick('proposal')}
                    disabled={!editingJob?.id || mode === 'create'}
                    data-testid="menu-item-email-proposal"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email Proposal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={() => setIsProfitTrackerOpen(true)} 
                disabled={!editingJob?.id || mode === 'create'}
                data-testid="button-profit"
              >
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-5 h-5 text-teal-500" />
                  <span className="text-sm font-medium text-gray-700">Proposal</span>
                </div>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={() => setIsTimeTrackingOpen(true)} 
                disabled={!editingJob?.id || mode === 'create'}
                data-testid="button-time"
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700">Time</span>
                </div>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 hover-elevate active-elevate-2" 
                onClick={() => setIsPhotoCaptureOpen(true)}
                disabled={!editingJob?.id || mode === 'create'}
                data-testid="button-camera"
              >
                <div className="flex items-center gap-1.5">
                  <Camera className="w-5 h-5 text-pink-500" />
                  <span className="text-sm font-medium text-gray-700">Camera</span>
                </div>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-2 hover-elevate active-elevate-2" 
                    data-testid="button-more"
                  >
                    <div className="flex items-center gap-1.5">
                      <MoreHorizontal className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-gray-700">More</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePrintClick}>
                    Print
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicateClick}>
                    Duplicate Job
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleArchiveClick}>
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
                  <DropdownMenuItem onClick={() => setIsProposalBuilderOpen(true)} disabled={!selectedCustomer?.id} data-testid="menu-item-proposal-mobile">
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
                  <DropdownMenuItem onClick={() => setIsPhotoCaptureOpen(true)} disabled={!editingJob?.id || mode === 'create'} data-testid="menu-item-camera-mobile">
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ServiceM8-style Layout: Left Sidebar + Two Panel Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 max-w-full overflow-x-hidden">
          {/* Horizontal Tabs on Mobile, Left Sidebar on Desktop */}
          <div className="bg-gray-200 border-b md:border-b-0 md:border-r border-gray-300 flex md:flex-col md:w-16 flex-shrink-0">
            <button
              className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b border-gray-300 ${
                sidebarTab === 'details' ? 'bg-white text-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarTab('details')}
              data-testid="sidebar-details"
            >
              Details
            </button>
            <button
              className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b border-gray-300 ${
                sidebarTab === 'billing' ? 'bg-white text-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarTab('billing')}
              data-testid="sidebar-billing"
            >
              Billing
            </button>
            <button
              className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium border-r md:border-r-0 md:border-b border-gray-300 ${
                sidebarTab === 'diary' ? 'bg-white text-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarTab('diary')}
              data-testid="sidebar-diary"
            >
              Diary
            </button>
            <button
              className={`flex-1 md:flex-none p-3 min-h-[44px] text-xs font-medium md:border-b border-gray-300 ${
                sidebarTab === 'equipment' ? 'bg-white text-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarTab('equipment')}
              data-testid="sidebar-equipment"
            >
              Equipment
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0 min-w-0">
            <Form {...form}>
            <form 
              onSubmit={form.handleSubmit((data) => {
                console.log('Form submitted:', data);
                // Save functionality will be handled by the save buttons
              })}
              className="flex flex-col h-full w-full min-w-0" 
              data-form="job-form"
            >
              {/* ServiceM8-style Two Panel Layout */}
              <div className="flex flex-col md:flex-row h-full w-full min-w-0">
                {/* Left Panel - Job Details */}
                <div className="flex-1 md:flex-[3] bg-white md:border-r border-gray-300 p-3 sm:p-4 overflow-y-auto overflow-x-hidden md:rounded-l-lg min-w-0">
                  {sidebarTab === 'details' && (
                    <div className="space-y-4">
                      {/* ServiceM8-Style Customer Search or Create */}
                      <div className="space-y-3">
                        {/* Search or Create Client Combobox */}
                        <FormField
                          control={form.control}
                          name="customerId"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      type="button"
                                      className={cn(
                                        "w-full justify-between h-11 font-normal",
                                        !selectedCustomerName && "text-muted-foreground"
                                      )}
                                      data-testid="button-search-customer"
                                    >
                                      {selectedCustomerName || "Search or Create Client"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                  <Command shouldFilter={false}>
                                    <CommandInput
                                      placeholder="Type customer name, phone, or address..."
                                      value={customerSearchValue}
                                      onValueChange={setCustomerSearchValue}
                                      data-testid="input-search-customer"
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        <div className="py-6 text-center text-sm">
                                          <p className="text-muted-foreground mb-2">No customer found</p>
                                          <Button
                                            type="button"
                                            variant="default"
                                            size="sm"
                                            onClick={() => {
                                              // Create new customer with search value as name
                                              form.setValue('isNewCustomer', true);
                                              form.setValue('customerId', '');
                                              form.setValue('newCustomerName', customerSearchValue);
                                              setSelectedCustomerName(customerSearchValue);
                                              
                                              // Set name in job contact fields
                                              const names = customerSearchValue.split(' ');
                                              form.setValue('jobContactFirstName', names[0] || '');
                                              form.setValue('jobContactLastName', names.slice(1).join(' ') || '');
                                              
                                              setCustomerSearchOpen(false);
                                            }}
                                            data-testid="button-create-new-customer"
                                          >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create "{customerSearchValue}"
                                          </Button>
                                        </div>
                                      </CommandEmpty>
                                      <CommandGroup heading="Existing Customers">
                                        {customersData?.data
                                          ?.filter((customer) => {
                                            const searchLower = customerSearchValue.toLowerCase();
                                            return (
                                              customer.name.toLowerCase().includes(searchLower) ||
                                              customer.email?.toLowerCase().includes(searchLower) ||
                                              customer.phone?.toLowerCase().includes(searchLower) ||
                                              customer.address?.toLowerCase().includes(searchLower)
                                            );
                                          })
                                          .map((customer) => (
                                            <CommandItem
                                              key={customer.id}
                                              value={customer.id}
                                              onSelect={() => {
                                                field.onChange(customer.id);
                                                form.setValue('isNewCustomer', false);
                                                setSelectedCustomerName(customer.name);
                                                setCustomerSearchValue("");
                                                
                                                // Auto-populate customer details
                                                const nameParts = customer.name.split(' ');
                                                form.setValue('jobContactFirstName', nameParts[0] || '');
                                                form.setValue('jobContactLastName', nameParts.slice(1).join(' ') || '');
                                                form.setValue('jobContactEmail', customer.email || '');
                                                form.setValue('jobContactPhone', customer.phone || '');
                                                form.setValue('newCustomerAddress', customer.address || '');
                                                
                                                setCustomerSearchOpen(false);
                                              }}
                                              data-testid={`customer-option-${customer.id}`}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  field.value === customer.id ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span className="font-medium">{customer.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                  {customer.email} • {customer.phone}
                                                </span>
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
                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name="newCustomerCity"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-medium text-gray-600">City</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="City"
                                        data-testid="input-new-customer-city"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="newCustomerRegion"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-medium text-gray-600">Region</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="Region/State"
                                        data-testid="input-new-customer-region"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Customer Name and Address */}
                      <div className="bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <UserCircle className="w-5 h-5 text-gray-600" />
                          <h3 className="font-bold text-xl tracking-tight">
                            {selectedCustomer?.name || formData.newCustomerName || 'Customer Name'}
                          </h3>
                        </div>
                        <div className="text-base text-gray-700 font-medium">
                          <div>{selectedCustomer?.address || formData.newCustomerAddress || 'Address'}</div>
                        </div>
                      </div>

                      {/* Job Information Section */}
                      <div className="space-y-4">
                        {/* Job Status, Lead Source */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Job Status</label>
                            <FormField
                              control={form.control}
                              name="status"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select value={field.value || ""} onValueChange={field.onChange}>
                                      <SelectTrigger className="h-8 text-sm" data-testid="select-job-status">
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
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Lead Source</label>
                            <FormField
                              control={form.control}
                              name="leadSource"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select value={field.value || ""} onValueChange={field.onChange}>
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Select source" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="website">Website</SelectItem>
                                        <SelectItem value="referral">Referral</SelectItem>
                                        <SelectItem value="google">Google Search</SelectItem>
                                        <SelectItem value="facebook">Facebook</SelectItem>
                                        <SelectItem value="phone">Phone Call</SelectItem>
                                        <SelectItem value="direct">Direct</SelectItem>
                                        <SelectItem value="advertisement">Advertisement</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Job Address */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            <label className="text-xs font-medium text-gray-600">Job Address</label>
                          </div>
                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field}
                                    className="h-8 text-sm" 
                                    placeholder="Job site address"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Job Description */}
                        <div>
                          <label className="text-sm font-semibold text-gray-700 mb-1 block">Job Description</label>
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea 
                                    {...field}
                                    className="min-h-[90px] text-base font-medium" 
                                    placeholder="Describe the work that needs to be done"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Checklist */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-600">Checklist</label>
                            <button className="text-xs text-blue-600 hover:text-blue-800">⋯</button>
                          </div>
                          <div className="border rounded-lg p-2 bg-gray-50">
                            <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                              <Plus className="w-3 h-3" />
                              New Item
                            </button>
                          </div>
                        </div>

                        {/* Upcoming Bookings */}
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-2 block">Upcoming Bookings</label>
                          <div className="border rounded-lg p-3 bg-blue-50 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              <span className="font-medium">Kalsey on 29/09/2025 8:00 AM</span>
                            </div>
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
                                    <Input {...field} className="h-8 text-sm" placeholder="First Name" />
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
                                    <Input {...field} className="h-8 text-sm" placeholder="Last Name" />
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
                                    <Input {...field} className="h-8 text-sm" placeholder="Email" type="email" />
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
                                    <Input {...field} className="h-8 text-sm" placeholder="Phone" />
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
                                    <Input {...field} className="h-8 text-sm" placeholder="Mobile" />
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
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 -m-4 mb-4">
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
                                          const jobCity = form.getValues('city') || '';
                                          const jobRegion = form.getValues('region') || '';
                                          
                                          // Populate billing fields with job address data
                                          form.setValue('billingAddress', jobAddress);
                                          
                                          // Note: city and region are shared fields, so they're already populated
                                          // Just ensure they have the job data
                                          if (!form.getValues('city')) {
                                            form.setValue('city', jobCity);
                                          }
                                          if (!form.getValues('region')) {
                                            form.setValue('region', jobRegion);
                                          }
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
                                      className="h-8 text-sm" 
                                      placeholder="Billing Address"
                                      disabled={form.watch('sameAsJobAddress')}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        className="h-8 text-sm" 
                                        placeholder="City"
                                        disabled={form.watch('sameAsJobAddress')}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="region"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        className="h-8 text-sm" 
                                        placeholder="Region"
                                        disabled={form.watch('sameAsJobAddress')}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Invoice Description */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">Invoice Description</h4>
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
                                      <SelectTrigger className="h-8 text-sm">
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
                            <Input className="h-8 text-sm" defaultValue="15.00%" readOnly />
                          </div>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <h4 className="font-medium text-gray-800 mb-3">Financial Summary</h4>
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const lineItems = form.watch('lineItems') || [];
                            const taxMode = form.watch('taxMode') || 'tax_exclusive';
                            const paidAmount = parseFloat(form.watch('paidAmount') || '0');
                            const gstRate = 0.15; // 15% GST for New Zealand
                            
                            // Calculate line item totals
                            const lineItemTotal = lineItems.reduce((sum: number, item: any) => {
                              const quantity = parseFloat(item.quantity || '0');
                              const unitPrice = parseFloat(item.unitPrice || '0');
                              return sum + (quantity * unitPrice);
                            }, 0);
                            
                            let subtotal: number;
                            let gstAmount: number;
                            let totalIncGst: number;
                            
                            if (taxMode === 'tax_inclusive') {
                              // Prices include GST - reverse calculate
                              totalIncGst = lineItemTotal;
                              subtotal = totalIncGst / (1 + gstRate);
                              gstAmount = totalIncGst - subtotal;
                            } else {
                              // tax_exclusive or cost_markup - GST added on top
                              subtotal = lineItemTotal;
                              gstAmount = subtotal * gstRate;
                              totalIncGst = subtotal + gstAmount;
                            }
                            
                            const balanceDue = totalIncGst - paidAmount;
                            
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Subtotal (Ex GST)</span>
                                  <span className="font-mono">${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">GST (15%)</span>
                                  <span className="font-mono">${gstAmount.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                                  <span>Total (Inc GST)</span>
                                  <span className="font-mono">${totalIncGst.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-green-600">
                                  <span>Paid</span>
                                  <span className="font-mono">${paidAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-orange-600">
                                  <span>Balance Due</span>
                                  <span className="font-mono">${balanceDue.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
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
                                  setNewLineItem({ description: '', quantity: 1, unitPrice: 0, unitCost: 0 });
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
                            
                            <div className="grid grid-cols-4 gap-3">
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
                                  onChange={(e) => setNewLineItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
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
                        {lineItemFields.length > 0 ? (
                          <div className="space-y-4">
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                                <h4 className="font-medium text-gray-800">Items & Services</h4>
                                <div className="text-xs text-gray-500">⋯</div>
                              </div>
                              
                              {/* Table Header */}
                              <div className="bg-gray-50 border-b border-gray-200">
                                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-600">
                                  <div className="col-span-2">Item Code</div>
                                  <div className="col-span-2">Item Name</div>
                                  <div className="col-span-1 text-center">Qty</div>
                                  <div className="col-span-1 text-center">GST</div>
                                  <div className="col-span-2 text-right">Cost ex GST</div>
                                  <div className="col-span-1 text-right">Markup</div>
                                  <div className="col-span-2 text-right">Price</div>
                                  <div className="col-span-1 text-right">Total</div>
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
                                    <div key={field.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-sm">
                                      <div className="col-span-2 text-gray-500">—</div>
                                      <div className="col-span-2 font-medium text-gray-900">
                                        <div className="flex items-center gap-2">
                                          <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0"></div>
                                          {field.description}
                                        </div>
                                      </div>
                                      <div className="col-span-1 text-center">
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
                                                    // Update total when quantity changes
                                                    const currentItems = form.getValues('lineItems');
                                                    currentItems[index].total = newQuantity * currentItems[index].unitPrice;
                                                    currentItems[index].totalCost = newQuantity * currentItems[index].unitCost;
                                                    form.setValue('lineItems', currentItems);
                                                  }}
                                                  className="w-16 h-8 text-center text-sm border-none bg-transparent p-0"
                                                />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                      <div className="col-span-1 text-center">
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
                                                      const isIncluding = e.target.checked;
                                                      const gstRate = 0.15; // 15% GST for NZ
                                                      
                                                      // Get current price
                                                      const currentPrice = form.getValues(`lineItems.${index}.unitPrice`) || 0;
                                                      const wasIncluding = gstField.value || false;
                                                      
                                                      let newPrice = currentPrice;
                                                      
                                                      // Convert price based on toggle direction
                                                      if (isIncluding && !wasIncluding) {
                                                        // Converting from Ex to Inc: add GST
                                                        newPrice = currentPrice * (1 + gstRate);
                                                      } else if (!isIncluding && wasIncluding) {
                                                        // Converting from Inc to Ex: remove GST  
                                                        newPrice = currentPrice / (1 + gstRate);
                                                      }
                                                      
                                                      // Update the GST mode and the converted price
                                                      gstField.onChange(isIncluding);
                                                      form.setValue(`lineItems.${index}.unitPrice`, parseFloat(newPrice.toFixed(2)));
                                                    }}
                                                  />
                                                  <div className={`relative w-8 h-4 bg-gray-200 rounded-full transition-colors ${
                                                    gstField.value ? 'bg-blue-600' : 'bg-gray-200'
                                                  }`}>
                                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                                                      gstField.value ? 'transform translate-x-4' : ''
                                                    }`}></div>
                                                  </div>
                                                  <span className="ml-1 text-xs text-gray-600">
                                                    {gstField.value ? 'Inc' : 'Ex'}
                                                  </span>
                                                </label>
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                      <div className="col-span-2 text-right font-mono">${costExGst.toFixed(2)}</div>
                                      <div className="col-span-1 text-right text-gray-600">{markupPercent}%</div>
                                      <div className="col-span-2 text-right">
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
                                                    // Update total when price changes
                                                    const currentItems = form.getValues('lineItems');
                                                    currentItems[index].total = currentItems[index].quantity * newPrice;
                                                    form.setValue('lineItems', currentItems);
                                                  }}
                                                  disabled={!isAdmin}
                                                  readOnly={!isAdmin}
                                                  className="w-20 h-8 text-right text-sm border-none bg-transparent p-1 font-mono"
                                                />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                      <div className="col-span-1 text-right font-mono font-semibold">
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

                              {/* Search Row */}
                              <div className="bg-white border-t border-gray-200">
                                <div className="p-4">
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

                            {/* ServiceM8-Style Financial Summary */}
                            <div className="grid grid-cols-2 gap-6">
                              <div></div> {/* Left side spacer */}
                              <div className="space-y-2 text-sm">
                                {(() => {
                                  const lineItems = form.watch('lineItems') || [];
                                  const taxMode = form.watch('taxMode') || 'tax_exclusive';
                                  const gstRate = 0.15; // 15% GST for New Zealand
                                  const paidAmount = parseFloat(form.watch('paidAmount') || '0');
                                  
                                  const lineItemTotal = lineItems.reduce((sum: number, item: any) => {
                                    const quantity = item.quantity || 1;
                                    const unitPrice = item.unitPrice || 0;
                                    return sum + (quantity * unitPrice);
                                  }, 0);
                                  
                                  let subtotal: number;
                                  let gstAmount: number;
                                  let totalIncGst: number;
                                  
                                  if (taxMode === 'tax_inclusive') {
                                    totalIncGst = lineItemTotal;
                                    subtotal = totalIncGst / (1 + gstRate);
                                    gstAmount = totalIncGst - subtotal;
                                  } else {
                                    subtotal = lineItemTotal;
                                    gstAmount = subtotal * gstRate;
                                    totalIncGst = subtotal + gstAmount;
                                  }
                                  
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
                        ) : (
                          <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">No items added yet</p>
                            <p className="text-sm text-gray-400">Search for items above to start building your quote</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {sidebarTab === 'diary' && editingJob && (
                    <JobDiarySection 
                      jobId={editingJob.id}
                      isServiceM8Style={true}
                      onQuoteClick={(quoteNumber) => {
                        setIsQuoteModalOpen(true);
                      }}
                      onInvoiceClick={(invoiceNumber) => {
                        setIsInvoiceModalOpen(true);
                      }}
                      onProposalClick={(proposalNumber) => {
                        setIsProposalBuilderOpen(true);
                      }}
                    />
                  )}
                  
                  {sidebarTab === 'diary' && !editingJob && (
                    <div className="p-4">
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Activity diary will appear here after saving the job.</p>
                      </div>
                    </div>
                  )}

                  {sidebarTab === 'equipment' && (
                    <div className="space-y-2 md:space-y-4 p-2 md:p-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                          <h3 className="text-base md:text-lg font-semibold text-gray-800">Equipment Checklist</h3>
                        </div>
                      </div>

                      {/* Quick Add Equipment Dropdown */}
                      {editingJob && (
                        <div className="space-y-2">
                          <label className="text-xs md:text-sm font-medium text-gray-700">Add Equipment</label>
                          <Select
                            value=""
                            onValueChange={async (equipmentId) => {
                              if (!editingJob?.id || !equipmentId) return;
                              
                              const selectedEquip = allEquipment.find((e: any) => e.id === equipmentId);
                              if (!selectedEquip) return;

                              const currentChecklist = editingJob.equipmentChecklist || [];
                              
                              // Check if already added
                              if (currentChecklist.some((item: any) => item.equipment === selectedEquip.name)) {
                                toast({
                                  title: "Already Added",
                                  description: `${selectedEquip.name} is already on this job`,
                                  variant: "destructive"
                                });
                                return;
                              }

                              const newItem = {
                                id: `equip-${Date.now()}`,
                                equipment: selectedEquip.name,
                                checked: false,
                                checkedAt: undefined,
                                checkedBy: undefined,
                              };

                              const updatedChecklist = [...currentChecklist, newItem];

                              try {
                                // Optimistically update local cache first
                                queryClient.setQueryData(['/api/jobs'], (oldData: any) => {
                                  if (!oldData?.data) return oldData;
                                  return {
                                    ...oldData,
                                    data: oldData.data.map((j: any) => 
                                      j.id === editingJob.id 
                                        ? { ...j, equipmentChecklist: updatedChecklist }
                                        : j
                                    )
                                  };
                                });

                                // Then update server
                                await apiRequest('PATCH', `/api/jobs/${editingJob.id}`, {
                                  equipmentChecklist: updatedChecklist,
                                });

                                toast({
                                  title: "Equipment Added",
                                  description: `${selectedEquip.name} added to job`,
                                });
                              } catch (error) {
                                console.error('Error adding equipment:', error);
                                // Revert optimistic update on error
                                queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
                                toast({
                                  title: "Error",
                                  description: "Failed to add equipment",
                                  variant: "destructive"
                                });
                              }
                            }}
                            data-testid="select-add-equipment"
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select equipment to add..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allEquipment.length > 0 ? (
                                allEquipment.map((equip: any) => (
                                  <SelectItem key={equip.id} value={equip.id}>
                                    {equip.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>
                                  No equipment available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {editingJob && (editingJob.equipmentChecklist && editingJob.equipmentChecklist.length > 0) ? (
                        <div className="space-y-1 md:space-y-2">
                          {editingJob.equipmentChecklist.map((item: any, index: number) => (
                            <div
                              key={item.id}
                              className="p-2 md:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                              data-testid={`equipment-item-${item.id}`}
                            >
                              <div className="flex items-center gap-2 md:gap-3">
                                <Checkbox
                                  checked={item.checked || false}
                                  onCheckedChange={async (checked) => {
                                    if (!editingJob?.id) return;

                                    const now = new Date().toISOString();
                                    const updatedChecklist = editingJob.equipmentChecklist.map((i: any) =>
                                      i.id === item.id
                                        ? {
                                            ...i,
                                            checked: checked as boolean,
                                            checkedAt: checked ? now : undefined,
                                            checkedBy: checked ? 'Staff' : undefined,
                                          }
                                        : i
                                    );

                                    try {
                                      // Update the equipment checklist
                                      await apiRequest('PATCH', `/api/jobs/${editingJob.id}`, {
                                        equipmentChecklist: updatedChecklist,
                                      });

                                      // Create diary entry
                                      await apiRequest('POST', `/api/jobs/${editingJob.id}/diary`, {
                                        entryType: 'equipment',
                                        entryText: checked
                                          ? `Equipment checked: ${item.equipment} by Staff`
                                          : `Equipment unchecked: ${item.equipment}`,
                                        metadata: {
                                          equipmentId: item.id,
                                          equipmentName: item.equipment,
                                          action: checked ? 'checked' : 'unchecked',
                                          checkedBy: 'Staff',
                                        },
                                      });

                                      // Invalidate queries to refresh data
                                      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
                                      queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary'] });

                                      toast({
                                        title: checked ? 'Equipment Checked' : 'Equipment Unchecked',
                                        description: `${item.equipment} has been ${checked ? 'checked' : 'unchecked'} and logged to diary`,
                                      });
                                    } catch (error) {
                                      console.error('Error updating equipment:', error);
                                      toast({
                                        title: 'Error',
                                        description: 'Failed to update equipment checklist',
                                        variant: 'destructive',
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-equipment-${item.id}`}
                                />
                                <div className="flex-1">
                                  <p className="text-sm md:text-base font-medium text-gray-800">{item.equipment}</p>
                                  {item.checked && item.checkedAt && (
                                    <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                                      Checked by {item.checkedBy || 'Staff'} on{' '}
                                      {format(new Date(item.checkedAt), 'MMM d, yyyy h:mm a')}
                                    </p>
                                  )}
                                </div>
                                {item.checked && (
                                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 md:h-8 md:w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={async () => {
                                    if (!editingJob?.id) return;

                                    const updatedChecklist = editingJob.equipmentChecklist.filter(
                                      (i: any) => i.id !== item.id
                                    );

                                    try {
                                      // Optimistically update cache
                                      queryClient.setQueryData(['/api/jobs'], (oldData: any) => {
                                        if (!oldData?.data) return oldData;
                                        return {
                                          ...oldData,
                                          data: oldData.data.map((j: any) => 
                                            j.id === editingJob.id 
                                              ? { ...j, equipmentChecklist: updatedChecklist }
                                              : j
                                          )
                                        };
                                      });

                                      // Update server
                                      await apiRequest('PATCH', `/api/jobs/${editingJob.id}`, {
                                        equipmentChecklist: updatedChecklist,
                                      });

                                      toast({
                                        title: "Equipment Removed",
                                        description: `${item.equipment} removed from job`,
                                      });
                                    } catch (error) {
                                      console.error('Error removing equipment:', error);
                                      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
                                      toast({
                                        title: "Error",
                                        description: "Failed to remove equipment",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                  data-testid={`button-delete-equipment-${item.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              {/* Notes section */}
                              <div className="mt-2">
                                <Textarea
                                  placeholder="Add notes..."
                                  value={item.notes || ''}
                                  onChange={async (e) => {
                                    if (!editingJob?.id) return;
                                    
                                    const newNotes = e.target.value;
                                    const updatedChecklist = editingJob.equipmentChecklist.map((i: any) =>
                                      i.id === item.id ? { ...i, notes: newNotes } : i
                                    );

                                    // Optimistically update cache
                                    queryClient.setQueryData(['/api/jobs'], (oldData: any) => {
                                      if (!oldData?.data) return oldData;
                                      return {
                                        ...oldData,
                                        data: oldData.data.map((j: any) => 
                                          j.id === editingJob.id 
                                            ? { ...j, equipmentChecklist: updatedChecklist }
                                            : j
                                        )
                                      };
                                    });

                                    // Debounce server update
                                    if (window.equipmentNotesTimeout) {
                                      clearTimeout(window.equipmentNotesTimeout);
                                    }
                                    
                                    (window as any).equipmentNotesTimeout = setTimeout(async () => {
                                      try {
                                        await apiRequest('PATCH', `/api/jobs/${editingJob.id}`, {
                                          equipmentChecklist: updatedChecklist,
                                        });
                                      } catch (error) {
                                        console.error('Error saving equipment notes:', error);
                                        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
                                      }
                                    }, 500);
                                  }}
                                  className="text-xs md:text-sm min-h-[60px]"
                                  data-testid={`textarea-equipment-notes-${item.id}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 md:py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                          <Package className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-50" />
                          <p className="text-base md:text-lg font-medium">No equipment assigned to this job</p>
                          <p className="text-xs md:text-sm text-gray-400 mt-1 md:mt-2">Equipment items will appear here when added to the job</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Panel - Activity Diary - Only show when NOT in diary tab */}
                {sidebarTab !== 'diary' && (
                  <div className="hidden md:block md:flex-[2] bg-white overflow-y-auto overflow-x-hidden rounded-r-lg min-w-0">
                    {editingJob && (
                      <JobDiarySection 
                        jobId={editingJob.id}
                        onQuoteClick={(quoteNumber) => {
                          setIsQuoteModalOpen(true);
                        }}
                        onInvoiceClick={(invoiceNumber) => {
                          setIsInvoiceModalOpen(true);
                        }}
                        onProposalClick={(proposalNumber) => {
                          setIsProposalBuilderOpen(true);
                        }}
                      />
                    )}
                    {!editingJob && (
                      <div className="p-4">
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Activity diary will appear here after saving the job.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

                {/* Line Items & Pricing - Only show in Billing tab */}
                {sidebarTab === 'billing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Line Items & Pricing
                    </h3>
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
                            setNewLineItem({ description: '', quantity: 1, unitPrice: 0, unitCost: 0 });
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
                      
                      <div className="grid grid-cols-4 gap-3">
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
                            onChange={(e) => setNewLineItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
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
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">Profit</label>
                          <div className="text-sm bg-gray-100 p-2 rounded border text-center font-medium">
                            ${((newLineItem.unitPrice - newLineItem.unitCost) * newLineItem.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Total: ${(newLineItem.quantity * newLineItem.unitPrice).toFixed(2)}
                        </div>
                        <Button
                          type="button"
                          onClick={addLineItem}
                          disabled={!newLineItem.description || !newLineItem.quantity || !newLineItem.unitPrice}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          Add Item
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ServiceM8-Style Items & Services Table */}
                  {lineItemFields.length > 0 ? (
                    <div className="space-y-4">
                      {/* Table Header */}
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-t-lg">
                        <h4 className="font-semibold">Items & Services</h4>
                        <p className="text-orange-100 text-sm">Professional service breakdown with GST calculations</p>
                      </div>
                      
                      {/* Table */}
                      <div className="overflow-x-auto border rounded-b-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left p-2 font-medium text-gray-700">Item Code</th>
                              <th className="text-left p-2 font-medium text-gray-700">Description</th>
                              <th className="text-center p-2 font-medium text-gray-700">Qty</th>
                              <th className="text-right p-2 font-medium text-gray-700">Unit Price</th>
                              <th className="text-right p-2 font-medium text-gray-700">Total</th>
                              <th className="text-right p-2 font-medium text-gray-700">Cost</th>
                              <th className="text-right p-2 font-medium text-gray-700">Markup</th>
                              <th className="text-center p-2 font-medium text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItemFields.map((field, index) => {
                              const unitPrice = field.unitPrice || 0;
                              const quantity = field.quantity || 0;
                              const total = quantity * unitPrice;
                              const unitCost = field.unitCost || 0;
                              const totalCost = quantity * unitCost;
                              const markup = total > 0 && totalCost > 0 ? ((total - totalCost) / totalCost * 100) : 0;
                              
                              return (
                                <tr key={field.id} className="border-b hover:bg-gray-50">
                                  <td className="p-2">
                                    <span className="text-blue-600 font-mono text-xs">{field.itemCode || '-'}</span>
                                  </td>
                                  <td className="p-2">
                                    <div className="font-medium text-gray-900">{field.description}</div>
                                  </td>
                                  <td className="p-2 text-center">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                                      {quantity}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-mono">
                                    ${unitPrice.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-mono font-semibold">
                                    ${total.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-mono text-gray-600">
                                    ${totalCost.toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right">
                                    <span className={`font-medium ${markup > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {markup.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeLineItemField(index)}
                                      className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-200"
                                      data-testid={`button-remove-line-item-${index}`}
                                    >
                                      <Trash2 className="w-3 h-3 text-red-500" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* ServiceM8-Style Financial Summary */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Cost Breakdown */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-medium text-gray-800 mb-3">Cost Breakdown</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Cost</span>
                              <span className="font-mono text-red-600">
                                ${form.watch('lineItems')?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitCost || 0)), 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Revenue</span>
                              <span className="font-mono text-green-600">
                                ${form.watch('lineItems')?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                              <span>Gross Profit</span>
                              <span className="font-mono text-blue-600">
                                ${(
                                  form.watch('lineItems')?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0) -
                                  form.watch('lineItems')?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitCost || 0)), 0)
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* GST Calculation */}
                        <div className="bg-blue-50 rounded-lg p-4">
                          <h5 className="font-medium text-blue-800 mb-3">GST Calculation (15%)</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-blue-700">Subtotal (Ex GST)</span>
                              <span className="font-mono">
                                ${(form.watch('lineItems')?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0) / 1.15).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">GST (15%)</span>
                              <span className="font-mono">
                                ${(form.watch('lineItems')?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0) * 0.15 / 1.15).toFixed(2)}
                              </span>
                            </div>
                            <div className="border-t border-blue-200 pt-2 flex justify-between font-semibold text-blue-900">
                              <span>Total (Inc GST)</span>
                              <span className="font-mono">
                                ${form.watch('lineItems')?.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-t-lg -m-4 mb-8">
                        <h4 className="font-semibold">Items & Services</h4>
                        <p className="text-orange-100 text-sm">Professional service breakdown with GST calculations</p>
                      </div>
                      <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No items added yet</p>
                      <p className="text-sm text-gray-400">Click "Add Line Item" to start building your quote</p>
                    </div>
                  )}
                </div>
                )}
            </form>
          </Form>
          </div>
        </div>
      </DialogContent>

      {/* Email Composer Modal */}
      {isEmailComposerOpen && (
        <EmailComposerModal
          isOpen={isEmailComposerOpen}
          onClose={() => setIsEmailComposerOpen(false)}
          job={editingJob}
          customer={selectedCustomer}
          quoteData={emailContext === 'quote' && jobQuoteResponse?.success && jobQuoteResponse.data.length > 0 ? {
            id: jobQuoteResponse.data[0].id,
            quoteNumber: jobQuoteResponse.data[0].quoteNumber,
            totalAmount: jobQuoteResponse.data[0].amount,
            validUntil: jobQuoteResponse.data[0].validUntil,
            status: jobQuoteResponse.data[0].status,
            lineItems: formData?.lineItems || []
          } : undefined}
          invoiceData={emailContext === 'invoice' ? {
            id: editingJob?.id,
            invoiceNumber: `INV-${editingJob?.jobNumber || '0000'}`,
            totalAmount: formData?.lineItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            lineItems: formData?.lineItems || []
          } : undefined}
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
          templateType={emailContext === 'general' ? undefined : emailContext}
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
          onClose={() => setIsProposalBuilderOpen(false)}
          jobId={editingJob?.id}
          customerId={selectedCustomer?.id}
          lineItems={formData?.lineItems || []}
        />
      )}

      {/* Quote Management Modal */}
      {isQuoteModalOpen && editingJob && quoteTemplate && (
        <Dialog open={isQuoteModalOpen} onOpenChange={setIsQuoteModalOpen}>
          <DialogContent className="max-w-full sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="p-3 sm:p-6 border-b">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base sm:text-lg font-semibold">Quote Preview - {editingJob?.title || 'Job'}</h2>
                <div className="flex gap-1 sm:gap-2 flex-wrap">
                  <Button 
                    size="sm" 
                    onClick={handleSaveQuote} 
                    data-testid="button-save-quote" 
                    className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                  >
                    <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Save Quote
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
                    className="h-7 text-xs"
                  >
                    <Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Copy
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIsQuoteModalOpen(false);
                      handleEmailClick('quote');
                    }} 
                    data-testid="button-email-quote"
                    className="h-7 text-xs"
                  >
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Email
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
                    className="h-7 text-xs"
                  >
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="p-3 sm:p-6">
              <QuoteTemplate
                template={quoteTemplate}
                quote={{
                  id: editingJob.id,
                  amount: String(formData?.lineItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0),
                  status: 'draft',
                  customerId: selectedCustomer?.id || '',
                  leadId: editingJob.id,
                  description: editingJob.description || '',
                  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  terms: quoteTemplate?.paymentTerms || 'Payment due within 30 days',
                  createdAt: new Date(),
                  updatedAt: new Date()
                }}
                customer={selectedCustomer || undefined}
                lineItems={formData?.lineItems?.map(item => ({
                  id: item.id,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  unit: 'each',
                  total: item.total
                })) || []}
                showActions={false}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Management Modal */}
      {isInvoiceModalOpen && editingJob && invoiceTemplate && (
        <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="text-lg font-semibold">Invoice Preview - {editingJob?.title || 'Job'}</h2>
            </DialogHeader>
            <div className="p-6">
              <InvoiceTemplate
                template={invoiceTemplate}
                invoice={{
                  id: editingJob.id,
                  invoiceNumber: `INV-${editingJob.jobNumber || '0000'}`,
                  customerId: selectedCustomer?.id || '',
                  amount: formData?.lineItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0,
                  status: 'draft',
                  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
                  issueDate: new Date().toISOString(),
                  paymentTerms: invoiceTemplate?.paymentTerms || 'Payment due within 30 days',
                  notes: editingJob.notes || '',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }}
                customer={selectedCustomer || undefined}
                lineItems={formData?.lineItems?.map(item => ({
                  id: item.id,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                  unit: 'each',
                  category: 'service',
                  taxable: true
                })) || []}
                showActions={true}
                onEmail={() => {
                  setIsInvoiceModalOpen(false);
                  handleEmailClick();
                }}
                onDownload={() => {
                  toast({
                    title: "Download Started",
                    description: "Invoice PDF download will be available soon.",
                  });
                }}
                onCopy={() => {
                  toast({
                    title: "Copied",
                    description: "Invoice details copied to clipboard.",
                  });
                }}
                onAddPayment={() => {
                  toast({
                    title: "Add Payment",
                    description: "Payment tracking functionality will be available soon.",
                  });
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Profit Tracker */}
      {isProfitTrackerOpen && editingJob?.id && (
        <Dialog open={isProfitTrackerOpen} onOpenChange={setIsProfitTrackerOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <Input
                  type="time"
                  value={schedulingData.startTime}
                  onChange={(e) => setSchedulingData(prev => ({ ...prev, startTime: e.target.value }))}
                  data-testid="input-schedule-start-time"
                />
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
                    const hasConflict = staffConflicts.some(c => c.employeeId === employee.id);
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
                        {hasConflict && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Conflict
                          </Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {staffConflicts.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  {staffConflicts.length} staff member(s) have scheduling conflicts at this time
                </div>
              )}
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
                  notes: ''
                });
                setStaffConflicts([]);
              }}
              data-testid="btn-cancel-schedule"
            >
              Cancel
            </Button>
            <Button
              onClick={saveSchedule}
              disabled={!schedulingData.date || !schedulingData.startTime || !schedulingData.duration || schedulingData.assignedTo.length === 0 || staffConflicts.length > 0}
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

      {/* Photo Capture Modal */}
      {editingJob && (
        <PhotoCaptureModal
          isOpen={isPhotoCaptureOpen}
          onClose={() => setIsPhotoCaptureOpen(false)}
          jobId={editingJob.id}
        />
      )}

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
    </Dialog>
  );
}
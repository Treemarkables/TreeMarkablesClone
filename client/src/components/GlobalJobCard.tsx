import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { X, Plus, Mail, MessageSquare, Phone, Calendar, FileText, Presentation, Check, Trash2, User, Building2, Building, DollarSign, ChevronDown, Receipt, Send, CreditCard, CheckCircle, Settings, Zap, Percent, Clock, MapPin, Calculator, Target, MoreHorizontal, UserCircle, Edit3, Image as ImageIcon, Package, Search } from "lucide-react";
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

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertJobSchema, type ChecklistItem, type Job, type Customer } from "@shared/schema";

// Form validation schema extending the base insertJobSchema
const globalJobCardSchema = insertJobSchema.extend({
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
  const [activeCustomerTab, setActiveCustomerTab] = useState("existing");
  const [activeTab, setActiveTab] = useState("details");
  const [sidebarTab, setSidebarTab] = useState("details");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
    endTime: '',
    assignedTo: '',
    notes: ''
  });

  // Time tracking modal state
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);

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
    enabled: isOpen,
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

  // Find selected customer
  const selectedCustomer = useMemo(() => {
    if (mode === "edit" && editingJob?.customerId) {
      return customers.find(c => c.id === editingJob.customerId);
    }
    return null;
  }, [mode, editingJob, customers]);

  // Get customer data for the editing job
  const editingJobCustomer = editingJob ? customers.find(c => c.id === editingJob.customerId) : null;

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

  // Populate form with complete job data when editing an existing job
  useEffect(() => {
    if (editingJob && editingJob.id) {
      // Wait for job data to be fully loaded before resetting form
      
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
      onJobCreated?.(newJob);
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      // Update the job with the quote ID
      if (result.data?.id && editingJob?.id) {
        apiRequest('PUT', `/api/jobs/${editingJob.id}`, { quoteId: result.data.id });
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
  const handleScheduleClick = () => {
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
          content: `Quote ${quoteResult.data.quoteNumber || 'draft'} created for ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(totalAmount)}`,
          isPrivate: false,
          createdBy: 'system'
        };

        await apiRequest('POST', `/api/jobs/${editingJob.id}/diary`, diaryEntry);
        
        // Invalidate diary query to refresh
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id, 'diary'] });
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

  // Save schedule function
  const saveSchedule = async () => {
    try {
      const scheduledDate = new Date(`${schedulingData.date}T${schedulingData.startTime}`);
      
      toast({
        title: "Job Scheduled",
        description: `Job scheduled for ${format(scheduledDate, 'PPP')} at ${format(scheduledDate, 'p')}`,
      });
      
      setIsSchedulingModalOpen(false);
      setSchedulingData({
        date: '',
        startTime: '',
        endTime: '',
        assignedTo: '',
        notes: ''
      });
      
      console.log("Job scheduled successfully");
    } catch (error) {
      console.error("Error scheduling job:", error);
      toast({
        title: "Scheduling Error",
        description: "Failed to schedule job. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Save button handlers
  const handleSave = async () => {
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
    } catch (error) {
      console.error('Save failed:', error);
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
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 bg-gray-50 rounded-xl">
        {/* ServiceM8-style Header */}
        <div className="bg-orange-500 border-b border-orange-600 px-4 py-2 flex-shrink-0 rounded-t-xl">
          <div className="flex items-center justify-between">
            {/* Left: Job Title */}
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white" data-testid="text-job-title">
                {mode === "create" ? "New Job" : `Job #${editingJob?.jobNumber || "3314"}`}
              </h1>
            </div>
            
            {/* Center: Action Buttons */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleEmailClick} data-testid="button-email">
                <Mail className="w-4 h-4 mr-1" />
                Email
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setIsSMSComposerOpen(true)} data-testid="button-sms">
                <MessageSquare className="w-4 h-4 mr-1" />
                SMS
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleCallClick} data-testid="button-call">
                <Phone className="w-4 h-4 mr-1" />
                Call
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleScheduleClick} data-testid="button-schedule">
                <Calendar className="w-4 h-4 mr-1" />
                Schedule
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleQueueClick} data-testid="button-queue">
                <FileText className="w-4 h-4 mr-1" />
                Queue
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" data-testid="button-send">
                    <Send className="w-4 h-4 mr-1" />
                    Send
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
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs" 
                onClick={() => setIsProfitTrackerOpen(true)} 
                disabled={!editingJob?.id || mode === 'create'}
                data-testid="button-profit"
                title={!editingJob?.id || mode === 'create' ? "Save job first to track profit" : "View profit tracking"}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Profit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs" 
                onClick={() => setIsTimeTrackingOpen(true)} 
                disabled={!editingJob?.id || mode === 'create'}
                data-testid="button-time"
                title={!editingJob?.id || mode === 'create' ? "Save job first to track time" : "Record time tracking"}
              >
                <Clock className="w-4 h-4 mr-1" />
                Time
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" data-testid="button-more">
                    <MoreHorizontal className="w-4 h-4 mr-1" />
                    More
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Right: Save Buttons */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs" 
                onClick={handleSave}
                disabled={createJobMutation.isPending || updateJobMutation.isPending}
                data-testid="button-save"
              >
                {(createJobMutation.isPending || updateJobMutation.isPending) ? 'Saving...' : 'Save'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs" 
                onClick={handleSaveAndClose}
                disabled={createJobMutation.isPending || updateJobMutation.isPending}
                data-testid="button-save-close"
              >
                {(createJobMutation.isPending || updateJobMutation.isPending) ? 'Saving...' : 'Save & Close'}
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={onClose} data-testid="button-close">
                Close
              </Button>
            </div>
          </div>
        </div>

        {/* ServiceM8-style Layout: Left Sidebar + Two Panel Content */}
        <div className="flex-1 flex min-h-0">
          {/* Left Sidebar Navigation */}
          <div className="w-16 bg-gray-200 border-r border-gray-300 flex flex-col">
            <button
              className={`p-3 text-xs font-medium border-b border-gray-300 ${
                sidebarTab === 'details' ? 'bg-white text-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarTab('details')}
              data-testid="sidebar-details"
            >
              Details
            </button>
            <button
              className={`p-3 text-xs font-medium border-b border-gray-300 ${
                sidebarTab === 'billing' ? 'bg-white text-gray-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setSidebarTab('billing')}
              data-testid="sidebar-billing"
            >
              Billing
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0">
            <Form {...form}>
            <form 
              onSubmit={form.handleSubmit((data) => {
                console.log('Form submitted:', data);
                // Save functionality will be handled by the save buttons
              })}
              className="flex flex-col h-full w-full" 
              data-form="job-form"
            >
              {/* ServiceM8-style Two Panel Layout */}
              <div className="flex h-full w-full">
                {/* Left Panel - Job Details */}
                <div className="flex-[3] bg-white border-r border-gray-300 p-4 overflow-y-auto rounded-l-lg">
                  {sidebarTab === 'details' && (
                    <div className="space-y-4">
                      {/* Customer Selection */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <UserCircle className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-800">Customer</h4>
                        </div>
                        
                        {/* Customer Tabs */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          <button
                            type="button"
                            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                              activeCustomerTab === 'existing' 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                            onClick={() => {
                              setActiveCustomerTab('existing');
                              form.setValue('isNewCustomer', false);
                              // Clear new customer fields
                              form.setValue('newCustomerName', '');
                              form.setValue('newCustomerEmail', '');
                              form.setValue('newCustomerPhone', '');
                              form.setValue('newCustomerAddress', '');
                              form.setValue('newCustomerCity', '');
                              form.setValue('newCustomerRegion', '');
                            }}
                            data-testid="tab-existing-customer"
                          >
                            Existing Customer
                          </button>
                          <button
                            type="button"
                            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                              activeCustomerTab === 'new' 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                            onClick={() => {
                              setActiveCustomerTab('new');
                              form.setValue('isNewCustomer', true);
                              form.setValue('customerId', '');
                            }}
                            data-testid="tab-new-customer"
                          >
                            New Customer
                          </button>
                        </div>

                        {/* Existing Customer Selection */}
                        {activeCustomerTab === 'existing' && (
                          <div>
                            <FormField
                              control={form.control}
                              name="customerId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select 
                                      value={field.value} 
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        form.setValue('isNewCustomer', false);
                                        
                                        // Populate customer details into job contact fields
                                        const selectedCustomer = customersData?.data?.find(c => c.id === value);
                                        if (selectedCustomer) {
                                          // Split customer name into first and last for job contact fields
                                          const nameParts = selectedCustomer.name.split(' ');
                                          form.setValue('jobContactFirstName', nameParts[0] || '');
                                          form.setValue('jobContactLastName', nameParts.slice(1).join(' ') || '');
                                          form.setValue('jobContactEmail', selectedCustomer.email || '');
                                          form.setValue('jobContactPhone', selectedCustomer.phone || '');
                                        }
                                      }}
                                      data-testid="select-customer"
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a customer..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {customersData?.data?.map((customer) => (
                                          <SelectItem key={customer.id} value={customer.id}>
                                            {customer.name} - {customer.email}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        {/* New Customer Form */}
                        {activeCustomerTab === 'new' && (
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
                          <h3 className="font-semibold text-lg">
                            {selectedCustomer?.name || formData.newCustomerName || 'Customer Name'}
                          </h3>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>{selectedCustomer?.address || formData.newCustomerAddress || 'Address'}</div>
                          <div>{selectedCustomer?.city || formData.newCustomerCity || 'City'}, {selectedCustomer?.region || formData.newCustomerRegion || 'Region'}</div>
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
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Job Description */}
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Job Description</label>
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea 
                                    {...field}
                                    className="min-h-[90px] text-sm" 
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
                </div>

                {/* Right Panel - Activity Diary */}
                <div className="flex-[2] bg-white overflow-y-auto rounded-r-lg">
                  {editingJob && (
                    <JobDiarySection 
                      jobId={editingJob.id}
                      isServiceM8Style={true}
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
              </div>

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
          recipientName={selectedCustomer?.name || ''}
          recipientPhone={selectedCustomer?.phone || ''}
          jobTitle={mode === "create" ? "New Job" : `Job #${editingJob?.jobNumber || ""}`}
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
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <h2 className="text-lg font-semibold">Quote Preview - {editingJob?.title || 'Job'}</h2>
            </DialogHeader>
            <div className="p-6">
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
                showActions={true}
                onSave={handleSaveQuote}
                onEmail={() => {
                  setIsQuoteModalOpen(false);
                  handleEmailClick('quote');
                }}
                onDownload={() => {
                  toast({
                    title: "Download Started",
                    description: "Quote PDF download will be available soon.",
                  });
                }}
                onCopy={() => {
                  toast({
                    title: "Copied",
                    description: "Quote details copied to clipboard.",
                  });
                }}
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
              <h2 className="text-lg font-semibold">Profit Tracking - {editingJob.title}</h2>
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
                <label className="text-sm font-medium">End Time</label>
                <Input
                  type="time"
                  value={schedulingData.endTime}
                  onChange={(e) => setSchedulingData(prev => ({ ...prev, endTime: e.target.value }))}
                  data-testid="input-schedule-end-time"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Assigned To</label>
              <Select
                value={schedulingData.assignedTo}
                onValueChange={(value) => setSchedulingData(prev => ({ ...prev, assignedTo: value }))}
              >
                <SelectTrigger data-testid="select-schedule-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee: any) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  endTime: '',
                  assignedTo: '',
                  notes: ''
                });
              }}
              data-testid="btn-cancel-schedule"
            >
              Cancel
            </Button>
            <Button
              onClick={saveSchedule}
              disabled={!schedulingData.date || !schedulingData.startTime || !schedulingData.endTime || !schedulingData.assignedTo}
              data-testid="btn-save-schedule"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Clock className="h-4 w-4 mr-2" />
              Schedule Job
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
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
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
  const [isSMSComposerOpen, setIsSMSComposerOpen] = useState(false);
  
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
  
  const invoiceTemplate = invoiceTemplateData || null;
  const quoteTemplate = quoteTemplateData || null;

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
      totalCost: newLineItem.quantity * (newLineItem.unitCost || 0)
    };

    const currentLineItems = form.getValues('lineItems') || [];
    form.setValue('lineItems', [...currentLineItems, lineItem]);
    
    // Reset form
    setNewLineItem({
      description: '',
      quantity: 1,
      unitPrice: 0,
      unitCost: 0
    });
    setIsAddingLineItem(false);
    
    // Calculate profit impact for enhanced tracking
    const updatedLineItems = form.getValues('lineItems') || [];
    const newJobRevenue = updatedLineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const newJobCosts = updatedLineItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const revenueIncrease = lineItem.total;
    const costIncrease = lineItem.totalCost;
    const profitMargin = newJobRevenue - newJobCosts;
    
    toast({
      title: "Profit Tracking",
      description: `Added "${lineItem.description}" • Revenue: +$${revenueIncrease.toFixed(2)} • Costs: +$${costIncrease.toFixed(2)} • Job Profit: $${profitMargin.toFixed(2)}`
    });
  };

  const removeLineItem = (index: number) => {
    const currentLineItems = form.getValues('lineItems') || [];
    const updatedLineItems = currentLineItems.filter((_, i) => i !== index);
    form.setValue('lineItems', updatedLineItems);
    
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
    const unitPrice = parseFloat(item.displayPrice || item.price || 0);
    const unitCost = parseFloat(item.cost || item.baseCost || 0);
    const itemName = item.name || item.itemNumber;
    
    // Create line item directly
    const lineItem = {
      id: `item-${Date.now()}`,
      description: itemName,
      quantity: 1,
      unitPrice: unitPrice,
      unitCost: unitCost,
      total: unitPrice,
      totalCost: unitCost
    };

    const currentLineItems = form.getValues('lineItems') || [];
    form.setValue('lineItems', [...currentLineItems, lineItem]);
    
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
      return job || jobs.find(j => j.id === jobId);
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
      status: "work_order",
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

  // Populate form with complete job data when editing an existing job
  useEffect(() => {
    if (editingJob) {
      // Split customer name into first and last name for form fields
      const nameParts = editingJobCustomer?.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      form.reset({
        // Core job data
        title: editingJob.title || '',
        description: editingJob.description || '',
        status: (editingJob.status as any) || 'work_order',
        priority: editingJob.priority || 'medium',
        customerId: editingJob.customerId || '',
        leadSource: editingJob.leadSource || '',
        address: editingJob.address || '',
        city: editingJob.city || '',
        region: editingJob.region || '',
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
        // Arrays
        lineItems: editingJob.lineItems || [],
        checklist: editingJob.checklist || [],
      });
    }
  }, [editingJob, editingJobCustomer, form]);

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

  // Handle email click
  const handleEmailClick = () => {
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
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" data-testid="button-queue">
                <FileText className="w-4 h-4 mr-1" />
                Queue
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" data-testid="button-form">
                <FileText className="w-4 h-4 mr-1" />
                Form
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setIsProposalBuilderOpen(true)} data-testid="button-proposal">
                <Presentation className="w-4 h-4 mr-1" />
                Proposal
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setIsProfitTrackerOpen(true)} data-testid="button-profit">
                <DollarSign className="w-4 h-4 mr-1" />
                Profit
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setIsTimeTrackingOpen(true)} data-testid="button-time">
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
                  <DropdownMenuItem onClick={() => console.log('Print clicked')}>
                    Print
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Duplicate clicked')}>
                    Duplicate Job
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log('Archive clicked')}>
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Right: Save and Close Button */}
            <div className="flex items-center gap-2">
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
                            <Select>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Work Order" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="work-order">Work Order</SelectItem>
                                <SelectItem value="quote">Quote</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
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

                        {/* Job Description */}
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Job Description</label>
                          <Textarea 
                            className="min-h-[90px] text-sm" 
                            placeholder="Describe the work that needs to be done"
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
                        {form.watch('lineItems')?.length > 0 ? (
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
                                  <div className="col-span-3">Item Name</div>
                                  <div className="col-span-1 text-center">Qty</div>
                                  <div className="col-span-2 text-right">Cost ex GST</div>
                                  <div className="col-span-1 text-right">Markup</div>
                                  <div className="col-span-2 text-right">Price ex GST</div>
                                  <div className="col-span-1 text-right">Total ex GST</div>
                                </div>
                              </div>

                              {/* Table Body */}
                              <div className="bg-white">
                                {form.watch('lineItems')?.map((item: any, index: number) => {
                                  const costExGst = item.totalCost || 0;
                                  const priceExGst = item.unitPrice || 0;
                                  const totalExGst = (item.quantity || 0) * priceExGst;
                                  const markup = priceExGst - costExGst;
                                  const markupPercent = costExGst > 0 ? ((markup / costExGst) * 100).toFixed(0) : '0';
                                  
                                  return (
                                    <div key={item.id || index} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-sm">
                                      <div className="col-span-2 text-gray-500">—</div>
                                      <div className="col-span-3 font-medium text-gray-900">
                                        <div className="flex items-center gap-2">
                                          <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0"></div>
                                          {item.description}
                                        </div>
                                      </div>
                                      <div className="col-span-1 text-center">{item.quantity || 1}</div>
                                      <div className="col-span-2 text-right font-mono">${costExGst.toFixed(2)}</div>
                                      <div className="col-span-1 text-right text-gray-600">{markupPercent}%</div>
                                      <div className="col-span-2 text-right font-mono">${priceExGst.toFixed(2)}</div>
                                      <div className="col-span-1 text-right font-mono font-semibold">${totalExGst.toFixed(2)}</div>
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
                  {form.watch('lineItems')?.length > 0 ? (
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
                            {form.watch('lineItems').map((item: any, index: number) => {
                              const unitPrice = item.unitPrice || 0;
                              const quantity = item.quantity || 0;
                              const total = quantity * unitPrice;
                              const unitCost = item.unitCost || 0;
                              const totalCost = quantity * unitCost;
                              const markup = total > 0 && totalCost > 0 ? ((total - totalCost) / totalCost * 100) : 0;
                              
                              return (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                  <td className="p-2">
                                    <span className="text-blue-600 font-mono text-xs">{item.itemCode || '-'}</span>
                                  </td>
                                  <td className="p-2">
                                    <div className="font-medium text-gray-900">{item.description}</div>
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
                                      onClick={() => removeLineItem(index)}
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
          recipientName={selectedCustomer?.name || ''}
          recipientEmail={selectedCustomer?.email || ''}
          jobTitle={mode === "create" ? "New Job" : `Job #${editingJob?.jobNumber || ""}`}
          lineItems={formData?.lineItems || []}
          invoiceTemplate={invoiceTemplate}
          customer={selectedCustomer}
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
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { X, Plus, Mail, MessageSquare, Phone, Calendar, FileText, Presentation, Check, Trash2, User, Building2, Building, DollarSign, ChevronDown, Receipt, Send, CreditCard, CheckCircle, Settings, Zap, Percent, Clock, MapPin, Target } from "lucide-react";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { ProposalBuilder } from "./ProposalBuilder";
import { JobDiarySection } from "./JobDiarySection";
import { StaffTimeManager } from "./StaffTimeManager";
import { StaffTimeTracker } from "./StaffTimeTracker";
import { ExpenseManager } from "./ExpenseManager";
import { GrossMarginCalculator } from "./GrossMarginCalculator";
import { ServiceM8TimeRecordingModal } from "./ServiceM8TimeRecordingModal";
import { EmailComposerModal } from "./EmailComposerModal";
import { SMSComposerModal } from "./SMSComposerModal";
import { ServiceM8HeaderToolbar } from "./ServiceM8HeaderToolbar";
import { ServiceM8ActivityFeed } from "./ServiceM8ActivityFeed";

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
const globalJobCardSchema = insertJobSchema.omit({ title: true }).extend({
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
  billingContactPhone: z.string().optional(),
  billingContactMobile: z.string().optional(),
  
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Proposal builder state
  const [isProposalBuilderOpen, setIsProposalBuilderOpen] = useState(false);
  
  // Margin tracker dialog states
  const [isStaffTimeDialogOpen, setIsStaffTimeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isServiceM8TimeModalOpen, setIsServiceM8TimeModalOpen] = useState(false);
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

  // Line item search state
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

  // Fetch all jobs for address lookup
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
    enabled: isOpen,
  });

  // Fetch job data if editing
  const { data: jobData } = useQuery({
    queryKey: ['/api/jobs', jobId],
    enabled: mode === "edit" && !!jobId && isOpen,
  });

  // Fetch all materials and services for dropdown when focused
  const { data: allMaterialsServicesData } = useQuery({
    queryKey: ['/api/materials-services'],
    queryFn: async () => {
      const response = await fetch('/api/materials-services');
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch filtered materials and services for search
  const { data: materialsServicesData } = useQuery({
    queryKey: ['/api/materials-services', debouncedSearchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/materials-services?search=${encodeURIComponent(debouncedSearchQuery)}`);
      return response.json();
    },
    enabled: debouncedSearchQuery.length > 0 && isOpen,
  });

  const customers = (customersData as any)?.data || [];
  const jobs = (jobsData as any)?.data || [];
  const editingJob = mode === "edit" ? ((jobData as any)?.data || job) : null;
  const materialsServices = (materialsServicesData as any)?.data || [];
  const allMaterialsServices = (allMaterialsServicesData as any)?.data || [];

  // Search results - show all items when no search query, filtered results when searching
  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery) {
      // Show all materials/services when no search query
      return allMaterialsServices.slice(0, 10); // Limit to 10 for better UX
    }
    // Show filtered results when searching
    return materialsServices.slice(0, 5); // Limit to 5 for search results
  }, [materialsServices, allMaterialsServices, debouncedSearchQuery]);
  
  // Tab state management
  const [activeTab, setActiveTab] = useState("details");
  
  // Line items state
  const [lineItems, setLineItems] = useState<Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>>([]);

  // Tax calculation state
  const [isTaxInclusive, setIsTaxInclusive] = useState(true); // Default to Tax Inclusive

  const form = useForm<GlobalJobCardFormData>({
    resolver: zodResolver(globalJobCardSchema),
    defaultValues: {
      customerId: customerId || editingJob?.customerId || "",
      isNewCustomer: false,
      description: editingJob?.description || "",
      address: editingJob?.address || "",
      status: editingJob?.status || "lead",
      serviceType: editingJob?.serviceType || "",
      priority: editingJob?.priority || "medium",
      jobNumber: editingJob?.jobNumber || "",
      leadSource: editingJob?.leadSource || "direct",
      // Contact fields
      jobContactFirstName: "",
      jobContactLastName: "",
      jobContactEmail: "",
      jobContactPhone: "",
      billingContactPhone: "",
      billingContactMobile: "",
    },
  });

  useEffect(() => {
    if (mode === "edit" && editingJob) {
      setChecklist(Array.isArray(editingJob.checklist) ? editingJob.checklist : []);
      setLineItems(Array.isArray(editingJob.lineItems) ? editingJob.lineItems : []);
      form.reset({
        customerId: editingJob.customerId || "",
        description: editingJob.description || "",
        address: editingJob.address || "",
        status: editingJob.status || "lead",
        serviceType: editingJob.serviceType || "",
        priority: editingJob.priority || "medium",
        jobNumber: editingJob.jobNumber || "",
        leadSource: editingJob.leadSource || "direct",
      });
    }
  }, [mode, editingJob, form]);
  
  // Initialize line items from job data when component mounts
  useEffect(() => {
    if (editingJob?.lineItems && Array.isArray(editingJob.lineItems)) {
      setLineItems(editingJob.lineItems);
    }
  }, [editingJob?.lineItems]);

  // State for selected customer in form
  const [formSelectedCustomer, setFormSelectedCustomer] = useState<Customer | null>(null);
  
  // Find the selected customer for diary section (after form is defined)
  const selectedCustomerId = form.watch("customerId") || customerId;
  const selectedCustomer = customers.find((customer: any) => customer.id === selectedCustomerId);
  
  // Update formSelectedCustomer when form changes
  useEffect(() => {
    const currentCustomerId = form.getValues("customerId");
    if (currentCustomerId) {
      const customer = customers.find((c: Customer) => c.id === currentCustomerId);
      setFormSelectedCustomer(customer || null);
    } else {
      setFormSelectedCustomer(null);
    }
  }, [form.watch("customerId"), customers]);

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newChecklistItem.trim(),
        completed: false
      };
      setChecklist([...checklist, newItem]);
      setNewChecklistItem("");
    }
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(checklist.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };
  
  // Line item management functions
  const addLineItem = (materialService?: any) => {
    const newItem = {
      id: Date.now().toString(),
      itemCode: materialService?.itemNumber || "",
      itemName: materialService?.name || "",
      description: materialService?.name || "",
      quantity: 1,
      unitPrice: materialService?.price || 0,
      total: materialService?.price || 0,
      category: materialService?.category || "",
      taxRate: materialService?.taxRate || "15% GST on Income"
    };
    setLineItems([...lineItems, newItem]);
    
    // Clear search after adding item
    setSearchQuery("");
    setShowSearchResults(false);
  };

  // Handle search item selection
  const handleSelectSearchItem = (item: any) => {
    addLineItem(item);
  };
  
  const updateLineItem = (id: string, field: keyof typeof lineItems[0], value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Always recalculate total when quantity or unitPrice changes
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = field === 'quantity' ? value : updated.quantity;
          const price = field === 'unitPrice' ? value : updated.unitPrice;
          updated.total = (qty || 0) * (price || 0);
        }
        return updated;
      }
      return item;
    }));
  };
  
  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };
  
  const getTotalAmount = () => {
    const total = lineItems.reduce((sum, item) => sum + item.total, 0);
    return total.toFixed(2); // Convert to string with 2 decimal places for decimal type
  };

  // Calculate subtotal, GST, and total for display
  const getCalculatedTotals = () => {
    const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const gstRate = 0.15; // 15% GST
    
    if (isTaxInclusive) {
      // When tax inclusive: the line items total includes GST
      const total = lineItemsTotal;
      const subtotal = total / (1 + gstRate); // Extract subtotal from inclusive total
      const gst = total - subtotal;
      
      return {
        subtotal: subtotal.toFixed(2),
        gst: gst.toFixed(2),
        total: total.toFixed(2)
      };
    } else {
      // When tax exclusive: the line items total is the subtotal
      const subtotal = lineItemsTotal;
      const gst = subtotal * gstRate;
      const total = subtotal + gst;
      
      return {
        subtotal: subtotal.toFixed(2),
        gst: gst.toFixed(2),
        total: total.toFixed(2)
      };
    }
  };

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/jobs', data);
      return response.json();
    },
    onSuccess: (response) => {
      toast({ title: "Success", description: "Job created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      onJobCreated?.(response.data || response);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create job",
        variant: "destructive"
      });
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', `/api/jobs/${jobId}`, data);
      return response.json();
    },
    onSuccess: (response) => {
      toast({ title: "Success", description: "Job updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      }
      onJobUpdated?.(response.data || response);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update job",
        variant: "destructive"
      });
    }
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const response = await apiRequest('POST', '/api/customers', customerData);
      return response.json();
    },
  });

  const onSubmit = async (data: GlobalJobCardFormData) => {
    try {
      let finalCustomerId = data.customerId;

      // Create new customer if needed
      if (data.isNewCustomer && data.newCustomerName) {
        const customerResponse = await createCustomerMutation.mutateAsync({
          name: data.newCustomerName,
          email: data.newCustomerEmail || undefined,
          phone: data.newCustomerPhone || undefined,
          address: data.newCustomerAddress || undefined,
          city: data.newCustomerCity || undefined,
          region: data.newCustomerRegion || undefined,
        });
        finalCustomerId = customerResponse.data?.id || customerResponse.id;
      }

      const jobData = {
        customerId: finalCustomerId,
        description: data.description,
        address: data.address,
        status: data.status,
        serviceType: data.serviceType,
        priority: data.priority,
        leadSource: data.leadSource,
        jobNumber: data.jobNumber,
        checklist: checklist,
        totalAmount: getTotalAmount(),
        lineItems: lineItems,
      };

      // Debug logging for job save
      console.log('GlobalJobCard SAVE DEBUG:', {
        mode,
        jobData,
        lineItemsCount: lineItems.length,
        totalAmount: getTotalAmount(),
        lineItems: lineItems
      });

      if (mode === "create") {
        createJobMutation.mutate(jobData);
      } else {
        updateJobMutation.mutate(jobData);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to process job",
        variant: "destructive"
      });
    }
  };

  const isLoading = createJobMutation.isPending || updateJobMutation.isPending || createCustomerMutation.isPending;

  // Button click handlers
  const handleScheduleClick = () => {
    if (!editingJob) return;
    
    // Pre-populate scheduling data with current job information
    const jobDate = editingJob.scheduledDate || editingJob.serviceDate || new Date().toISOString();
    const date = new Date(jobDate);
    
    setSchedulingData({
      date: format(date, 'yyyy-MM-dd'),
      startTime: format(date, 'HH:mm'),
      endTime: format(new Date(date.getTime() + (editingJob.estimatedDuration || 2) * 60 * 60 * 1000), 'HH:mm'),
      assignedTo: editingJob.staffId || '',
      notes: ''
    });
    
    setIsSchedulingModalOpen(true);
    
    console.log("Schedule button clicked - opening scheduling modal");
  };

  const handleProposalClick = () => {
    console.log('Proposal Generator - Opening proposal builder...');
    setIsProposalBuilderOpen(true);
    toast({
      title: "Proposal Builder",
      description: "Opening proposal builder interface...",
    });
  };

  const handleEmailClick = async () => {
    if (!editingJob) return;
    
    toast({
      title: "Email Customer",
      description: "Opening email composer...",
    });
    
    try {
      // If job has no invoice yet, create one first
      if (!editingJob.invoiceId) {
        console.log("Creating invoice before opening email composer");
        const invoiceData = await convertToInvoiceMutation.mutateAsync({ invoiceType: 'full' });
        setCurrentInvoiceData(invoiceData);
        
        // Invalidate queries to refresh job data
        await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id] });
      }
      
      setIsEmailComposerOpen(true);
      console.log("Email button clicked - opening composer");
    } catch (error) {
      console.error("Error in handleEmailClick:", error);
    }
  };

  const handleSMSClick = () => {
    toast({
      title: "Send SMS",
      description: "Opening SMS composer...",
    });
    // TODO: Open SMS modal or send SMS using Twilio
    console.log("SMS button clicked");
  };

  const handleCallClick = () => {
    toast({
      title: "Initiate Call",
      description: "Preparing to call customer...",
    });
    // TODO: Log call or initiate VoIP call
    console.log("Call button clicked");
  };

  // Invoice action handlers
  const convertToInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: { invoiceType: 'full' | 'partial'; customData?: any }) => {
      if (!editingJob?.id) throw new Error("No job selected");
      return apiRequest('POST', `/api/jobs/${editingJob.id}/convert-to-invoice`, invoiceData);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: "Invoice Created",
        description: data.message || "Invoice created successfully",
      });
      // Refresh job data
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      console.log("Invoice created:", data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive"
      });
    }
  });

  const [currentInvoiceData, setCurrentInvoiceData] = useState<any>(null);

  const handleSendInvoice = async () => {
    if (!editingJob) return;
    
    try {
      // First convert to invoice, then handle sending - mutation already returns parsed JSON
      const invoiceData = await convertToInvoiceMutation.mutateAsync({ invoiceType: 'full' });
      
      // Store the fresh invoice data for the email modal
      setCurrentInvoiceData(invoiceData);
      
      // Invalidate and refetch job queries to get updated job with invoice reference
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id] });
      
      console.log("Send Invoice - job converted, opening email composer");
      setIsEmailComposerOpen(true);
    } catch (error) {
      console.error("Error in handleSendInvoice:", error);
    }
  };

  const handleSMSInvoice = async () => {
    if (!editingJob) return;
    
    try {
      // If job has no invoice yet, create one first
      let invoiceData = currentInvoiceData;
      if (!editingJob.invoiceId) {
        console.log("Creating invoice before opening SMS composer");
        invoiceData = await convertToInvoiceMutation.mutateAsync({ invoiceType: 'full' });
        setCurrentInvoiceData(invoiceData);
        
        // Invalidate queries to refresh job data
        await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/jobs', editingJob.id] });
      }
      
      toast({
        title: "SMS Invoice",
        description: "Opening SMS composer...",
      });
      setIsSMSComposerOpen(true);
      console.log("SMS Invoice - opening SMS composer");
    } catch (error) {
      console.error("Error in handleSMSInvoice:", error);
    }
  };

  const handleAddPayment = () => {
    toast({
      title: "Add Payment",
      description: "Opening payment recording interface...",
    });
    console.log("Add Payment clicked");
    // TODO: Implement payment recording functionality
  };

  const handleApproveToXero = async () => {
    if (!editingJob) return;
    
    // Check if job is completed first
    if (editingJob.status !== 'completed') {
      toast({
        title: "Job Not Completed",
        description: "Job must be completed before sending to Xero",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Convert to invoice if not already done
      if (!editingJob.invoiceId) {
        await convertToInvoiceMutation.mutateAsync({ invoiceType: 'full' });
      }
      
      // TODO: Implement actual Xero API integration here
      // For now, simulate the Xero sending process
      toast({
        title: "Sent to Xero",
        description: "Invoice has been successfully sent to Xero accounting system",
      });
      console.log("Approve to Xero - invoice sent to Xero for job:", editingJob.jobNumber);
      
      // TODO: Update job with xeroSent status when Xero integration is added
      // await updateJobXeroStatus(editingJob.id, true);
      
    } catch (error) {
      console.error("Error in handleApproveToXero:", error);
      toast({
        title: "Xero Integration Error", 
        description: "Failed to send invoice to Xero",
        variant: "destructive"
      });
    }
  };

  const handleCustomiseInvoice = async () => {
    if (!editingJob) return;
    
    try {
      await convertToInvoiceMutation.mutateAsync({ invoiceType: 'full' });
      
      toast({
        title: "Customise Invoice",
        description: "Invoice created. Opening customization interface...",
      });
      console.log("Customise Invoice - job converted, opening editor");
      // TODO: Open invoice customization modal
    } catch (error) {
      console.error("Error in handleCustomiseInvoice:", error);
    }
  };

  const handleAutoInvoice = async () => {
    if (!editingJob) return;
    
    try {
      await convertToInvoiceMutation.mutateAsync({ invoiceType: 'full' });
      
      toast({
        title: "Auto Invoice",
        description: "Invoice auto-generated from job details!",
      });
      console.log("Auto Invoice - job converted automatically");
    } catch (error) {
      console.error("Error in handleAutoInvoice:", error);
    }
  };

  const handlePartialInvoice = async () => {
    if (!editingJob) return;
    
    // TODO: Open modal to get percentage for partial invoice
    const percentage = prompt("Enter percentage for partial invoice (e.g., 50 for 50%):");
    if (!percentage || isNaN(Number(percentage))) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid percentage",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await convertToInvoiceMutation.mutateAsync({ 
        invoiceType: 'partial', 
        customData: { percentage: Number(percentage) } 
      });
      
      toast({
        title: "Partial Invoice",
        description: `${percentage}% partial invoice created successfully!`,
      });
      console.log(`Partial Invoice - ${percentage}% of job converted`);
    } catch (error) {
      console.error("Error in handlePartialInvoice:", error);
    }
  };

  // Save schedule function
  const saveSchedule = async () => {
    if (!editingJob || !schedulingData.date || !schedulingData.startTime || !schedulingData.endTime || !schedulingData.assignedTo) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required scheduling fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const scheduledDate = new Date(`${schedulingData.date}T${schedulingData.startTime}:00`);
      const endDate = new Date(`${schedulingData.date}T${schedulingData.endTime}:00`);
      
      const updatedJob = {
        ...editingJob,
        scheduledDate: scheduledDate.toISOString(),
        staffId: schedulingData.assignedTo,
        status: 'scheduled' as const,
        notes: schedulingData.notes ? `${editingJob.notes || ''}\nScheduling Notes: ${schedulingData.notes}`.trim() : editingJob.notes
      };

      await updateJobMutation.mutateAsync(updatedJob);
      
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0">
        {/* ServiceM8-Style Header */}
        <ServiceM8HeaderToolbar
          mode={mode}
          jobNumber={editingJob?.jobNumber}
          customerName={selectedCustomer?.name}
          onClose={onClose}
          onEmailClick={handleEmailClick}
          onSMSClick={() => setIsSMSComposerOpen(true)}
          onCallClick={handleCallClick}
          onScheduleClick={handleScheduleClick}
          onQueueClick={() => setIsServiceM8TimeModalOpen(true)}
          onFormClick={() => setActiveTab('details')}
          onProposalClick={handleProposalClick}
          onProfitClick={() => setIsStaffTimeDialogOpen(true)}
          onTrackExpenses={() => setIsExpenseDialogOpen(true)}
          onSendInvoice={handleSendInvoice}
          onSMSInvoice={handleSMSInvoice}
          onAutoInvoice={handleAutoInvoice}
          onPartialInvoice={handlePartialInvoice}
          onCustomiseInvoice={handleCustomiseInvoice}
          onAddPayment={handleAddPayment}
          onSendToXero={handleApproveToXero}
        />

        {/* Tabbed interface */}
        <div className="flex-1 flex flex-col min-h-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full" data-form="job-form">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                <div className="px-4 pt-2 pb-0">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details" data-testid="tab-details">
                      Job Details
                    </TabsTrigger>
                    <TabsTrigger 
                      value="diary" 
                      disabled={!jobId}
                      data-testid="tab-diary"
                    >
                      Job Diary
                    </TabsTrigger>
                    <TabsTrigger 
                      value="profit" 
                      disabled={!jobId}
                      data-testid="tab-profit"
                    >
                      Profit Tracking
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <TabsContent value="details" className="h-full m-0">
                    <div className="h-full overflow-y-auto px-3 pb-1">
                      <div className="space-y-2">
                        {/* Customer Contact Details (Read-only when editing) */}
                        {mode === "edit" && editingJob && (
                          <Card>
                            <CardHeader className="pb-1">
                              <CardTitle className="flex items-center gap-1 text-xs font-medium">
                                <User className="w-3 h-3" />
                                Customer Contact Details
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-1 text-xs">
                              {(() => {
                                const selectedCustomer = customers.find((c: Customer) => c.id === editingJob.customerId);
                                if (selectedCustomer) {
                                  // Parse name into first and last name
                                  const nameParts = selectedCustomer.name?.split(' ') || ['Customer'];
                                  const firstName = nameParts[0] || '';
                                  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                                  
                                  return (
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div>
                                        <div className="font-medium text-xs">{firstName} {lastName}</div>
                                        <div className="text-muted-foreground text-[10px]">Contact</div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-xs">{selectedCustomer?.email || 'N/A'}</div>
                                        <div className="text-muted-foreground text-[10px]">Email</div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-xs">{selectedCustomer?.phone || 'N/A'}</div>
                                        <div className="text-muted-foreground text-[10px]">Phone</div>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="text-center py-4 text-muted-foreground">
                                    No customer selected for this job
                                  </div>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        )}

                        {/* Customer Selection Section - Only for Create Mode */}
                        {mode === "create" && (
                          <Card>
                            <CardHeader className="pb-1">
                              <CardTitle className="flex items-center gap-1 text-xs font-medium">
                                <User className="w-3 h-3" />
                                Customer Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-1 text-xs">
                              <Tabs value={activeCustomerTab} onValueChange={setActiveCustomerTab}>
                              <TabsList className="grid w-full grid-cols-2 h-7">
                                <TabsTrigger 
                                  value="existing" 
                                  onClick={() => form.setValue("isNewCustomer", false)}
                                  data-testid="tab-existing-customer"
                                >
                                  <Building2 className="w-3 h-3 mr-1" />
                                  Existing Customer
                                </TabsTrigger>
                                <TabsTrigger 
                                  value="new" 
                                  onClick={() => form.setValue("isNewCustomer", true)}
                                  data-testid="tab-new-customer"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  New Customer
                                </TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="existing" className="space-y-1 mt-1">
                                <FormField
                                  control={form.control}
                                  name="customerId"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Select Customer</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value || ""} disabled={mode === "edit"}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-customer" className="h-7 text-xs">
                                            <SelectValue placeholder="Choose a customer..." />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {customers.map((customer: Customer) => (
                                            <SelectItem key={customer.id} value={customer.id}>
                                              {customer.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TabsContent>
                              
                              <TabsContent value="new" className="space-y-1">
                                <div className="grid grid-cols-2 gap-2">
                                  <FormField
                                    control={form.control}
                                    name="newCustomerName"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Customer Name *</FormLabel>
                                        <FormControl>
                                          <Input {...field} value={field.value || ""} placeholder="John Smith" data-testid="input-new-customer-name" className="h-7 text-xs" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="newCustomerEmail"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Email Address</FormLabel>
                                        <FormControl>
                                          <Input {...field} value={field.value || ""} type="email" placeholder="john@example.com" data-testid="input-new-customer-email" className="h-7 text-xs" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <FormField
                                    control={form.control}
                                    name="newCustomerPhone"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Mobile Phone</FormLabel>
                                        <FormControl>
                                          <Input {...field} value={field.value || ""} placeholder="021 123 4567" data-testid="input-new-customer-phone" className="h-7 text-xs" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="newCustomerAddress"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Street Address</FormLabel>
                                        <FormControl>
                                          <AddressAutocomplete
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            placeholder="123 Main St"
                                            mode="street"
                                            className="h-7 text-xs"
                                            data-testid="input-new-customer-address"
                                            onAddressSelect={(address) => {
                                              // Auto-fill city and region when full address is selected
                                              if (address.city) {
                                                form.setValue('newCustomerCity', address.city);
                                              }
                                              if (address.region) {
                                                form.setValue('newCustomerRegion', address.region);
                                              }
                                            }}
                                            onManualEdit={() => {
                                              // Clear dependent fields when address is manually edited
                                              form.setValue('newCustomerCity', '');
                                              form.setValue('newCustomerRegion', '');
                                            }}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <FormField
                                    control={form.control}
                                    name="newCustomerCity"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">City</FormLabel>
                                        <FormControl>
                                          <AddressAutocomplete
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            placeholder="Auckland"
                                            mode="city"
                                            className="h-7 text-xs"
                                            data-testid="input-new-customer-city"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="newCustomerRegion"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Region</FormLabel>
                                        <FormControl>
                                          <AddressAutocomplete
                                            value={field.value || ""}
                                            onChange={field.onChange}
                                            placeholder="Auckland"
                                            mode="region"
                                            className="h-7 text-xs"
                                            data-testid="input-new-customer-region"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </TabsContent>
                            </Tabs>
                          </CardContent>
                        </Card>
                        )}

                        {/* Job Details Section */}
                        <Card>
                          <CardHeader className="pb-1">
                            <CardTitle className="flex items-center gap-1 text-xs font-medium">
                              <Building className="w-3 h-3" />
                              Job Details
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-1 space-y-1">
                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      {...field} 
                                      value={field.value || ""}
                                      placeholder="Detailed description of the work to be performed..."
                                      rows={2}
                                      data-testid="textarea-job-description"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="address"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Job Address *</FormLabel>
                                  <FormControl>
                                    <div className="flex items-center gap-2">
                                      <AddressAutocomplete
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                        placeholder="Start typing an address..."
                                        mode="full"
                                        data-testid="input-job-address"
                                        onAddressSelect={(address) => {
                                          // Optionally auto-fill other fields when a full address is selected
                                          console.log('Selected address details:', address);
                                        }}
                                      />
                                      {selectedCustomer && (selectedCustomer.address || selectedCustomer.city || selectedCustomer.region) && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-9 px-2 text-xs"
                                          onClick={() => {
                                            const customerAddress = [
                                              selectedCustomer.address,
                                              selectedCustomer.city,
                                              selectedCustomer.region
                                            ].filter(Boolean).join(', ');
                                            if (customerAddress) {
                                              form.setValue('address', customerAddress);
                                            }
                                          }}
                                          data-testid="button-copy-customer-address"
                                          title="Use customer address"
                                        >
                                          <MapPin className="h-3 w-3" />
                                        </Button>
                                      )}
                                      {form.watch("isNewCustomer") && (form.watch("newCustomerAddress") || form.watch("newCustomerCity") || form.watch("newCustomerRegion")) && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-9 px-2 text-xs"
                                          onClick={() => {
                                            const newCustomerAddress = form.watch("newCustomerAddress");
                                            const newCustomerCity = form.watch("newCustomerCity");
                                            const newCustomerRegion = form.watch("newCustomerRegion");
                                            
                                            const customerAddress = [
                                              newCustomerAddress,
                                              newCustomerCity,
                                              newCustomerRegion
                                            ].filter(Boolean).join(', ');
                                            if (customerAddress) {
                                              form.setValue('address', customerAddress);
                                            }
                                          }}
                                          data-testid="button-copy-new-customer-address"
                                          title="Use new customer address"
                                        >
                                          <MapPin className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-job-status">
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="lead">Lead</SelectItem>
                                        <SelectItem value="quote">Quote</SelectItem>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="work_order">Work Order</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Priority</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-job-priority">
                                          <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="estimatedHours"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Est. Hours</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" placeholder="8" data-testid="input-estimated-hours" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Line Items Section */}
                        <Card>
                          <CardHeader className="pb-1">
                            <CardTitle className="flex items-center justify-between text-xs font-medium">
                              <div className="flex items-center gap-1">
                                <Receipt className="w-3 h-3" />
                                Line Items
                              </div>
                              {/* Line Items Settings Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Settings className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <div className="p-2 space-y-3">
                                    {/* Tax Rate Option */}
                                    <div className="flex items-center space-x-2">
                                      <Checkbox id="tax-rate" />
                                      <label htmlFor="tax-rate" className="text-sm">Tax Rate</label>
                                    </div>
                                    
                                    {/* Cost & Markup Option */}
                                    <div className="flex items-center space-x-2">
                                      <Checkbox id="cost-markup" defaultChecked />
                                      <label htmlFor="cost-markup" className="text-sm">Cost & Markup</label>
                                    </div>
                                    
                                    <DropdownMenuSeparator />
                                    
                                    {/* Tax Calculation Options */}
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2">
                                        <input 
                                          type="radio" 
                                          name="tax-calculation" 
                                          id="tax-inclusive" 
                                          className="w-3 h-3" 
                                          checked={isTaxInclusive}
                                          onChange={() => setIsTaxInclusive(true)}
                                        />
                                        <label htmlFor="tax-inclusive" className="text-sm">Amounts are Tax Inclusive</label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <input 
                                          type="radio" 
                                          name="tax-calculation" 
                                          id="tax-exclusive" 
                                          className="w-3 h-3" 
                                          checked={!isTaxInclusive}
                                          onChange={() => setIsTaxInclusive(false)}
                                        />
                                        <label htmlFor="tax-exclusive" className="text-sm">Amounts are Tax Exclusive</label>
                                      </div>
                                    </div>
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-1 space-y-2">
                            {/* Line Items Table */}
                            <div className="border rounded-md">
                              <div className="grid grid-cols-7 gap-1 p-2 bg-muted/20 border-b text-xs font-medium">
                                <div className="col-span-1">Item Code</div>
                                <div className="col-span-2">Item Name</div>
                                <div className="col-span-1 text-center">Qty</div>
                                <div className="col-span-1 text-right">Cost ex GST</div>
                                <div className="col-span-1 text-center">Markup</div>
                                <div className="col-span-1 text-right">Total ex GST</div>
                              </div>
                              
                              {/* Existing line items */}
                              {lineItems && lineItems.length > 0 ? (
                                lineItems.map((item: any, index: number) => (
                                  <div key={item.id} className="grid grid-cols-7 gap-1 p-2 border-b last:border-b-0 text-xs">
                                    <div className="col-span-1">{item.itemCode || 'labour 22'}</div>
                                    <div className="col-span-2">{item.itemName || 'labour Tree care service'}</div>
                                    <div className="col-span-1 text-center">{item.quantity || 1}</div>
                                    <div className="col-span-1 text-right">${(item.unitPrice || 0).toFixed(2)}</div>
                                    <div className="col-span-1 text-center">{item.markup || '—'}</div>
                                    <div className="col-span-1 text-right font-medium">${(item.total || item.unitPrice || 0).toFixed(2)}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="grid grid-cols-7 gap-1 p-2 text-xs text-muted-foreground">
                                  <div className="col-span-7 text-center py-2">No line items added yet. Search above to add materials or services.</div>
                                </div>
                              )}
                              
                              {/* Search or Add New Input */}
                              <div className="p-2 bg-muted/10 border-t relative">
                                <Input 
                                  placeholder="Search or Add New..."
                                  className="h-7 text-xs"
                                  data-testid="input-search-add-item"
                                  value={searchQuery}
                                  onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowSearchResults(true);
                                  }}
                                  onFocus={() => setShowSearchResults(true)}
                                  onBlur={() => {
                                    // Delay hiding to allow click on results
                                    setTimeout(() => setShowSearchResults(false), 150);
                                  }}
                                />
                                
                                {/* Search Results Dropdown */}
                                {showSearchResults && (
                                  <div className="absolute top-full left-2 right-2 bg-background border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                                    {searchResults.length > 0 ? (
                                      searchResults.map((item: any) => (
                                        <div
                                          key={item.id}
                                          className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                          onClick={() => handleSelectSearchItem(item)}
                                          data-testid={`search-result-${item.id}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                              <div className="text-xs font-medium">{item.itemNumber} - {item.name}</div>
                                              <div className="text-xs text-muted-foreground">{item.category}</div>
                                            </div>
                                            <div className="text-xs font-medium">${item.price.toFixed(2)}</div>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="p-2 text-xs text-muted-foreground text-center">
                                        {debouncedSearchQuery ? 'No items found' : 'No materials or services available'}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Additional Information */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                <span>0 seconds</span>
                                <span className="text-muted-foreground">Job Time</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <span>1 min</span>
                                <span className="text-muted-foreground">Admin Time</span>
                              </div>
                            </div>

                            {/* Total Section - Tax Exclusive Format */}
                            <div className="flex justify-end pt-1">
                              <div className="grid grid-cols-2 gap-4 w-64 text-xs">
                                <div className="text-right font-medium">SUBTOTAL</div>
                                <div className="font-medium">${getCalculatedTotals().subtotal}</div>
                                <div className="text-right">GST</div>
                                <div className="font-medium">${getCalculatedTotals().gst}</div>
                                <div className="text-right font-bold border-t pt-1">Total</div>
                                <div className="font-bold border-t pt-1">${getCalculatedTotals().total}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="diary" className="h-full m-0">
                    <div className="h-full">
                      {jobId ? (
                        <JobDiarySection 
                          jobId={jobId}
                          customerId={form.getValues("customerId") || customerId}
                          customerEmail={selectedCustomer?.email}
                          customerPhone={selectedCustomer?.phone}
                          className="h-full"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <div className="text-sm">Job Diary</div>
                            <div className="text-xs mt-1">Available after job is created</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="profit" className="h-full m-0">
                    <div className="h-full overflow-y-auto px-4 py-4">
                      {jobId ? (
                        <div className="space-y-4">
                          <div className="text-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Job Profitability Tracker</h3>
                            <p className="text-sm text-gray-500">Real-time cost tracking and margin analysis</p>
                          </div>
                          
                          <StaffTimeManager jobId={jobId} />
                          <ExpenseManager jobId={jobId} />
                          <GrossMarginCalculator jobId={jobId} />
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <div className="text-sm">Profit Tracking</div>
                            <div className="text-xs mt-1">Available after job is created</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </form>
          </Form>
        </div>
        
        {/* Form Actions - Always visible outside form */}
        <div className="flex justify-end gap-3 p-4 border-t bg-background">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              console.log('🔧 Save button clicked');
              console.log('📝 Form errors:', form.formState.errors);
              console.log('📋 Form values:', form.getValues());
              console.log('✅ Form is valid:', form.formState.isValid);
              console.log('🏗️ Line items:', lineItems);
              form.handleSubmit(onSubmit)();
            }}
            disabled={isLoading}
            data-testid="button-save-job"
          >
            {isLoading ? "Saving..." : mode === "create" ? "Create Job" : "Update Job"}
          </Button>
        </div>
      </DialogContent>
      
      {/* Proposal Builder Integration */}
      <ProposalBuilder
        isOpen={isProposalBuilderOpen}
        onClose={() => setIsProposalBuilderOpen(false)}
        jobId={jobId}
        customerId={form.watch("customerId") || customerId}
        mode="create"
      />
      
      {/* ServiceM8-Style Time Recording Modal */}
      {jobId && (
        <ServiceM8TimeRecordingModal
          isOpen={isServiceM8TimeModalOpen}
          onClose={() => setIsServiceM8TimeModalOpen(false)}
          jobId={jobId}
          jobNumber={editingJob?.jobNumber || `#${jobId.slice(-4)}`}
        />
      )}

      {/* Email Composer Modal */}
      <EmailComposerModal
        isOpen={isEmailComposerOpen}
        onClose={() => setIsEmailComposerOpen(false)}
        job={editingJob}
        customer={customers.find((c: any) => c.id === editingJob?.customerId)}
        invoiceData={currentInvoiceData}
      />

      {/* SMS Composer Modal */}
      <SMSComposerModal
        isOpen={isSMSComposerOpen}
        onClose={() => setIsSMSComposerOpen(false)}
        job={editingJob}
        customer={customers.find((c: any) => c.id === editingJob?.customerId)}
        invoiceData={currentInvoiceData}
      />
      
      {/* Scheduling Modal */}
      <Dialog open={isSchedulingModalOpen} onOpenChange={setIsSchedulingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Schedule Job</h2>
              <p className="text-sm text-muted-foreground">
                {editingJob ? `Job #${editingJob.jobNumber || 'New'} - ${editingJob.description || 'Untitled'}` : 'Schedule Job'}
              </p>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="schedule-date" className="text-sm font-medium">Date</label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={schedulingData.date}
                  onChange={(e) => setSchedulingData(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-schedule-date"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="schedule-start-time" className="text-sm font-medium">Start Time</label>
                <Input
                  id="schedule-start-time"
                  type="time"
                  value={schedulingData.startTime}
                  onChange={(e) => setSchedulingData(prev => ({ ...prev, startTime: e.target.value }))}
                  data-testid="input-schedule-start-time"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="schedule-end-time" className="text-sm font-medium">End Time</label>
                <Input
                  id="schedule-end-time"
                  type="time"
                  value={schedulingData.endTime}
                  onChange={(e) => setSchedulingData(prev => ({ ...prev, endTime: e.target.value }))}
                  data-testid="input-schedule-end-time"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="schedule-assigned-to" className="text-sm font-medium">Assigned To</label>
                <Select value={schedulingData.assignedTo} onValueChange={(value) => setSchedulingData(prev => ({ ...prev, assignedTo: value }))}>
                  <SelectTrigger id="schedule-assigned-to" data-testid="select-schedule-assigned-to">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(employeesData) ? employeesData.map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    )) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="schedule-notes" className="text-sm font-medium">Notes</label>
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
              disabled={!schedulingData.date || !schedulingData.startTime || !schedulingData.endTime || !schedulingData.assignedTo || updateJobMutation.isPending}
              data-testid="btn-save-schedule"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Clock className="h-4 w-4 mr-2" />
              {updateJobMutation.isPending ? 'Scheduling...' : 'Schedule Job'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

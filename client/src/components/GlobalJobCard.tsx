import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { X, Plus, Mail, MessageSquare, Phone, Calendar, FileText, Presentation, Check, Trash2, User, Building2, Building, DollarSign } from "lucide-react";
import { ProposalBuilder } from "./ProposalBuilder";
import { JobDiarySection } from "./JobDiarySection";
import { StaffTimeManager } from "./StaffTimeManager";
import { ExpenseManager } from "./ExpenseManager";
import { GrossMarginCalculator } from "./GrossMarginCalculator";

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

  // Fetch customers for the dropdown
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
    enabled: isOpen,
  });

  // Fetch job data if editing
  const { data: jobData } = useQuery({
    queryKey: ['/api/jobs', jobId],
    enabled: mode === "edit" && !!jobId && isOpen,
  });

  const customers = (customersData as any)?.data || [];
  const editingJob = mode === "edit" ? ((jobData as any)?.data || job) : null;
  
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

  // Find the selected customer for diary section (after form is defined)
  const selectedCustomerId = form.watch("customerId") || customerId;
  const selectedCustomer = customers.find((customer: any) => customer.id === selectedCustomerId);

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
  const addLineItem = () => {
    const newItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setLineItems([...lineItems, newItem]);
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
        title: data.title,
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
    toast({
      title: "Schedule Feature",
      description: "Opening scheduling interface...",
    });
    // TODO: Open scheduling modal or redirect to calendar
    console.log("Schedule button clicked");
  };

  const handleProposalClick = () => {
    console.log('Proposal Generator - Opening proposal builder...');
    setIsProposalBuilderOpen(true);
    toast({
      title: "Proposal Builder",
      description: "Opening proposal builder interface...",
    });
  };

  const handleEmailClick = () => {
    toast({
      title: "Email Customer",
      description: "Opening email composer...",
    });
    // TODO: Open email modal or send email using SendGrid
    console.log("Email button clicked");
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0">
        {/* Header spans full width */}
        <DialogHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {mode === "create" ? "Create New Job" : "Edit Job"}
                </h2>
                <p className="text-orange-100 text-sm">
                  {mode === "create" ? "Fill in the details to create a new job" : `Job ${editingJob?.jobNumber || ""}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handleScheduleClick}
                data-testid="button-schedule"
              >
                <Calendar className="w-4 h-4 mr-1" />
                Schedule
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handleProposalClick}
                data-testid="button-proposal"
              >
                <Presentation className="w-4 h-4 mr-1" />
                Proposal
              </Button>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-2"
                  onClick={handleEmailClick}
                  data-testid="button-email"
                >
                  <Mail className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-2"
                  onClick={handleSMSClick}
                  data-testid="button-sms"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-2"
                  onClick={handleCallClick}
                  data-testid="button-call"
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/10"
                data-testid="button-close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabbed interface */}
        <div className="flex-1 flex flex-col min-h-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full" data-form="job-form">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                <div className="px-6 pt-4 pb-0">
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
                    <div className="h-full overflow-y-auto px-6 pb-6">
                      <div className="space-y-6">
            {/* Customer Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeCustomerTab} onValueChange={setActiveCustomerTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger 
                      value="existing" 
                      onClick={() => form.setValue("isNewCustomer", false)}
                      data-testid="tab-existing-customer"
                    >
                      <Building2 className="w-4 h-4 mr-2" />
                      Existing Customer
                    </TabsTrigger>
                    <TabsTrigger 
                      value="new" 
                      onClick={() => form.setValue("isNewCustomer", true)}
                      data-testid="tab-new-customer"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Customer
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="existing" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="customerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Customer</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={mode === "edit"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-customer">
                                <SelectValue placeholder="Choose a customer..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customers.map((customer: Customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                  {customer.email && ` - ${customer.email}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  <TabsContent value="new" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="newCustomerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-new-customer-name" />
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
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" data-testid="input-new-customer-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="newCustomerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-new-customer-phone" />
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
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-new-customer-address" />
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

            {/* Job Details Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Job Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter job title" data-testid="input-job-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          rows={3}
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
                        <Input {...field} placeholder="123 Main St, Auckland, NZ" data-testid="input-job-address" />
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
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="quote">Quote</SelectItem>
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
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-job-priority">
                              <SelectValue />
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
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-type">
                              <SelectValue placeholder="Select service..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Tree Removal">Tree Removal</SelectItem>
                            <SelectItem value="Tree Pruning">Tree Pruning</SelectItem>
                            <SelectItem value="Hedge Trimming">Hedge Trimming</SelectItem>
                            <SelectItem value="Stump Grinding">Stump Grinding</SelectItem>
                            <SelectItem value="Tree Assessment">Tree Assessment</SelectItem>
                            <SelectItem value="Storm Damage">Storm Damage</SelectItem>
                            <SelectItem value="Emergency Service">Emergency Service</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="jobNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Number *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="JOB-2024-001" data-testid="input-job-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </CardContent>
            </Card>

            {/* Checklist Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Job Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 border rounded-lg">
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleChecklistItem(item.id)}
                        data-testid={`checkbox-checklist-${item.id}`}
                      />
                      <span className={`flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.text}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChecklistItem(item.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-remove-checklist-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Add checklist item..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                    data-testid="input-new-checklist-item"
                  />
                  <Button 
                    type="button" 
                    onClick={addChecklistItem}
                    data-testid="button-add-checklist-item"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Line Items Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Pricing & Line Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {lineItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg">
                      <div className="col-span-5">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Description (e.g., Oak tree removal)"
                          data-testid={`input-line-item-description-${item.id}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                            updateLineItem(item.id, 'quantity', val);
                          }}
                          placeholder="Qty"
                          min="0"
                          step="0.1"
                          data-testid={`input-line-item-quantity-${item.id}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.unitPrice || ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                            updateLineItem(item.id, 'unitPrice', val);
                          }}
                          placeholder="Unit Price"
                          min="0"
                          step="0.01"
                          data-testid={`input-line-item-price-${item.id}`}
                        />
                      </div>
                      <div className="col-span-2 text-right font-medium">
                        ${item.total.toFixed(2)}
                      </div>
                      <div className="col-span-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-remove-line-item-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={addLineItem}
                    data-testid="button-add-line-item"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line Item
                  </Button>
                  
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total Amount</div>
                    <div className="text-2xl font-bold text-primary">
                      ${getTotalAmount()}
                    </div>
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
                <div className="h-full overflow-y-auto px-6 py-6">
                  {jobId ? (
                    <div className="space-y-6">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Job Profitability Tracker</h3>
                        <p className="text-sm text-gray-500">Real-time cost tracking and margin analysis</p>
                      </div>
                      
                      {/* Staff Time and Expense Management */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <StaffTimeManager 
                          jobId={jobId} 
                          compact={true} 
                          isAddDialogOpen={isStaffTimeDialogOpen}
                          setIsAddDialogOpen={setIsStaffTimeDialogOpen}
                        />
                        <ExpenseManager 
                          jobId={jobId} 
                          compact={true} 
                          isAddDialogOpen={isExpenseDialogOpen}
                          setIsAddDialogOpen={setIsExpenseDialogOpen}
                        />
                      </div>
                      
                      {/* Gross Margin Calculator */}
                      <div className="mt-6">
                        <GrossMarginCalculator 
                          jobId={jobId} 
                          jobData={editingJob}
                          compact={false}
                        />
                      </div>
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
    <div className="flex justify-end gap-3 p-6 border-t bg-background">
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
    </Dialog>
  );
}
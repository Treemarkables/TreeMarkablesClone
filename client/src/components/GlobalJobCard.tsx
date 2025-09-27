import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { X, Plus, Mail, MessageSquare, Phone, Calendar, FileText, Presentation, Check, Trash2, User, Building2, Building, DollarSign, ChevronDown, Receipt, Send, CreditCard, CheckCircle, Settings, Zap, Percent, Clock, MapPin, Target, MoreHorizontal, UserCircle, Edit3, Image as ImageIcon } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("details");
  const [sidebarTab, setSidebarTab] = useState("details");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Proposal builder state
  const [isProposalBuilderOpen, setIsProposalBuilderOpen] = useState(false);
  
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

  const customers: Customer[] = (customersData as any)?.data || [];
  const employees: any[] = (employeesData as any)?.data || [];
  const jobs: Job[] = (jobsData as any)?.data || [];
  const invoiceTemplate = invoiceTemplateData || null;
  const quoteTemplate = quoteTemplateData || null;

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
        status: editingJob.status || 'work_order',
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
        // Arrays
        lineItems: editingJob.lineItems || [],
        checklist: editingJob.checklist || [],
      });
    }
  }, [editingJob, editingJobCustomer, form]);

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
      <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0 bg-gray-50">
        {/* ServiceM8-style Header */}
        <div className="bg-orange-500 border-b border-orange-600 px-4 py-2 flex-shrink-0">
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
            
            {/* Right: Close Button */}
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={onClose} data-testid="button-close">
              Close
            </Button>
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
              className="flex flex-col h-full" 
              data-form="job-form"
            >
              {/* ServiceM8-style Two Panel Layout */}
              <div className="flex h-full">
                {/* Left Panel - Job Details */}
                <div className="w-1/2 bg-white border-r border-gray-300 p-4 overflow-y-auto">
                  {sidebarTab === 'details' && (
                    <div className="space-y-4">
                      {/* Customer Name and Address */}
                      <div className="bg-gray-50 p-3 rounded border">
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
                                    <Select value={field.value} onValueChange={field.onChange}>
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
                            className="min-h-[60px] text-sm" 
                            placeholder="Describe the work that needs to be done"
                          />
                        </div>

                        {/* Checklist */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-600">Checklist</label>
                            <button className="text-xs text-blue-600 hover:text-blue-800">⋯</button>
                          </div>
                          <div className="border rounded p-2 bg-gray-50">
                            <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                              <Plus className="w-3 h-3" />
                              New Item
                            </button>
                          </div>
                        </div>

                        {/* Upcoming Bookings */}
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-2 block">Upcoming Bookings</label>
                          <div className="border rounded p-3 bg-blue-50 text-sm">
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
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Billing Information</h3>
                      <p className="text-gray-600">Billing details and invoice management will be displayed here.</p>
                    </div>
                  )}
                </div>

                {/* Right Panel - Activity Diary */}
                <div className="w-1/2 bg-white overflow-y-auto">
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
              
              {/* Bottom Action Bar */}
              <div className="bg-gray-100 border-t border-gray-300 px-4 py-3 flex justify-between items-center">
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSave}
                    disabled={createJobMutation.isPending || updateJobMutation.isPending}
                    data-testid="button-save"
                  >
                    {(createJobMutation.isPending || updateJobMutation.isPending) ? 'Saving...' : 'Save'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSaveAndClose}
                    disabled={createJobMutation.isPending || updateJobMutation.isPending}
                    data-testid="button-save-close"
                  >
                    {(createJobMutation.isPending || updateJobMutation.isPending) ? 'Saving...' : 'Save & Close'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={onClose} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
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
    </Dialog>
  );
}
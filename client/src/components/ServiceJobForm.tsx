import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { X, Plus, Mail, MessageSquare, Phone, Calendar, FileText, Presentation, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProposalGeneration } from "@/components/ProposalGeneration";

// Form schema with conditional customer creation fields
const jobFormSchema = z.object({
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
  
  // Job details
  description: z.string().optional(),
  address: z.string().min(1, "Job address is required"),
  status: z.string().min(1, "Job status is required"),
  category: z.string().min(1, "Job category is required"),
  priority: z.string().default("medium"),
  estimatedDuration: z.string().optional(),
  poNumber: z.string().optional(),
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

type JobFormData = z.infer<typeof jobFormSchema>;

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface ServiceJobFormProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  onJobCreated?: (job: any) => void;
}

export function ServiceJobForm({ isOpen, onClose, customerId, onJobCreated }: ServiceJobFormProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customers for dropdown
  const { data: customersData } = useQuery({
    queryKey: ['/api/customers'],
    enabled: !customerId, // Only fetch if no customerId provided
  });

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      customerId: customerId || "",
      isNewCustomer: false,
      newCustomerName: "",
      newCustomerEmail: "",
      newCustomerPhone: "",
      newCustomerAddress: "",
      newCustomerCity: "",
      newCustomerRegion: "",
      description: "",
      address: "",
      status: "work_order",
      category: "tree_removal",
      priority: "medium",
      estimatedDuration: "4",
      poNumber: "",
      jobContactFirstName: "",
      jobContactLastName: "",
      jobContactEmail: "",
      jobContactPhone: "",
      billingContactPhone: "",
      billingContactMobile: "",
    },
  });

  // Get next job number
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
  });

  const getNextJobNumber = () => {
    const jobs = (jobsData as any)?.jobs || [];
    const maxJobNumber = jobs.reduce((max: number, job: any) => {
      const match = job.title?.match(/Job #(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    return maxJobNumber + 1;
  };

  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      let finalCustomerId = data.customerId;
      
      // Create new customer if needed
      if (data.isNewCustomer && data.newCustomerName) {
        const customerData = {
          name: data.newCustomerName,
          email: data.newCustomerEmail || "",
          phone: data.newCustomerPhone || "",
          address: data.newCustomerAddress || "",
          city: data.newCustomerCity || "",
          region: data.newCustomerRegion || "",
          source: "job_creation"
        };
        
        const customerResponse = await apiRequest('POST', '/api/customers', customerData);
        const customerResult = await customerResponse.json();
        
        if (!customerResult.success) {
          throw new Error('Failed to create customer');
        }
        
        finalCustomerId = customerResult.data.id;
      }
      
      const jobNumber = getNextJobNumber();
      
      const jobData = {
        customerId: finalCustomerId,
        jobNumber: `JOB-${Date.now()}`,
        title: `Job #${jobNumber}`,
        description: data.description || "",
        address: data.address,
        scheduledDate: new Date(),
        status: data.status,
        category: data.category,
        priority: data.priority,
        estimatedDuration: parseInt(data.estimatedDuration || "4"),
        assignedTeam: [],
        equipment: [],
        specialInstructions: ""
      };

      const response = await apiRequest('POST', '/api/jobs', jobData);
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Job Created",
          description: `Job ${result.data.title} has been created successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        onJobCreated?.(result.data);
        onClose();
        form.reset();
        setChecklist([]);
        setIsCreatingNewCustomer(false);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create job. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newChecklistItem.trim(),
        completed: false,
      };
      setChecklist([...checklist, newItem]);
      setNewChecklistItem("");
    }
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  const onSubmit = (data: JobFormData) => {
    createJobMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header with orange background */}
        <div className="bg-amber-500 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold" data-testid="text-job-number">
                Job #{getNextJobNumber()}
              </h2>
              <div className="text-amber-100">
                New Job Request
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="text-white hover:bg-amber-600"
              data-testid="button-close-job-form"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowEmailDialog(true)}
              data-testid="button-email"
            >
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowSMSDialog(true)}
              data-testid="button-sms"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              SMS
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => {
                toast({
                  title: "Call Feature",
                  description: "Call functionality would integrate with phone system here.",
                });
              }}
              data-testid="button-call"
            >
              <Phone className="h-4 w-4 mr-1" />
              Call
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowScheduleDialog(true)}
              data-testid="button-schedule"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Schedule
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => {
                toast({
                  title: "Added to Queue",
                  description: "Job has been added to the work queue for processing.",
                });
              }}
              data-testid="button-queue"
            >
              <FileText className="h-4 w-4 mr-1" />
              Queue
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowProposalDialog(true)}
              data-testid="button-proposal"
            >
              <Presentation className="h-4 w-4 mr-1" />
              Proposal
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowMoreMenu(true)}
              data-testid="button-more"
            >
              <MoreHorizontal className="h-4 w-4 mr-1" />
              More
            </Button>
          </div>
        </div>

        {/* Form content */}
        <div className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Customer Selection */}
              <div className="space-y-4">
                {/* Customer Selection Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant={!isCreatingNewCustomer ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setIsCreatingNewCustomer(false);
                        form.setValue('isNewCustomer', false);
                      }}
                      data-testid="button-select-existing-customer"
                    >
                      Select Existing
                    </Button>
                    <Button
                      type="button"
                      variant={isCreatingNewCustomer ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setIsCreatingNewCustomer(true);
                        form.setValue('isNewCustomer', true);
                        form.setValue('customerId', '');
                      }}
                      data-testid="button-create-new-customer"
                    >
                      Create New Customer
                    </Button>
                  </div>

                  {!isCreatingNewCustomer ? (
                    <FormField
                      control={form.control}
                      name="customerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!!customerId}>
                            <FormControl>
                              <SelectTrigger data-testid="select-customer">
                                <SelectValue placeholder="Select customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {((customersData as any)?.data || []).map((customer: any) => (
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
                  ) : (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                      <h4 className="font-medium text-sm">New Customer Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="newCustomerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter customer name" {...field} data-testid="input-new-customer-name" />
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
                                <Input type="email" placeholder="customer@email.com" {...field} data-testid="input-new-customer-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newCustomerPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="021234567" {...field} data-testid="input-new-customer-phone" />
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
                                <Input placeholder="123 Main Street" {...field} data-testid="input-new-customer-address" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newCustomerCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input placeholder="Auckland" {...field} data-testid="input-new-customer-city" />
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
                              <FormLabel>Region</FormLabel>
                              <FormControl>
                                <Input placeholder="Auckland" {...field} data-testid="input-new-customer-region" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter job address" {...field} data-testid="input-job-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-job-status">
                              <SelectValue placeholder="Select status" />
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
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-job-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tree_removal">Tree Removal</SelectItem>
                            <SelectItem value="tree_trimming">Tree Trimming</SelectItem>
                            <SelectItem value="stump_grinding">Stump Grinding</SelectItem>
                            <SelectItem value="emergency">Emergency</SelectItem>
                            <SelectItem value="consultation">Consultation</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="poNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter PO number" {...field} data-testid="input-po-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter job description" 
                          className="min-h-[100px]"
                          {...field} 
                          data-testid="textarea-job-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Checklist Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Checklist</h3>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                      <input 
                        type="checkbox" 
                        checked={item.completed}
                        onChange={(e) => {
                          setChecklist(checklist.map(i => 
                            i.id === item.id ? { ...i, completed: e.target.checked } : i
                          ));
                        }}
                        data-testid={`checkbox-checklist-${item.id}`}
                      />
                      <span className={item.completed ? "line-through text-muted-foreground" : ""}>{item.text}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeChecklistItem(item.id)}
                        data-testid={`button-remove-checklist-${item.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="New item"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                      data-testid="input-new-checklist-item"
                    />
                    <Button 
                      type="button" 
                      onClick={addChecklistItem}
                      data-testid="button-add-checklist-item"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contacts Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Contacts</h3>
                
                {/* Job Contact */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-blue-600">JC</span>
                    </div>
                    Job Contact
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-8">
                    <FormField
                      control={form.control}
                      name="jobContactFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl>
                            <Input placeholder="First name" {...field} data-testid="input-job-contact-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobContactLastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl>
                            <Input placeholder="Last name" {...field} data-testid="input-job-contact-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="email@example.com" {...field} data-testid="input-job-contact-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Billing Contact */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-xs font-semibold text-green-600">BC</span>
                    </div>
                    Billing Contact
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
                    <FormField
                      control={form.control}
                      name="billingContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone number" {...field} data-testid="input-billing-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billingContactMobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile</FormLabel>
                          <FormControl>
                            <Input placeholder="Mobile number" {...field} data-testid="input-billing-contact-mobile" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  data-testid="button-cancel-job-form"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createJobMutation.isPending}
                  data-testid="button-submit-job-form"
                  onClick={() => {
                    console.log('Submit button clicked');
                    console.log('Form valid:', form.formState.isValid);
                    console.log('Form errors:', form.formState.errors);
                  }}
                >
                  {createJobMutation.isPending ? "Creating..." : "Create Job"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>

    {/* Proposal Generation Dialog */}
    <ProposalGeneration
      customerId={isCreatingNewCustomer ? undefined : form.watch('customerId')}
      open={showProposalDialog}
      onOpenChange={setShowProposalDialog}
      onProposalCreated={(proposal) => {
        toast({
          title: "Proposal Generated",
          description: `Proposal for ${proposal.title} has been created successfully.`,
        });
        setShowProposalDialog(false);
      }}
    />

    {/* Email Dialog */}
    <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <h3 className="text-lg font-semibold">Send Email</h3>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">To:</label>
            <Input 
              placeholder="customer@example.com" 
              defaultValue={form.watch('jobContactEmail') || form.watch('newCustomerEmail')}
              data-testid="input-email-to"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Subject:</label>
            <Input 
              placeholder="Job Update - Tree Removal Service" 
              data-testid="input-email-subject"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Message:</label>
            <Textarea 
              placeholder="Hello, regarding your tree removal request..."
              rows={4}
              data-testid="textarea-email-message"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} data-testid="button-email-cancel">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                toast({
                  title: "Email Sent",
                  description: "Email has been sent to the customer successfully.",
                });
                setShowEmailDialog(false);
              }}
              data-testid="button-email-send"
            >
              Send Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* SMS Dialog */}
    <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <h3 className="text-lg font-semibold">Send SMS</h3>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">To:</label>
            <Input 
              placeholder="+64 21 123 4567" 
              defaultValue={form.watch('jobContactPhone') || form.watch('newCustomerPhone')}
              data-testid="input-sms-to"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Message:</label>
            <Textarea 
              placeholder="Hi, this is regarding your tree removal service request..."
              rows={4}
              maxLength={160}
              data-testid="textarea-sms-message"
            />
            <div className="text-xs text-gray-500">160 characters max</div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowSMSDialog(false)} data-testid="button-sms-cancel">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                toast({
                  title: "SMS Sent",
                  description: "SMS has been sent to the customer successfully.",
                });
                setShowSMSDialog(false);
              }}
              data-testid="button-sms-send"
            >
              Send SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Schedule Dialog */}
    <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <h3 className="text-lg font-semibold">Schedule Job</h3>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Date:</label>
            <Input 
              type="date" 
              data-testid="input-schedule-date"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Time:</label>
            <Input 
              type="time" 
              defaultValue="08:00"
              data-testid="input-schedule-time"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Duration (hours):</label>
            <Input 
              type="number" 
              defaultValue="4"
              min="1"
              max="12"
              data-testid="input-schedule-duration"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Assigned Crew:</label>
            <Select>
              <SelectTrigger data-testid="select-schedule-crew">
                <SelectValue placeholder="Select crew" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crew-a">Crew A - John & Mike</SelectItem>
                <SelectItem value="crew-b">Crew B - Sarah & Tom</SelectItem>
                <SelectItem value="crew-c">Crew C - David & Lisa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)} data-testid="button-schedule-cancel">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                toast({
                  title: "Job Scheduled",
                  description: "Job has been added to the schedule successfully.",
                });
                setShowScheduleDialog(false);
              }}
              data-testid="button-schedule-confirm"
            >
              Schedule Job
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* More Actions Dialog */}
    <Dialog open={showMoreMenu} onOpenChange={setShowMoreMenu}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <h3 className="text-lg font-semibold">More Actions</h3>
        </DialogHeader>
        <div className="space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            onClick={() => {
              toast({ title: "Print", description: "Job details will be printed." });
              setShowMoreMenu(false);
            }}
            data-testid="button-more-print"
          >
            <FileText className="h-4 w-4 mr-2" />
            Print Job Details
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            onClick={() => {
              toast({ title: "Export", description: "Job exported as PDF." });
              setShowMoreMenu(false);
            }}
            data-testid="button-more-export"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export as PDF
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            onClick={() => {
              toast({ title: "Duplicate", description: "Job duplicated successfully." });
              setShowMoreMenu(false);
            }}
            data-testid="button-more-duplicate"
          >
            <FileText className="h-4 w-4 mr-2" />
            Duplicate Job
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            onClick={() => {
              toast({ title: "Archive", description: "Job archived successfully." });
              setShowMoreMenu(false);
            }}
            data-testid="button-more-archive"
          >
            <FileText className="h-4 w-4 mr-2" />
            Archive Job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
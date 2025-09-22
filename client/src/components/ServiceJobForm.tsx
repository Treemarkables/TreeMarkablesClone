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

// Form schema based on existing job schema
const jobFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  title: z.string().min(1, "Job title is required"),
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
      title: "",
      description: "",
      address: "",
      status: "scheduled",
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
      const jobNumber = getNextJobNumber();
      
      const jobData = {
        customerId: data.customerId,
        title: `Job #${jobNumber}`,
        description: data.description || "",
        address: data.address,
        scheduledDate: new Date().toISOString(),
        status: data.status,
        category: data.category,
        priority: data.priority,
        estimatedDuration: parseInt(data.estimatedDuration || "4"),
        assignedCrewIds: [],
        requiredEquipmentIds: [],
        specialInstructions: "",
        safetyRequirements: [],
        poNumber: data.poNumber || "",
        // Add contact information to job data
        metadata: {
          jobContact: {
            firstName: data.jobContactFirstName,
            lastName: data.jobContactLastName,
            email: data.jobContactEmail,
            phone: data.jobContactPhone,
          },
          billingContact: {
            phone: data.billingContactPhone,
            mobile: data.billingContactMobile,
          },
          checklist: checklist,
        }
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
        onJobCreated?.(result.data);
        onClose();
        form.reset();
        setChecklist([]);
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
            <Button variant="secondary" size="sm" data-testid="button-email">
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>
            <Button variant="secondary" size="sm" data-testid="button-sms">
              <MessageSquare className="h-4 w-4 mr-1" />
              SMS
            </Button>
            <Button variant="secondary" size="sm" data-testid="button-call">
              <Phone className="h-4 w-4 mr-1" />
              Call
            </Button>
            <Button variant="secondary" size="sm" data-testid="button-schedule">
              <Calendar className="h-4 w-4 mr-1" />
              Schedule
            </Button>
            <Button variant="secondary" size="sm" data-testid="button-queue">
              <FileText className="h-4 w-4 mr-1" />
              Queue
            </Button>
            <Button variant="secondary" size="sm" data-testid="button-proposal">
              <Presentation className="h-4 w-4 mr-1" />
              Proposal
            </Button>
            <Button variant="secondary" size="sm" data-testid="button-more">
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
                          {((customersData as any)?.customers || []).map((customer: any) => (
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
                            <SelectItem value="quote">Quote</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
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
                >
                  {createJobMutation.isPending ? "Creating..." : "Create Job"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
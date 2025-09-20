import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { 
  Calendar,
  MapPin, 
  Phone, 
  Mail,
  Clock,
  DollarSign,
  Camera,
  CheckCircle,
  AlertCircle,
  Star,
  MessageSquare,
  Download,
  CreditCard,
  User,
  Settings,
  LogOut,
  Plus,
  Eye,
  FileText,
  TreePine,
  Loader2,
  ChevronRight,
  Home,
  Shield,
  Truck,
  Users
} from "lucide-react";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

interface CustomerJob {
  id: string;
  jobNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  scheduledDate: string;
  estimatedDuration: number;
  actualDuration?: number;
  address: string;
  notes?: string;
  assignedTeam?: string[];
  photos?: string[];
  invoiceId?: string;
  completedAt?: string;
  feedback?: {
    rating: number;
    comment: string;
    createdAt: string;
  };
}

interface CustomerInvoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  jobTitle: string;
  amount: number;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  items: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
}

export function CustomerPortal() {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [selectedJob, setSelectedJob] = useState<CustomerJob | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<CustomerInvoice | null>(null);
  const [showNewServiceDialog, setShowNewServiceDialog] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({
    serviceType: '',
    description: '',
    preferredDate: '',
    urgency: 'medium',
    address: ''
  });
  const [feedback, setFeedback] = useState({ rating: 5, comment: '' });
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  // Service Request Schema
  const serviceRequestSchema = z.object({
    serviceType: z.string().min(1, "Service type is required"),
    description: z.string().min(10, "Please provide more details (minimum 10 characters)"),
    preferredDate: z.string().optional(),
    urgency: z.enum(["low", "medium", "high", "urgent"]),
    address: z.string().min(5, "Please provide a valid address")
  });

  type ServiceRequestData = z.infer<typeof serviceRequestSchema>;

  // Form for service requests
  const form = useForm<ServiceRequestData>({
    resolver: zodResolver(serviceRequestSchema),
    defaultValues: {
      serviceType: '',
      description: '',
      preferredDate: '',
      urgency: 'medium',
      address: customer?.address || ''
    }
  });

  // Mock customer data for demo - in real app this would come from authentication
  const mockCustomer: Customer = {
    id: 'cust-001',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@email.com',
    phone: '021 555 0123',
    address: '123 Oak Street',
    city: 'Auckland',
    postalCode: '1010'
  };

  // Customer login
  const loginMutation = useMutation({
    mutationFn: async ({ email, phone }: { email: string; phone: string }) => {
      // In real app, this would authenticate with backend
      // For demo, we'll simulate successful login
      return { customer: mockCustomer };
    },
    onSuccess: (data) => {
      setCustomer(data.customer);
      setIsLoggedIn(true);
      toast({
        title: "Welcome back!",
        description: "You've been successfully logged in.",
      });
    },
    onError: () => {
      toast({
        title: "Login Failed",
        description: "Invalid email or phone number. Please check your details.",
        variant: "destructive",
      });
    },
  });

  // Mock data for demonstration
  const customerJobs: CustomerJob[] = [
    {
      id: 'job-001',
      jobNumber: 'TRM-2024-001',
      title: 'Large Oak Tree Removal',
      description: 'Remove large oak tree near power lines, includes stump grinding',
      status: 'completed',
      priority: 'high',
      scheduledDate: '2024-12-15T09:00:00Z',
      estimatedDuration: 6,
      actualDuration: 5.5,
      address: '123 Oak Street, Auckland',
      assignedTeam: ['Mike Thompson', 'David Chen'],
      photos: ['before1.jpg', 'progress1.jpg', 'after1.jpg'],
      invoiceId: 'inv-001',
      completedAt: '2024-12-15T14:30:00Z',
      feedback: {
        rating: 5,
        comment: 'Excellent work, very professional crew',
        createdAt: '2024-12-16T10:00:00Z'
      }
    },
    {
      id: 'job-002', 
      jobNumber: 'TRM-2024-002',
      title: 'Hedge Trimming & Garden Cleanup',
      description: 'Trim overgrown hedges and general garden maintenance',
      status: 'in_progress',
      priority: 'medium',
      scheduledDate: '2024-12-22T10:00:00Z',
      estimatedDuration: 3,
      address: '123 Oak Street, Auckland',
      assignedTeam: ['Sarah Williams'],
      photos: ['before2.jpg'],
      notes: 'Customer requested organic debris removal'
    }
  ];

  const customerInvoices: CustomerInvoice[] = [
    {
      id: 'inv-001',
      invoiceNumber: 'INV-2024-001',
      jobId: 'job-001',
      jobTitle: 'Large Oak Tree Removal',
      amount: 1250.00,
      status: 'paid',
      issueDate: '2024-12-15',
      dueDate: '2024-12-30',
      paidDate: '2024-12-18',
      items: [
        { description: 'Tree removal (6 hours)', quantity: 6, rate: 120, amount: 720 },
        { description: 'Stump grinding', quantity: 1, rate: 300, amount: 300 }
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'scheduled': return 'bg-orange-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-blue-600 bg-blue-50'; 
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', { 
      style: 'currency', 
      currency: 'NZD' 
    }).format(amount);
  };

  const handleLogin = () => {
    if (!loginEmail || !loginPhone) {
      toast({
        title: "Missing Information",
        description: "Please enter both your email and phone number.",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ email: loginEmail, phone: loginPhone });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCustomer(null);
    setLoginEmail('');
    setLoginPhone('');
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <TreePine className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Customer Portal</CardTitle>
            <CardDescription>
              Access your jobs, invoices, and schedule new services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                data-testid="input-login-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="021 555 0123"
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                data-testid="input-login-phone"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              className="w-full" 
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Demo: Use any email and phone number to access the portal
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main Portal Interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <TreePine className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Treemarkables Portal</h1>
                <p className="text-sm text-muted-foreground">Welcome back, {customer?.firstName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" data-testid="button-profile">
                <User className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="jobs" data-testid="tab-jobs">My Jobs</TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule Service</TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">My Jobs</h2>
                <p className="text-muted-foreground">Track your tree service jobs and view progress</p>
              </div>
            </div>

            <div className="grid gap-6">
              {customerJobs.map((job) => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {job.title}
                          <Badge className={getStatusColor(job.status)}>
                            {job.status.replace('_', ' ')}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.address}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(job.scheduledDate), 'MMM dd, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {job.actualDuration || job.estimatedDuration}h
                          </span>
                        </CardDescription>
                      </div>
                      <Badge className={getPriorityColor(job.priority)}>
                        {job.priority} priority
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">{job.description}</p>
                    
                    {job.assignedTeam && job.assignedTeam.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Assigned to: {job.assignedTeam.join(', ')}</span>
                      </div>
                    )}

                    {job.photos && job.photos.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{job.photos.length} photos available</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-0"
                          onClick={() => {
                            setSelectedJob(job);
                            setShowPhotoDialog(true);
                          }}
                          data-testid={`button-view-photos-${job.id}`}
                        >
                          View Photos
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex gap-2">
                        {job.feedback && (
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Review submitted ({job.feedback.rating}★)
                          </div>
                        )}
                        {job.invoiceId && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const invoice = customerInvoices.find(inv => inv.id === job.invoiceId);
                              if (invoice) setSelectedInvoice(invoice);
                            }}
                            data-testid={`button-view-invoice-${job.id}`}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            View Invoice
                          </Button>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">#{job.jobNumber}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Invoices</h2>
              <p className="text-muted-foreground">View and pay your invoices online</p>
            </div>

            <div className="grid gap-4">
              {customerInvoices.map((invoice) => (
                <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{invoice.invoiceNumber}</h4>
                        <p className="text-sm text-muted-foreground">{invoice.jobTitle}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Issued: {format(parseISO(invoice.issueDate), 'MMM dd, yyyy')}</span>
                          <span>Due: {format(parseISO(invoice.dueDate), 'MMM dd, yyyy')}</span>
                          {invoice.paidDate && (
                            <span className="text-green-600">
                              Paid: {format(parseISO(invoice.paidDate), 'MMM dd, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{formatCurrency(invoice.amount)}</div>
                        <Badge className={invoice.status === 'paid' ? 'bg-green-500' : 'bg-orange-500'}>
                          {invoice.status}
                        </Badge>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowInvoiceDialog(true);
                            }}
                            data-testid={`button-view-invoice-${invoice.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {invoice.status === 'pending' && (
                            <Button 
                              size="sm"
                              data-testid={`button-pay-invoice-${invoice.id}`}
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Pay Now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Schedule Service Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Schedule New Service</h2>
              <p className="text-muted-foreground">Request a quote or book a service online</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => {
                    console.log('Service request data:', data);
                    toast({
                      title: "Service Request Submitted",
                      description: "We'll contact you within 24 hours to schedule your service.",
                    });
                    form.reset();
                  })} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="serviceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service Type *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-service-type">
                                  <SelectValue placeholder="Choose a service..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="tree-removal">Tree Removal</SelectItem>
                                <SelectItem value="tree-trimming">Tree Trimming/Pruning</SelectItem>
                                <SelectItem value="stump-grinding">Stump Grinding</SelectItem>
                                <SelectItem value="hedge-trimming">Hedge Trimming</SelectItem>
                                <SelectItem value="emergency-removal">Emergency Tree Removal</SelectItem>
                                <SelectItem value="consultation">Tree Health Consultation</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="urgency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Urgency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-urgency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low - Within 2 weeks</SelectItem>
                                <SelectItem value="medium">Medium - Within 1 week</SelectItem>
                                <SelectItem value="high">High - Within 3 days</SelectItem>
                                <SelectItem value="urgent">Urgent - Same day</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="preferredDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-preferred-date"
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
                            <FormLabel>Service Address *</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={customer?.address}
                                data-testid="input-service-address"
                              />
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
                          <FormLabel>Description *</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Please describe the work you need done, tree species, size, location, access issues, etc."
                              rows={4}
                              data-testid="textarea-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={form.formState.isSubmitting}
                      data-testid="button-submit-service-request"
                    >
                      {form.formState.isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Service Request'
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Profile Information</h2>
              <p className="text-muted-foreground">Manage your account details and preferences</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{customer?.firstName} {customer?.lastName}</div>
                    <div className="text-sm text-muted-foreground">Full Name</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{customer?.email}</div>
                    <div className="text-sm text-muted-foreground">Email Address</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Photo Gallery Dialog */}
      {showPhotoDialog && selectedJob && selectedJob.photos && (
        <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedJob.title} - Photos</DialogTitle>
              <DialogDescription>
                Job #{selectedJob.jobNumber} completed on{' '}
                {selectedJob.completedAt && format(parseISO(selectedJob.completedAt), 'MMM dd, yyyy')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedJob.photos.map((photo, index) => (
                <div key={index} className="relative aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                  <Camera className="w-12 h-12 text-gray-400" />
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    {photo}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowPhotoDialog(false)}>
                Close
              </Button>
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Detail Dialog */}
      {showInvoiceDialog && selectedInvoice && (
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invoice {selectedInvoice.invoiceNumber}</DialogTitle>
              <DialogDescription>{selectedInvoice.jobTitle}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium">Issue Date</div>
                  <div>{format(parseISO(selectedInvoice.issueDate), 'MMM dd, yyyy')}</div>
                </div>
                <div>
                  <div className="font-medium">Due Date</div>
                  <div>{format(parseISO(selectedInvoice.dueDate), 'MMM dd, yyyy')}</div>
                </div>
                <div>
                  <div className="font-medium">Status</div>
                  <Badge className={selectedInvoice.status === 'paid' ? 'bg-green-500' : 'bg-orange-500'}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
                <div>
                  <div className="font-medium">Total Amount</div>
                  <div className="text-lg font-bold">{formatCurrency(selectedInvoice.amount)}</div>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">Description</th>
                      <th className="text-center p-3 text-sm font-medium">Qty</th>
                      <th className="text-right p-3 text-sm font-medium">Rate</th>
                      <th className="text-right p-3 text-sm font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3 text-sm">{item.description}</td>
                        <td className="p-3 text-sm text-center">{item.quantity}</td>
                        <td className="p-3 text-sm text-right">{formatCurrency(item.rate)}</td>
                        <td className="p-3 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="p-3 text-sm font-medium text-right">Total:</td>
                      <td className="p-3 text-sm font-bold text-right">{formatCurrency(selectedInvoice.amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowInvoiceDialog(false)}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                {selectedInvoice.status === 'pending' && (
                  <Button className="flex-1">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay Now
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
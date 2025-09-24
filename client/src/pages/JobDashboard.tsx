import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CalendarDays, Users, FileText, TrendingUp, Wrench, MessageSquare, Settings, MapPin, Clock, DollarSign, AlertTriangle, CheckCircle, Plug, Cloud, Shield, Mail, Phone, Edit2, Briefcase, Search, Filter } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Pipeline from './Pipeline';
import { PerformanceAnalytics } from '@/components/PerformanceAnalytics';
import { EquipmentTracker } from '@/components/EquipmentTracker';
import CommunicationsManagement from './CommunicationsManagement';
import Integrations from './Integrations';
import { WeatherDashboard } from '@/components/WeatherDashboard';
import QuoteManagement from '@/components/QuoteManagement';
import { LeadEnhancement } from '@/components/LeadEnhancement';
import { DispatchBoard } from '@/components/DispatchBoard';
import { JobDiary } from '@/components/JobDiary';
import { SafetyReporting } from '@/components/SafetyReporting';
import JobTemplateManagement from '@/components/JobTemplateManagement';
import { GlobalJobCard } from '@/components/GlobalJobCard';
import { ServiceM8ImportModal } from '@/components/ServiceM8ImportModal';
import { CustomerCSVUpload } from '@/components/CustomerCSVUpload';
import { ServiceM8JobImport } from '@/components/ServiceM8JobImport';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job, Lead, Customer } from "@shared/schema";

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
  count?: number;
}

// Display types that combine schema with UI requirements
type DisplayJob = {
  id: string;
  title: string;
  customerId: string;
  status: string;
  priority: string;
  scheduledDate: string;
  estimatedValue: number;
  location: string;
  customer?: string;
};

type DisplayLead = {
  id: string;
  name: string;
  source: string;
  status: string;
  estimatedValue: number;
  lastContact: string;
};

type DisplayCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalJobs: number;
  lifetimeValue: string;
  lastContactDate?: string;
};

interface JobDashboardProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function JobDashboard({ activeTab = "overview", onTabChange }: JobDashboardProps) {
  // State for job card modal
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isJobCardOpen, setIsJobCardOpen] = useState(false);
  
  // Customer editing state
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCustomerName, setEditingCustomerName] = useState("");
  
  // Jobs pagination and search state
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [currentJobPage, setCurrentJobPage] = useState(1);
  const [jobsPerPage] = useState(12); // Show 12 jobs per page for good performance
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Customer update mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest('PUT', `/api/customers/${id}`, { name });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setEditingCustomerId(null);
      setEditingCustomerName("");
      toast({
        title: "Success",
        description: "Customer name updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update customer name",
        variant: "destructive"
      });
    }
  });

  // Handle starting customer name edit
  const handleEditCustomerName = (customerId: string, currentName: string) => {
    setEditingCustomerId(customerId);
    setEditingCustomerName(currentName.startsWith('Customer #') ? '' : currentName);
  };

  // Handle saving customer name
  const handleSaveCustomerName = (customerId: string) => {
    if (!editingCustomerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a customer name",
        variant: "destructive"
      });
      return;
    }
    updateCustomerMutation.mutate({ id: customerId, name: editingCustomerName.trim() });
  };

  // Handle job item click
  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsJobCardOpen(true);
  };

  const handleCloseJobCard = () => {
    setIsJobCardOpen(false);
    setSelectedJobId(null);
  };

  // Fetch jobs data with proper typing
  const { data: jobsResponse, isLoading: jobsLoading } = useQuery<ApiResponse<Job>>({
    queryKey: ['/api/jobs'],
  });

  // Fetch leads data with proper typing
  const { data: leadsResponse, isLoading: leadsLoading } = useQuery<ApiResponse<Lead>>({
    queryKey: ['/api/leads'],
  });

  // Fetch customers data with proper typing
  const { data: customersResponse, isLoading: customersLoading } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers'],
  });

  // Extract data from API responses with type safety
  const jobs = jobsResponse?.data || [];
  const leads = leadsResponse?.data || [];
  const customers = customersResponse?.data || [];

  // No mock data - use real data only

  // Initialize customers first to avoid temporal dead zone
  const transformCustomersForDisplay = (apiCustomers: Customer[]): DisplayCustomer[] => {
    return apiCustomers.map((customer, index) => {
      // Create a more meaningful display name using job address data
      let displayName = customer.name || 'Unnamed Customer';
      
      // If it's a generic placeholder name, use simple numbering
      if (customer.name?.startsWith('Customer-')) {
        const uniqueId = customer.name.split('-').pop()?.slice(-6) || customer.id.slice(-6);
        displayName = `Customer #${index + 1} (${uniqueId})`;
      }

      return {
        id: customer.id,
        name: displayName,
        email: customer.email || '',
        phone: customer.phone || '',
        totalJobs: customer.totalJobs || 0,
        lifetimeValue: customer.lifetimeValue ? String(customer.lifetimeValue) : '0.00',
        lastContactDate: customer.lastContactDate ? new Date(customer.lastContactDate).toLocaleDateString() : undefined
      };
    });
  };

  const displayCustomers: DisplayCustomer[] = customers.length > 0 ? transformCustomersForDisplay(customers) : [];

  // Helper function to get customer name by ID - now safe to use
  const getCustomerName = (customerId: string) => {
    const customer = displayCustomers.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  // Transform API data to display format - now safe to use getCustomerName
  const transformJobsForDisplay = (apiJobs: Job[]): DisplayJob[] => {
    return apiJobs.map(job => ({
      id: job.id,
      title: job.title || 'Untitled Job',
      customerId: job.customerId || '',
      status: job.status || 'unknown',
      priority: job.priority || 'medium',
      scheduledDate: job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : '',
      estimatedValue: job.totalAmount ? Number(job.totalAmount) : 0,
      location: job.address || 'Location TBD',
      customer: getCustomerName(job.customerId || '')
    }));
  };

  const transformLeadsForDisplay = (apiLeads: Lead[]): DisplayLead[] => {
    return apiLeads.map(lead => ({
      id: lead.id,
      name: lead.name || 'Unnamed Lead',
      source: lead.source || 'Unknown',
      status: lead.status || 'new',
      estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : 0,
      lastContact: lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : 'Never'
    }));
  };

  // Transform and filter jobs
  const allDisplayJobs: DisplayJob[] = jobs.length > 0 ? transformJobsForDisplay(jobs) : [];
  
  // Filter jobs based on search query
  const filteredJobs = allDisplayJobs.filter(job => {
    if (!jobSearchQuery.trim()) return true;
    const query = jobSearchQuery.toLowerCase();
    return (
      job.title.toLowerCase().includes(query) ||
      job.customer.toLowerCase().includes(query) ||
      job.location.toLowerCase().includes(query) ||
      job.status.toLowerCase().includes(query) ||
      job.priority.toLowerCase().includes(query)
    );
  });
  
  // Paginate filtered jobs
  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
  const startIndex = (currentJobPage - 1) * jobsPerPage;
  const endIndex = startIndex + jobsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);
  
  // For overview tab, still show recent jobs (first 5)
  const displayJobs: DisplayJob[] = allDisplayJobs.slice(0, 5);
  const displayLeads: DisplayLead[] = leads.length > 0 ? transformLeadsForDisplay(leads) : [];

  // Calculate metrics
  const totalRevenue = displayJobs.reduce((sum, job) => sum + (job.estimatedValue ?? 0), 0);
  const completedJobs = displayJobs.filter(job => job.status === "completed").length;
  const activeJobs = displayJobs.filter(job => job.status === "in-progress" || job.status === "scheduled").length;
  const newLeads = displayLeads.filter(lead => lead.status === "new").length;

  const getJobStatusBadge = (status: string) => {
    const jobStatusConfig = {
      "scheduled": { variant: "outline" as const, label: "Scheduled" },
      "in-progress": { variant: "default" as const, label: "In Progress" },
      "completed": { variant: "default" as const, label: "Completed" },
      "cancelled": { variant: "destructive" as const, label: "Cancelled" }
    };
    
    const config = jobStatusConfig[status as keyof typeof jobStatusConfig];
    return <Badge variant={config?.variant || "default"} data-testid={`badge-status-${status}`}>{config?.label || status}</Badge>;
  };

  const getLeadStatusBadge = (status: string) => {
    const leadStatusConfig = {
      "new": { variant: "default" as const, label: "New" },
      "contacted": { variant: "outline" as const, label: "Contacted" },
      "quoted": { variant: "outline" as const, label: "Quoted" },
      "won": { variant: "default" as const, label: "Won" },
      "lost": { variant: "destructive" as const, label: "Lost" }
    };
    
    const config = leadStatusConfig[status as keyof typeof leadStatusConfig];
    return <Badge variant={config?.variant || "default"} data-testid={`badge-status-${status}`}>{config?.label || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      "low": { variant: "outline" as const, label: "Low" },
      "medium": { variant: "outline" as const, label: "Medium" },
      "high": { variant: "destructive" as const, label: "High" },
      "emergency": { variant: "destructive" as const, label: "Emergency" }
    };
    
    const config = priorityConfig[priority as keyof typeof priorityConfig];
    return <Badge variant={config?.variant || "default"} data-testid={`badge-priority-${priority}`}>{config?.label || priority}</Badge>;
  };

  // Helper functions for customer cards
  const getInitials = (name: string) => {
    return (name || '')
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCustomerTier = (lifetimeValue: number) => {
    if (lifetimeValue >= 10000) return { label: 'Premium', color: 'bg-purple-100 text-purple-800' };
    if (lifetimeValue >= 5000) return { label: 'Gold', color: 'bg-yellow-100 text-yellow-800' };
    if (lifetimeValue >= 1000) return { label: 'Silver', color: 'bg-gray-100 text-gray-800' };
    return { label: 'Bronze', color: 'bg-orange-100 text-orange-800' };
  };

  // Handle customer card click for viewing/editing
  const handleCustomerCardClick = (customerId: string, customerName: string) => {
    if (editingCustomerId !== customerId) {
      handleEditCustomerName(customerId, customerName);
    }
  };

  return (
    <div className="h-full bg-background p-4 md:p-6 overflow-hidden w-full max-w-full min-w-0">
      <div className="w-full max-w-full h-full flex flex-col min-w-0">
        <div className="mb-4 md:mb-6 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-job-dashboard">
                Job Dashboard
              </h1>
              <p className="text-muted-foreground" data-testid="text-dashboard-description">
                Comprehensive business management for Treemarkables
              </p>
            </div>
            <ServiceM8ImportModal />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
          <TabsList className="flex w-full overflow-x-auto whitespace-nowrap gap-2 md:gap-3 mb-4 md:mb-6 shrink-0 no-scrollbar" data-testid="tabs-dashboard-navigation">
            <TabsTrigger value="overview" data-testid="tab-overview" className="shrink-0"><TrendingUp className="w-4 h-4 mr-2" />Overview</TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs" className="shrink-0"><Briefcase className="w-4 h-4 mr-2" />All Jobs</TabsTrigger>
            <TabsTrigger value="pipeline" data-testid="tab-pipeline" className="shrink-0"><CalendarDays className="w-4 h-4 mr-2" />Pipeline</TabsTrigger>
            <TabsTrigger value="job-import" data-testid="tab-job-import" className="shrink-0"><FileText className="w-4 h-4 mr-2" />Job Import</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates" className="shrink-0"><FileText className="w-4 h-4 mr-2" />Templates</TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads" className="shrink-0"><Users className="w-4 h-4 mr-2" />Leads</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers" className="shrink-0"><Users className="w-4 h-4 mr-2" />Customers</TabsTrigger>
            <TabsTrigger value="diary" data-testid="tab-diary" className="shrink-0"><FileText className="w-4 h-4 mr-2" />Job Diary</TabsTrigger>
            <TabsTrigger value="quotes" data-testid="tab-quotes" className="shrink-0"><FileText className="w-4 h-4 mr-2" />Quotes</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics" className="shrink-0"><TrendingUp className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
            <TabsTrigger value="equipment" data-testid="tab-equipment" className="shrink-0"><Wrench className="w-4 h-4 mr-2" />Equipment</TabsTrigger>
            <TabsTrigger value="communications" data-testid="tab-communications" className="shrink-0"><MessageSquare className="w-4 h-4 mr-2" />Communications</TabsTrigger>
            <TabsTrigger value="weather" data-testid="tab-weather" className="shrink-0"><Cloud className="w-4 h-4 mr-2" />Weather</TabsTrigger>
            <TabsTrigger value="safety" data-testid="tab-safety" className="shrink-0"><Shield className="w-4 h-4 mr-2" />Safety</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations" className="shrink-0"><Plug className="w-4 h-4 mr-2" />Integrations</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-total-revenue">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-revenue">
                    ${totalRevenue.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>

              <Card data-testid="card-active-jobs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-active-jobs">{activeJobs}</div>
                  <p className="text-xs text-muted-foreground">In progress + scheduled</p>
                </CardContent>
              </Card>

              <Card data-testid="card-completed-jobs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-completed-jobs">{completedJobs}</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>

              <Card data-testid="card-new-leads">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Leads</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-new-leads">{newLeads}</div>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </CardContent>
              </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="card-recent-jobs">
                <CardHeader>
                  <CardTitle>Recent Jobs</CardTitle>
                  <CardDescription>Latest job activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {displayJobs.slice(0, 5).map(job => (
                      <div 
                        key={job.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer" 
                        data-testid={`job-item-${job.id}`}
                        onClick={() => handleJobClick(job.id)}
                      >
                        <div className="flex-1">
                          <h4 className="font-medium" data-testid={`job-title-${job.id}`}>{job.title}</h4>
                          <p className="text-sm text-muted-foreground" data-testid={`job-customer-${job.id}`}>{job.customer}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="text-xs text-muted-foreground" data-testid={`job-location-${job.id}`}>{job.location}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="font-medium" data-testid={`job-value-${job.id}`}>${(job.estimatedValue || 0).toLocaleString()}</div>
                          <div className="flex gap-1">
                            {getJobStatusBadge(job.status)}
                            {getPriorityBadge(job.priority)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-recent-leads">
                <CardHeader>
                  <CardTitle>Recent Leads</CardTitle>
                  <CardDescription>Latest lead inquiries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {displayLeads.slice(0, 5).map(lead => (
                      <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`lead-item-${lead.id}`}>
                        <div className="flex-1">
                          <h4 className="font-medium" data-testid={`lead-name-${lead.id}`}>{lead.name}</h4>
                          <p className="text-sm text-muted-foreground" data-testid={`lead-source-${lead.id}`}>Source: {lead.source}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`lead-last-contact-${lead.id}`}>Last contact: {lead.lastContact}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="font-medium" data-testid={`lead-value-${lead.id}`}>${(lead.estimatedValue || 0).toLocaleString()}</div>
                          {getLeadStatusBadge(lead.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>

          {/* All Jobs Tab */}
          <TabsContent value="jobs" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="heading-all-jobs">
                    All Jobs ({jobs.length.toLocaleString()})
                  </h2>
                  <p className="text-muted-foreground" data-testid="text-jobs-description">
                    Complete list of all jobs including imported ServiceM8 data
                  </p>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search jobs..."
                      className="pl-10"
                      value={jobSearchQuery}
                      onChange={(e) => {
                        setJobSearchQuery(e.target.value);
                        setCurrentJobPage(1); // Reset to first page when searching
                      }}
                      data-testid="input-search-jobs"
                    />
                  </div>
                  <Button variant="outline" size="icon" data-testid="button-filter-jobs">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Jobs Grid */}
              {jobsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(9)].map((_, i) => (
                    <Card key={i} data-testid={`skeleton-job-${i}`}>
                      <CardContent className="p-4">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2 mb-3" />
                        <div className="flex gap-2 mb-2">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : paginatedJobs.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">No Jobs Found</h3>
                    <p className="text-sm text-muted-foreground">
                      Start by creating your first job or import from ServiceM8
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedJobs.map((job) => (
                    <Card 
                      key={job.id} 
                      className="hover-elevate cursor-pointer transition-all duration-200"
                      onClick={() => handleJobClick(job.id)}
                      data-testid={`card-job-${job.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-foreground line-clamp-2" data-testid={`text-job-title-${job.id}`}>
                              {job.title}
                            </h3>
                            <div className="text-lg font-bold text-green-600 ml-2" data-testid={`text-job-value-${job.id}`}>
                              ${job.estimatedValue.toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground font-medium" data-testid={`text-job-customer-${job.id}`}>
                              {job.customer}
                            </p>
                            
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span className="line-clamp-1" data-testid={`text-job-location-${job.id}`}>{job.location}</span>
                            </div>
                            
                            {job.scheduledDate && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span data-testid={`text-job-date-${job.id}`}>{job.scheduledDate}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2 flex-wrap">
                            {getJobStatusBadge(job.status)}
                            {getPriorityBadge(job.priority)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Pagination info and controls */}
              {allDisplayJobs.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground" data-testid="text-jobs-showing">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length.toLocaleString()} 
                        {jobSearchQuery ? ' filtered' : ''} jobs
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: {allDisplayJobs.length.toLocaleString()} jobs in database
                      </p>
                    </div>
                    
                    {/* Pagination controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentJobPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentJobPage === 1}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        
                        <div className="flex items-center gap-1">
                          {[...Array(Math.min(5, totalPages))].map((_, i) => {
                            const pageNum = currentJobPage <= 3 ? i + 1 : currentJobPage - 2 + i;
                            if (pageNum > totalPages) return null;
                            
                            return (
                              <Button
                                key={pageNum}
                                variant={pageNum === currentJobPage ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setCurrentJobPage(pageNum)}
                                className="w-8"
                                data-testid={`button-page-${pageNum}`}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                          
                          {totalPages > 5 && currentJobPage < totalPages - 2 && (
                            <>
                              <span className="text-muted-foreground">...</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentJobPage(totalPages)}
                                className="w-8"
                                data-testid={`button-page-${totalPages}`}
                              >
                                {totalPages}
                              </Button>
                            </>
                          )}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentJobPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentJobPage === totalPages}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="flex-1 overflow-auto">
            <Pipeline />
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="flex-1 overflow-auto">
            <LeadEnhancement />
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="flex-1 overflow-auto">
            <div className="space-y-4">
            <Card data-testid="card-customer-management">
              <CardHeader>
                <CardTitle>Customer Management</CardTitle>
                <CardDescription>Manage customer relationships and history</CardDescription>
              </CardHeader>
              <CardContent>
                {/* ServiceM8 Data Diagnostic Warning */}
                {customers.length > 0 && customers.filter(c => c.name?.startsWith('Customer-')).length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 text-amber-600 mt-0.5">⚠️</div>
                      <div>
                        <h3 className="text-amber-800 font-semibold">ServiceM8 Customer Data Issue</h3>
                        <p className="text-amber-700 text-sm mt-1">
                          Your ServiceM8 account contains <strong>{customers.filter(c => c.name?.startsWith('Customer-')).length} customers with missing name data</strong>. 
                          All customer records show as "company_name: null, contact_first: null, contact_last: null" in ServiceM8.
                        </p>
                        <p className="text-amber-700 text-sm mt-2">
                          <strong>Solutions:</strong> 1) Add customer names manually using the "Edit" buttons below, or 2) Update customer names in ServiceM8 then re-import.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* CSV Upload Component */}
                <CustomerCSVUpload />
                
                {/* Customer List */}
                <div className="space-y-4 mt-6">
                  {customersLoading ? (
                    <div className="grid gap-4">
                      {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                          <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                              <Skeleton className="h-12 w-12 rounded-full" />
                              <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-1/4" />
                              </div>
                              <Skeleton className="h-6 w-16" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : displayCustomers.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Users className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No customers found</h3>
                        <p className="text-muted-foreground text-center max-w-md">
                          No customers have been added yet. Import customers using the CSV upload above or they will appear here when jobs are created.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {displayCustomers.map(customer => {
                        const isEditing = editingCustomerId === customer.id;
                        const needsName = customer.name.startsWith('Customer #');
                        const tier = getCustomerTier(parseFloat(customer.lifetimeValue || '0'));
                        
                        return (
                          <Card 
                            key={customer.id} 
                            className={`hover-elevate cursor-pointer transition-all ${isEditing ? 'ring-2 ring-primary' : ''}`}
                            data-testid={`customer-card-${customer.id}`}
                            onClick={() => !isEditing && handleCustomerCardClick(customer.id, customer.name)}
                          >
                            <CardContent className="p-6">
                              {isEditing ? (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                      <AvatarFallback className="bg-primary/10 text-primary">
                                        {getInitials(customer.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <Input
                                        value={editingCustomerName}
                                        onChange={(e) => setEditingCustomerName(e.target.value)}
                                        placeholder="Enter customer name..."
                                        className="font-medium text-lg"
                                        data-testid={`input-edit-customer-name-${customer.id}`}
                                        autoFocus
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      size="sm" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveCustomerName(customer.id);
                                      }}
                                      disabled={updateCustomerMutation.isPending}
                                      data-testid={`button-save-customer-${customer.id}`}
                                    >
                                      {updateCustomerMutation.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCustomerId(null);
                                      }}
                                      data-testid={`button-cancel-edit-customer-${customer.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                      <AvatarFallback className="bg-primary/10 text-primary">
                                        {getInitials(customer.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <h3 className={`text-lg font-semibold ${needsName ? 'text-muted-foreground' : ''}`} data-testid={`customer-name-${customer.id}`}>
                                          {customer.name}
                                        </h3>
                                        <Badge className={tier.color} data-testid={`badge-tier-${customer.id}`}>{tier.label}</Badge>
                                        {needsName && (
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditCustomerName(customer.id, customer.name);
                                            }}
                                            data-testid={`button-edit-customer-name-${customer.id}`}
                                            className="text-xs px-2 py-1 h-auto"
                                          >
                                            <Edit2 className="w-3 h-3 mr-1" />
                                            Add Name
                                          </Button>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <Mail className="w-4 h-4" />
                                          <span data-testid={`customer-email-${customer.id}`}>{customer.email || 'No email'}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Phone className="w-4 h-4" />
                                          <span data-testid={`customer-phone-${customer.id}`}>{customer.phone || 'No phone'}</span>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          <DollarSign className="w-4 h-4" />
                                          <span data-testid={`customer-lifetime-value-${customer.id}`}>
                                            Lifetime Value: ${parseFloat(customer.lifetimeValue || '0').toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Calendar className="w-4 h-4" />
                                          <span data-testid={`customer-jobs-${customer.id}`}>{customer.totalJobs} jobs</span>
                                        </div>
                                      </div>
                                      
                                      {customer.lastContactDate && (
                                        <p className="text-xs text-muted-foreground" data-testid={`customer-last-contact-${customer.id}`}>
                                          Last service: {customer.lastContactDate}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditCustomerName(customer.id, customer.name);
                                      }}
                                      data-testid={`button-edit-${customer.id}`}
                                    >
                                      <Edit2 className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      data-testid={`button-view-customer-${customer.id}`}
                                    >
                                      View Details
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* Job Templates Tab */}
          <TabsContent value="templates" className="flex-1 overflow-auto">
            <JobTemplateManagement />
          </TabsContent>

          {/* Job Diary Tab */}
          <TabsContent value="diary" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="heading-job-diary">
                  Job Documentation & Progress Tracking
                </h2>
                <p className="text-muted-foreground" data-testid="text-diary-description">
                  Comprehensive job diary system for documentation, progress tracking, and field notes
                </p>
              </div>

              {/* Job Diary will show real job data when available */}
              {displayJobs.length > 0 && (
                <Card data-testid="card-featured-job-diary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2" data-testid="title-featured-job">
                      <FileText className="w-5 h-5" />
                      Featured Job: {displayJobs[0].title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground" data-testid="text-job-details">
                      {displayJobs[0].customer} - {displayJobs[0].location}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <JobDiary 
                      jobId={displayJobs[0].id} 
                      jobTitle={displayJobs[0].title} 
                      compact={false}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Additional Job Diaries - Show real jobs when available */}
              {displayJobs.length > 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {displayJobs.slice(1, 3).map((job) => (
                    <Card key={job.id} data-testid={`card-job-diary-${job.id}`}>
                      <CardHeader>
                        <CardTitle className="text-lg" data-testid={`title-job-${job.id}`}>
                          {job.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground" data-testid={`text-job-details-${job.id}`}>
                          {job.customer} - {job.location}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <JobDiary 
                          jobId={job.id} 
                          jobTitle={job.title} 
                          compact={true}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="flex-1 overflow-auto">
            <QuoteManagement />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="flex-1 overflow-auto">
            <PerformanceAnalytics />
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="flex-1 overflow-auto">
            <EquipmentTracker />
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications" className="flex-1 overflow-auto">
            <CommunicationsManagement />
          </TabsContent>

          {/* Weather Tab */}
          <TabsContent value="weather" className="flex-1 overflow-auto">
            <div className="space-y-4 w-full max-w-full overflow-hidden min-w-0">
              <WeatherDashboard />
            </div>
          </TabsContent>

          {/* Safety Tab */}
          <TabsContent value="safety" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="heading-safety-management">
                  Safety Management & Compliance
                </h2>
                <p className="text-muted-foreground" data-testid="text-safety-description">
                  Comprehensive safety incident tracking, risk assessments, and compliance monitoring for tree removal operations
                </p>
              </div>
              <SafetyReporting />
            </div>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="flex-1 overflow-auto">
            <Integrations />
          </TabsContent>

          {/* ServiceM8 Job Import Tab */}
          <TabsContent value="job-import" className="flex-1 overflow-auto">
            <ServiceM8JobImport />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Job Card Modal for editing existing jobs */}
      {selectedJobId && (
        <GlobalJobCard 
          isOpen={isJobCardOpen}
          onClose={handleCloseJobCard}
          mode="edit"
          jobId={selectedJobId}
        />
      )}
    </div>
  );
}
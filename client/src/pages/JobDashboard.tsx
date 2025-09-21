import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CalendarDays, Users, FileText, TrendingUp, Wrench, MessageSquare, Settings, MapPin, Clock, DollarSign, AlertTriangle, CheckCircle, Plug, Cloud, Shield } from "lucide-react";
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
import { JobTemplateManagement } from '@/components/JobTemplateManagement';
import { useQuery } from "@tanstack/react-query";
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

  // Mock data for demonstration when API data is not available
  const mockJobs: DisplayJob[] = [
    { id: "1", title: "Large Oak Tree Removal", customerId: "1", status: "scheduled", priority: "high", scheduledDate: "2024-09-23", estimatedValue: 2500, location: "Auckland" },
    { id: "2", title: "Commercial Hedge Trimming", customerId: "2", status: "in-progress", priority: "medium", scheduledDate: "2024-09-22", estimatedValue: 800, location: "Wellington" },
    { id: "3", title: "Storm Damage Tree Removal", customerId: "3", status: "completed", priority: "emergency", scheduledDate: "2024-09-21", estimatedValue: 3200, location: "Christchurch" },
  ];

  const mockLeads: DisplayLead[] = [
    { id: "1", name: "Green Valley Property", source: "Website", status: "new", estimatedValue: 1500, lastContact: "2024-09-21" },
    { id: "2", name: "City Council", source: "Referral", status: "quoted", estimatedValue: 5000, lastContact: "2024-09-20" },
    { id: "3", name: "Park Estate", source: "Google Ads", status: "contacted", estimatedValue: 2200, lastContact: "2024-09-19" },
  ];

  const mockCustomers: DisplayCustomer[] = [
    { id: "1", name: "Smith Family", email: "smith@email.com", phone: "021-123-4567", totalJobs: 3, lifetimeValue: "4500.00" },
    { id: "2", name: "ABC Corporation", email: "contact@abc.co.nz", phone: "09-987-6543", totalJobs: 12, lifetimeValue: "15600.00" },
    { id: "3", name: "Johnson Residence", email: "johnson@gmail.com", phone: "027-456-7890", totalJobs: 1, lifetimeValue: "3200.00" },
  ];

  // Initialize customers first to avoid temporal dead zone
  const transformCustomersForDisplay = (apiCustomers: Customer[]): DisplayCustomer[] => {
    return apiCustomers.map(customer => ({
      id: customer.id,
      name: customer.name || 'Unnamed Customer',
      email: customer.email || '',
      phone: customer.phone || '',
      totalJobs: customer.totalJobs || 0,
      lifetimeValue: customer.lifetimeValue ? String(customer.lifetimeValue) : '0.00',
      lastContactDate: customer.lastContactDate ? new Date(customer.lastContactDate).toLocaleDateString() : undefined
    }));
  };

  const displayCustomers: DisplayCustomer[] = customers.length > 0 ? transformCustomersForDisplay(customers) : mockCustomers;

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

  const displayJobs: DisplayJob[] = jobs.length > 0 ? transformJobsForDisplay(jobs) : mockJobs.map(job => ({...job, customer: getCustomerName(job.customerId)}));
  const displayLeads: DisplayLead[] = leads.length > 0 ? transformLeadsForDisplay(leads) : mockLeads;

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

  return (
    <div className="h-full bg-background p-4 md:p-6 overflow-hidden w-full max-w-full min-w-0">
      <div className="w-full max-w-full h-full flex flex-col min-w-0">
        <div className="mb-4 md:mb-6 shrink-0">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-job-dashboard">
            Job Dashboard
          </h1>
          <p className="text-muted-foreground" data-testid="text-dashboard-description">
            Comprehensive business management for Treemarkables
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
          <TabsList className="flex w-full overflow-x-auto whitespace-nowrap gap-2 md:gap-3 mb-4 md:mb-6 shrink-0 no-scrollbar" data-testid="tabs-dashboard-navigation">
            <TabsTrigger value="overview" data-testid="tab-overview" className="shrink-0"><TrendingUp className="w-4 h-4 mr-2" />Overview</TabsTrigger>
            <TabsTrigger value="dispatch" data-testid="tab-dispatch" className="shrink-0"><Calendar className="w-4 h-4 mr-2" />Dispatch</TabsTrigger>
            <TabsTrigger value="pipeline" data-testid="tab-pipeline" className="shrink-0"><CalendarDays className="w-4 h-4 mr-2" />Pipeline</TabsTrigger>
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
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`job-item-${job.id}`}>
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

          {/* Dispatch Tab */}
          <TabsContent value="dispatch" className="flex-1 overflow-hidden">
            <DispatchBoard />
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
                <div className="space-y-4">
                  {displayCustomers.map(customer => (
                    <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate" data-testid={`customer-card-${customer.id}`}>
                      <div className="flex-1">
                        <h4 className="font-medium" data-testid={`customer-name-${customer.id}`}>{customer.name}</h4>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone}</p>
                        <p className="text-xs text-muted-foreground">Last service: {customer.lastContactDate || 'N/A'}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-medium">${parseFloat(customer.lifetimeValue || "0").toLocaleString()}</div>
                        <p className="text-sm text-muted-foreground">{customer.totalJobs} jobs</p>
                        <Button size="sm" variant="outline" data-testid={`button-view-customer-${customer.id}`}>View Details</Button>
                      </div>
                    </div>
                  ))}
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

              {/* Featured Job Diary - Using sample job for demonstration */}
              <Card data-testid="card-featured-job-diary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" data-testid="title-featured-job">
                    <FileText className="w-5 h-5" />
                    Featured Job: Large Oak Tree Removal
                  </CardTitle>
                  <p className="text-sm text-muted-foreground" data-testid="text-job-details">
                    Job #JOB-001 - 123 Maple Street, Auckland, NZ
                  </p>
                </CardHeader>
                <CardContent>
                  <JobDiary 
                    jobId="1" 
                    jobTitle="Large Oak Tree Removal" 
                    compact={false}
                  />
                </CardContent>
              </Card>

              {/* Additional Job Dairy Examples */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-hedge-trimming-diary">
                  <CardHeader>
                    <CardTitle className="text-lg" data-testid="title-hedge-job">
                      Hedge Trimming & Pruning
                    </CardTitle>
                    <p className="text-sm text-muted-foreground" data-testid="text-hedge-details">
                      Job #JOB-002 - 456 Pine Avenue, Wellington, NZ
                    </p>
                  </CardHeader>
                  <CardContent>
                    <JobDiary 
                      jobId="2" 
                      jobTitle="Hedge Trimming & Pruning" 
                      compact={true}
                    />
                  </CardContent>
                </Card>

                <Card data-testid="card-stump-removal-diary">
                  <CardHeader>
                    <CardTitle className="text-lg" data-testid="title-stump-job">
                      Stump Grinding Service
                    </CardTitle>
                    <p className="text-sm text-muted-foreground" data-testid="text-stump-details">
                      Job #JOB-003 - 789 Cedar Lane, Christchurch, NZ
                    </p>
                  </CardHeader>
                  <CardContent>
                    <JobDiary 
                      jobId="3" 
                      jobTitle="Stump Grinding Service" 
                      compact={true}
                    />
                  </CardContent>
                </Card>
              </div>
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
        </Tabs>
      </div>
    </div>
  );
}
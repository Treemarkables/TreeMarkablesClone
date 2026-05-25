import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  CalendarDays,
  Users,
  FileText,
  TrendingUp,
  Wrench,
  MessageSquare,
  Settings,
  MapPin,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Plug,
  Cloud,
  Shield,
  Mail,
  Phone,
  Edit2,
  Briefcase,
  Search,
  Filter,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Pipeline from "./Pipeline";
import { PerformanceAnalytics } from "@/components/PerformanceAnalytics";
import { EquipmentTracker } from "@/components/EquipmentTracker";
import CommunicationsManagement from "./CommunicationsManagement";
import Opportunities from "./Opportunities";
import Integrations from "./Integrations";
import { DispatchBoard } from "@/components/DispatchBoard";
import { SafetyReporting } from "@/components/SafetyReporting";
import JobTemplateManagement from "@/components/JobTemplateManagement";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import { CustomerCSVUpload } from "@/components/CustomerCSVUpload";
import { CSVImportManager } from "@/components/CSVImportManager";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job, Lead, Customer } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";

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
  jobNumber?: string;
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

export default function JobDashboard({
  activeTab = "communications",
  onTabChange,
}: JobDashboardProps) {
  const [, navigate] = useLocation();

  // State for job card modal
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isJobCardOpen, setIsJobCardOpen] = useState(false);

  // Customer editing state
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null,
  );
  const [editingCustomerName, setEditingCustomerName] = useState("");

  // Jobs pagination and search state
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentJobPage, setCurrentJobPage] = useState(1);
  const [jobsPerPage, setJobsPerPage] = useState(10);

  // Bulk selection state
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isCrew } = useAuth();

  // Customer update mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("PUT", `/api/customers/${id}`, {
        name,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setEditingCustomerId(null);
      setEditingCustomerName("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update customer name",
        variant: "destructive",
      });
    },
  });

  const deleteJobsMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      const res = await apiRequest("DELETE", "/api/jobs/bulk-delete", { jobIds });
      return await res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.refetchQueries({ queryKey: [jobsApiUrl] });
      setSelectedJobs(new Set());
      if (result?.failed > 0) {
        toast({
          title: "Some jobs could not be deleted",
          description: `${result.deleted} deleted, ${result.failed} failed.${result.errors?.length ? ` First error: ${result.errors[0]}` : ""}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete jobs",
        variant: "destructive",
      });
    },
  });

  // Handle starting customer name edit
  const handleEditCustomerName = (customerId: string, currentName: string) => {
    setEditingCustomerId(customerId);
    setEditingCustomerName(
      currentName.startsWith("Customer #") ? "" : currentName,
    );
  };

  // Handle saving customer name
  const handleSaveCustomerName = (customerId: string) => {
    if (!editingCustomerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a customer name",
        variant: "destructive",
      });
      return;
    }
    updateCustomerMutation.mutate({
      id: customerId,
      name: editingCustomerName.trim(),
    });
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

  // Job selection handlers
  const handleSelectJob = (jobId: string, checked: boolean) => {
    const newSelected = new Set(selectedJobs);
    if (checked) {
      newSelected.add(jobId);
    } else {
      newSelected.delete(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(new Set(paginatedJobs.map((job) => job.id)));
    } else {
      setSelectedJobs(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedJobs.size === 0) return;
    if (
      confirm(
        `Are you sure you want to delete ${selectedJobs.size} selected jobs? This action cannot be undone.`,
      )
    ) {
      deleteJobsMutation.mutate(Array.from(selectedJobs));
    }
  };

  // Build the URL for the current page — switches to the search endpoint when there is a query
  const jobsApiUrl = debouncedSearch.trim()
    ? `/api/jobs/search?q=${encodeURIComponent(debouncedSearch.trim())}&limit=${jobsPerPage}&offset=${(currentJobPage - 1) * jobsPerPage}&excludeArchived=false`
    : `/api/jobs?limit=${jobsPerPage}&offset=${(currentJobPage - 1) * jobsPerPage}`;

  // Fetch only the current page — server handles filtering, search, and pagination
  const { data: jobsResponse, isLoading: jobsLoading } = useQuery<
    ApiResponse<Job>
  >({
    queryKey: [jobsApiUrl],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch leads data with proper typing
  const { data: leadsResponse, isLoading: leadsLoading } = useQuery<
    ApiResponse<Lead>
  >({
    queryKey: ["/api/leads"],
  });

  // Fetch customers data with proper typing
  const { data: customersResponse, isLoading: customersLoading } = useQuery<
    ApiResponse<Customer>
  >({
    queryKey: ["/api/customers"],
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Debounce the search input so we don't fire a server request on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(jobSearchQuery);
      setCurrentJobPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [jobSearchQuery]);

  // Redirect crew users if they try to access restricted tabs
  useEffect(() => {
    const allowedCrewTabs = ["jobs", "safety"];
    if (isCrew && !allowedCrewTabs.includes(activeTab)) {
      onTabChange?.("jobs");
    }
  }, [isCrew, activeTab, onTabChange]);

  // Extract data from API responses with type safety
  const jobs = jobsResponse?.data || [];
  const totalJobCount = (jobsResponse as any)?.total ?? 0;
  const leads = leadsResponse?.data || [];
  const customers = customersResponse?.data || [];

  // No mock data - use real data only

  // Initialize customers first to avoid temporal dead zone
  const transformCustomersForDisplay = (
    apiCustomers: Customer[],
  ): DisplayCustomer[] => {
    return apiCustomers.map((customer, index) => {
      // Create a more meaningful display name using job address data
      let displayName = customer.name || "Unnamed Customer";

      // If it's a generic placeholder name, use simple numbering
      if (customer.name?.startsWith("Customer-")) {
        const uniqueId =
          customer.name.split("-").pop()?.slice(-6) || customer.id.slice(-6);
        displayName = `Customer #${index + 1} (${uniqueId})`;
      }

      return {
        id: customer.id,
        name: displayName,
        email: customer.email || "",
        phone: customer.phone || "",
        totalJobs: customer.totalJobs || 0,
        lifetimeValue: customer.lifetimeValue
          ? String(customer.lifetimeValue)
          : "0.00",
        lastContactDate: customer.lastContactDate
          ? new Date(customer.lastContactDate).toLocaleDateString()
          : undefined,
      };
    });
  };

  const displayCustomers: DisplayCustomer[] =
    customers.length > 0 ? transformCustomersForDisplay(customers) : [];

  // Helper function to get customer name by ID - now safe to use
  const getCustomerName = (customerId: string) => {
    const customer = displayCustomers.find((c) => c.id === customerId);
    return customer?.name || "Unknown Customer";
  };

  // Job price for the All Jobs list column.
  //
  // Output is INCLUSIVE of GST — that's what /all-jobs has always shown and
  // changing it would silently shrink every dollar amount on the list by
  // ~13%. Other surfaces (Live Roster, Dispatch Board) display ex-GST; this
  // surface intentionally differs.
  //
  // Source hierarchy matches the canonical desktop card header logic +
  // PR #28/#30 lineItems fix, but with inc-GST output:
  //   line items (ex-GST × 1.15) → subtotal (ex-GST × 1.15) →
  //   totalIncludingGst (as-is) → totalAmount (as-is, project convention
  //   says this column is stored inc-GST).
  //
  // The bug fixed here: previously only `totalAmount` was checked, so a
  // job sourced from an accepted proposal (lineItems populated, no rolled-
  // up subtotal/totalAmount yet) showed \$0 in the list. Same blind spot
  // PR #28 fixed on the Live Roster.
  const getJobPrice = (job: Job): number => {
    const toNum = (v: unknown): number => {
      if (v == null) return 0;
      const n = typeof v === "string" ? parseFloat(v) : (v as number);
      return Number.isFinite(n) ? n : 0;
    };
    const lineItems = (job as any).lineItems as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      const lineItemsTotalExGst = lineItems.reduce((sum, li) => {
        const exGst =
          toNum(li.totalExGst) ||
          (li.priceExGst != null ? toNum(li.priceExGst) * toNum(li.quantity || 1) : 0);
        return sum + (exGst || toNum(li.total));
      }, 0);
      if (lineItemsTotalExGst > 0) return lineItemsTotalExGst * 1.15;
    }
    const subtotal = toNum(job.subtotal);
    if (subtotal > 0) return subtotal * 1.15;
    const incGst = toNum((job as any).totalIncludingGst);
    if (incGst > 0) return incGst;
    return toNum(job.totalAmount);
  };

  // Transform API data to display format - now safe to use getCustomerName
  const transformJobsForDisplay = (apiJobs: Job[]): DisplayJob[] => {
    return apiJobs.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber || undefined,
      title: job.title || getCustomerName(job.customerId || ""),
      customerId: job.customerId || "",
      status: job.status || "unknown",
      priority: job.priority || "medium",
      scheduledDate: job.scheduledDate
        ? new Date(job.scheduledDate).toLocaleDateString()
        : "",
      estimatedValue: getJobPrice(job),
      location: job.address || "Location TBD",
      customer: getCustomerName(job.customerId || ""),
    }));
  };

  const transformLeadsForDisplay = (apiLeads: Lead[]): DisplayLead[] => {
    return apiLeads.map((lead) => ({
      id: lead.id,
      name: lead.name || "Unnamed Lead",
      source: lead.source || "Unknown",
      status: lead.status || "new",
      estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : 0,
      lastContact: lead.followUpDate
        ? new Date(lead.followUpDate).toLocaleDateString()
        : "Never",
    }));
  };

  // Transform and filter jobs
  const allDisplayJobs: DisplayJob[] =
    jobs.length > 0 ? transformJobsForDisplay(jobs) : [];

  // Server already filters and paginates — just use the response directly
  const filteredJobs = allDisplayJobs;
  const paginatedJobs = allDisplayJobs;
  const totalPages = Math.ceil(totalJobCount / jobsPerPage);
  const startIndex = (currentJobPage - 1) * jobsPerPage;
  const endIndex = Math.min(startIndex + jobsPerPage, totalJobCount);

  // For overview tab, still show recent jobs (first 5)
  const displayJobs: DisplayJob[] = allDisplayJobs.slice(0, 5);
  const displayLeads: DisplayLead[] =
    leads.length > 0 ? transformLeadsForDisplay(leads) : [];

  // Calculate metrics
  const totalRevenue = displayJobs.reduce(
    (sum, job) => sum + (job.estimatedValue ?? 0),
    0,
  );
  const completedJobs = displayJobs.filter(
    (job) => job.status === "completed",
  ).length;
  const activeJobs = displayJobs.filter(
    // 'scheduled' status retired 2026-05 — work_order covers all active.
    (job) => job.status === "work_order" || job.status === "in-progress",
  ).length;
  const newLeads = displayLeads.filter((lead) => lead.status === "new").length;

  const getJobStatusBadge = (status: string) => {
    const jobStatusConfig = {
      // 'scheduled' retired 2026-05 — replaced with work_order in the badge map.
      work_order: { variant: "outline" as const, label: "Work Order" },
      "in-progress": { variant: "default" as const, label: "In Progress" },
      completed: { variant: "default" as const, label: "Completed" },
      cancelled: { variant: "destructive" as const, label: "Cancelled" },
    };

    const config = jobStatusConfig[status as keyof typeof jobStatusConfig];
    return (
      <Badge
        variant={config?.variant || "default"}
        data-testid={`badge-status-${status}`}
      >
        {config?.label || status}
      </Badge>
    );
  };

  const getLeadStatusBadge = (status: string) => {
    const leadStatusConfig = {
      new: { variant: "default" as const, label: "New" },
      contacted: { variant: "outline" as const, label: "Contacted" },
      quoted: { variant: "outline" as const, label: "Quoted" },
      won: { variant: "default" as const, label: "Won" },
      lost: { variant: "destructive" as const, label: "Lost" },
    };

    const config = leadStatusConfig[status as keyof typeof leadStatusConfig];
    return (
      <Badge
        variant={config?.variant || "default"}
        data-testid={`badge-status-${status}`}
      >
        {config?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { variant: "outline" as const, label: "Low" },
      medium: { variant: "outline" as const, label: "Medium" },
      high: { variant: "destructive" as const, label: "High" },
      emergency: { variant: "destructive" as const, label: "Emergency" },
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig];
    return (
      <Badge
        variant={config?.variant || "default"}
        data-testid={`badge-priority-${priority}`}
      >
        {config?.label || priority}
      </Badge>
    );
  };

  // Helper functions for customer cards
  const getInitials = (name: string) => {
    return (name || "")
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getCustomerTier = (lifetimeValue: number) => {
    if (lifetimeValue >= 10000)
      return { label: "Premium", color: "bg-purple-100 text-purple-800" };
    if (lifetimeValue >= 5000)
      return { label: "Gold", color: "bg-yellow-100 text-yellow-800" };
    if (lifetimeValue >= 1000)
      return { label: "Silver", color: "bg-gray-100 text-gray-800" };
    return { label: "Bronze", color: "bg-orange-100 text-orange-800" };
  };

  // Handle customer card click for viewing/editing
  const handleCustomerCardClick = (
    customerId: string,
    customerName: string,
  ) => {
    if (editingCustomerId !== customerId) {
      handleEditCustomerName(customerId, customerName);
    }
  };

  // Handle View Details button click
  const handleViewCustomerDetails = (customerId: string) => {
    // Navigate to customer details - for now, switch to customers tab and highlight
    onTabChange?.("customers");

    // Show user feedback with toast notification
  };

  // Handle job navigation
  const handleViewCustomerJobs = (customerId: string, customerName: string) => {
    // Switch to jobs tab and filter by customer
    onTabChange?.("jobs");
    setJobSearchQuery(customerName);
  };

  return (
    <div className="h-full bg-background p-2 sm:p-4 md:p-6 overflow-x-hidden overflow-y-auto w-full max-w-full min-w-0">
      <div className="w-full max-w-full h-full flex flex-col min-w-0">
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="flex flex-col h-full"
        >
          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-total-revenue">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Revenue
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="text-total-revenue"
                    >
                      ${totalRevenue.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-active-jobs">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Active Jobs
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="text-active-jobs"
                    >
                      {activeJobs}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      In progress + scheduled
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-completed-jobs">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Completed Jobs
                    </CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="text-completed-jobs"
                    >
                      {completedJobs}
                    </div>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-new-leads">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      New Leads
                    </CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="text-new-leads"
                    >
                      {newLeads}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requires attention
                    </p>
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
                      {displayJobs.slice(0, 5).map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                          data-testid={`job-item-${job.id}`}
                          onClick={() => handleJobClick(job.id)}
                        >
                          <div className="flex-1">
                            <h4
                              className="font-medium"
                              data-testid={`job-title-${job.id}`}
                            >
                              {job.title}
                            </h4>
                            <p
                              className="text-sm text-muted-foreground"
                              data-testid={`job-customer-${job.id}`}
                            >
                              {job.customer}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span
                                className="text-xs text-muted-foreground"
                                data-testid={`job-location-${job.id}`}
                              >
                                {job.location}
                              </span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div
                              className="font-medium"
                              data-testid={`job-value-${job.id}`}
                            >
                              ${(job.estimatedValue || 0).toLocaleString()}
                            </div>
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
                      {displayLeads.slice(0, 5).map((lead) => (
                        <div
                          key={lead.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`lead-item-${lead.id}`}
                        >
                          <div className="flex-1">
                            <h4
                              className="font-medium"
                              data-testid={`lead-name-${lead.id}`}
                            >
                              {lead.name}
                            </h4>
                            <p
                              className="text-sm text-muted-foreground"
                              data-testid={`lead-source-${lead.id}`}
                            >
                              Source: {lead.source}
                            </p>
                            <p
                              className="text-xs text-muted-foreground"
                              data-testid={`lead-last-contact-${lead.id}`}
                            >
                              Last contact: {lead.lastContact}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <div
                              className="font-medium"
                              data-testid={`lead-value-${lead.id}`}
                            >
                              ${(lead.estimatedValue || 0).toLocaleString()}
                            </div>
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
          <TabsContent
            value="jobs"
            className="flex-1 overflow-auto overflow-x-hidden w-full max-w-full"
          >
            <div className="space-y-4 w-full max-w-full min-w-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full max-w-full min-w-0">
                <div>
                  <h2
                    className="text-2xl font-bold text-foreground mb-2"
                    data-testid="heading-all-jobs"
                  >
                    All Jobs ({totalJobCount.toLocaleString()})
                  </h2>
                  <p
                    className="text-muted-foreground"
                    data-testid="text-jobs-description"
                  >
                    Complete list of all jobs including imported ServiceM8 data
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto min-w-0">
                  <div className="relative flex-1 sm:flex-none sm:w-64 min-w-0">
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
                  <Button
                    variant="outline"
                    size="icon"
                    data-testid="button-filter-jobs"
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedJobs.size > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg w-full max-w-full min-w-0">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-blue-800">
                      {selectedJobs.size} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedJobs(new Set())}
                      data-testid="button-clear-selection"
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={deleteJobsMutation.isPending}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
              )}

              {/* Select All Header */}
              {paginatedJobs.length > 0 && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
                  <Checkbox
                    checked={
                      selectedJobs.size === paginatedJobs.length &&
                      paginatedJobs.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-sm font-medium">
                    Select All ({paginatedJobs.length})
                  </span>
                </div>
              )}

              {/* Jobs Grid */}
              {jobsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full">
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
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">
                      No Jobs Found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Start by creating your first job or import from ServiceM8
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full">
                  {paginatedJobs.map((job) => {
                    const isSelected = selectedJobs.has(job.id);

                    return (
                      <Card
                        key={job.id}
                        className={`hover-elevate cursor-pointer transition-all duration-200 ${isSelected ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
                        onClick={() => handleJobClick(job.id)}
                        data-testid={`card-job-${job.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) =>
                                    handleSelectJob(job.id, checked as boolean)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`checkbox-select-job-${job.id}`}
                                />
                                <div>
                                  <h3
                                    className="font-semibold text-foreground line-clamp-2"
                                    data-testid={`text-job-customer-${job.id}`}
                                  >
                                    {job.customer}
                                  </h3>
                                  {job.jobNumber && (
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                      #{job.jobNumber}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div
                                className="text-lg font-bold text-green-600 ml-2"
                                data-testid={`text-job-value-${job.id}`}
                              >
                                ${job.estimatedValue.toLocaleString()}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p
                                className="text-sm text-muted-foreground font-medium"
                                data-testid={`text-job-title-${job.id}`}
                              >
                                {job.title}
                              </p>

                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span
                                  className="line-clamp-1"
                                  data-testid={`text-job-location-${job.id}`}
                                >
                                  {job.location}
                                </span>
                              </div>

                              {job.scheduledDate && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span data-testid={`text-job-date-${job.id}`}>
                                    {job.scheduledDate}
                                  </span>
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
                    );
                  })}
                </div>
              )}

              {/* Pagination info and controls - Always show dropdown */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t">
                  <div className="space-y-1">
                    {totalJobCount > 0 && (
                      <p
                        className="text-sm text-muted-foreground"
                        data-testid="text-jobs-showing"
                      >
                        Showing {startIndex + 1}–{endIndex} of{" "}
                        {totalJobCount.toLocaleString()}
                        {debouncedSearch ? " results" : " jobs"}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-xs text-muted-foreground">
                        Jobs per page:
                      </label>
                      <Select
                        value={jobsPerPage.toString()}
                        onValueChange={(value) => {
                          setJobsPerPage(parseInt(value));
                          setCurrentJobPage(1);
                        }}
                      >
                        <SelectTrigger
                          className="w-full sm:w-20 h-8 text-xs"
                          data-testid="select-jobs-per-page"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto max-w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentJobPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={currentJobPage === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          const pageNum =
                            currentJobPage <= 3
                              ? i + 1
                              : currentJobPage - 2 + i;
                          if (pageNum > totalPages) return null;

                          return (
                            <Button
                              key={pageNum}
                              variant={
                                pageNum === currentJobPage ? "default" : "ghost"
                              }
                              size="sm"
                              onClick={() => setCurrentJobPage(pageNum)}
                              className="w-8 flex-shrink-0"
                              data-testid={`button-page-${pageNum}`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}

                        {totalPages > 5 && currentJobPage < totalPages - 2 && (
                          <>
                            <span className="text-muted-foreground flex-shrink-0">
                              ...
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCurrentJobPage(totalPages)}
                              className="w-8 flex-shrink-0"
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
                        onClick={() =>
                          setCurrentJobPage((prev) =>
                            Math.min(prev + 1, totalPages),
                          )
                        }
                        disabled={currentJobPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="flex-1 overflow-auto">
            <Pipeline />
          </TabsContent>

          {/* Job Templates Tab */}
          <TabsContent value="templates" className="flex-1 overflow-auto">
            <JobTemplateManagement />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent
            value="analytics"
            className="flex-1 overflow-auto overflow-x-hidden w-full max-w-full"
          >
            <PerformanceAnalytics />
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="flex-1 overflow-auto">
            <EquipmentTracker />
          </TabsContent>

          {/* Safety Tab */}
          <TabsContent value="safety" className="flex-1 overflow-auto">
            <div className="space-y-6">
              <div className="mb-6">
                <h2
                  className="text-2xl font-bold text-foreground mb-2"
                  data-testid="heading-safety-management"
                >
                  Safety Management & Compliance
                </h2>
                <p
                  className="text-muted-foreground"
                  data-testid="text-safety-description"
                >
                  Comprehensive safety incident tracking, risk assessments, and
                  compliance monitoring for tree removal operations
                </p>
              </div>

              {/* Job Hazard Analysis Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Job Hazard Analysis (JHA)
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card
                    className="hover-elevate cursor-pointer"
                    onClick={() => navigate("/jha-assessment")}
                    data-testid="card-jha-assessment"
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        New JHA Assessment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Conduct a comprehensive hazard analysis before starting
                        work
                      </p>
                    </CardContent>
                  </Card>
                  <Card
                    className="hover-elevate cursor-pointer"
                    onClick={() => navigate("/jha-history")}
                    data-testid="card-jha-history"
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        JHA History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        View all completed hazard assessments and documentation
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="border-t pt-6">
                <SafetyReporting />
              </div>
            </div>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="flex-1 overflow-auto">
            <Integrations />
          </TabsContent>

          {/* CSV Data Import Tab */}
          <TabsContent value="job-import" className="flex-1 overflow-auto">
            <CSVImportManager />
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

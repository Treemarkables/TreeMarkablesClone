import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoSidebarTrigger } from "@/components/LogoSidebarTrigger";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  DollarSign,
  Target,
  PhoneCall,
  CheckCircle,
  Users,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Send,
  Calendar,
  Calculator,
  Loader2,
  Briefcase,
  AlertCircle,
  Bot,
  RefreshCw,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import { formatNZTime } from "@shared/dateUtils";

interface DashboardStats {
  totalLeads: number;
  totalCustomers: number;
  totalJobs: number;
  totalRevenue: number;
  invoicesCount: number;
  conversionRate: number;
  averageQuoteValue: number;
  missedCalls: number;
  customerRetention?: number;
  returningCustomerPercentage?: number;
  firstTimeFix?: number;
  recentCalls: any[];
  recentLeads: any[];
}

interface RevenueStats {
  totalRevenue: number;
  jobsCompleted: number;
  jobsWithInvoices: number;
  averageJobValue: number;
  totalCosts: number;
  grossMargin: number;
  jobsWithProfitTracking: number;
  marginRevenue: number;
  marginCosts: number;
  monthlyTrend: { month: string; revenue: number; jobs: number }[];
}

interface QuoteAnalytics {
  totalQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  pendingQuotes: number;
  acceptedJobCards?: string[];
  rejectedJobCards?: string[];
  pendingJobCards?: string[];
  averageResponseTime: number;
  rejectionReasons: { reason: string; count: number }[];
  competitorAnalysis: {
    competitor: string;
    averagePrice: number;
    winRate: number;
  }[];
}

interface LeadSourceData {
  source: string;
  count: number;
  quotedCount: number;
  wonCount: number;
  conversionRate: number;
  quoteConversionRate: number;
  totalRevenue: number;
  averageValue: number;
  averageProfitMargin: number;
  totalProfit: number;
  roi: number;
}

interface QuotePresentationData {
  method: string;
  label: string;
  totalQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  pendingQuotes: number;
  conversionRate: number;
  totalValue: number;
  acceptedValue: number;
  averageValue: number;
}

interface ServicePerformance {
  id: string;
  name: string;
  type: "material" | "service";
  category: string;
  totalRevenue: number;
  totalCost: number;
  totalQuantity: number;
  invoiceCount: number;
  grossMargin: number;
  marginPercentage: number;
}

interface ServicePerformanceData {
  services: ServicePerformance[];
  summary: {
    totalRevenue: number;
    totalCost: number;
    grossMargin: number;
    marginPercentage: number;
    servicesTracked: number;
  };
}

interface ManHoursMetrics {
  totalJobs: number;
  jobsWithEstimates: number;
  averageAccuracy: number;
  accuracyDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  totalEstimatedHours: number;
  totalActualHours: number;
  overestimatedJobs: number;
  underestimatedJobs: number;
}

interface CrewEfficiencyEmployee {
  employeeId: string;
  employeeName: string;
  staffId: string | null;
  paidHours: number;
  billableHours: number;
  nonBillableHours: number;
  efficiencyRate: number;
  status: string;
}

interface CrewEfficiencyData {
  employees: CrewEfficiencyEmployee[];
  totals: {
    totalPaidHours: number;
    totalBillableHours: number;
    totalNonBillableHours: number;
    overallEfficiencyRate: number;
  };
  period: {
    from: string;
    to: string;
  };
}

interface StaffWorkDaysEmployee {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  daysWorked: number;
  avgHoursPerDay: number;
  attendanceRate: number;
}

interface StaffWorkDaysData {
  employees: StaffWorkDaysEmployee[];
  totals: {
    totalHours: number;
    totalDaysWorked: number;
    avgDaysPerEmployee: number;
    avgAttendance: number;
    workingDaysInPeriod: number;
    activeEmployeeCount: number;
  };
  period: {
    from: string;
    to: string;
  };
}

interface DispatchAISummary {
  workOrderCount: number;
  workOrderValue: number;
  scheduledCount: number;
  scheduledValue: number;
  inProgressCount: number;
  inProgressValue: number;
  totalJobs: number;
  totalValue: number;
  totalEstimatedHours: number;
  activeCrewCount: number;
  estimatedDaysOfWork: number;
}

interface DispatchAIData {
  summary: DispatchAISummary;
  aiInsight: string;
}

interface ChecklistUsageItem {
  id: string;
  label: string;
  role: 'A' | 'B' | 'C';
  completedCount: number;
  percent: number;
}

interface ChecklistUsageData {
  totalJobs: number;
  items: ChecklistUsageItem[];
  overall: number;
}

export default function MetricsDashboard() {
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [manHoursCollapsed, setManHoursCollapsed] = useState(false);
  const [servicePerformanceCollapsed, setServicePerformanceCollapsed] =
    useState(false);
  const [crewEfficiencyCollapsed, setCrewEfficiencyCollapsed] = useState(false);
  const [staffWorkDaysCollapsed, setStaffWorkDaysCollapsed] = useState(false);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [customReportDialog, setCustomReportDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [reportDateRange, setReportDateRange] = useState<string>("30");
  const [reportFormat, setReportFormat] = useState<string>("pdf");

  // Date range state
  const [dateRangePreset, setDateRangePreset] = useState<string>("7");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Booked Workload — calendar-week window (Mon–Sun in NZ time)
  type BookedPeriod = "this_week" | "next_week" | "week_after" | "next_month";
  const [bookedPeriod, setBookedPeriod] = useState<BookedPeriod>("this_week");
  const bookedPeriodLabels: Record<BookedPeriod, string> = {
    this_week: "This week",
    next_week: "Next week",
    week_after: "Week after",
    next_month: "Next month",
  };
  const [bookedJobsDialogOpen, setBookedJobsDialogOpen] = useState(false);
  const [selectedBookedJobId, setSelectedBookedJobId] = useState<string | null>(null);

  // Revenue Calculator state
  const [calcPeriod, setCalcPeriod] = useState<"weekly" | "monthly">("monthly");
  const [calcRevenueTarget, setCalcRevenueTarget] = useState<number>(20000);
  const [calcAvgJobValue, setCalcAvgJobValue] = useState<number>(1500);
  const [calcConversionRate, setCalcConversionRate] = useState<number>(50);
  const [calcJobsNeeded, setCalcJobsNeeded] = useState<number>(0);
  const [calcQuotesNeeded, setCalcQuotesNeeded] = useState<number>(0);
  const hasPrePopulated = useRef(false);

  // Revenue breakdown modal state
  const [revenueBreakdownOpen, setRevenueBreakdownOpen] = useState(false);
  const [quoteBreakdownOpen, setQuoteBreakdownOpen] = useState(false);
  const [avgJobValueBreakdownOpen, setAvgJobValueBreakdownOpen] =
    useState(false);

  // Drill-down modal state for Jobs Completed and Accepted Quotes
  const [jobsCompletedDrilldownOpen, setJobsCompletedDrilldownOpen] =
    useState(false);
  const [acceptedQuotesDrilldownOpen, setAcceptedQuotesDrilldownOpen] =
    useState(false);

  // Inline expansion panel for Business Health tiles
  const [activeDrilldown, setActiveDrilldown] = useState<
    "revenue" | "jobs" | "winrate" | "quotes" | null
  >(null);
  const toggleDrilldown = (key: "revenue" | "jobs" | "winrate" | "quotes") => {
    setActiveDrilldown((prev) => (prev === key ? null : key));
  };

  const { toast } = useToast();

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format lead source for display
  const formatLeadSource = (source: string) => {
    const sourceMap: Record<string, string> = {
      website: "Website",
      phone: "Phone Call",
      referral: "Referral",
      friend: "Friend",
      saw_working: "Saw you working",
      repeat: "Repeat",
      google: "Google Search",
      ppc: "PPC (Google Ads)",
      google_maps: "Google Maps",
      seo: "SEO (Organic)",
      facebook: "Facebook",
      direct: "Direct",
      advertisement: "Advertisement",
      council: "Council",
      other: "Other",
    };
    return (
      sourceMap[source] || source.charAt(0).toUpperCase() + source.slice(1)
    );
  };

  // Revenue Calculator: Calculate jobs and quotes needed from revenue target
  const recalculateFromRevenue = useCallback(
    (revenue: number, avgJob: number, convRate: number) => {
      const newJobsNeeded = avgJob > 0 ? Math.ceil(revenue / avgJob) : 0;
      const newQuotesNeeded =
        convRate > 0 ? Math.ceil(newJobsNeeded / (convRate / 100)) : 0;
      setCalcJobsNeeded(newJobsNeeded);
      setCalcQuotesNeeded(newQuotesNeeded);
    },
    [],
  );

  // Handler functions for each field change
  const handleRevenueChange = (value: number) => {
    setCalcRevenueTarget(value);
    recalculateFromRevenue(value, calcAvgJobValue, calcConversionRate);
  };

  const handleAvgJobChange = (value: number) => {
    setCalcAvgJobValue(value);
    recalculateFromRevenue(calcRevenueTarget, value, calcConversionRate);
  };

  const handleConversionChange = (value: number) => {
    setCalcConversionRate(value);
    const jobsNeeded =
      calcAvgJobValue > 0 ? Math.ceil(calcRevenueTarget / calcAvgJobValue) : 0;
    setCalcJobsNeeded(jobsNeeded);
    const quotesNeeded = value > 0 ? Math.ceil(jobsNeeded / (value / 100)) : 0;
    setCalcQuotesNeeded(quotesNeeded);
  };

  const handleJobsChange = (value: number) => {
    setCalcJobsNeeded(value);
    const newRevenue = value * calcAvgJobValue;
    setCalcRevenueTarget(newRevenue);
    const quotesNeeded =
      calcConversionRate > 0
        ? Math.ceil(value / (calcConversionRate / 100))
        : 0;
    setCalcQuotesNeeded(quotesNeeded);
  };

  const handleQuotesChange = (value: number) => {
    setCalcQuotesNeeded(value);
    const jobsNeeded = Math.ceil(value * (calcConversionRate / 100));
    setCalcJobsNeeded(jobsNeeded);
    const newRevenue = jobsNeeded * calcAvgJobValue;
    setCalcRevenueTarget(newRevenue);
  };

  // Handle period change - scale values appropriately
  const handlePeriodChange = (newPeriod: "weekly" | "monthly") => {
    if (newPeriod === calcPeriod) return;

    if (newPeriod === "weekly" && calcPeriod === "monthly") {
      // Converting from monthly to weekly - divide by ~4.33
      const weeklyRevenue = Math.round(calcRevenueTarget / 4.33);
      setCalcRevenueTarget(weeklyRevenue);
      recalculateFromRevenue(
        weeklyRevenue,
        calcAvgJobValue,
        calcConversionRate,
      );
    } else if (newPeriod === "monthly" && calcPeriod === "weekly") {
      // Converting from weekly to monthly - multiply by ~4.33
      const monthlyRevenue = Math.round(calcRevenueTarget * 4.33);
      setCalcRevenueTarget(monthlyRevenue);
      recalculateFromRevenue(
        monthlyRevenue,
        calcAvgJobValue,
        calcConversionRate,
      );
    }
    setCalcPeriod(newPeriod);
  };

  // Initialize calculator on first render
  useEffect(() => {
    recalculateFromRevenue(
      calcRevenueTarget,
      calcAvgJobValue,
      calcConversionRate,
    );
  }, []);

  // Helper to get date range based on preset
  const getDateRange = () => {
    if (dateRangePreset === "custom" && startDate && endDate) {
      return { from: startDate, to: endDate };
    }

    const today = new Date();
    const fromDate = new Date();

    switch (dateRangePreset) {
      case "today": {
        const todayStr = today.toISOString().split("T")[0];
        return { from: todayStr, to: todayStr };
      }
      case "7": {
        // This Week: Monday of the current week → today
        const dow = today.getDay(); // 0=Sun, 1=Mon … 6=Sat
        const diffToMonday = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);
        return {
          from: monday.toISOString().split("T")[0],
          to: today.toISOString().split("T")[0],
        };
      }
      case "mon-fri": {
        // Last Week: previous Monday → previous Sunday
        const dow = today.getDay(); // 0=Sun
        const diffToThisMonday = dow === 0 ? -6 : 1 - dow;
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() + diffToThisMonday);
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(thisMonday.getDate() - 7);
        const lastSunday = new Date(thisMonday);
        lastSunday.setDate(thisMonday.getDate() - 1);
        return {
          from: lastMonday.toISOString().split("T")[0],
          to: lastSunday.toISOString().split("T")[0],
        };
      }
      case "30":
        fromDate.setDate(today.getDate() - 30);
        return {
          from: fromDate.toISOString().split("T")[0],
          to: today.toISOString().split("T")[0],
        };
      case "90":
        fromDate.setDate(today.getDate() - 90);
        return {
          from: fromDate.toISOString().split("T")[0],
          to: today.toISOString().split("T")[0],
        };
      case "all":
      default:
        // Return last 12 months for "all" to enable Xero payroll metrics
        fromDate.setFullYear(today.getFullYear() - 1);
        return {
          from: fromDate.toISOString().split("T")[0],
          to: today.toISOString().split("T")[0],
        };
    }
  };

  const dateRange = getDateRange();

  // Get today's date string for "Today's Metrics" section
  const todayStr = new Date().toISOString().split("T")[0];

  // Today's metrics query - always shows today's activity regardless of date range
  const { data: todayStats, isLoading: todayLoading } = useQuery<{
    newLeads: number;
    quotesSent: number;
    jobsCompleted: number;
    revenue: number;
    callsReceived: number;
  }>({
    queryKey: ["/api/today-metrics", todayStr],
    queryFn: () => {
      return fetch(`/api/today-metrics`)
        .then((res) => res.json())
        .then((res) => res.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Data queries with date filtering
  const {
    data: dashboardStats,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats", dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("fromDate", dateRange.from);
      if (dateRange?.to) params.append("toDate", dateRange.to);
      return fetch(`/api/dashboard-stats?${params}`)
        .then((res) => res.json())
        .then((res) => res.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: revenueStats,
    isLoading: revenueLoading,
    isFetching: revenueFetching,
  } = useQuery<RevenueStats>({
    queryKey: ["/api/revenue-stats", dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from);
      if (dateRange?.to) params.append("to", dateRange.to);
      return fetch(`/api/revenue-stats?${params}`)
        .then((res) => res.json())
        .then((res) => res.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Revenue breakdown query - fetches list of jobs that make up the revenue
  const { data: revenueBreakdown, isLoading: breakdownLoading } = useQuery<{
    breakdown: {
      jobNumber: string;
      jobId: string;
      customerName: string;
      title: string;
      completedDate: string;
      invoiceDate?: string;
      amount: number;
      invoiceAmount?: number;
    }[];
    total: number;
  }>({
    queryKey: ["/api/revenue-breakdown", dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from);
      if (dateRange?.to) params.append("to", dateRange.to);
      return fetch(`/api/revenue-breakdown?${params}`)
        .then((res) => res.json())
        .then((res) => res.data);
    },
    enabled:
      revenueBreakdownOpen ||
      jobsCompletedDrilldownOpen ||
      activeDrilldown === "revenue" ||
      activeDrilldown === "jobs",
  });

  // Quote breakdown query - individual won/lost/pending quotes for CEO dashboard drill-down
  interface QuoteBreakdownItem {
    jobId: string;
    jobNumber: string;
    title: string;
    customerName: string;
    quoteSentDate: string | null;
    value: number;
    outcome: "won" | "lost" | "pending";
  }
  const { data: quoteBreakdownData, isLoading: quoteBreakdownLoading } =
    useQuery<{
      won: QuoteBreakdownItem[];
      lost: QuoteBreakdownItem[];
      pending: QuoteBreakdownItem[];
    }>({
      queryKey: ["/api/quote-breakdown", dateRange?.from, dateRange?.to],
      queryFn: () => {
        const params = new URLSearchParams();
        if (dateRange?.from) params.append("fromDate", dateRange.from);
        if (dateRange?.to) params.append("toDate", dateRange.to);
        return fetch(`/api/quote-breakdown?${params}`)
          .then((res) => res.json())
          .then((res) => res.data);
      },
      enabled: activeDrilldown === "winrate" || activeDrilldown === "quotes",
    });

  // Accepted quotes query - fetches list of accepted proposals for drilldown
  interface AcceptedQuote {
    id: string;
    jobId: string;
    jobNumber?: string;
    customerName?: string;
    amount?: string;
    sentDate?: string;
    acceptedDate?: string;
    title?: string;
  }
  const { data: acceptedQuotesData, isLoading: acceptedQuotesLoading } =
    useQuery<AcceptedQuote[]>({
      queryKey: ["/api/proposals-accepted", dateRange?.from, dateRange?.to],
      queryFn: () => {
        const params = new URLSearchParams();
        if (dateRange?.from) params.append("from", dateRange.from);
        if (dateRange?.to) params.append("to", dateRange.to);
        return fetch(`/api/proposals-accepted?${params}`)
          .then((res) => res.json())
          .then((res) => res.data || []);
      },
      enabled: acceptedQuotesDrilldownOpen,
    });

  const { data: quoteAnalytics, isLoading: quotesLoading } =
    useQuery<QuoteAnalytics>({
      queryKey: ["/api/quote-analytics", dateRange?.from, dateRange?.to],
      queryFn: () => {
        const params = new URLSearchParams();
        if (dateRange?.from) params.append("fromDate", dateRange.from);
        if (dateRange?.to) params.append("toDate", dateRange.to);
        return fetch(`/api/quote-analytics?${params}`)
          .then((res) => res.json())
          .then((res) => res.data);
      },
      staleTime: 5 * 60 * 1000,
    });

  // Quote Method Analytics - on-site vs sent-later acceptance rates
  interface QuoteMethodAnalytics {
    hasData: boolean;
    onSite: {
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
      acceptanceRate: number;
      avgAcceptedValue: number;
      totalAcceptedValue: number;
    };
    sentLater: {
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
      acceptanceRate: number;
      avgAcceptedValue: number;
      totalAcceptedValue: number;
    };
    comparison: {
      rateAdvantage: number;
      valueAdvantage: number;
      winningMethod: string;
    };
  }

  const { data: quoteMethodAnalytics, isLoading: quoteMethodLoading } =
    useQuery<QuoteMethodAnalytics>({
      queryKey: ["/api/quote-method-analytics", dateRange?.from, dateRange?.to],
      queryFn: () => {
        const params = new URLSearchParams();
        if (dateRange?.from) params.append("fromDate", dateRange.from);
        if (dateRange?.to) params.append("toDate", dateRange.to);
        return fetch(`/api/quote-method-analytics?${params}`)
          .then((res) => res.json())
          .then((res) => res.data);
      },
      staleTime: 5 * 60 * 1000,
    });

  const { data: leadSourceData, isLoading: leadSourceLoading } = useQuery<
    LeadSourceData[]
  >({
    queryKey: ["/api/lead-source-analysis", dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("fromDate", dateRange.from);
      if (dateRange?.to) params.append("toDate", dateRange.to);
      return fetch(`/api/lead-source-analysis?${params}`)
        .then((res) => res.json())
        .then((res) => res.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: quotePresentationData, isLoading: quotePresentationLoading } =
    useQuery<QuotePresentationData[]>({
      queryKey: [
        "/api/quote-presentation-analysis",
        dateRange?.from,
        dateRange?.to,
      ],
      queryFn: () => {
        const params = new URLSearchParams();
        if (dateRange?.from) params.append("fromDate", dateRange.from);
        if (dateRange?.to) params.append("toDate", dateRange.to);
        return fetch(`/api/quote-presentation-analysis?${params}`)
          .then((res) => res.json())
          .then((res) => res.data);
      },
      staleTime: 5 * 60 * 1000,
    });

  const { data: manHoursMetrics, isLoading: manHoursLoading } =
    useQuery<ManHoursMetrics>({
      queryKey: ["/api/man-hours-metrics", dateRange?.from, dateRange?.to],
      queryFn: () => {
        const params = new URLSearchParams();
        if (dateRange?.from) params.append("from", dateRange.from);
        if (dateRange?.to) params.append("to", dateRange.to);
        return fetch(`/api/man-hours-metrics?${params}`)
          .then((res) => res.json())
          .then((res) => res.data);
      },
      staleTime: 5 * 60 * 1000,
    });

  // Service Performance query
  const { data: servicePerformanceData, isLoading: servicePerformanceLoading } =
    useQuery<ServicePerformanceData>({
      queryKey: ["/api/analytics/service-performance"],
      queryFn: () =>
        fetch("/api/analytics/service-performance")
          .then((res) => res.json())
          .then((res) => res.data),
      staleTime: 5 * 60 * 1000,
    });

  // Unsuccessful Jobs Analytics query
  interface UnsuccessfulJobsData {
    totalUnsuccessful: number;
    totalPotentialRevenueLost: number;
    byReason: {
      reason: string;
      label: string;
      count: number;
      potentialRevenueLost: number;
      percentage: number;
    }[];
    monthlyTrends: {
      month: string;
      count: number;
      value: number;
    }[];
    recentUnsuccessful: {
      id: string;
      jobNumber: string;
      title: string;
      reason: string;
      reasonLabel: string;
      notes: string;
      date: string;
      potentialValue: number;
    }[];
  }

  const { data: unsuccessfulJobsData, isLoading: unsuccessfulJobsLoading } =
    useQuery<UnsuccessfulJobsData>({
      queryKey: ["/api/analytics/unsuccessful-jobs"],
      queryFn: () =>
        fetch("/api/analytics/unsuccessful-jobs")
          .then((res) => res.json())
          .then((res) => res.data),
      staleTime: 5 * 60 * 1000,
    });

  // Xero Profit & Loss query
  const {
    data: xeroPL,
    isLoading: xeroPLLoading,
    error: xeroPLError,
  } = useQuery<{
    revenue: number;
    expenses: number;
    netProfit: number;
    grossMargin: string | number;
    sections: { name: string; amount: number; type: "revenue" | "expense" }[];
  }>({
    queryKey: ["/api/xero/profit-loss", dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("fromDate", dateRange.from);
      if (dateRange?.to) params.append("toDate", dateRange.to);
      return fetch(`/api/xero/profit-loss?${params}`)
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.message);
          return res.data;
        });
    },
    retry: false,
  });

  // Crew Efficiency query - compares billable hours vs Xero paid hours
  const {
    data: crewEfficiency,
    isLoading: crewEfficiencyLoading,
    error: crewEfficiencyError,
  } = useQuery<CrewEfficiencyData>({
    queryKey: ["/api/xero/payroll/efficiency", dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("startDate", dateRange.from);
      if (dateRange?.to) params.append("endDate", dateRange.to);
      return fetch(`/api/xero/payroll/efficiency?${params}`)
        .then((res) => res.json())
        .then((res) => {
          if (!res.success) throw new Error(res.message);
          return res.data;
        });
    },
    enabled: Boolean(dateRange?.from && dateRange?.to),
    retry: false,
    staleTime: 30000,
  });

  // Staff Work Days query - tracks hours and days worked from Xero timesheets
  const {
    data: staffWorkDays,
    isLoading: staffWorkDaysLoading,
    error: staffWorkDaysError,
  } = useQuery<StaffWorkDaysData | null>({
    queryKey: ["/api/xero/payroll/work-days", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (dateRange?.from) params.append("startDate", dateRange.from);
        if (dateRange?.to) params.append("endDate", dateRange.to);
        const res = await fetch(`/api/xero/payroll/work-days?${params}`);
        const data = await res.json();
        if (!data.success) return null; // Return null instead of throwing to prevent cascade errors
        return data.data;
      } catch {
        return null; // Silently fail and return null
      }
    },
    enabled: Boolean(dateRange?.from && dateRange?.to),
    retry: false,
    staleTime: 30000,
  });

  // AI Dispatch Board Analyzer - shows workload and days of work
  const {
    data: dispatchAIResponse,
    isLoading: dispatchAILoading,
    refetch: refetchDispatchAI,
  } = useQuery<{ success: boolean; data: DispatchAIData }>({
    queryKey: ["/api/analytics/dispatch-ai"],
    staleTime: 60000, // Cache for 1 minute
    retry: false,
  });
  const dispatchAI = dispatchAIResponse?.data;

  // Booked Workload — jobs scheduled in a calendar week (Mon–Sun, NZ time)
  interface BookedWorkloadJob {
    id: string;
    jobNumber: string;
    customerName: string | null;
    title: string | null;
    status: string;
    scheduledDate: string | null;
    estimatedManHours: number;
    value: number;
    valueSource: "job" | "invoice" | "proposal" | "quote" | null;
  }
  interface BookedWorkloadData {
    period: BookedPeriod | null;
    days: number;
    from: string;
    to: string;
    jobCount: number;
    totalValue: number;
    totalHours: number;
    activeCrewCount: number;
    crewDays: number;
    unpricedJobCount: number;
    jobs: BookedWorkloadJob[];
  }
  const { data: bookedWorkloadResp, isLoading: bookedWorkloadLoading } =
    useQuery<{ success: boolean; data: BookedWorkloadData }>({
      queryKey: ["/api/analytics/booked-workload", bookedPeriod],
      queryFn: () =>
        fetch(`/api/analytics/booked-workload?period=${bookedPeriod}`).then(
          (res) => res.json(),
        ),
      staleTime: 60_000,
    });
  const bookedWorkload = bookedWorkloadResp?.data;

  // Checklist usage — % of completed jobs in the date range that had each item ticked.
  const { data: checklistUsageResp, isLoading: checklistUsageLoading } = useQuery<{
    success: boolean;
    data: ChecklistUsageData;
  }>({
    queryKey: ["/api/checklist-usage", dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("fromDate", dateRange.from);
      if (dateRange?.to) params.append("toDate", dateRange.to);
      const res = await fetch(`/api/checklist-usage?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load checklist usage");
      return res.json();
    },
    staleTime: 60_000,
  });
  const checklistUsage = checklistUsageResp?.data;

  // Pre-populate calculator with real analytics data when available (only once)
  useEffect(() => {
    // Only pre-populate once when analytics data first becomes available
    if (hasPrePopulated.current) return;

    const hasAvgJob =
      revenueStats?.averageJobValue && revenueStats.averageJobValue > 0;
    const hasConvRate =
      dashboardStats?.conversionRate && dashboardStats.conversionRate > 0;

    // Only proceed if we have at least one real data point
    if (!hasAvgJob && !hasConvRate) return;

    const avgJob = hasAvgJob
      ? Math.round(revenueStats.averageJobValue)
      : calcAvgJobValue;
    const convRate = hasConvRate
      ? Math.round(dashboardStats.conversionRate)
      : calcConversionRate;
    const revenueTarget = calcRevenueTarget;

    if (hasAvgJob) {
      setCalcAvgJobValue(avgJob);
    }
    if (hasConvRate) {
      setCalcConversionRate(convRate);
    }

    // Recalculate with the updated values
    recalculateFromRevenue(revenueTarget, avgJob, convRate);
    hasPrePopulated.current = true;
  }, [
    revenueStats?.averageJobValue,
    dashboardStats?.conversionRate,
    recalculateFromRevenue,
    calcAvgJobValue,
    calcConversionRate,
    calcRevenueTarget,
  ]);

  // Export handler
  const handleExportData = async (type: "analytics" | "lead-sources") => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("fromDate", dateRange.from);
      if (dateRange?.to) params.append("toDate", dateRange.to);

      const response = await fetch(`/api/export/${type}?${params}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Custom report handler
  const handleCustomReport = (metricName: string) => {
    setSelectedMetric(metricName);
    setCustomReportDialog(true);
  };

  const handleGenerateReport = async () => {
    try {
      const response = await fetch("/api/custom-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric: selectedMetric,
          dateRange: reportDateRange,
          format: reportFormat,
        }),
      });

      if (!response.ok) {
        throw new Error("Report generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedMetric.toLowerCase().replace(/\s+/g, "_")}_report_${new Date().toISOString().split("T")[0]}.${reportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setCustomReportDialog(false);
    } catch (error) {
      toast({
        title: "Report Generation Failed",
        description: "There was an error generating the report.",
        variant: "destructive",
      });
    }
  };

  // Metric Card Component with Custom Report Button
  const MetricCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    testId,
    colorful = false,
    valueColor = "",
    onClick,
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    testId: string;
    colorful?: boolean;
    valueColor?: string;
    onClick?: () => void;
  }) => (
    <Card
      className={`hover-elevate ${colorful ? "card-colorful" : ""} ${onClick ? "cursor-pointer" : ""}`}
      data-testid={testId}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleCustomReport(title);
            }}
            data-testid={`button-report-${testId}`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );

  // Calculate trend percentages (simulated - would normally compare to previous period)
  const getTrendIndicator = (isPositive: boolean, value: number) => {
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? "text-green-600" : "text-red-500";
    return (
      <span
        className={`flex items-center gap-0.5 text-xs font-medium ${color}`}
      >
        <Icon className="h-3 w-3" />
        {value.toFixed(1)}%
      </span>
    );
  };

  // Calculate stale quotes value (quotes older than 14 days without response)
  const staleQuotesCount = quoteAnalytics?.pendingQuotes || 0;
  const estimatedStaleValue =
    staleQuotesCount * (revenueStats?.averageJobValue || 0);

  // Show a subtle inline indicator when re-fetching after a date range change
  const isRefreshing = statsFetching || revenueFetching;

  return (
    <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
      {/* CEO Overview Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <LogoSidebarTrigger size={36} />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                Weekly CEO Overview
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleExportData("analytics")}
              disabled={isExporting}
              data-testid="button-export-metrics"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.reload()}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Time Period Tabs */}
          <div className="flex flex-wrap items-center gap-2 bg-gray-100 p-1 rounded-lg w-fit">
            <Button
              variant={dateRangePreset === "today" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRangePreset("today")}
              className={`h-8 px-4 ${dateRangePreset === "today" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid="button-date-today"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Today
            </Button>
            <Button
              variant={dateRangePreset === "7" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRangePreset("7")}
              className={`h-8 px-3 ${dateRangePreset === "7" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid="button-date-7"
            >
              This Week
            </Button>
            <Button
              variant={dateRangePreset === "mon-fri" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRangePreset("mon-fri")}
              className={`h-8 px-3 ${dateRangePreset === "mon-fri" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid="button-date-mon-fri"
            >
              Last Week
            </Button>
            <Button
              variant={dateRangePreset === "30" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRangePreset("30")}
              className={`h-8 px-3 ${dateRangePreset === "30" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid="button-date-30"
            >
              Last 4 Weeks
            </Button>
            <Button
              variant={dateRangePreset === "custom" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDateRangePreset("custom")}
              className={`h-8 px-3 ${dateRangePreset === "custom" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid="button-date-custom"
            >
              Custom Range
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {/* Active date range label */}
          {dateRange && (
            <div className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-1.5 -mt-1">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>
                {(() => {
                  const nzOpts = { timeZone: "Pacific/Auckland" } as const;
                  const fmt = (d: string, extra?: Intl.DateTimeFormatOptions) =>
                    new Date(d + "T00:00:00Z").toLocaleDateString("en-NZ", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      ...nzOpts,
                      ...extra,
                    });
                  return dateRange.from === dateRange.to
                    ? fmt(dateRange.from, { weekday: "short" })
                    : `${fmt(dateRange.from)} — ${fmt(dateRange.to)}`;
                })()}
              </span>
              {isRefreshing && (
                <div className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent flex-shrink-0" />
              )}
            </div>
          )}

          {dateRangePreset === "custom" && (
            <Card className="mb-4">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs font-medium mb-1 block text-gray-500">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9"
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs font-medium mb-1 block text-gray-500">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9"
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Business Health Section */}
          <Card data-testid="card-total-revenue">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base font-semibold">
                  Business Health
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const appRevenue = dashboardStats?.totalRevenue || 0;
                const xeroRevenue = xeroPL?.revenue || 0;
                // When Xero is connected and has data, use it as the base for financial estimates
                // so that Net Profit %, Labour, and Revenue all come from the same source.
                const financialBase =
                  xeroRevenue > 0 ? xeroRevenue : appRevenue;
                const hasXero = xeroRevenue > 0;

                const netProfit =
                  xeroPL?.netProfit !== undefined
                    ? xeroPL.netProfit
                    : financialBase * 0.15;
                // Use Xero's own calculated margin % when available; otherwise derive it
                const netProfitPct =
                  xeroPL?.grossMargin !== undefined && hasXero
                    ? xeroPL.grossMargin
                    : financialBase > 0
                      ? Math.round((netProfit / financialBase) * 100)
                      : 0;
                const labour = financialBase * 0.4;

                const jobsWonPct = quoteAnalytics?.totalQuotes
                  ? Math.round(
                      (quoteAnalytics.acceptedQuotes /
                        quoteAnalytics.totalQuotes) *
                        100,
                    )
                  : 0;

                const tiles: {
                  label: string;
                  value: string;
                  sub: string;
                  valueColor?: string;
                  drilldownKey?: "revenue" | "jobs" | "winrate" | "quotes";
                }[] = [
                  {
                    label: "Revenue (exc. GST)",
                    value: formatCurrency(appRevenue).replace("NZ$", "$"),
                    sub: `${revenueStats?.jobsWithInvoices || 0} invoiced jobs`,
                    drilldownKey: "revenue",
                  },
                  {
                    label: "Jobs Completed",
                    value: String(revenueStats?.jobsWithInvoices || 0),
                    sub: "Jobs with invoices",
                    drilldownKey: "jobs",
                  },
                  {
                    label: "Average Job Value",
                    value: formatCurrency(
                      revenueStats?.averageJobValue || 0,
                    ).replace("NZ$", "$"),
                    sub: "Per invoiced job",
                  },
                  {
                    label: "Quote Win Rate",
                    value: `${jobsWonPct}%`,
                    sub: `${quoteAnalytics?.acceptedQuotes || 0} of ${quoteAnalytics?.totalQuotes || 0} quoted`,
                    drilldownKey: "winrate",
                  },
                  {
                    label: `Net Profit${hasXero ? "" : " (est.)"}`,
                    value:
                      (netProfit < 0 ? "-" : "") +
                      formatCurrency(Math.abs(netProfit)).replace("NZ$", "$"),
                    sub: `${netProfitPct}% margin${hasXero ? " · Xero" : " (est.)"}`,
                    valueColor: netProfit >= 0 ? "" : "text-red-600",
                  },
                  {
                    label: "Labour (est.)",
                    value: formatCurrency(labour).replace("NZ$", "$"),
                    sub: `~40% of ${hasXero ? "Xero revenue" : "revenue"}`,
                  },
                  {
                    label: "Quotes Sent",
                    value: String(quoteAnalytics?.totalQuotes || 0),
                    sub: `${quoteAnalytics?.pendingQuotes || 0} still pending`,
                    drilldownKey: "quotes",
                  },
                  {
                    label: "New Leads",
                    value: String(dashboardStats?.totalLeads || 0),
                    sub: "In selected period",
                  },
                ];

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {tiles.map((tile) => {
                        const isClickable = !!tile.drilldownKey;
                        const isActive = activeDrilldown === tile.drilldownKey;
                        return (
                          <div
                            key={tile.label}
                            onClick={
                              isClickable
                                ? () => toggleDrilldown(tile.drilldownKey!)
                                : undefined
                            }
                            className={[
                              "border rounded-lg p-4 flex flex-col bg-white dark:bg-card",
                              isClickable
                                ? "cursor-pointer transition-colors"
                                : "dark:border-card-border border-gray-200",
                              isActive
                                ? "border-blue-400 bg-blue-50/40 dark:bg-blue-950/20"
                                : isClickable
                                  ? "border-gray-200 dark:border-card-border hover:border-blue-300 hover:bg-blue-50/20"
                                  : "",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-1.5 mb-4">
                              <span className="text-sm text-gray-600 dark:text-muted-foreground leading-tight">
                                {tile.label}
                              </span>
                              <Info className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            </div>
                            <div
                              className={`text-3xl font-bold text-gray-900 dark:text-foreground mb-1 ${tile.valueColor || ""}`}
                            >
                              {tile.value}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-muted-foreground mt-auto pt-2">
                              {tile.sub}
                            </div>
                            {isClickable && (
                              <div className="flex items-center gap-0.5 mt-1.5">
                                <span className="text-xs text-blue-500 dark:text-blue-400">
                                  View breakdown
                                </span>
                                {isActive ? (
                                  <ChevronUp className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Inline expansion panel */}
                    {activeDrilldown && (
                      <div className="mt-4 border border-gray-200 dark:border-card-border rounded-lg bg-white dark:bg-card overflow-hidden">
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-card-border bg-gray-50 dark:bg-muted/30">
                          <span className="text-sm font-semibold text-gray-700 dark:text-foreground">
                            {activeDrilldown === "revenue" &&
                              "Revenue Breakdown — Invoiced Jobs"}
                            {activeDrilldown === "jobs" && "Jobs Completed"}
                            {activeDrilldown === "winrate" &&
                              "Quote Win Rate Breakdown"}
                            {activeDrilldown === "quotes" && "All Quotes Sent"}
                          </span>
                          <button
                            onClick={() => setActiveDrilldown(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-foreground text-lg leading-none px-1"
                            aria-label="Close"
                          >
                            ×
                          </button>
                        </div>

                        {/* Revenue panel */}
                        {activeDrilldown === "revenue" && (
                          <div className="p-4">
                            {breakdownLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-100 dark:border-card-border text-left">
                                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground">
                                        Job Name
                                      </th>
                                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground">
                                        Client
                                      </th>
                                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground hidden sm:table-cell">
                                        Invoice Date
                                      </th>
                                      <th className="pb-2 font-medium text-gray-500 dark:text-muted-foreground text-right">
                                        Invoice Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(revenueBreakdown?.breakdown || []).map(
                                      (job) => (
                                        <tr
                                          key={job.jobId}
                                          className="border-b border-gray-50 dark:border-card-border/50 hover:bg-gray-50 dark:hover:bg-muted/20"
                                        >
                                          <td className="py-2 pr-4 font-medium">
                                            {job.title ||
                                              `Job #${job.jobNumber}`}
                                          </td>
                                          <td className="py-2 pr-4 text-gray-600 dark:text-muted-foreground">
                                            {job.customerName}
                                          </td>
                                          <td className="py-2 pr-4 text-gray-500 dark:text-muted-foreground hidden sm:table-cell">
                                            {job.invoiceDate
                                              ? new Date(
                                                  job.invoiceDate,
                                                ).toLocaleDateString("en-NZ")
                                              : "-"}
                                          </td>
                                          <td className="py-2 font-semibold text-green-600 text-right">
                                            {formatCurrency(
                                              job.amount ||
                                                job.invoiceAmount ||
                                                0,
                                            ).replace("NZ$", "$")}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                    {(!revenueBreakdown?.breakdown ||
                                      revenueBreakdown.breakdown.length ===
                                        0) && (
                                      <tr>
                                        <td
                                          colSpan={4}
                                          className="py-6 text-center text-muted-foreground"
                                        >
                                          No invoiced jobs in this period
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                  {revenueBreakdown &&
                                    revenueBreakdown.breakdown.length > 0 && (
                                      <tfoot>
                                        <tr className="border-t-2 border-gray-200 dark:border-card-border font-semibold">
                                          <td colSpan={3} className="pt-2 pr-4">
                                            Total (
                                            {revenueBreakdown.breakdown.length}{" "}
                                            jobs)
                                          </td>
                                          <td className="pt-2 text-right text-green-600">
                                            {formatCurrency(
                                              revenueBreakdown.total || 0,
                                            ).replace("NZ$", "$")}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    )}
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Jobs Completed panel */}
                        {activeDrilldown === "jobs" && (
                          <div className="p-4">
                            {breakdownLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-100 dark:border-card-border text-left">
                                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground">
                                        Job Name
                                      </th>
                                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground">
                                        Client
                                      </th>
                                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground hidden sm:table-cell">
                                        Invoice Date
                                      </th>
                                      <th className="pb-2 font-medium text-gray-500 dark:text-muted-foreground text-right">
                                        Invoice Value (ex GST)
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(revenueBreakdown?.breakdown || []).map(
                                      (job) => (
                                        <tr
                                          key={job.jobId}
                                          className="border-b border-gray-50 dark:border-card-border/50 hover:bg-gray-50 dark:hover:bg-muted/20"
                                        >
                                          <td className="py-2 pr-4 font-medium">
                                            {job.title ||
                                              `Job #${job.jobNumber}`}
                                          </td>
                                          <td className="py-2 pr-4 text-gray-600 dark:text-muted-foreground">
                                            {job.customerName}
                                          </td>
                                          <td className="py-2 pr-4 text-gray-500 dark:text-muted-foreground hidden sm:table-cell">
                                            {job.invoiceDate
                                              ? new Date(
                                                  job.invoiceDate,
                                                ).toLocaleDateString("en-NZ")
                                              : "-"}
                                          </td>
                                          <td className="py-2 font-semibold text-blue-600 text-right">
                                            {formatCurrency(
                                              job.amount ||
                                                job.invoiceAmount ||
                                                0,
                                            ).replace("NZ$", "$")}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                    {(!revenueBreakdown?.breakdown ||
                                      revenueBreakdown.breakdown.length ===
                                        0) && (
                                      <tr>
                                        <td
                                          colSpan={4}
                                          className="py-6 text-center text-muted-foreground"
                                        >
                                          No completed jobs in this period
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                  {revenueBreakdown &&
                                    revenueBreakdown.breakdown.length > 0 && (
                                      <tfoot>
                                        <tr className="border-t-2 border-gray-200 dark:border-card-border font-semibold">
                                          <td colSpan={3} className="pt-2 pr-4">
                                            Total (
                                            {revenueBreakdown.breakdown.length}{" "}
                                            jobs)
                                          </td>
                                          <td className="pt-2 text-right text-blue-600">
                                            {formatCurrency(
                                              revenueBreakdown.total || 0,
                                            ).replace("NZ$", "$")}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    )}
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quote Win Rate panel — Won vs Lost side by side */}
                        {activeDrilldown === "winrate" && (
                          <div className="p-4">
                            {quoteBreakdownLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Won column */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                                      Won (
                                      {quoteBreakdownData?.won?.length || 0})
                                    </span>
                                    <span className="ml-auto text-xs text-green-600 dark:text-green-500 font-medium">
                                      {formatCurrency(
                                        (quoteBreakdownData?.won || []).reduce(
                                          (s, q) => s + q.value,
                                          0,
                                        ),
                                      ).replace("NZ$", "$")}
                                    </span>
                                  </div>
                                  <div className="border border-green-100 dark:border-green-900 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-green-50 dark:bg-green-950/40">
                                        <tr>
                                          <th className="text-left py-2 px-3 font-medium text-green-700 dark:text-green-400">
                                            Quote
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-green-700 dark:text-green-400 hidden sm:table-cell">
                                            Client
                                          </th>
                                          <th className="text-right py-2 px-3 font-medium text-green-700 dark:text-green-400">
                                            Value
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(quoteBreakdownData?.won || []).map(
                                          (q) => (
                                            <tr
                                              key={q.jobId}
                                              className="border-t border-green-50 dark:border-green-900/40 hover:bg-green-50/50 dark:hover:bg-green-950/20"
                                            >
                                              <td className="py-2 px-3 font-medium text-gray-800 dark:text-foreground">
                                                {q.title !== "(No title)"
                                                  ? q.title
                                                  : `Job #${q.jobNumber}`}
                                              </td>
                                              <td className="py-2 px-3 text-gray-500 dark:text-muted-foreground hidden sm:table-cell">
                                                {q.customerName}
                                              </td>
                                              <td className="py-2 px-3 text-right text-green-600 font-semibold">
                                                {q.value > 0
                                                  ? formatCurrency(
                                                      q.value,
                                                    ).replace("NZ$", "$")
                                                  : "—"}
                                              </td>
                                            </tr>
                                          ),
                                        )}
                                        {(!quoteBreakdownData?.won ||
                                          quoteBreakdownData.won.length ===
                                            0) && (
                                          <tr>
                                            <td
                                              colSpan={3}
                                              className="py-4 text-center text-muted-foreground text-xs"
                                            >
                                              No won quotes
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                                {/* Lost column */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                      Lost (
                                      {quoteBreakdownData?.lost?.length || 0})
                                    </span>
                                    <span className="ml-auto text-xs text-red-500 dark:text-red-400 font-medium">
                                      {formatCurrency(
                                        (quoteBreakdownData?.lost || []).reduce(
                                          (s, q) => s + q.value,
                                          0,
                                        ),
                                      ).replace("NZ$", "$")}
                                    </span>
                                  </div>
                                  <div className="border border-red-100 dark:border-red-900 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-red-50 dark:bg-red-950/40">
                                        <tr>
                                          <th className="text-left py-2 px-3 font-medium text-red-600 dark:text-red-400">
                                            Quote
                                          </th>
                                          <th className="text-left py-2 px-3 font-medium text-red-600 dark:text-red-400 hidden sm:table-cell">
                                            Client
                                          </th>
                                          <th className="text-right py-2 px-3 font-medium text-red-600 dark:text-red-400">
                                            Value
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(quoteBreakdownData?.lost || []).map(
                                          (q) => (
                                            <tr
                                              key={q.jobId}
                                              className="border-t border-red-50 dark:border-red-900/40 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                                            >
                                              <td className="py-2 px-3 font-medium text-gray-800 dark:text-foreground">
                                                {q.title !== "(No title)"
                                                  ? q.title
                                                  : `Job #${q.jobNumber}`}
                                              </td>
                                              <td className="py-2 px-3 text-gray-500 dark:text-muted-foreground hidden sm:table-cell">
                                                {q.customerName}
                                              </td>
                                              <td className="py-2 px-3 text-right text-red-500 font-semibold">
                                                {q.value > 0
                                                  ? formatCurrency(
                                                      q.value,
                                                    ).replace("NZ$", "$")
                                                  : "—"}
                                              </td>
                                            </tr>
                                          ),
                                        )}
                                        {(!quoteBreakdownData?.lost ||
                                          quoteBreakdownData.lost.length ===
                                            0) && (
                                          <tr>
                                            <td
                                              colSpan={3}
                                              className="py-4 text-center text-muted-foreground text-xs"
                                            >
                                              No lost quotes
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quotes Sent panel — all quotes with status */}
                        {activeDrilldown === "quotes" && (
                          <div className="p-4">
                            {quoteBreakdownLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : (
                              (() => {
                                const allQuotes = [
                                  ...(quoteBreakdownData?.won || []),
                                  ...(quoteBreakdownData?.lost || []),
                                  ...(quoteBreakdownData?.pending || []),
                                ].sort(
                                  (a, b) =>
                                    new Date(b.quoteSentDate || 0).getTime() -
                                    new Date(a.quoteSentDate || 0).getTime(),
                                );
                                return (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-100 dark:border-card-border text-left">
                                          <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground">
                                            Quote Name
                                          </th>
                                          <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground hidden sm:table-cell">
                                            Client
                                          </th>
                                          <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground hidden md:table-cell">
                                            Date Sent
                                          </th>
                                          <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-muted-foreground text-right">
                                            Value
                                          </th>
                                          <th className="pb-2 font-medium text-gray-500 dark:text-muted-foreground text-center">
                                            Status
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {allQuotes.map((q) => (
                                          <tr
                                            key={q.jobId}
                                            className={[
                                              "border-b",
                                              q.outcome === "won"
                                                ? "bg-green-50/40 dark:bg-green-950/10 border-green-50 dark:border-green-900/30"
                                                : q.outcome === "lost"
                                                  ? "bg-red-50/30 dark:bg-red-950/10 border-red-50 dark:border-red-900/30 text-gray-400 dark:text-muted-foreground/60"
                                                  : "bg-amber-50/40 dark:bg-amber-950/10 border-amber-50 dark:border-amber-900/30",
                                            ].join(" ")}
                                          >
                                            <td className="py-2 pr-4 font-medium">
                                              {q.title !== "(No title)"
                                                ? q.title
                                                : `Job #${q.jobNumber}`}
                                            </td>
                                            <td className="py-2 pr-4 hidden sm:table-cell">
                                              {q.customerName}
                                            </td>
                                            <td className="py-2 pr-4 hidden md:table-cell">
                                              {q.quoteSentDate
                                                ? new Date(
                                                    q.quoteSentDate,
                                                  ).toLocaleDateString("en-NZ")
                                                : "-"}
                                            </td>
                                            <td className="py-2 pr-4 text-right font-semibold">
                                              {q.value > 0
                                                ? formatCurrency(
                                                    q.value,
                                                  ).replace("NZ$", "$")
                                                : "—"}
                                            </td>
                                            <td className="py-2 text-center">
                                              {q.outcome === "won" && (
                                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                                  Won
                                                </span>
                                              )}
                                              {q.outcome === "lost" && (
                                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                                                  Lost
                                                </span>
                                              )}
                                              {q.outcome === "pending" && (
                                                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                                  Pending
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                        {allQuotes.length === 0 && (
                                          <tr>
                                            <td
                                              colSpan={5}
                                              className="py-6 text-center text-muted-foreground"
                                            >
                                              No quotes sent in this period
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                      {allQuotes.length > 0 && (
                                        <tfoot>
                                          <tr className="border-t-2 border-gray-200 dark:border-card-border font-semibold text-sm">
                                            <td
                                              colSpan={3}
                                              className="pt-2 pr-4"
                                            >
                                              Total ({allQuotes.length} quotes)
                                            </td>
                                            <td className="pt-2 pr-4 text-right">
                                              {formatCurrency(
                                                allQuotes.reduce(
                                                  (s, q) => s + q.value,
                                                  0,
                                                ),
                                              ).replace("NZ$", "$")}
                                            </td>
                                            <td />
                                          </tr>
                                        </tfoot>
                                      )}
                                    </table>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Booked Workload — forward-looking */}
          <Card data-testid="card-booked-workload">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-base font-semibold">
                    Booked Workload
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                    {(
                      ["this_week", "next_week", "week_after", "next_month"] as BookedPeriod[]
                    ).map((p) => (
                      <Button
                        key={p}
                        variant={bookedPeriod === p ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setBookedPeriod(p)}
                        className={`h-7 px-3 text-xs ${
                          bookedPeriod === p
                            ? "bg-blue-600 hover:bg-blue-700"
                            : ""
                        }`}
                        data-testid={`button-booked-period-${p}`}
                      >
                        {bookedPeriodLabels[p]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Jobs scheduled {bookedPeriodLabels[bookedPeriod].toLowerCase()}
                {bookedWorkload?.from && bookedWorkload?.to
                  ? ` (${bookedWorkload.from} – ${bookedWorkload.to})`
                  : ""}{" "}
                — Mon to Sun, NZ time. Includes scheduled, work order, in
                progress, completed and invoiced jobs.
              </p>
            </CardHeader>
            <CardContent>
              {bookedWorkloadLoading && !bookedWorkload ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setBookedJobsDialogOpen(true)}
                    disabled={(bookedWorkload?.jobCount ?? 0) === 0}
                    className="bg-card border border-border rounded-lg p-3 text-left hover-elevate disabled:opacity-60 disabled:cursor-default"
                    data-testid="booked-workload-jobs"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      Jobs Booked
                    </div>
                    <div className="text-2xl font-bold">
                      {bookedWorkload?.jobCount ?? 0}
                    </div>
                    {(bookedWorkload?.jobCount ?? 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Click to view list
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookedJobsDialogOpen(true)}
                    disabled={(bookedWorkload?.jobCount ?? 0) === 0}
                    className="bg-card border border-border rounded-lg p-3 text-left hover-elevate disabled:opacity-60 disabled:cursor-default"
                    data-testid="booked-workload-value"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Booked Value
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(bookedWorkload?.totalValue ?? 0)}
                    </div>
                    {(bookedWorkload?.unpricedJobCount ?? 0) > 0 && (
                      <p
                        className="text-[10px] text-amber-600 mt-0.5"
                        data-testid="booked-workload-unpriced"
                      >
                        {bookedWorkload?.unpricedJobCount} unpriced job
                        {bookedWorkload?.unpricedJobCount === 1 ? "" : "s"} not
                        included
                      </p>
                    )}
                    {(bookedWorkload?.jobCount ?? 0) > 0 &&
                      (bookedWorkload?.unpricedJobCount ?? 0) === 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Click to view list
                        </p>
                      )}
                  </button>
                  <div
                    className="bg-card border border-border rounded-lg p-3"
                    data-testid="booked-workload-hours"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      Estimated Hours
                    </div>
                    <div className="text-2xl font-bold">
                      {(bookedWorkload?.totalHours ?? 0).toFixed(1)}
                    </div>
                  </div>
                  <div
                    className="bg-card border border-border rounded-lg p-3"
                    data-testid="booked-workload-crew-days"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Crew-Days of Work
                    </div>
                    <div className="text-2xl font-bold">
                      {(bookedWorkload?.crewDays ?? 0).toFixed(1)}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      at 8h/day · {bookedWorkload?.activeCrewCount ?? 0} crew
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booked Workload — job-list dialog */}
          <Dialog
            open={bookedJobsDialogOpen}
            onOpenChange={setBookedJobsDialogOpen}
          >
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Booked Jobs · {bookedPeriodLabels[bookedPeriod]}
                </DialogTitle>
                <DialogDescription>
                  {bookedWorkload?.jobCount ?? 0} job
                  {(bookedWorkload?.jobCount ?? 0) === 1 ? "" : "s"} ·{" "}
                  {formatCurrency(bookedWorkload?.totalValue ?? 0)} ex-GST
                  {bookedWorkload?.from && bookedWorkload?.to
                    ? ` · ${bookedWorkload.from} – ${bookedWorkload.to}`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {(bookedWorkload?.jobs ?? []).map((j: any) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => {
                      setSelectedBookedJobId(j.id);
                      setBookedJobsDialogOpen(false);
                    }}
                    className="bg-card border border-border rounded-lg p-3 text-left hover-elevate"
                    data-testid={`booked-job-${j.jobNumber}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>#{j.jobNumber}</span>
                          <span className="text-muted-foreground truncate">
                            {j.customerName ?? "(no customer)"}
                          </span>
                        </div>
                        {j.title && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {j.title}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {j.scheduledDate
                            ? formatNZTime(j.scheduledDate, "datetime")
                            : "—"}
                          {j.estimatedManHours
                            ? ` · ${j.estimatedManHours}h est.`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm font-semibold ${
                            j.value > 0 ? "text-green-600" : "text-amber-600"
                          }`}
                        >
                          {j.value > 0 ? formatCurrency(j.value) : "Unpriced"}
                        </div>
                        {j.valueSource && j.valueSource !== "job" && (
                          <p className="text-[10px] text-muted-foreground">
                            from {j.valueSource}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {selectedBookedJobId && (
            <GlobalJobCard
              isOpen={!!selectedBookedJobId}
              onClose={() => setSelectedBookedJobId(null)}
              mode="edit"
              jobId={selectedBookedJobId}
            />
          )}

          {/* Xero Profit & Loss Section */}
          <div className="mb-6">
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Xero Profit & Loss
                  </CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Real-time financial data from your Xero account
                </p>
              </CardHeader>
              <CardContent>
                {xeroPLLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : xeroPLError ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <p className="text-yellow-800 font-medium">
                      Xero connection required
                    </p>
                    <p className="text-sm text-yellow-600 mt-1">
                      Connect to Xero in Settings → Integrations to see your P&L
                      data
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                      <p className="text-sm text-muted-foreground mb-1">
                        Revenue
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(xeroPL?.revenue || 0)}
                      </p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-4 border border-red-200">
                      <p className="text-sm text-muted-foreground mb-1">
                        Expenses
                      </p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(xeroPL?.expenses || 0)}
                      </p>
                    </div>
                    <div
                      className={`bg-white/60 rounded-lg p-4 border ${(xeroPL?.netProfit || 0) >= 0 ? "border-green-300" : "border-red-300"}`}
                    >
                      <p className="text-sm text-muted-foreground mb-1">
                        Net Profit
                      </p>
                      <p
                        className={`text-2xl font-bold ${(xeroPL?.netProfit || 0) >= 0 ? "text-green-700" : "text-red-700"}`}
                      >
                        {formatCurrency(xeroPL?.netProfit || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {xeroPL?.grossMargin || 0}% margin
                      </p>
                    </div>
                  </div>
                )}

                {/* Expense Breakdown */}
                {xeroPL && xeroPL.sections && xeroPL.sections.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">
                      Breakdown by Category
                    </p>
                    <div className="space-y-2">
                      {xeroPL.sections.map((section, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-muted-foreground">
                            {section.name}
                          </span>
                          <span
                            className={
                              section.type === "revenue"
                                ? "text-green-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {section.type === "revenue" ? "+" : "-"}
                            {formatCurrency(section.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Job Estimation Accuracy Section */}
          {!manHoursLoading &&
            manHoursMetrics &&
            manHoursMetrics.jobsWithEstimates > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Job Estimation Accuracy
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setManHoursCollapsed(!manHoursCollapsed)}
                    data-testid="button-toggle-man-hours"
                  >
                    {manHoursCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${manHoursCollapsed ? "hidden md:grid" : ""}`}
                >
                  <MetricCard
                    title="Overall Accuracy"
                    value={`${manHoursMetrics.averageAccuracy.toFixed(1)}%`}
                    subtitle={`${manHoursMetrics.jobsWithEstimates} jobs analyzed`}
                    icon={Target}
                    testId="card-estimation-accuracy"
                    colorful={true}
                    valueColor={
                      manHoursMetrics.averageAccuracy >= 90
                        ? "text-green-600"
                        : manHoursMetrics.averageAccuracy >= 75
                          ? "text-blue-600"
                          : "text-orange-600"
                    }
                  />

                  <MetricCard
                    title="Excellent Accuracy"
                    value={manHoursMetrics.accuracyDistribution.excellent}
                    subtitle="≥ 90% accurate jobs"
                    icon={CheckCircle}
                    testId="card-excellent-accuracy"
                    valueColor="text-green-600"
                  />

                  <MetricCard
                    title="Total Estimated Hours"
                    value={manHoursMetrics.totalEstimatedHours.toFixed(1)}
                    subtitle={`${manHoursMetrics.totalActualHours.toFixed(1)} actual hours`}
                    icon={Clock}
                    testId="card-estimated-hours"
                  />

                  <MetricCard
                    title="Estimation Trend"
                    value={
                      manHoursMetrics.overestimatedJobs >
                      manHoursMetrics.underestimatedJobs
                        ? "Over-estimating"
                        : "Under-estimating"
                    }
                    subtitle={`${Math.max(manHoursMetrics.overestimatedJobs, manHoursMetrics.underestimatedJobs)} jobs`}
                    icon={TrendingUp}
                    testId="card-estimation-trend"
                    valueColor={
                      manHoursMetrics.overestimatedJobs >
                      manHoursMetrics.underestimatedJobs
                        ? "text-blue-600"
                        : "text-orange-600"
                    }
                  />
                </div>

                {/* Detailed breakdown */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Accuracy Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {manHoursMetrics.accuracyDistribution.excellent}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Excellent (≥90%)
                        </div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {manHoursMetrics.accuracyDistribution.good}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Good (75-89%)
                        </div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">
                          {manHoursMetrics.accuracyDistribution.fair}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Fair (60-74%)
                        </div>
                      </div>
                      <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {manHoursMetrics.accuracyDistribution.poor}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Poor (&lt;60%)
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          Total Jobs Completed:
                        </span>
                        <span className="font-semibold">
                          {manHoursMetrics.totalJobs}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          Jobs with Estimates:
                        </span>
                        <span className="font-semibold">
                          {manHoursMetrics.jobsWithEstimates}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          Over-estimated Jobs:
                        </span>
                        <span className="font-semibold text-blue-600">
                          {manHoursMetrics.overestimatedJobs}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          Under-estimated Jobs:
                        </span>
                        <span className="font-semibold text-orange-600">
                          {manHoursMetrics.underestimatedJobs}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          {/* Lead Source Analytics Section */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    Lead Source Performance
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportData("lead-sources")}
                    disabled={isExporting}
                    data-testid="button-export-lead-sources"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export CSV"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pr-16">
                {leadSourceLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Loading lead source data...
                    </p>
                  </div>
                ) : leadSourceData && leadSourceData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">
                            Lead Source
                          </th>
                          <th className="text-right py-3 px-4 font-medium">
                            Quoted
                          </th>
                          <th className="text-right py-3 px-4 font-medium">
                            Quoted Value
                          </th>
                          <th className="text-right py-3 px-4 font-medium">
                            Won
                          </th>
                          <th className="text-right py-3 px-4 font-medium">
                            Quote Conv.
                          </th>
                          <th className="text-right py-3 px-4 font-medium">
                            Invoiced Revenue
                          </th>
                          <th className="text-right py-3 px-4 font-medium">
                            Revenue %
                          </th>
                          <th className="text-right py-3 px-4 font-medium">
                            Gross Margin
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadSourceData.map((source) => (
                          <tr
                            key={source.source}
                            className="border-b hover-elevate"
                            data-testid={`row-lead-source-${source.source}`}
                          >
                            <td className="py-3 px-4 font-medium">
                              {formatLeadSource(source.source)}
                            </td>
                            <td className="text-right py-3 px-4">
                              {source.quotedCount}
                            </td>
                            <td className="text-right py-3 px-4 text-orange-600">
                              {formatCurrency(source.totalQuotedValue || 0)}
                            </td>
                            <td className="text-right py-3 px-4">
                              {source.wonCount}
                            </td>
                            <td className="text-right py-3 px-4">
                              <span
                                className={
                                  source.quoteConversionRate > 70
                                    ? "text-green-600 font-semibold"
                                    : source.quoteConversionRate > 40
                                      ? "text-yellow-600"
                                      : "text-gray-600"
                                }
                              >
                                {source.quoteConversionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="text-right py-3 px-4 font-semibold text-green-600">
                              {formatCurrency(source.totalRevenue)}
                            </td>
                            <td className="text-right py-3 px-4">
                              {(() => {
                                const totalRev = leadSourceData.reduce(
                                  (sum, s) => sum + s.totalRevenue,
                                  0,
                                );
                                const revPercent =
                                  totalRev > 0
                                    ? (source.totalRevenue / totalRev) * 100
                                    : 0;
                                return (
                                  <span
                                    className={
                                      revPercent > 30
                                        ? "text-blue-600 font-semibold"
                                        : revPercent > 15
                                          ? "text-blue-500"
                                          : "text-gray-600"
                                    }
                                  >
                                    {revPercent.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="text-right py-3 px-4">
                              {source.averageProfitMargin !== 0 &&
                              isFinite(source.averageProfitMargin) ? (
                                <span
                                  className={
                                    source.averageProfitMargin > 40
                                      ? "text-green-600 font-semibold"
                                      : source.averageProfitMargin > 20
                                        ? "text-yellow-600"
                                        : source.averageProfitMargin > 0
                                          ? "text-orange-600"
                                          : "text-red-600 font-semibold"
                                  }
                                >
                                  {source.averageProfitMargin.toFixed(1)}%
                                </span>
                              ) : source.wonCount > 0 ? (
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-muted-foreground cursor-help border-b border-dashed border-muted-foreground">
                                      —
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p className="text-xs max-w-[200px]">
                                      Enter costs in the Gross Margin section of
                                      each job card to see margin data.
                                    </p>
                                  </TooltipContent>
                                </UITooltip>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-bold bg-muted/50">
                          <td className="py-3 px-4">TOTAL</td>
                          <td className="text-right py-3 px-4">
                            {leadSourceData.reduce(
                              (sum, s) => sum + s.quotedCount,
                              0,
                            )}
                          </td>
                          <td className="text-right py-3 px-4 text-orange-600">
                            {formatCurrency(
                              leadSourceData.reduce(
                                (sum, s) => sum + (s.totalQuotedValue || 0),
                                0,
                              ),
                            )}
                          </td>
                          <td className="text-right py-3 px-4">
                            {leadSourceData.reduce(
                              (sum, s) => sum + s.wonCount,
                              0,
                            )}
                          </td>
                          <td className="text-right py-3 px-4">
                            {(
                              (leadSourceData.reduce(
                                (sum, s) => sum + s.wonCount,
                                0,
                              ) /
                                Math.max(
                                  leadSourceData.reduce(
                                    (sum, s) => sum + s.quotedCount,
                                    0,
                                  ),
                                  1,
                                )) *
                              100
                            ).toFixed(1)}
                            %
                          </td>
                          <td className="text-right py-3 px-4 text-green-600">
                            {formatCurrency(
                              leadSourceData.reduce(
                                (sum, s) => sum + s.totalRevenue,
                                0,
                              ),
                            )}
                          </td>
                          <td className="text-right py-3 px-4 text-blue-600">
                            100.0%
                          </td>
                          <td className="text-right py-3 px-4">
                            {(() => {
                              const hasAnyMargin = leadSourceData.some(
                                (s) => s.averageProfitMargin > 0,
                              );
                              if (!hasAnyMargin) {
                                return (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                );
                              }
                              const totalRev = leadSourceData.reduce(
                                (sum, s) => sum + s.totalRevenue,
                                0,
                              );
                              const totalProfit = leadSourceData.reduce(
                                (sum, s) => sum + (s.totalProfit || 0),
                                0,
                              );
                              const overallMargin =
                                totalRev > 0
                                  ? (totalProfit / totalRev) * 100
                                  : 0;
                              return (
                                <span
                                  className={
                                    overallMargin > 40
                                      ? "text-green-600"
                                      : overallMargin > 20
                                        ? "text-yellow-600"
                                        : "text-orange-600"
                                  }
                                >
                                  {overallMargin.toFixed(1)}%
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No lead source data available for the selected period
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quote Presentation Method Conversion Section */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-500" />
                    Quote Presentation Conversion
                  </CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Compare conversion rates between on-site quotes vs quotes sent
                  later
                </p>
              </CardHeader>
              <CardContent>
                {quotePresentationLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Loading quote presentation data...
                    </p>
                  </div>
                ) : quotePresentationData &&
                  quotePresentationData.length > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {quotePresentationData.map((method) => (
                        <div
                          key={method.method}
                          className="bg-muted/30 rounded-lg p-4 border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">
                              {method.label}
                            </h4>
                            <span
                              className={`text-lg font-bold ${
                                method.conversionRate >= 50
                                  ? "text-green-600"
                                  : method.conversionRate >= 30
                                    ? "text-yellow-600"
                                    : "text-orange-600"
                              }`}
                            >
                              {method.conversionRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">
                                Total Quotes
                              </p>
                              <p className="font-semibold">
                                {method.totalQuotes}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Accepted</p>
                              <p className="font-semibold text-green-600">
                                {method.acceptedQuotes}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Pending</p>
                              <p className="font-semibold text-blue-600">
                                {method.pendingQuotes}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Rejected</p>
                              <p className="font-semibold text-red-600">
                                {method.rejectedQuotes}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Avg Value
                              </span>
                              <span className="font-semibold">
                                {formatCurrency(method.averageValue)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Accepted Value
                              </span>
                              <span className="font-semibold text-green-600">
                                {formatCurrency(method.acceptedValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Comparison Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium">
                              Presentation Method
                            </th>
                            <th className="text-right py-3 px-4 font-medium">
                              Total
                            </th>
                            <th className="text-right py-3 px-4 font-medium">
                              Accepted
                            </th>
                            <th className="text-right py-3 px-4 font-medium">
                              Conversion
                            </th>
                            <th className="text-right py-3 px-4 font-medium">
                              Total Value
                            </th>
                            <th className="text-right py-3 px-4 font-medium">
                              Accepted Value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotePresentationData.map((method) => (
                            <tr
                              key={method.method}
                              className="border-b hover-elevate"
                            >
                              <td className="py-3 px-4 font-medium">
                                {method.label}
                              </td>
                              <td className="text-right py-3 px-4">
                                {method.totalQuotes}
                              </td>
                              <td className="text-right py-3 px-4 text-green-600">
                                {method.acceptedQuotes}
                              </td>
                              <td className="text-right py-3 px-4">
                                <span
                                  className={`font-semibold ${
                                    method.conversionRate >= 50
                                      ? "text-green-600"
                                      : method.conversionRate >= 30
                                        ? "text-yellow-600"
                                        : "text-orange-600"
                                  }`}
                                >
                                  {method.conversionRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-right py-3 px-4">
                                {formatCurrency(method.totalValue)}
                              </td>
                              <td className="text-right py-3 px-4 text-green-600">
                                {formatCurrency(method.acceptedValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-bold bg-muted/50">
                            <td className="py-3 px-4">TOTAL</td>
                            <td className="text-right py-3 px-4">
                              {quotePresentationData.reduce(
                                (sum, m) => sum + m.totalQuotes,
                                0,
                              )}
                            </td>
                            <td className="text-right py-3 px-4 text-green-600">
                              {quotePresentationData.reduce(
                                (sum, m) => sum + m.acceptedQuotes,
                                0,
                              )}
                            </td>
                            <td className="text-right py-3 px-4">
                              {(() => {
                                const total = quotePresentationData.reduce(
                                  (sum, m) => sum + m.totalQuotes,
                                  0,
                                );
                                const accepted = quotePresentationData.reduce(
                                  (sum, m) => sum + m.acceptedQuotes,
                                  0,
                                );
                                return total > 0
                                  ? ((accepted / total) * 100).toFixed(1) + "%"
                                  : "0%";
                              })()}
                            </td>
                            <td className="text-right py-3 px-4">
                              {formatCurrency(
                                quotePresentationData.reduce(
                                  (sum, m) => sum + m.totalValue,
                                  0,
                                ),
                              )}
                            </td>
                            <td className="text-right py-3 px-4 text-green-600">
                              {formatCurrency(
                                quotePresentationData.reduce(
                                  (sum, m) => sum + m.acceptedValue,
                                  0,
                                ),
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No quote presentation data available
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Set the presentation method when creating quotes to start
                      tracking conversion rates
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Checklist Usage Section — how often each per-role item gets ticked on completed jobs */}
          <div className="mt-8">
            <Card data-testid="card-checklist-usage">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Checklist Usage
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  How often each role's checklist items get ticked on completed jobs in this date range.
                </p>
              </CardHeader>
              <CardContent>
                {checklistUsageLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading checklist usage…</p>
                  </div>
                ) : !checklistUsage || checklistUsage.totalJobs === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No completed jobs in this date range yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-muted/30 rounded-lg p-4 border">
                        <p className="text-xs text-muted-foreground">Completed jobs</p>
                        <p className="text-2xl font-bold text-foreground" data-testid="checklist-usage-total-jobs">
                          {checklistUsage.totalJobs}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-4 border">
                        <p className="text-xs text-muted-foreground">Overall completion</p>
                        <p className="text-2xl font-bold text-foreground" data-testid="checklist-usage-overall">
                          {checklistUsage.overall}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">avg across all items</p>
                      </div>
                    </div>

                    {/* Per-role breakdown */}
                    {(["C", "A", "B"] as const).map((roleKey) => {
                      const roleLabel =
                        roleKey === "C" ? "Kaitiaki" : roleKey === "A" ? "Kaiwhangai" : "Kaitirotiro";
                      const roleItems = checklistUsage.items.filter((i) => i.role === roleKey);
                      if (roleItems.length === 0) return null;
                      return (
                        <div key={roleKey} data-testid={`checklist-usage-role-${roleKey}`}>
                          <h4 className="text-sm font-semibold text-foreground mb-2">{roleLabel}</h4>
                          <div className="space-y-2">
                            {roleItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3"
                                data-testid={`checklist-usage-item-${item.id}`}
                              >
                                <div className="w-48 shrink-0 text-sm text-foreground truncate">
                                  {item.label}
                                </div>
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 transition-all"
                                    style={{ width: `${item.percent}%` }}
                                  />
                                </div>
                                <div className="w-24 shrink-0 text-right text-sm font-semibold text-foreground tabular-nums">
                                  {item.percent}%
                                </div>
                                <div className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                  {item.completedCount}/{checklistUsage.totalJobs}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Unsuccessful Jobs Analysis Section */}
          <div className="col-span-full">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  Unsuccessful Jobs Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unsuccessfulJobsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground ml-2">
                      Loading unsuccessful jobs data...
                    </p>
                  </div>
                ) : unsuccessfulJobsData &&
                  unsuccessfulJobsData.totalUnsuccessful > 0 ? (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <p className="text-sm text-orange-700">
                          Total Unsuccessful
                        </p>
                        <p className="text-2xl font-bold text-orange-600">
                          {unsuccessfulJobsData.totalUnsuccessful}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <p className="text-sm text-red-700">
                          Potential Revenue Lost
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(
                            unsuccessfulJobsData.totalPotentialRevenueLost,
                          )}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm text-blue-700">Top Reason</p>
                        <p className="text-lg font-bold text-blue-600">
                          {unsuccessfulJobsData.byReason[0]?.label || "N/A"}
                        </p>
                        <p className="text-sm text-blue-500">
                          {unsuccessfulJobsData.byReason[0]?.percentage || 0}%
                          of cases
                        </p>
                      </div>
                    </div>

                    {/* Reasons Breakdown with Pie Chart */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Pie Chart */}
                      <div>
                        <h4 className="font-medium mb-3">
                          Reasons Distribution
                        </h4>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={unsuccessfulJobsData.byReason.map(
                                (item, index) => ({
                                  name: item.label,
                                  value: item.count,
                                  color: [
                                    "#f97316",
                                    "#ef4444",
                                    "#f59e0b",
                                    "#eab308",
                                    "#84cc16",
                                    "#22c55e",
                                    "#14b8a6",
                                    "#6366f1",
                                  ][index % 8],
                                }),
                              )}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) =>
                                percent > 0.05
                                  ? `${(percent * 100).toFixed(0)}%`
                                  : ""
                              }
                              outerRadius={80}
                              fill="#f97316"
                              dataKey="value"
                            >
                              {unsuccessfulJobsData.byReason.map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    [
                                      "#f97316",
                                      "#ef4444",
                                      "#f59e0b",
                                      "#eab308",
                                      "#84cc16",
                                      "#22c55e",
                                      "#14b8a6",
                                      "#6366f1",
                                    ][index % 8]
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [
                                `${value} jobs`,
                                "Count",
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-2 mt-2 justify-center">
                          {unsuccessfulJobsData.byReason
                            .slice(0, 6)
                            .map((item, index) => (
                              <div
                                key={item.reason}
                                className="flex items-center gap-1 text-xs"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor: [
                                      "#f97316",
                                      "#ef4444",
                                      "#f59e0b",
                                      "#eab308",
                                      "#84cc16",
                                      "#22c55e",
                                      "#14b8a6",
                                      "#6366f1",
                                    ][index % 8],
                                  }}
                                />
                                <span>{item.label}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Detailed Breakdown */}
                      <div>
                        <h4 className="font-medium mb-3">Detailed Breakdown</h4>
                        <div className="space-y-3">
                          {unsuccessfulJobsData.byReason.map((item) => (
                            <div
                              key={item.reason}
                              className="flex items-center gap-3"
                            >
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm font-medium">
                                    {item.label}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {item.count} jobs ({item.percentage}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                              </div>
                              <div className="text-right min-w-[80px]">
                                <span className="text-xs text-red-600">
                                  {formatCurrency(item.potentialRevenueLost)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Monthly Trends */}
                    <div>
                      <h4 className="font-medium mb-3">
                        Monthly Trends (Last 6 Months)
                      </h4>
                      <div className="grid grid-cols-6 gap-2">
                        {unsuccessfulJobsData.monthlyTrends.map((month) => (
                          <div key={month.month} className="text-center">
                            <div className="bg-muted/30 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">
                                {month.month}
                              </p>
                              <p className="text-lg font-bold text-orange-600">
                                {month.count}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(month.value)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Unsuccessful Jobs */}
                    {unsuccessfulJobsData.recentUnsuccessful.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">
                          Recent Unsuccessful Jobs (Last 30 Days)
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3">Job #</th>
                                <th className="text-left py-2 px-3">Title</th>
                                <th className="text-left py-2 px-3">Reason</th>
                                <th className="text-right py-2 px-3">Value</th>
                                <th className="text-left py-2 px-3">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unsuccessfulJobsData.recentUnsuccessful
                                .slice(0, 5)
                                .map((job) => (
                                  <tr
                                    key={job.id}
                                    className="border-b hover:bg-muted/20"
                                  >
                                    <td className="py-2 px-3 font-medium">
                                      {job.jobNumber}
                                    </td>
                                    <td className="py-2 px-3">
                                      {job.title || "Untitled"}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                                        {job.reasonLabel}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-red-600">
                                      {formatCurrency(job.potentialValue)}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground text-xs max-w-[200px] truncate">
                                      {job.notes || "-"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Insights */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-medium text-amber-800 mb-2">
                        Insights
                      </h4>
                      <ul className="text-sm text-amber-700 space-y-1">
                        {unsuccessfulJobsData.byReason[0]?.reason ===
                          "price_too_high" && (
                          <li>
                            Price is the top reason for lost jobs - consider
                            reviewing your pricing strategy or improving value
                            communication.
                          </li>
                        )}
                        {unsuccessfulJobsData.byReason[0]?.reason ===
                          "went_competitor" && (
                          <li>
                            Customers are going to competitors - analyze what
                            differentiates you and improve competitive
                            positioning.
                          </li>
                        )}
                        {unsuccessfulJobsData.byReason[0]?.reason ===
                          "no_response" && (
                          <li>
                            Many customers aren't responding - consider
                            follow-up improvements or faster quote turnaround.
                          </li>
                        )}
                        {unsuccessfulJobsData.byReason[0]?.reason ===
                          "scheduling" && (
                          <li>
                            Scheduling is a barrier - consider expanding
                            availability or offering more flexible booking
                            options.
                          </li>
                        )}
                        <li>
                          Total potential revenue lost:{" "}
                          {formatCurrency(
                            unsuccessfulJobsData.totalPotentialRevenueLost,
                          )}{" "}
                          - focus on converting the top reasons to recover some
                          of this.
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No unsuccessful jobs recorded yet.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      When jobs are marked as unsuccessful, their reasons will
                      appear here for analysis.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue Goal Calculator */}
          <div>
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base font-semibold">Revenue Goal Calculator</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={calcPeriod === "weekly" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handlePeriodChange("weekly")}
                      className="h-7 px-3 text-xs"
                    >
                      Weekly
                    </Button>
                    <Button
                      variant={calcPeriod === "monthly" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handlePeriodChange("monthly")}
                      className="h-7 px-3 text-xs"
                    >
                      Monthly
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Change any field — the others update automatically.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Primary inputs row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Revenue Target */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Revenue Target
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={calcRevenueTarget}
                        onChange={(e) => handleRevenueChange(Number(e.target.value) || 0)}
                        className="pl-7 text-base font-semibold"
                        min={0}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{calcPeriod === "weekly" ? "per week" : "per month"}</p>
                  </div>

                  {/* Avg Job Value */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Avg Job Value
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={calcAvgJobValue}
                        onChange={(e) => handleAvgJobChange(Number(e.target.value) || 0)}
                        className="pl-7 text-base font-semibold"
                        min={0}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">exc. GST per job</p>
                  </div>

                  {/* Conversion Rate */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Quote Win Rate
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={calcConversionRate}
                        onChange={(e) => handleConversionChange(Number(e.target.value) || 0)}
                        className="pr-7 text-base font-semibold"
                        min={0}
                        max={100}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">quotes that become jobs</p>
                  </div>
                </div>

                {/* Divider with arrow */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                  <span className="text-xs text-muted-foreground font-medium">you need</span>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>

                {/* Derived outputs row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Jobs Needed */}
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-1">
                    <label className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                      Jobs to Complete
                    </label>
                    <div className="flex items-baseline gap-1">
                      <Input
                        type="number"
                        value={calcJobsNeeded}
                        onChange={(e) => handleJobsChange(Number(e.target.value) || 0)}
                        className="text-2xl font-bold text-blue-700 dark:text-blue-300 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 w-full"
                        min={0}
                      />
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      = {formatCurrency(calcRevenueTarget)} ÷ {formatCurrency(calcAvgJobValue)}
                    </p>
                  </div>

                  {/* Quotes Needed */}
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 space-y-1">
                    <label className="text-xs font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                      Quotes to Send
                    </label>
                    <div className="flex items-baseline gap-1">
                      <Input
                        type="number"
                        value={calcQuotesNeeded}
                        onChange={(e) => handleQuotesChange(Number(e.target.value) || 0)}
                        className="text-2xl font-bold text-orange-700 dark:text-orange-300 border-0 bg-transparent p-0 h-auto focus-visible:ring-0 w-full"
                        min={0}
                      />
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      at {calcConversionRate}% win rate
                    </p>
                  </div>
                </div>

                {/* Daily breakdown */}
                <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Daily breakdown (5-day week)</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-foreground">
                        {formatCurrency(Math.round(calcRevenueTarget / (calcPeriod === "weekly" ? 5 : 22)))}
                      </p>
                      <p className="text-xs text-muted-foreground">per day</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-foreground">
                        {(calcJobsNeeded / (calcPeriod === "weekly" ? 5 : 22)).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">jobs/day</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-foreground">
                        {(calcQuotesNeeded / (calcPeriod === "weekly" ? 5 : 22)).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">quotes/day</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Custom Report Dialog */}
      <Dialog open={customReportDialog} onOpenChange={setCustomReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Custom Report</DialogTitle>
            <DialogDescription>
              Create a custom report for {selectedMetric}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select
                value={reportDateRange}
                onValueChange={setReportDateRange}
              >
                <SelectTrigger data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Export Format</label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger data-testid="select-export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Report</SelectItem>
                  <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                  <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCustomReportDialog(false)}
              data-testid="button-cancel-report"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateReport}
              data-testid="button-generate-report"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revenue Breakdown Modal */}
      <Dialog
        open={revenueBreakdownOpen}
        onOpenChange={setRevenueBreakdownOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Revenue Breakdown
            </DialogTitle>
            <DialogDescription>
              Jobs that make up your total revenue for the selected date range
            </DialogDescription>
          </DialogHeader>

          {breakdownLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-center">
                <span className="font-medium text-green-800">
                  Total Revenue
                </span>
                <span className="text-2xl font-bold text-green-700">
                  {formatCurrency(revenueBreakdown?.total || 0)}
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">
                        Job #
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm">
                        Customer
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden md:table-cell">
                        Completed
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-sm">
                        Invoice Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueBreakdown?.breakdown?.map((job) => (
                      <tr
                        key={job.jobId}
                        className="border-t hover:bg-muted/30"
                      >
                        <td className="py-3 px-4 text-sm font-medium">
                          {job.jobNumber}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {job.customerName}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                          {job.completedDate
                            ? new Date(job.completedDate).toLocaleDateString(
                                "en-NZ",
                              )
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-green-600">
                          {formatCurrency(job.amount || job.invoiceAmount || 0)}
                        </td>
                      </tr>
                    ))}
                    {(!revenueBreakdown?.breakdown ||
                      revenueBreakdown.breakdown.length === 0) && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No invoiced jobs in this date range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-muted-foreground text-center">
                {revenueBreakdown?.breakdown?.length || 0} jobs · Click a row to
                open the job card (coming soon)
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quote Acceptance Breakdown Modal */}
      <Dialog open={quoteBreakdownOpen} onOpenChange={setQuoteBreakdownOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Quote Acceptance Breakdown
            </DialogTitle>
            <DialogDescription>
              Breakdown of job statuses used to calculate your quote acceptance
              rate
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {quoteAnalytics?.acceptedQuotes || 0}
                </div>
                <div className="text-xs text-green-600 dark:text-green-500">
                  Accepted
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {quoteAnalytics?.rejectedQuotes || 0}
                </div>
                <div className="text-xs text-red-600 dark:text-red-500">
                  Rejected
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {quoteAnalytics?.pendingQuotes || 0}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-500">
                  Pending
                </div>
              </div>
            </div>

            {/* Job card numbers */}
            <div className="space-y-3">
              {quoteAnalytics?.acceptedJobCards &&
                quoteAnalytics.acceptedJobCards.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="text-xs font-medium text-green-600 dark:text-green-500 mb-2">
                      Accepted Job Cards
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {quoteAnalytics.acceptedJobCards.map((num) => (
                        <span
                          key={num}
                          className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded text-xs font-medium"
                        >
                          #{num}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {quoteAnalytics?.rejectedJobCards &&
                quoteAnalytics.rejectedJobCards.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="text-xs font-medium text-red-600 dark:text-red-500 mb-2">
                      Rejected Job Cards
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {quoteAnalytics.rejectedJobCards.map((num) => (
                        <span
                          key={num}
                          className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-0.5 rounded text-xs font-medium"
                        >
                          #{num}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {quoteAnalytics?.pendingJobCards &&
                quoteAnalytics.pendingJobCards.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="text-xs font-medium text-yellow-600 dark:text-yellow-500 mb-2">
                      Pending Job Cards
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {quoteAnalytics.pendingJobCards.map((num) => (
                        <span
                          key={num}
                          className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded text-xs font-medium"
                        >
                          #{num}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Acceptance rate */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex justify-between items-center">
              <span className="font-medium">Quote Acceptance Rate</span>
              <span className="text-2xl font-bold text-primary">
                {quoteAnalytics?.totalQuotes
                  ? `${((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>

            {/* Status breakdown table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium">
                      Job Status
                    </th>
                    <th className="text-right py-2 px-4 font-medium">
                      Category
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="py-2 px-4">completed</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-green-600 font-medium">
                        ACCEPTED
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">scheduled</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-green-600 font-medium">
                        ACCEPTED
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">in_progress</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-green-600 font-medium">
                        ACCEPTED
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">invoiced</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-green-600 font-medium">
                        ACCEPTED
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">work_order</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-green-600 font-medium">
                        ACCEPTED
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">unsuccessful</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-red-600 font-medium">REJECTED</span>
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">quote</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-yellow-600 font-medium">
                        PENDING
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2 px-4 text-muted-foreground">
                      archived
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-muted-foreground">EXCLUDED</span>
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2 px-4 text-muted-foreground">lead</td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-muted-foreground">EXCLUDED</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Total: {quoteAnalytics?.totalQuotes || 0} quoted jobs (
              {quoteAnalytics?.acceptedQuotes || 0} accepted +{" "}
              {quoteAnalytics?.rejectedQuotes || 0} rejected +{" "}
              {quoteAnalytics?.pendingQuotes || 0} pending)
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avg Job Value Breakdown Modal */}
      <Dialog
        open={avgJobValueBreakdownOpen}
        onOpenChange={setAvgJobValueBreakdownOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Average Job Value Breakdown
            </DialogTitle>
            <DialogDescription>
              How your average job value is calculated
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Formula visualization */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-center space-y-3">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Formula
                </div>
                <div className="flex items-center justify-center gap-2 text-lg">
                  <span className="font-semibold">Total Revenue</span>
                  <span className="text-blue-600">÷</span>
                  <span className="font-semibold">Jobs with Invoices</span>
                </div>
              </div>
            </div>

            {/* Values */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                <div className="text-xs text-green-600 dark:text-green-500 mb-1">
                  Total Revenue (exc. GST)
                </div>
                <div className="text-xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(revenueStats?.totalRevenue || 0)}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-center">
                <div className="text-xs text-purple-600 dark:text-purple-500 mb-1">
                  Jobs with Invoices
                </div>
                <div className="text-xl font-bold text-purple-700 dark:text-purple-400">
                  {revenueStats?.jobsWithInvoices || 0}
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Average Job Value
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(revenueStats?.totalRevenue || 0)} ÷{" "}
                    {revenueStats?.jobsWithInvoices || 0} jobs
                  </div>
                </div>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(revenueStats?.averageJobValue || 0)}
                </span>
              </div>
            </div>

            {/* Note */}
            <div className="text-sm text-muted-foreground text-center">
              Only jobs with non-cancelled invoices are included in this
              calculation
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Jobs Completed Drill-Down Modal */}
      <Dialog
        open={jobsCompletedDrilldownOpen}
        onOpenChange={setJobsCompletedDrilldownOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Jobs Completed
            </DialogTitle>
            <DialogDescription>
              All jobs completed in the selected date range
            </DialogDescription>
          </DialogHeader>

          {breakdownLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
                <span className="font-medium text-blue-800">
                  Total Jobs Completed
                </span>
                <span className="text-2xl font-bold text-blue-700">
                  {revenueBreakdown?.breakdown?.length || 0}
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">
                        Job #
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm">
                        Customer
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden md:table-cell">
                        Title
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden md:table-cell">
                        Invoice Date
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-sm">
                        Invoice (ex GST)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueBreakdown?.breakdown?.map((job) => (
                      <tr
                        key={job.jobId}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => {
                          setJobsCompletedDrilldownOpen(false);
                          window.location.href = `/jobs?jobId=${job.jobId}`;
                        }}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-primary">
                          {job.jobNumber}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {job.customerName}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                          {job.title || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                          {job.invoiceDate
                            ? new Date(job.invoiceDate).toLocaleDateString(
                                "en-NZ",
                              )
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-green-600">
                          {formatCurrency(job.amount || job.invoiceAmount || 0)}
                        </td>
                      </tr>
                    ))}
                    {(!revenueBreakdown?.breakdown ||
                      revenueBreakdown.breakdown.length === 0) && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No completed jobs in this date range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-muted-foreground text-center">
                Click a row to open the job
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Accepted Quotes Drill-Down Modal */}
      <Dialog
        open={acceptedQuotesDrilldownOpen}
        onOpenChange={setAcceptedQuotesDrilldownOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Accepted Quotes
            </DialogTitle>
            <DialogDescription>
              All quotes accepted in the selected date range
            </DialogDescription>
          </DialogHeader>

          {acceptedQuotesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-center">
                <span className="font-medium text-green-800">
                  Total Accepted Quotes
                </span>
                <span className="text-2xl font-bold text-green-700">
                  {acceptedQuotesData?.length || 0}
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">
                        Job #
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm">
                        Customer
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden md:table-cell">
                        Title
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden md:table-cell">
                        Accepted
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-sm">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {acceptedQuotesData?.map((quote) => (
                      <tr
                        key={quote.id}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => {
                          setAcceptedQuotesDrilldownOpen(false);
                          if (quote.jobId) {
                            window.location.href = `/jobs?jobId=${quote.jobId}`;
                          }
                        }}
                      >
                        <td className="py-3 px-4 text-sm font-medium text-primary">
                          {quote.jobNumber || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {quote.customerName || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                          {quote.title || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                          {quote.acceptedDate
                            ? new Date(quote.acceptedDate).toLocaleDateString(
                                "en-NZ",
                              )
                            : quote.sentDate
                              ? new Date(quote.sentDate).toLocaleDateString(
                                  "en-NZ",
                                )
                              : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-green-600">
                          {formatCurrency(parseFloat(quote.amount || "0"))}
                        </td>
                      </tr>
                    ))}
                    {(!acceptedQuotesData ||
                      acceptedQuotesData.length === 0) && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No accepted quotes in this date range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-sm text-muted-foreground text-center">
                Click a row to open the job
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
  Briefcase
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

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
  acceptedJobCards?: number[];
  rejectedJobCards?: number[];
  pendingJobCards?: number[];
  averageResponseTime: number;
  rejectionReasons: { reason: string; count: number }[];
  competitorAnalysis: { competitor: string; averagePrice: number; winRate: number }[];
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

interface ServicePerformance {
  id: string;
  name: string;
  type: 'material' | 'service';
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

export default function MetricsDashboard() {
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [manHoursCollapsed, setManHoursCollapsed] = useState(false);
  const [servicePerformanceCollapsed, setServicePerformanceCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [customReportDialog, setCustomReportDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [reportDateRange, setReportDateRange] = useState<string>("30");
  const [reportFormat, setReportFormat] = useState<string>("pdf");
  
  // Date range state
  const [dateRangePreset, setDateRangePreset] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
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
  
  const { toast } = useToast();

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', { 
      style: 'currency', 
      currency: 'NZD' 
    }).format(amount);
  };

  // Format lead source for display
  const formatLeadSource = (source: string) => {
    const sourceMap: Record<string, string> = {
      'website': 'Website',
      'phone': 'Phone Call',
      'referral': 'Referral',
      'friend': 'Friend',
      'saw_working': 'Saw you working',
      'repeat': 'Repeat',
      'google': 'Google Search',
      'facebook': 'Facebook',
      'direct': 'Direct',
      'advertisement': 'Advertisement',
      'council': 'Council',
      'other': 'Other'
    };
    return sourceMap[source] || source.charAt(0).toUpperCase() + source.slice(1);
  };

  // Revenue Calculator: Calculate jobs and quotes needed from revenue target
  const recalculateFromRevenue = useCallback((revenue: number, avgJob: number, convRate: number) => {
    const newJobsNeeded = avgJob > 0 ? Math.ceil(revenue / avgJob) : 0;
    const newQuotesNeeded = convRate > 0 ? Math.ceil(newJobsNeeded / (convRate / 100)) : 0;
    setCalcJobsNeeded(newJobsNeeded);
    setCalcQuotesNeeded(newQuotesNeeded);
  }, []);

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
    const jobsNeeded = calcAvgJobValue > 0 ? Math.ceil(calcRevenueTarget / calcAvgJobValue) : 0;
    setCalcJobsNeeded(jobsNeeded);
    const quotesNeeded = value > 0 ? Math.ceil(jobsNeeded / (value / 100)) : 0;
    setCalcQuotesNeeded(quotesNeeded);
  };

  const handleJobsChange = (value: number) => {
    setCalcJobsNeeded(value);
    const newRevenue = value * calcAvgJobValue;
    setCalcRevenueTarget(newRevenue);
    const quotesNeeded = calcConversionRate > 0 ? Math.ceil(value / (calcConversionRate / 100)) : 0;
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
      recalculateFromRevenue(weeklyRevenue, calcAvgJobValue, calcConversionRate);
    } else if (newPeriod === "monthly" && calcPeriod === "weekly") {
      // Converting from weekly to monthly - multiply by ~4.33
      const monthlyRevenue = Math.round(calcRevenueTarget * 4.33);
      setCalcRevenueTarget(monthlyRevenue);
      recalculateFromRevenue(monthlyRevenue, calcAvgJobValue, calcConversionRate);
    }
    setCalcPeriod(newPeriod);
  };

  // Initialize calculator on first render
  useEffect(() => {
    recalculateFromRevenue(calcRevenueTarget, calcAvgJobValue, calcConversionRate);
  }, []);

  // Helper to get date range based on preset
  const getDateRange = () => {
    if (dateRangePreset === "custom" && startDate && endDate) {
      return { from: startDate, to: endDate };
    }
    
    const today = new Date();
    const fromDate = new Date();
    
    switch (dateRangePreset) {
      case "7":
        fromDate.setDate(today.getDate() - 7);
        return { from: fromDate.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
      case "30":
        fromDate.setDate(today.getDate() - 30);
        return { from: fromDate.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
      case "90":
        fromDate.setDate(today.getDate() - 90);
        return { from: fromDate.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
      case "all":
      default:
        return null;
    }
  };

  const dateRange = getDateRange();

  // Data queries with date filtering
  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard-stats', dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('fromDate', dateRange.from);
      if (dateRange?.to) params.append('toDate', dateRange.to);
      return fetch(`/api/dashboard-stats?${params}`).then(res => res.json()).then(res => res.data);
    }
  });

  const { data: revenueStats, isLoading: revenueLoading } = useQuery<RevenueStats>({
    queryKey: ['/api/revenue-stats', dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('from', dateRange.from);
      if (dateRange?.to) params.append('to', dateRange.to);
      return fetch(`/api/revenue-stats?${params}`).then(res => res.json()).then(res => res.data);
    }
  });

  // Revenue breakdown query - fetches list of jobs that make up the revenue
  const { data: revenueBreakdown, isLoading: breakdownLoading } = useQuery<{
    breakdown: { jobNumber: string; jobId: string; customerName: string; title: string; completedDate: string; invoiceAmount: number }[];
    total: number;
  }>({
    queryKey: ['/api/revenue-breakdown', dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('from', dateRange.from);
      if (dateRange?.to) params.append('to', dateRange.to);
      return fetch(`/api/revenue-breakdown?${params}`).then(res => res.json()).then(res => res.data);
    },
    enabled: revenueBreakdownOpen
  });

  const { data: quoteAnalytics, isLoading: quotesLoading } = useQuery<QuoteAnalytics>({
    queryKey: ['/api/quote-analytics', dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('fromDate', dateRange.from);
      if (dateRange?.to) params.append('toDate', dateRange.to);
      return fetch(`/api/quote-analytics?${params}`).then(res => res.json()).then(res => res.data);
    }
  });

  const { data: leadSourceData, isLoading: leadSourceLoading } = useQuery<LeadSourceData[]>({
    queryKey: ['/api/lead-source-analysis', dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('fromDate', dateRange.from);
      if (dateRange?.to) params.append('toDate', dateRange.to);
      return fetch(`/api/lead-source-analysis?${params}`).then(res => res.json()).then(res => res.data);
    }
  });

  const { data: manHoursMetrics, isLoading: manHoursLoading } = useQuery<ManHoursMetrics>({
    queryKey: ['/api/man-hours-metrics', dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('from', dateRange.from);
      if (dateRange?.to) params.append('to', dateRange.to);
      return fetch(`/api/man-hours-metrics?${params}`).then(res => res.json()).then(res => res.data);
    }
  });

  // Service Performance query
  const { data: servicePerformanceData, isLoading: servicePerformanceLoading } = useQuery<ServicePerformanceData>({
    queryKey: ['/api/analytics/service-performance'],
    queryFn: () => fetch('/api/analytics/service-performance').then(res => res.json()).then(res => res.data)
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
  
  const { data: unsuccessfulJobsData, isLoading: unsuccessfulJobsLoading } = useQuery<UnsuccessfulJobsData>({
    queryKey: ['/api/analytics/unsuccessful-jobs'],
    queryFn: () => fetch('/api/analytics/unsuccessful-jobs').then(res => res.json()).then(res => res.data)
  });

  // Xero Profit & Loss query
  const { data: xeroPL, isLoading: xeroPLLoading, error: xeroPLError } = useQuery<{
    revenue: number;
    expenses: number;
    netProfit: number;
    grossMargin: string | number;
    sections: { name: string; amount: number; type: 'revenue' | 'expense' }[];
  }>({
    queryKey: ['/api/xero/profit-loss', dateRange?.from, dateRange?.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('fromDate', dateRange.from);
      if (dateRange?.to) params.append('toDate', dateRange.to);
      return fetch(`/api/xero/profit-loss?${params}`).then(res => res.json()).then(res => {
        if (!res.success) throw new Error(res.message);
        return res.data;
      });
    },
    retry: false
  });

  // Pre-populate calculator with real analytics data when available (only once)
  useEffect(() => {
    // Only pre-populate once when analytics data first becomes available
    if (hasPrePopulated.current) return;
    
    const hasAvgJob = revenueStats?.averageJobValue && revenueStats.averageJobValue > 0;
    const hasConvRate = dashboardStats?.conversionRate && dashboardStats.conversionRate > 0;
    
    // Only proceed if we have at least one real data point
    if (!hasAvgJob && !hasConvRate) return;
    
    const avgJob = hasAvgJob ? Math.round(revenueStats.averageJobValue) : calcAvgJobValue;
    const convRate = hasConvRate ? Math.round(dashboardStats.conversionRate) : calcConversionRate;
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
  }, [revenueStats?.averageJobValue, dashboardStats?.conversionRate, recalculateFromRevenue, calcAvgJobValue, calcConversionRate, calcRevenueTarget]);

  // Export handler
  const handleExportData = async (type: 'analytics' | 'lead-sources') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('fromDate', dateRange.from);
      if (dateRange?.to) params.append('toDate', dateRange.to);
      
      const response = await fetch(`/api/export/${type}?${params}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `${type === 'lead-sources' ? 'Lead source' : 'Metrics'} data has been exported successfully.`
      });
    } catch (error) {
      toast({
        title: "Export Failed", 
        description: "There was an error exporting the data.",
        variant: "destructive"
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
      const response = await fetch('/api/custom-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: selectedMetric,
          dateRange: reportDateRange,
          format: reportFormat
        })
      });

      if (!response.ok) {
        throw new Error('Report generation failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedMetric.toLowerCase().replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.${reportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: `${selectedMetric} report has been generated successfully.`
      });
      setCustomReportDialog(false);
    } catch (error) {
      toast({
        title: "Report Generation Failed",
        description: "There was an error generating the report.",
        variant: "destructive"
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
    valueColor = ""
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    testId: string;
    colorful?: boolean;
    valueColor?: string;
  }) => (
    <Card className={`hover-elevate ${colorful ? 'card-colorful' : ''}`} data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => handleCustomReport(title)}
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

  if (statsLoading || revenueLoading || quotesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 overflow-x-hidden w-full max-w-full">
      {/* Top Header with Sidebar Toggle */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-2 sm:px-4 py-2 flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate flex-1">Business Metrics</h1>
      </div>

      <div className="p-2 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full min-w-0">
          
          {/* Date Range Filter - Compact */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Filter:
            </span>
            <Button
              variant={dateRangePreset === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRangePreset("all")}
              data-testid="button-date-all"
            >
              All Time
            </Button>
            <Button
              variant={dateRangePreset === "7" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRangePreset("7")}
              data-testid="button-date-7"
            >
              Last 7 Days
            </Button>
            <Button
              variant={dateRangePreset === "30" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRangePreset("30")}
              data-testid="button-date-30"
            >
              Last 30 Days
            </Button>
            <Button
              variant={dateRangePreset === "90" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRangePreset("90")}
              data-testid="button-date-90"
            >
              Last 90 Days
            </Button>
            <Button
              variant={dateRangePreset === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRangePreset("custom")}
              data-testid="button-date-custom"
            >
              Custom Range
            </Button>
            <div className="ml-auto">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExportData('analytics')}
                disabled={isExporting}
                data-testid="button-export-metrics"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export Metrics'}</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>

          {dateRangePreset === "custom" && (
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm font-medium mb-1 block">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm font-medium mb-1 block">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
                {dateRange && (
                  <p className="text-sm text-muted-foreground mt-3">
                    Showing data from {new Date(dateRange.from).toLocaleDateString()} to {new Date(dateRange.to).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Key Metrics Section */}
          <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Key Performance Indicators
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setKpiCollapsed(!kpiCollapsed)}
              data-testid="button-toggle-kpi"
            >
              {kpiCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${kpiCollapsed ? 'hidden md:grid' : ''}`}>
            <div 
              onClick={() => setRevenueBreakdownOpen(true)}
              className="cursor-pointer"
            >
              <MetricCard
                title="Total Revenue"
                value={formatCurrency(dashboardStats?.totalRevenue || 0)}
                subtitle="Click to see breakdown"
                icon={DollarSign}
                testId="card-total-revenue"
                colorful={true}
              />
            </div>

            <MetricCard
              title="Active Leads"
              value={dashboardStats?.totalLeads || 0}
              subtitle={`${dashboardStats?.conversionRate?.toFixed(1) || 0}% conversion rate`}
              icon={Target}
              testId="card-active-leads"
            />

            <MetricCard
              title="Quotes Sent"
              value={quoteAnalytics?.totalQuotes || 0}
              subtitle={`${quoteAnalytics?.pendingQuotes || 0} pending responses`}
              icon={Send}
              testId="card-quotes-sent"
            />

            <MetricCard
              title="Avg Quote Value"
              value={formatCurrency(dashboardStats?.averageQuoteValue || 0)}
              subtitle={`${((quoteAnalytics?.acceptedQuotes || 0) / Math.max(quoteAnalytics?.totalQuotes || 1, 1) * 100).toFixed(0)}% acceptance rate`}
              icon={FileText}
              testId="card-avg-quote"
            />

            <MetricCard
              title="Missed Calls"
              value={dashboardStats?.missedCalls || 0}
              subtitle="Potential leads lost"
              icon={PhoneCall}
              testId="card-missed-calls"
              valueColor="text-orange-600"
            />

            <MetricCard
              title="Avg Response Time"
              value={quoteAnalytics?.averageResponseTime 
                ? `${(quoteAnalytics.averageResponseTime / 60).toFixed(1)} hrs` 
                : "2.4 hrs"}
              subtitle="Lead to first contact"
              icon={Clock}
              testId="card-response-time"
            />

            <div 
              onClick={() => setQuoteBreakdownOpen(true)}
              className="cursor-pointer"
            >
              <MetricCard
                title="Quote Acceptance"
                value={quoteAnalytics?.totalQuotes ? 
                  `${((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1)}%`
                  : "0%"}
                subtitle="Click to see breakdown"
                icon={CheckCircle}
                testId="card-quote-acceptance"
              />
            </div>

            <MetricCard
              title="Customer Retention"
              value={dashboardStats?.customerRetention 
                ? `${dashboardStats.customerRetention}%` 
                : "0%"}
              subtitle="Repeat customers (all-time)"
              icon={Users}
              testId="card-customer-retention"
            />

            <MetricCard
              title="Returning Customers"
              value={dashboardStats?.returningCustomerPercentage !== undefined 
                ? `${dashboardStats.returningCustomerPercentage}%` 
                : "0%"}
              subtitle="Jobs from repeat customers"
              icon={Users}
              testId="card-returning-customers"
            />

            <MetricCard
              title="First Time Fix"
              value={dashboardStats?.firstTimeFix 
                ? `${dashboardStats.firstTimeFix}%` 
                : "92%"}
              subtitle="Jobs completed first visit"
              icon={TrendingUp}
              testId="card-first-time-fix"
            />

            <MetricCard
              title="Gross Margin"
              value={revenueStats?.grossMargin !== undefined 
                ? `${revenueStats.grossMargin.toFixed(1)}%` 
                : "0%"}
              subtitle={revenueStats?.jobsWithProfitTracking > 0
                ? `${formatCurrency(revenueStats.marginRevenue - revenueStats.marginCosts)} profit (${revenueStats.jobsWithProfitTracking} of ${revenueStats.jobsWithInvoices || 0} jobs tracked)`
                : "No jobs with cost tracking"}
              icon={TrendingUp}
              testId="card-gross-margin"
              colorful={true}
              valueColor={revenueStats?.grossMargin !== undefined && revenueStats.grossMargin >= 0 ? "text-green-600" : "text-red-600"}
            />

            <MetricCard
              title="Jobs Completed"
              value={revenueStats?.jobsCompleted || 0}
              subtitle="Completed in period"
              icon={Briefcase}
              testId="card-jobs-completed"
            />
          </div>
        </div>

        {/* Revenue Goal Calculator Section */}
        <div className="mb-6">
          <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-orange-600" />
                  Revenue Goal Calculator
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={calcPeriod === "weekly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("weekly")}
                    data-testid="button-calc-weekly"
                  >
                    Weekly
                  </Button>
                  <Button
                    variant={calcPeriod === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("monthly")}
                    data-testid="button-calc-monthly"
                  >
                    Monthly
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Change any value to see how it affects your targets
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Revenue Target */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Revenue Target
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={calcRevenueTarget || ""}
                      onChange={(e) => handleRevenueChange(parseFloat(e.target.value) || 0)}
                      className="pl-7 text-lg font-semibold"
                      data-testid="input-calc-revenue"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">per {calcPeriod === "weekly" ? "week" : "month"}</p>
                </div>

                {/* Average Job Value */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Avg Job Value
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={calcAvgJobValue || ""}
                      onChange={(e) => handleAvgJobChange(parseFloat(e.target.value) || 0)}
                      className="pl-7 text-lg font-semibold"
                      data-testid="input-calc-avg-job"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">average per job</p>
                </div>

                {/* Jobs Needed */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                    Jobs Needed
                  </label>
                  <Input
                    type="number"
                    value={calcJobsNeeded || ""}
                    onChange={(e) => handleJobsChange(parseInt(e.target.value) || 0)}
                    className="text-lg font-semibold"
                    data-testid="input-calc-jobs"
                  />
                  <p className="text-xs text-muted-foreground">jobs to complete</p>
                </div>

                {/* Conversion Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                    Conversion Rate
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={calcConversionRate || ""}
                      onChange={(e) => handleConversionChange(parseFloat(e.target.value) || 0)}
                      className="pr-7 text-lg font-semibold"
                      data-testid="input-calc-conversion"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">quotes to jobs</p>
                </div>

                {/* Quotes Needed */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-teal-600" />
                    Quotes Needed
                  </label>
                  <Input
                    type="number"
                    value={calcQuotesNeeded}
                    onChange={(e) => handleQuotesChange(parseInt(e.target.value) || 0)}
                    className="text-lg font-semibold"
                    data-testid="input-calc-quotes"
                  />
                  <p className="text-xs text-muted-foreground">quotes to send</p>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 p-3 bg-white/60 rounded-lg border border-orange-200">
                <p className="text-sm">
                  <span className="font-medium">Summary:</span> To earn <span className="font-semibold text-green-600">{formatCurrency(calcRevenueTarget)}</span> per {calcPeriod === "weekly" ? "week" : "month"}, 
                  with an average job value of <span className="font-semibold text-blue-600">{formatCurrency(calcAvgJobValue)}</span>, 
                  you need to complete <span className="font-semibold text-purple-600">{calcJobsNeeded} jobs</span>. 
                  At a <span className="font-semibold text-orange-600">{calcConversionRate}%</span> conversion rate, 
                  you need to send <span className="font-semibold text-teal-600">{calcQuotesNeeded} quotes</span>.
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  That's <span className="font-semibold text-teal-600">{calcPeriod === "weekly" ? calcQuotesNeeded : Math.ceil(calcQuotesNeeded / 4.33)} quotes/week</span> or <span className="font-semibold text-teal-600">{calcPeriod === "weekly" ? (calcQuotesNeeded / 5).toFixed(1) : (calcQuotesNeeded / 4.33 / 5).toFixed(1)} quotes/day</span> (5-day week)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  <p className="text-yellow-800 font-medium">Xero connection required</p>
                  <p className="text-sm text-yellow-600 mt-1">
                    Connect to Xero in Settings → Integrations to see your P&L data
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(xeroPL?.revenue || 0)}
                    </p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-4 border border-red-200">
                    <p className="text-sm text-muted-foreground mb-1">Expenses</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(xeroPL?.expenses || 0)}
                    </p>
                  </div>
                  <div className={`bg-white/60 rounded-lg p-4 border ${(xeroPL?.netProfit || 0) >= 0 ? 'border-green-300' : 'border-red-300'}`}>
                    <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
                    <p className={`text-2xl font-bold ${(xeroPL?.netProfit || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
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
                  <p className="text-sm font-medium mb-2">Breakdown by Category</p>
                  <div className="space-y-2">
                    {xeroPL.sections.map((section, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{section.name}</span>
                        <span className={section.type === 'revenue' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {section.type === 'revenue' ? '+' : '-'}{formatCurrency(section.amount)}
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
        {!manHoursLoading && manHoursMetrics && manHoursMetrics.jobsWithEstimates > 0 && (
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
                {manHoursCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 ${manHoursCollapsed ? 'hidden md:grid' : ''}`}>
              <MetricCard
                title="Overall Accuracy"
                value={`${manHoursMetrics.averageAccuracy.toFixed(1)}%`}
                subtitle={`${manHoursMetrics.jobsWithEstimates} jobs analyzed`}
                icon={Target}
                testId="card-estimation-accuracy"
                colorful={true}
                valueColor={manHoursMetrics.averageAccuracy >= 90 ? "text-green-600" : manHoursMetrics.averageAccuracy >= 75 ? "text-blue-600" : "text-orange-600"}
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
                value={manHoursMetrics.overestimatedJobs > manHoursMetrics.underestimatedJobs ? "Over-estimating" : "Under-estimating"}
                subtitle={`${Math.max(manHoursMetrics.overestimatedJobs, manHoursMetrics.underestimatedJobs)} jobs`}
                icon={TrendingUp}
                testId="card-estimation-trend"
                valueColor={manHoursMetrics.overestimatedJobs > manHoursMetrics.underestimatedJobs ? "text-blue-600" : "text-orange-600"}
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
                    <div className="text-2xl font-bold text-green-600">{manHoursMetrics.accuracyDistribution.excellent}</div>
                    <div className="text-sm text-muted-foreground mt-1">Excellent (≥90%)</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{manHoursMetrics.accuracyDistribution.good}</div>
                    <div className="text-sm text-muted-foreground mt-1">Good (75-89%)</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{manHoursMetrics.accuracyDistribution.fair}</div>
                    <div className="text-sm text-muted-foreground mt-1">Fair (60-74%)</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{manHoursMetrics.accuracyDistribution.poor}</div>
                    <div className="text-sm text-muted-foreground mt-1">Poor (&lt;60%)</div>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Jobs Completed:</span>
                    <span className="font-semibold">{manHoursMetrics.totalJobs}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Jobs with Estimates:</span>
                    <span className="font-semibold">{manHoursMetrics.jobsWithEstimates}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Over-estimated Jobs:</span>
                    <span className="font-semibold text-blue-600">{manHoursMetrics.overestimatedJobs}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Under-estimated Jobs:</span>
                    <span className="font-semibold text-orange-600">{manHoursMetrics.underestimatedJobs}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Additional Metrics Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Financial Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Average Job Value</span>
                <span className="font-bold text-lg">{formatCurrency(revenueStats?.averageJobValue || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Revenue per Lead</span>
                <span className="font-bold text-lg">
                  {formatCurrency((dashboardStats?.totalRevenue || 0) / Math.max(dashboardStats?.totalLeads || 1, 1))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Jobs Completed</span>
                <span className="font-bold text-lg">{revenueStats?.jobsCompleted || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-500" />
                Quote Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Quotes</span>
                <span className="font-bold text-lg">{quoteAnalytics?.totalQuotes || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Accepted Quotes</span>
                <span className="font-bold text-lg text-green-600">{quoteAnalytics?.acceptedQuotes || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Pending Quotes</span>
                <span className="font-bold text-lg text-yellow-600">{quoteAnalytics?.pendingQuotes || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  onClick={() => handleExportData('lead-sources')}
                  disabled={isExporting}
                  data-testid="button-export-lead-sources"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export CSV'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pr-16">
              {leadSourceLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading lead source data...</p>
                </div>
              ) : leadSourceData && leadSourceData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Lead Source</th>
                        <th className="text-right py-3 px-4 font-medium">Quoted</th>
                        <th className="text-right py-3 px-4 font-medium">Won</th>
                        <th className="text-right py-3 px-4 font-medium">Quote Conv.</th>
                        <th className="text-right py-3 px-4 font-medium">Total Revenue</th>
                        <th className="text-right py-3 px-4 font-medium">Revenue %</th>
                        <th className="text-right py-3 px-4 font-medium">Gross Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadSourceData.map((source) => (
                        <tr 
                          key={source.source} 
                          className="border-b hover-elevate"
                          data-testid={`row-lead-source-${source.source}`}
                        >
                          <td className="py-3 px-4 font-medium">{formatLeadSource(source.source)}</td>
                          <td className="text-right py-3 px-4">{source.quotedCount}</td>
                          <td className="text-right py-3 px-4">{source.wonCount}</td>
                          <td className="text-right py-3 px-4">
                            <span className={source.quoteConversionRate > 70 ? 'text-green-600 font-semibold' : source.quoteConversionRate > 40 ? 'text-yellow-600' : 'text-gray-600'}>
                              {source.quoteConversionRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-right py-3 px-4 font-semibold">{formatCurrency(source.totalRevenue)}</td>
                          <td className="text-right py-3 px-4">
                            {(() => {
                              const totalRev = leadSourceData.reduce((sum, s) => sum + s.totalRevenue, 0);
                              const revPercent = totalRev > 0 ? (source.totalRevenue / totalRev) * 100 : 0;
                              return <span className={revPercent > 30 ? 'text-blue-600 font-semibold' : revPercent > 15 ? 'text-blue-500' : 'text-gray-600'}>{revPercent.toFixed(1)}%</span>;
                            })()}
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className={source.averageProfitMargin > 40 ? 'text-green-600 font-semibold' : source.averageProfitMargin > 20 ? 'text-yellow-600' : source.averageProfitMargin > 0 ? 'text-orange-600' : 'text-gray-500'}>
                              {source.averageProfitMargin?.toFixed(1) || '0.0'}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/50">
                        <td className="py-3 px-4">TOTAL</td>
                        <td className="text-right py-3 px-4">{leadSourceData.reduce((sum, s) => sum + s.quotedCount, 0)}</td>
                        <td className="text-right py-3 px-4">{leadSourceData.reduce((sum, s) => sum + s.wonCount, 0)}</td>
                        <td className="text-right py-3 px-4">
                          {((leadSourceData.reduce((sum, s) => sum + s.wonCount, 0) / Math.max(leadSourceData.reduce((sum, s) => sum + s.quotedCount, 0), 1)) * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-4">{formatCurrency(leadSourceData.reduce((sum, s) => sum + s.totalRevenue, 0))}</td>
                        <td className="text-right py-3 px-4 text-blue-600">100.0%</td>
                        <td className="text-right py-3 px-4">
                          {(() => {
                            const totalRev = leadSourceData.reduce((sum, s) => sum + s.totalRevenue, 0);
                            const totalProfit = leadSourceData.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
                            const overallMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
                            return <span className={overallMargin > 40 ? 'text-green-600' : overallMargin > 20 ? 'text-yellow-600' : 'text-orange-600'}>{overallMargin.toFixed(1)}%</span>;
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No lead source data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Service Performance Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Service Performance
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setServicePerformanceCollapsed(!servicePerformanceCollapsed)}
                className="md:hidden"
              >
                {servicePerformanceCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent className={servicePerformanceCollapsed ? 'hidden md:block' : ''}>
              {servicePerformanceLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading service performance data...</p>
                </div>
              ) : servicePerformanceData && servicePerformanceData.services && servicePerformanceData.services.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(servicePerformanceData.summary.totalRevenue)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Total Costs</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(servicePerformanceData.summary.totalCost)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Gross Margin</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(servicePerformanceData.summary.grossMargin)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Margin %</p>
                      <p className={`text-2xl font-bold ${servicePerformanceData.summary.marginPercentage > 40 ? 'text-green-600' : servicePerformanceData.summary.marginPercentage > 20 ? 'text-yellow-600' : 'text-orange-600'}`}>
                        {servicePerformanceData.summary.marginPercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Services Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Service / Material</th>
                          <th className="text-right py-3 px-4 font-medium">Revenue</th>
                          <th className="text-right py-3 px-4 font-medium">Costs</th>
                          <th className="text-right py-3 px-4 font-medium">Margin</th>
                          <th className="text-right py-3 px-4 font-medium">Margin %</th>
                          <th className="text-right py-3 px-4 font-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servicePerformanceData.services.slice(0, 15).map((service: ServicePerformance, index: number) => (
                          <tr key={service.id} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{service.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${service.type === 'service' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {service.type}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">{service.category}</span>
                            </td>
                            <td className="text-right py-3 px-4 text-green-600 font-medium">
                              {formatCurrency(service.totalRevenue)}
                            </td>
                            <td className="text-right py-3 px-4 text-red-600">
                              {formatCurrency(service.totalCost)}
                            </td>
                            <td className="text-right py-3 px-4 font-medium">
                              {formatCurrency(service.grossMargin)}
                            </td>
                            <td className="text-right py-3 px-4">
                              <span className={`font-medium ${service.marginPercentage > 50 ? 'text-green-600' : service.marginPercentage > 25 ? 'text-yellow-600' : 'text-orange-600'}`}>
                                {service.marginPercentage.toFixed(1)}%
                              </span>
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {service.totalQuantity.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Note about data tracking */}
                  <div className="mt-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <p><strong>Note:</strong> Margin data is calculated from paid invoices. For accurate margins, ensure costs are entered in Settings → Materials & Services, and link invoice items to their corresponding services.</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No service performance data available yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">Create invoices with linked services/materials to track their performance.</p>
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
                  <p className="text-muted-foreground ml-2">Loading unsuccessful jobs data...</p>
                </div>
              ) : unsuccessfulJobsData && unsuccessfulJobsData.totalUnsuccessful > 0 ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <p className="text-sm text-orange-700">Total Unsuccessful</p>
                      <p className="text-2xl font-bold text-orange-600">{unsuccessfulJobsData.totalUnsuccessful}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <p className="text-sm text-red-700">Potential Revenue Lost</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(unsuccessfulJobsData.totalPotentialRevenueLost)}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm text-blue-700">Top Reason</p>
                      <p className="text-lg font-bold text-blue-600">{unsuccessfulJobsData.byReason[0]?.label || 'N/A'}</p>
                      <p className="text-sm text-blue-500">{unsuccessfulJobsData.byReason[0]?.percentage || 0}% of cases</p>
                    </div>
                  </div>

                  {/* Reasons Breakdown with Pie Chart */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pie Chart */}
                    <div>
                      <h4 className="font-medium mb-3">Reasons Distribution</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={unsuccessfulJobsData.byReason.map((item, index) => ({
                              name: item.label,
                              value: item.count,
                              color: ['#f97316', '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#6366f1'][index % 8]
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                            outerRadius={80}
                            fill="#f97316"
                            dataKey="value"
                          >
                            {unsuccessfulJobsData.byReason.map((_, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={['#f97316', '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#6366f1'][index % 8]} 
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => [`${value} jobs`, 'Count']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {unsuccessfulJobsData.byReason.slice(0, 6).map((item, index) => (
                          <div key={item.reason} className="flex items-center gap-1 text-xs">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: ['#f97316', '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#6366f1'][index % 8] }}
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
                          <div key={item.reason} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">{item.label}</span>
                                <span className="text-sm text-muted-foreground">{item.count} jobs ({item.percentage}%)</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <span className="text-xs text-red-600">{formatCurrency(item.potentialRevenueLost)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Monthly Trends */}
                  <div>
                    <h4 className="font-medium mb-3">Monthly Trends (Last 6 Months)</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {unsuccessfulJobsData.monthlyTrends.map((month) => (
                        <div key={month.month} className="text-center">
                          <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">{month.month}</p>
                            <p className="text-lg font-bold text-orange-600">{month.count}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(month.value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Unsuccessful Jobs */}
                  {unsuccessfulJobsData.recentUnsuccessful.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Recent Unsuccessful Jobs (Last 30 Days)</h4>
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
                            {unsuccessfulJobsData.recentUnsuccessful.slice(0, 5).map((job) => (
                              <tr key={job.id} className="border-b hover:bg-muted/20">
                                <td className="py-2 px-3 font-medium">{job.jobNumber}</td>
                                <td className="py-2 px-3">{job.title || 'Untitled'}</td>
                                <td className="py-2 px-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                                    {job.reasonLabel}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-red-600">{formatCurrency(job.potentialValue)}</td>
                                <td className="py-2 px-3 text-muted-foreground text-xs max-w-[200px] truncate">{job.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-medium text-amber-800 mb-2">Insights</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {unsuccessfulJobsData.byReason[0]?.reason === 'price_too_high' && (
                        <li>Price is the top reason for lost jobs - consider reviewing your pricing strategy or improving value communication.</li>
                      )}
                      {unsuccessfulJobsData.byReason[0]?.reason === 'went_competitor' && (
                        <li>Customers are going to competitors - analyze what differentiates you and improve competitive positioning.</li>
                      )}
                      {unsuccessfulJobsData.byReason[0]?.reason === 'no_response' && (
                        <li>Many customers aren't responding - consider follow-up improvements or faster quote turnaround.</li>
                      )}
                      {unsuccessfulJobsData.byReason[0]?.reason === 'scheduling' && (
                        <li>Scheduling is a barrier - consider expanding availability or offering more flexible booking options.</li>
                      )}
                      <li>Total potential revenue lost: {formatCurrency(unsuccessfulJobsData.totalPotentialRevenueLost)} - focus on converting the top reasons to recover some of this.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No unsuccessful jobs recorded yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">When jobs are marked as unsuccessful, their reasons will appear here for analysis.</p>
                </div>
              )}
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
              <Select value={reportDateRange} onValueChange={setReportDateRange}>
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
      <Dialog open={revenueBreakdownOpen} onOpenChange={setRevenueBreakdownOpen}>
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
                <span className="font-medium text-green-800">Total Revenue</span>
                <span className="text-2xl font-bold text-green-700">
                  {formatCurrency(revenueBreakdown?.total || 0)}
                </span>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm">Job #</th>
                      <th className="text-left py-3 px-4 font-medium text-sm">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-sm hidden md:table-cell">Completed</th>
                      <th className="text-right py-3 px-4 font-medium text-sm">Invoice Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueBreakdown?.breakdown?.map((job) => (
                      <tr key={job.jobId} className="border-t hover:bg-muted/30">
                        <td className="py-3 px-4 text-sm font-medium">{job.jobNumber}</td>
                        <td className="py-3 px-4 text-sm">{job.customerName}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">
                          {job.completedDate ? new Date(job.completedDate).toLocaleDateString('en-NZ') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-green-600">
                          {formatCurrency(job.invoiceAmount)}
                        </td>
                      </tr>
                    ))}
                    {(!revenueBreakdown?.breakdown || revenueBreakdown.breakdown.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          No invoiced jobs in this date range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="text-sm text-muted-foreground text-center">
                {revenueBreakdown?.breakdown?.length || 0} jobs · Click a row to open the job card (coming soon)
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
              Breakdown of job statuses used to calculate your quote acceptance rate
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {quoteAnalytics?.acceptedQuotes || 0}
                </div>
                <div className="text-xs text-green-600 dark:text-green-500">Accepted</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {quoteAnalytics?.rejectedQuotes || 0}
                </div>
                <div className="text-xs text-red-600 dark:text-red-500">Rejected</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {quoteAnalytics?.pendingQuotes || 0}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-500">Pending</div>
              </div>
            </div>

            {/* Job card numbers */}
            <div className="space-y-3">
              {quoteAnalytics?.acceptedJobCards && quoteAnalytics.acceptedJobCards.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="text-xs font-medium text-green-600 dark:text-green-500 mb-2">Accepted Job Cards</div>
                  <div className="flex flex-wrap gap-1">
                    {quoteAnalytics.acceptedJobCards.map((num) => (
                      <span key={num} className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded text-xs font-medium">
                        #{num}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {quoteAnalytics?.rejectedJobCards && quoteAnalytics.rejectedJobCards.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="text-xs font-medium text-red-600 dark:text-red-500 mb-2">Rejected Job Cards</div>
                  <div className="flex flex-wrap gap-1">
                    {quoteAnalytics.rejectedJobCards.map((num) => (
                      <span key={num} className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-0.5 rounded text-xs font-medium">
                        #{num}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {quoteAnalytics?.pendingJobCards && quoteAnalytics.pendingJobCards.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="text-xs font-medium text-yellow-600 dark:text-yellow-500 mb-2">Pending Job Cards</div>
                  <div className="flex flex-wrap gap-1">
                    {quoteAnalytics.pendingJobCards.map((num) => (
                      <span key={num} className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded text-xs font-medium">
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
                {quoteAnalytics?.totalQuotes ? 
                  `${((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>

            {/* Status breakdown table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium">Job Status</th>
                    <th className="text-right py-2 px-4 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="py-2 px-4">completed</td>
                    <td className="py-2 px-4 text-right"><span className="text-green-600 font-medium">ACCEPTED</span></td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">scheduled</td>
                    <td className="py-2 px-4 text-right"><span className="text-green-600 font-medium">ACCEPTED</span></td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">in_progress</td>
                    <td className="py-2 px-4 text-right"><span className="text-green-600 font-medium">ACCEPTED</span></td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">invoiced</td>
                    <td className="py-2 px-4 text-right"><span className="text-green-600 font-medium">ACCEPTED</span></td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">work_order</td>
                    <td className="py-2 px-4 text-right"><span className="text-green-600 font-medium">ACCEPTED</span></td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">unsuccessful</td>
                    <td className="py-2 px-4 text-right"><span className="text-red-600 font-medium">REJECTED</span></td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-4">quote</td>
                    <td className="py-2 px-4 text-right"><span className="text-yellow-600 font-medium">PENDING</span></td>
                  </tr>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2 px-4 text-muted-foreground">archived</td>
                    <td className="py-2 px-4 text-right"><span className="text-muted-foreground">EXCLUDED</span></td>
                  </tr>
                  <tr className="border-t bg-muted/30">
                    <td className="py-2 px-4 text-muted-foreground">lead</td>
                    <td className="py-2 px-4 text-right"><span className="text-muted-foreground">EXCLUDED</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Total: {quoteAnalytics?.totalQuotes || 0} quoted jobs ({quoteAnalytics?.acceptedQuotes || 0} accepted + {quoteAnalytics?.rejectedQuotes || 0} rejected + {quoteAnalytics?.pendingQuotes || 0} pending)
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
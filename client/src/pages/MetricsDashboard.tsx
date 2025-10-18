import React, { useState } from "react";
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
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Send,
  Calendar
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

interface DashboardStats {
  totalLeads: number;
  totalCustomers: number;
  totalJobs: number;
  totalRevenue: number;
  conversionRate: number;
  averageQuoteValue: number;
  missedCalls: number;
  customerRetention?: number;
  firstTimeFix?: number;
  recentCalls: any[];
  recentLeads: any[];
}

interface RevenueStats {
  totalRevenue: number;
  jobsCompleted: number;
  averageJobValue: number;
  totalCosts: number;
  grossMargin: number;
  monthlyTrend: { month: string; revenue: number; jobs: number }[];
}

interface QuoteAnalytics {
  totalQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  pendingQuotes: number;
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
  const [isExporting, setIsExporting] = useState(false);
  const [customReportDialog, setCustomReportDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [reportDateRange, setReportDateRange] = useState<string>("30");
  const [reportFormat, setReportFormat] = useState<string>("pdf");
  
  // Date range state
  const [dateRangePreset, setDateRangePreset] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  const { toast } = useToast();

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', { 
      style: 'currency', 
      currency: 'NZD' 
    }).format(amount);
  };

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
      if (dateRange?.from) params.append('fromDate', dateRange.from);
      if (dateRange?.to) params.append('toDate', dateRange.to);
      return fetch(`/api/revenue-stats?${params}`).then(res => res.json()).then(res => res.data);
    }
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
    queryKey: ['/api/man-hours-metrics'],
    queryFn: () => fetch('/api/man-hours-metrics').then(res => res.json()).then(res => res.data)
  });

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
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(dashboardStats?.totalRevenue || 0)}
              subtitle={`${dashboardStats?.totalJobs || 0} jobs completed`}
              icon={DollarSign}
              testId="card-total-revenue"
              colorful={true}
            />

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

            <MetricCard
              title="Quote Acceptance"
              value={quoteAnalytics?.totalQuotes ? 
                `${((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1)}%`
                : "0%"}
              subtitle="Quotes & proposals accepted"
              icon={CheckCircle}
              testId="card-quote-acceptance"
            />

            <MetricCard
              title="Customer Retention"
              value={dashboardStats?.customerRetention 
                ? `${dashboardStats.customerRetention}%` 
                : "85%"}
              subtitle="Repeat customers"
              icon={Users}
              testId="card-customer-retention"
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
              subtitle={revenueStats?.totalRevenue && revenueStats?.totalCosts 
                ? `${formatCurrency(revenueStats.totalRevenue - revenueStats.totalCosts)} profit`
                : "All completed jobs"}
              icon={TrendingUp}
              testId="card-gross-margin"
              colorful={true}
              valueColor="text-green-600"
            />
          </div>
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
                      </tr>
                    </thead>
                    <tbody>
                      {leadSourceData.map((source) => (
                        <tr 
                          key={source.source} 
                          className="border-b hover-elevate"
                          data-testid={`row-lead-source-${source.source}`}
                        >
                          <td className="py-3 px-4 font-medium capitalize">{source.source}</td>
                          <td className="text-right py-3 px-4">{source.quotedCount}</td>
                          <td className="text-right py-3 px-4">{source.wonCount}</td>
                          <td className="text-right py-3 px-4">
                            <span className={source.quoteConversionRate > 70 ? 'text-green-600 font-semibold' : source.quoteConversionRate > 40 ? 'text-yellow-600' : 'text-gray-600'}>
                              {source.quoteConversionRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-right py-3 px-4 font-semibold">{formatCurrency(source.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold bg-muted/50">
                        <td className="py-3 px-4">TOTAL</td>
                        <td className="text-right py-3 px-4">{leadSourceData.reduce((sum, s) => sum + s.quotedCount, 0)}</td>
                        <td className="text-right py-3 px-4">{leadSourceData.reduce((sum, s) => sum + s.wonCount, 0)}</td>
                        <td className="text-right py-3 px-4">
                          {((leadSourceData.reduce((sum, s) => sum + s.wonCount, 0) / leadSourceData.reduce((sum, s) => sum + s.quotedCount, 0)) * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-3 px-4">{formatCurrency(leadSourceData.reduce((sum, s) => sum + s.totalRevenue, 0))}</td>
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
    </div>
  );
}
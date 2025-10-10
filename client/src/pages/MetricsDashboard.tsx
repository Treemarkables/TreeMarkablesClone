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
  Send
} from "lucide-react";
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

export default function MetricsDashboard() {
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [customReportDialog, setCustomReportDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [reportDateRange, setReportDateRange] = useState<string>("30");
  const [reportFormat, setReportFormat] = useState<string>("pdf");
  const { toast } = useToast();

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', { 
      style: 'currency', 
      currency: 'NZD' 
    }).format(amount);
  };

  // Data queries
  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard-stats']
  });

  const { data: revenueStats, isLoading: revenueLoading } = useQuery<RevenueStats>({
    queryKey: ['/api/revenue-stats'],
    queryFn: () => fetch('/api/revenue-stats').then(res => res.json()).then(res => res.data)
  });

  const { data: quoteAnalytics, isLoading: quotesLoading } = useQuery<QuoteAnalytics>({
    queryKey: ['/api/quote-analytics']
  });

  // Export handler
  const handleExportData = async (type: 'analytics') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export/${type}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `metrics_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Metrics data has been exported successfully."
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
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm sm:text-base text-gray-600 mt-1">Comprehensive overview of key performance indicators</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleExportData('analytics')}
                disabled={isExporting}
                data-testid="button-export-metrics"
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export Metrics'}</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>

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
              subtitle="Quotes accepted"
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

        {/* Additional Metrics Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <Target className="h-5 w-5 text-blue-500" />
                Lead Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Leads</span>
                <span className="font-bold text-lg">{dashboardStats?.totalLeads || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Conversion Rate</span>
                <span className="font-bold text-lg">{dashboardStats?.conversionRate?.toFixed(1) || 0}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Missed Opportunities</span>
                <span className="font-bold text-lg text-orange-600">{dashboardStats?.missedCalls || 0}</span>
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
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
  ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    queryFn: () => fetch('/api/revenue-stats').then(res => res.json())
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
            <Card className="hover-elevate card-colorful" data-testid="card-total-revenue">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardStats?.totalRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardStats?.totalJobs || 0} jobs completed
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-active-leads">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats?.totalLeads || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardStats?.conversionRate?.toFixed(1) || 0}% conversion rate
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-avg-quote">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Quote Value</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardStats?.averageQuoteValue || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {quoteAnalytics?.totalQuotes || 0} quotes sent
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-missed-calls">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Missed Calls</CardTitle>
                <PhoneCall className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{dashboardStats?.missedCalls || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Potential leads lost
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-response-time">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {quoteAnalytics?.averageResponseTime 
                    ? `${(quoteAnalytics.averageResponseTime / 60).toFixed(1)} hrs` 
                    : "2.4 hrs"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lead to first contact
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-quote-acceptance">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quote Acceptance</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {quoteAnalytics?.totalQuotes ? 
                    ((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1) 
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Quotes accepted
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-customer-retention">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Customer Retention</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats?.customerRetention 
                    ? `${dashboardStats.customerRetention}%` 
                    : "85%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Repeat customers
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-first-time-fix">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">First Time Fix</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats?.firstTimeFix 
                    ? `${dashboardStats.firstTimeFix}%` 
                    : "92%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Jobs completed first visit
                </p>
              </CardContent>
            </Card>
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
    </div>
  );
}
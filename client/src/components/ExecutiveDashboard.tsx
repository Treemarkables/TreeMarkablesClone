import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Activity, 
  BarChart3, PieChart, Calendar, Download, Settings,
  Target, Award, CheckCircle, AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

// Use shared types instead of local interfaces
interface KpiMetric {
  id: string;
  name: string;
  value: number;
  unit: 'currency' | 'percentage' | 'rating' | 'number';
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
  category: 'financial' | 'customer' | 'operational';
}

interface DashboardStats {
  totalRevenue: number;
  totalJobs: number;
  totalCustomers: number;
  activeJobs: number;
  completedJobs: number;
  pendingQuotes: number;
  equipmentUtilization: number;
  teamProductivity: number;
  revenueGrowth: number;
  customerSatisfaction: number;
}

interface RevenueAnalytics {
  monthlyRevenue: Array<{ month: string; amount: number; }>;
  revenueByService: Array<{ service: string; revenue: number; percentage: number; }>;
  averageJobValue: number;
  recurringRevenue: number;
  seasonalTrends: Array<{ quarter: string; growth: number; }>;
}

// KPI Card Component - Compressed for more density
function KpiCard({ metric }: { metric: KpiMetric }) {
  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case 'currency':
        return new Intl.NumberFormat('en-NZ', { 
          style: 'currency', 
          currency: 'NZD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'rating':
        return `${value.toFixed(1)}/5`;
      default:
        return value.toLocaleString();
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-600" />;
      default:
        return <Activity className="w-3 h-3 text-yellow-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`kpi-card-${metric.id}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-medium">{metric.name}</CardTitle>
        {getTrendIcon(metric.trend)}
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="text-xl font-bold" data-testid={`kpi-value-${metric.id}`}>
          {formatValue(metric.value, metric.unit)}
        </div>
        {metric.trendValue > 0 && (
          <p className={`text-[10px] ${getTrendColor(metric.trend)}`}>
            {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '-' : ''}
            {formatValue(metric.trendValue, metric.unit)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Revenue Chart Component (simplified placeholder)
function RevenueChart({ data }: { data: RevenueAnalytics | undefined }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading revenue data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Revenue Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Average Job Value</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('en-NZ', { 
                  style: 'currency', 
                  currency: 'NZD' 
                }).format(data.averageJobValue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recurring Revenue</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('en-NZ', { 
                  style: 'currency', 
                  currency: 'NZD' 
                }).format(data.recurringRevenue)}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Revenue by Service</h4>
            {data.revenueByService.map((service, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{service.service}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{service.percentage.toFixed(1)}%</Badge>
                  <span className="text-sm font-medium">
                    {new Intl.NumberFormat('en-NZ', { 
                      style: 'currency', 
                      currency: 'NZD' 
                    }).format(service.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Executive Dashboard Component
export function ExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Build query params from date range
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateRange.from) {
      params.append('from', dateRange.from.toISOString());
    }
    if (dateRange.to) {
      params.append('to', dateRange.to.toISOString());
    }
    return params.toString();
  };

  // Fetch KPI metrics
  const { data: kpis, isLoading: kpisLoading } = useQuery<KpiMetric[]>({
    queryKey: ['/api/analytics/kpis', { from: dateRange.from?.toISOString() ?? null, to: dateRange.to?.toISOString() ?? null }],
    queryFn: async () => {
      const params = buildQueryParams();
      const url = `/api/analytics/kpis${params ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      return res.json();
    },
  });

  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: dashboardLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/analytics/dashboard', { from: dateRange.from?.toISOString() ?? null, to: dateRange.to?.toISOString() ?? null }],
    queryFn: async () => {
      const params = buildQueryParams();
      const url = `/api/analytics/dashboard${params ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    },
  });

  // Fetch revenue analytics
  const { data: revenueAnalytics, isLoading: revenueLoading } = useQuery<RevenueAnalytics>({
    queryKey: ['/api/analytics/revenue', { from: dateRange.from?.toISOString() ?? null, to: dateRange.to?.toISOString() ?? null }],
    queryFn: async () => {
      const params = buildQueryParams();
      const url = `/api/analytics/revenue${params ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch revenue analytics');
      return res.json();
    },
  });

  const handleExportData = (type: string) => {
    window.open(`/api/analytics/export/${type}?format=csv`, '_blank');
  };

  const filteredKpis = (category: string) => {
    return kpis?.filter(kpi => kpi.category === category) || [];
  };

  if (kpisLoading || dashboardLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Executive Dashboard</h2>
          <Badge variant="secondary">Loading...</Badge>
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-1 pt-3 px-3">
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-amber-800 dark:text-amber-200">
            Executive Dashboard
          </h2>
          <p className="text-muted-foreground">
            Comprehensive business intelligence and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-date-range">
                <Calendar className="w-4 h-4 mr-2" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  "All Time"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                numberOfMonths={2}
                data-testid="calendar-date-range"
              />
              {dateRange.from && (
                <div className="p-3 border-t flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                    data-testid="button-clear-dates"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleExportData('dashboard')}
            data-testid="button-export-dashboard"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" data-testid="button-dashboard-settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">
            Financial
          </TabsTrigger>
          <TabsTrigger value="operational" data-testid="tab-operational">
            Operational
          </TabsTrigger>
          <TabsTrigger value="customer" data-testid="tab-customer">
            Customer
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* High-Level Stats */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium">Total Revenue</CardTitle>
                <DollarSign className="w-3 h-3 text-amber-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold" data-testid="stat-total-revenue">
                  {dashboardStats ? new Intl.NumberFormat('en-NZ', { 
                    style: 'currency', 
                    currency: 'NZD' 
                  }).format(dashboardStats.totalRevenue) : '--'}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {dashboardStats?.revenueGrowth ? (
                    <span className={dashboardStats.revenueGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                      {dashboardStats.revenueGrowth > 0 ? '+' : ''}{dashboardStats.revenueGrowth.toFixed(1)}%
                    </span>
                  ) : '--'}
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium">Active Jobs</CardTitle>
                <Activity className="w-3 h-3 text-blue-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold" data-testid="stat-active-jobs">
                  {dashboardStats?.activeJobs || 0}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {dashboardStats?.totalJobs || 0} total
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium">Customers</CardTitle>
                <Users className="w-3 h-3 text-green-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold" data-testid="stat-total-customers">
                  {dashboardStats?.totalCustomers || 0}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Active
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium">Equipment</CardTitle>
                <Target className="w-3 h-3 text-purple-600" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-xl font-bold" data-testid="stat-equipment-utilization">
                  {dashboardStats?.equipmentUtilization ? `${dashboardStats.equipmentUtilization.toFixed(1)}%` : '--'}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Utilization
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <div className="grid gap-4 md:grid-cols-3">
            <RevenueChart data={revenueAnalytics} />
            
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-generate-report"
                >
                  <PieChart className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-schedule-review"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Review
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-export-data"
                  onClick={() => handleExportData('revenue')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {filteredKpis('financial').map((kpi) => (
              <KpiCard key={kpi.id} metric={kpi} />
            ))}
          </div>
          
          <RevenueChart data={revenueAnalytics} />
        </TabsContent>

        {/* Operational Tab */}
        <TabsContent value="operational" className="space-y-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {filteredKpis('operational').map((kpi) => (
              <KpiCard key={kpi.id} metric={kpi} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Operational Insights</CardTitle>
              <CardDescription>
                Key operational metrics and performance indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Job Completion Rate</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${dashboardStats?.completedJobs && dashboardStats?.totalJobs ? 
                          (dashboardStats.completedJobs / dashboardStats.totalJobs * 100) : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {dashboardStats?.completedJobs && dashboardStats?.totalJobs ? 
                        ((dashboardStats.completedJobs / dashboardStats.totalJobs) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Team Productivity</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${dashboardStats?.teamProductivity || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">
                      {dashboardStats?.teamProductivity?.toFixed(1) || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Tab */}
        <TabsContent value="customer" className="space-y-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {filteredKpis('customer').map((kpi) => (
              <KpiCard key={kpi.id} metric={kpi} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Customer Insights</CardTitle>
              <CardDescription>
                Customer relationship and satisfaction metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">Customer Satisfaction</p>
                      <p className="text-sm text-muted-foreground">Average rating across all services</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {dashboardStats?.customerSatisfaction?.toFixed(1) || '--'}/5
                    </p>
                    <p className="text-xs text-green-600">+0.2 this month</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Pending Quotes</p>
                      <p className="text-sm text-muted-foreground">Quotes awaiting customer response</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {dashboardStats?.pendingQuotes || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Active quotes</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
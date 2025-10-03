import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  Calendar,
  MessageSquare,
  FileText,
  AlertTriangle,
  ChevronRight,
  Briefcase
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityDashboardData {
  todaysJobs: {
    total: number;
    jobs: any[];
    statusBreakdown: Record<string, number>;
  };
  tomorrowsJobs: {
    total: number;
    jobs: any[];
  };
  financials: {
    totalRevenue: number;
    totalCosts: number;
    profit: number;
    profitMargin: string;
  };
  staffBookings: Array<{
    employeeId: string;
    employeeName: string;
    totalHours: number;
    jobs: string[];
  }>;
  pendingActions: {
    unansweredConversations: number;
    pendingQuotes: number;
    overdueInvoices: number;
    pendingIncidents: number;
    total: number;
  };
  recentActivities: any[];
  performanceIndicators: {
    completionRate: string;
    avgCompletionTimeHours: string;
    avgResponseTimeMinutes: string;
  };
}

export default function ActivityDashboard() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: ActivityDashboardData }>({
    queryKey: ['/api/activity-dashboard'],
  });

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
            <CardDescription>
              Unable to fetch activity dashboard data. Please try refreshing the page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const dashboard = data.data;

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    completed: 'bg-green-500',
    work_order: 'bg-purple-500',
    lead: 'bg-gray-500'
  };

  const statusLabels: Record<string, string> = {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    work_order: 'Work Order',
    lead: 'Lead'
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Today's Activity</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${dashboard.financials.totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard.todaysJobs.total} jobs booked
            </p>
          </CardContent>
        </Card>

        {/* Profit Margin */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.financials.profitMargin}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${dashboard.financials.profit.toFixed(2)} profit today
            </p>
          </CardContent>
        </Card>

        {/* Staff Booked */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Booked</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.staffBookings.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard.staffBookings.reduce((sum, s) => sum + s.totalHours, 0).toFixed(1)} total hours
            </p>
          </CardContent>
        </Card>

        {/* Pending Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.pendingActions.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Today's Jobs ({dashboard.todaysJobs.total})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.todaysJobs.total === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs scheduled for today</p>
            ) : (
              <>
                {/* Status Breakdown */}
                <div className="flex flex-wrap gap-2 pb-3 border-b">
                  {Object.entries(dashboard.todaysJobs.statusBreakdown).map(([status, count]) => (
                    <Badge 
                      key={status} 
                      variant="outline"
                      className="gap-1"
                      data-testid={`badge-status-${status}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-500'}`} />
                      {statusLabels[status] || status}: {count}
                    </Badge>
                  ))}
                </div>

                {/* Job List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {dashboard.todaysJobs.jobs.slice(0, 10).map((job: any) => (
                    <Link key={job.id} href="/job-dashboard" asChild>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-md border hover-elevate cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{job.address}</p>
                        </div>
                        <Badge variant="outline" className="ml-2 shrink-0">
                          {statusLabels[job.status] || job.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>

                {dashboard.todaysJobs.total > 10 && (
                  <Link href="/job-dashboard" asChild>
                    <Button variant="outline" size="sm" className="w-full" data-testid="button-view-all-jobs">
                      View All Jobs
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Tomorrow's Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tomorrow's Preview ({dashboard.tomorrowsJobs.total})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.tomorrowsJobs.total === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs scheduled for tomorrow</p>
            ) : (
              <>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {dashboard.tomorrowsJobs.jobs.map((job: any) => (
                    <Link key={job.id} href="/job-dashboard" asChild>
                      <div className="flex items-center justify-between p-2 sm:p-3 rounded-md border hover-elevate cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{job.address}</p>
                        </div>
                        <Badge variant="outline" className="ml-2 shrink-0">
                          {statusLabels[job.status] || job.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>

                {dashboard.tomorrowsJobs.total > 5 && (
                  <Link href="/dispatch" asChild>
                    <Button variant="outline" size="sm" className="w-full" data-testid="button-view-dispatch">
                      View Dispatch Board
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Staff Bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.staffBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff time logged today</p>
            ) : (
              <div className="space-y-2">
                {dashboard.staffBookings.map((staff: any) => (
                  <div 
                    key={staff.employeeId} 
                    className="flex items-center justify-between p-2 sm:p-3 rounded-md border"
                    data-testid={`staff-booking-${staff.employeeId}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{staff.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {staff.jobs.length} job{staff.jobs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{staff.totalHours.toFixed(1)}h</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Actions Detail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.pendingActions.total === 0 ? (
              <div className="flex items-center gap-2 text-green-600 p-3 rounded-md bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">All caught up!</span>
              </div>
            ) : (
              <div className="space-y-2">
                {dashboard.pendingActions.unansweredConversations > 0 && (
                  <Link href="/opportunities" asChild>
                    <div className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-orange-600" />
                        <span className="text-sm">Unanswered Messages</span>
                      </div>
                      <Badge variant="destructive">{dashboard.pendingActions.unansweredConversations}</Badge>
                    </div>
                  </Link>
                )}

                {dashboard.pendingActions.pendingQuotes > 0 && (
                  <Link href="/job-dashboard" asChild>
                    <div className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Pending Quotes</span>
                      </div>
                      <Badge variant="secondary">{dashboard.pendingActions.pendingQuotes}</Badge>
                    </div>
                  </Link>
                )}

                {dashboard.pendingActions.overdueInvoices > 0 && (
                  <Link href="/invoices" asChild>
                    <div className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Overdue Invoices</span>
                      </div>
                      <Badge variant="destructive">{dashboard.pendingActions.overdueInvoices}</Badge>
                    </div>
                  </Link>
                )}

                {dashboard.pendingActions.pendingIncidents > 0 && (
                  <Link href="/job-dashboard" asChild>
                    <div className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm">Safety Incidents</span>
                      </div>
                      <Badge variant="secondary">{dashboard.pendingActions.pendingIncidents}</Badge>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Indicators
          </CardTitle>
          <CardDescription>Key metrics for today's operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Job Completion Rate</p>
              <p className="text-2xl font-bold" data-testid="metric-completion-rate">
                {dashboard.performanceIndicators.completionRate}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg. Completion Time</p>
              <p className="text-2xl font-bold" data-testid="metric-completion-time">
                {dashboard.performanceIndicators.avgCompletionTimeHours}h
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg. Response Time</p>
              <p className="text-2xl font-bold" data-testid="metric-response-time">
                {dashboard.performanceIndicators.avgResponseTimeMinutes}m
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Feed */}
      {dashboard.recentActivities && dashboard.recentActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.recentActivities.map((activity: any, index: number) => (
                <div 
                  key={index} 
                  className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
                  data-testid={`activity-${index}`}
                >
                  <div className="mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.createdAt ? format(new Date(activity.createdAt), 'h:mm a') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

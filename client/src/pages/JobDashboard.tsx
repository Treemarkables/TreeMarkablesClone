import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Calendar, 
  MapPin, 
  Phone, 
  Mic, 
  Bot, 
  Plus, 
  Search,
  Clock,
  DollarSign,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  PhoneCall,
  Mail,
  Star,
  FileText,
  BarChart3,
  Activity,
  Zap,
  Eye
} from "lucide-react";

// Add Speech Recognition types for TypeScript
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

interface DashboardStats {
  totalLeads: number;
  totalCustomers: number;
  totalJobs: number;
  totalRevenue: number;
  conversionRate: number;
  averageQuoteValue: number;
  missedCalls: number;
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

const COLORS = ['#FF8042', '#0088FE', '#00C49F', '#FFBB28', '#8884D8', '#82CA9D'];

export default function JobDashboard() {
  const [isListening, setIsListening] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState("");
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showNewQuoteDialog, setShowNewQuoteDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const [dateRange, setDateRange] = useState("30d");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event: any) => {
        const command = event.results[0][0].transcript.toLowerCase();
        setVoiceCommand(command);
        processVoiceCommand(command);
        setIsListening(false);
      };
      
      recognitionInstance.onerror = () => {
        setIsListening(false);
        setVoiceCommand("Voice recognition not available in this browser");
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  // Data fetching queries
  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard-stats']
  });

  // Calculate from date for revenue stats
  const revenueFromDate = (() => {
    const days = parseInt(dateRange.replace('d', ''));
    return format(subDays(new Date(), days), 'yyyy-MM-dd');
  })();

  const { data: revenueStats, isLoading: revenueLoading } = useQuery<RevenueStats>({
    queryKey: ['/api/revenue-stats', { from: revenueFromDate }]
  });

  const { data: quoteAnalytics, isLoading: quotesLoading } = useQuery<QuoteAnalytics>({
    queryKey: ['/api/quote-analytics']
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers']
  });

  const { data: pipelineLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/pipeline-leads']
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs']
  });

  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ['/api/calls', { limit: 50 }]
  });

  const { data: quotes, isLoading: quotesDataLoading } = useQuery({
    queryKey: ['/api/quotes']
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/activities', { limit: 100 }]
  });

  // Enhanced lead analytics queries
  const { data: leadScoring, isLoading: leadScoringLoading } = useQuery({
    queryKey: ['/api/lead-scoring']
  });

  const { data: conversionFunnel, isLoading: conversionFunnelLoading } = useQuery({
    queryKey: ['/api/conversion-funnel']
  });

  const { data: followUpQueue, isLoading: followUpLoading } = useQuery({
    queryKey: ['/api/follow-up-queue']
  });

  const { data: leadSourceAnalysis, isLoading: leadSourceLoading } = useQuery({
    queryKey: ['/api/lead-source-analysis']
  });

  // Mutations for creating new records
  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/pipeline-leads', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      setShowNewLeadDialog(false);
      toast({
        title: "Success",
        description: "Lead created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create lead: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/jobs', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      setShowNewJobDialog(false);
      toast({
        title: "Success",
        description: "Job created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create job: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/quotes', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quote-analytics'] });
      setShowNewQuoteDialog(false);
      toast({
        title: "Success",
        description: "Quote created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create quote: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const processVoiceCommand = (command: string) => {
    if (command.includes('create job') || command.includes('new job')) {
      setShowNewJobDialog(true);
    } else if (command.includes('create lead') || command.includes('new lead')) {
      setShowNewLeadDialog(true);
    } else if (command.includes('create quote') || command.includes('new quote')) {
      setShowNewQuoteDialog(true);
    } else if (command.includes('show jobs') || command.includes('view jobs')) {
      // Switch to jobs tab
      const jobsTab = document.querySelector('[data-testid="tab-jobs"]') as HTMLButtonElement;
      jobsTab?.click();
    } else if (command.includes('show analytics') || command.includes('view analytics')) {
      const analyticsTab = document.querySelector('[data-testid="tab-analytics"]') as HTMLButtonElement;
      analyticsTab?.click();
    }
  };

  const startListening = () => {
    if (recognition) {
      setIsListening(true);
      recognition.start();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'scheduled': return 'bg-purple-500';
      case 'cancelled': return 'bg-red-500';
      case 'accepted': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'sent': return 'bg-yellow-500';
      case 'draft': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', { 
      style: 'currency', 
      currency: 'NZD',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  // Calculate conversion funnel data
  const conversionFunnelData = [
    { name: 'Website Visits', value: (dashboardStats?.totalLeads || 0) * 10, color: '#8884D8' },
    { name: 'Leads Generated', value: dashboardStats?.totalLeads || 0, color: '#82CA9D' },
    { name: 'Quotes Sent', value: quoteAnalytics?.totalQuotes || 0, color: '#FFC658' },
    { name: 'Jobs Won', value: quoteAnalytics?.acceptedQuotes || 0, color: '#FF7C7C' },
    { name: 'Jobs Completed', value: revenueStats?.jobsCompleted || 0, color: '#8DD1E1' }
  ];

  if (statsLoading || revenueLoading || quotesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" data-testid="job-dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-8 w-8 text-orange-600" />
              Treemarkables Business Intelligence
            </h1>
            <p className="text-gray-600 mt-1">Complete business management and analytics dashboard</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="365d">Last year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              onClick={startListening}
              variant={isListening ? "destructive" : "outline"}
              size="sm"
              className="flex items-center gap-2"
              data-testid="button-voice-command"
            >
              <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
              {isListening ? 'Listening...' : 'Voice Command'}
            </Button>
          </div>
        </div>

        {/* Voice Command Feedback */}
        {voiceCommand && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-orange-600" />
                <span className="text-sm text-gray-700">Command: "{voiceCommand}"</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover-elevate" data-testid="card-total-revenue">
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
              <PhoneCall className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{dashboardStats?.missedCalls || 0}</div>
              <p className="text-xs text-muted-foreground">
                Potential leads lost
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 h-auto p-1">
            <TabsTrigger value="overview" data-testid="tab-overview" className="min-h-12 sm:min-h-10 text-sm px-2">
              Overview
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads" className="min-h-12 sm:min-h-10 text-sm px-2">
              Leads
            </TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs" className="min-h-12 sm:min-h-10 text-sm px-2">
              Jobs
            </TabsTrigger>
            <TabsTrigger value="quotes" data-testid="tab-quotes" className="min-h-12 sm:min-h-10 text-sm px-2">
              Quotes
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers" className="min-h-12 sm:min-h-10 text-sm px-2">
              Customers
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics" className="min-h-12 sm:min-h-10 text-sm px-2">
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Revenue Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Revenue Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueStats?.monthlyTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                      <Area type="monotone" dataKey="revenue" stroke="#FF8042" fill="#FF8042" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Lead Conversion Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={conversionFunnelData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884D8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quote Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Quote Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Accepted', value: quoteAnalytics?.acceptedQuotes || 0, color: COLORS[0] },
                          { name: 'Rejected', value: quoteAnalytics?.rejectedQuotes || 0, color: COLORS[1] },
                          { name: 'Pending', value: quoteAnalytics?.pendingQuotes || 0, color: COLORS[2] }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Accepted', value: quoteAnalytics?.acceptedQuotes || 0 },
                          { name: 'Rejected', value: quoteAnalytics?.rejectedQuotes || 0 },
                          { name: 'Pending', value: quoteAnalytics?.pendingQuotes || 0 }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(activities || []).slice(0, 10).map((activity: any, index: number) => (
                      <div key={activity.id || index} className="flex items-center space-x-3 text-sm">
                        <div className="flex-shrink-0">
                          {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-500" />}
                          {activity.type === 'email' && <Mail className="h-4 w-4 text-green-500" />}
                          {activity.type === 'note' && <MessageSquare className="h-4 w-4 text-yellow-500" />}
                          {activity.type === 'quote_sent' && <FileText className="h-4 w-4 text-purple-500" />}
                        </div>
                        <div className="flex-grow">
                          <p className="text-gray-900">{activity.subject || activity.type}</p>
                          <p className="text-gray-500 text-xs">
                            {activity.createdAt && format(new Date(activity.createdAt), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-6">
            {/* Enhanced Lead Management Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Lead Management</h2>
                <p className="text-muted-foreground">AI-powered lead scoring, conversion tracking, and pipeline optimization</p>
              </div>
              <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2" data-testid="button-new-lead">
                    <Plus className="h-4 w-4" />
                    New Lead
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Lead</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createLeadMutation.mutate({
                      name: formData.get('name'),
                      phone: formData.get('phone'),
                      email: formData.get('email'),
                      address: formData.get('address'),
                      serviceRequested: formData.get('serviceRequested'),
                      urgency: formData.get('urgency'),
                      status: 'new',
                      source: 'manual_entry',
                      notes: formData.get('notes')
                    });
                  }} className="space-y-4">
                    <Input name="name" placeholder="Customer Name" required data-testid="input-lead-name" />
                    <Input name="phone" placeholder="Phone Number" required data-testid="input-lead-phone" />
                    <Input name="email" placeholder="Email Address" data-testid="input-lead-email" />
                    <Input name="address" placeholder="Address" data-testid="input-lead-address" />
                    <Input name="serviceRequested" placeholder="Service Requested" data-testid="input-service-requested" />
                    <Select name="urgency">
                      <SelectTrigger data-testid="select-urgency">
                        <SelectValue placeholder="Urgency Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea name="notes" placeholder="Additional Notes" data-testid="textarea-notes" />
                    <Button type="submit" className="w-full" data-testid="button-create-lead">
                      Create Lead
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Follow-Up Queue - Critical Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-red-50 border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    Overdue Follow-ups ({(followUpQueue?.overdue || []).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(followUpQueue?.overdue || []).map((lead: any) => (
                      <div key={lead.id} className="p-2 bg-white rounded border hover-elevate cursor-pointer">
                        <div className="font-medium text-sm">{lead.name}</div>
                        <div className="text-xs text-gray-600">{lead.phone}</div>
                        <div className="text-xs text-red-600">Due: {format(new Date(lead.followUpDate), 'PP')}</div>
                      </div>
                    )) || <div className="text-sm text-gray-500">No overdue follow-ups</div>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-700">
                    <Clock className="h-5 w-5" />
                    Today ({(followUpQueue?.today || []).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(followUpQueue?.today || []).map((lead: any) => (
                      <div key={lead.id} className="p-2 bg-white rounded border hover-elevate cursor-pointer">
                        <div className="font-medium text-sm">{lead.name}</div>
                        <div className="text-xs text-gray-600">{lead.phone}</div>
                        <div className="text-xs text-yellow-600">{lead.serviceRequested}</div>
                      </div>
                    )) || <div className="text-sm text-gray-500">No follow-ups today</div>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Calendar className="h-5 w-5" />
                    This Week ({(followUpQueue?.thisWeek || []).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(followUpQueue?.thisWeek || []).map((lead: any) => (
                      <div key={lead.id} className="p-2 bg-white rounded border hover-elevate cursor-pointer">
                        <div className="font-medium text-sm">{lead.name}</div>
                        <div className="text-xs text-gray-600">{lead.phone}</div>
                        <div className="text-xs text-blue-600">Due: {format(new Date(lead.followUpDate), 'PP')}</div>
                      </div>
                    )) || <div className="text-sm text-gray-500">No follow-ups this week</div>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lead Scoring & Conversion Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Priority Leads */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    High-Priority Leads
                  </CardTitle>
                  <CardDescription>AI-scored leads requiring immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(leadScoring || []).filter((lead: any) => lead.priority === 'hot').slice(0, 5).map((lead: any) => (
                      <div key={lead.id} className="p-3 border rounded-lg hover-elevate cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{lead.name}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">
                              {lead.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Score: {lead.score}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{lead.phone}</p>
                        <p className="text-xs text-gray-500">{lead.serviceRequested}</p>
                        {lead.estimatedValue && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            Est. Value: {formatCurrency(Number(lead.estimatedValue))}
                          </p>
                        )}
                      </div>
                    )) || <div className="text-sm text-gray-500">No high priority leads</div>}
                  </div>
                </CardContent>
              </Card>

              {/* Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Conversion Funnel
                  </CardTitle>
                  <CardDescription>Lead progression and conversion rates</CardDescription>
                </CardHeader>
                <CardContent>
                  {conversionFunnel && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Leads</span>
                          <span className="text-sm">{conversionFunnel.leads}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Contacted</span>
                          <span className="text-sm">{conversionFunnel.contacted} ({conversionFunnel.conversionRates.leadToContact.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${conversionFunnel.conversionRates.leadToContact}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Qualified</span>
                          <span className="text-sm">{conversionFunnel.qualified} ({conversionFunnel.conversionRates.contactToQualified.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: `${conversionFunnel.conversionRates.contactToQualified}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Quoted</span>
                          <span className="text-sm">{conversionFunnel.quoted} ({conversionFunnel.conversionRates.qualifiedToQuote.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${conversionFunnel.conversionRates.qualifiedToQuote}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Won</span>
                          <span className="text-sm">{conversionFunnel.won} ({conversionFunnel.conversionRates.quoteToWin.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-red-600 h-2 rounded-full" style={{ width: `${conversionFunnel.conversionRates.quoteToWin}%` }}></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center font-medium">
                          <span className="text-sm">Overall Conversion</span>
                          <span className="text-sm text-green-600">{conversionFunnel.conversionRates.overallConversion.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lead Source Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Lead Source Performance
                </CardTitle>
                <CardDescription>ROI and conversion rates by marketing channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Source</th>
                        <th className="text-right p-2">Leads</th>
                        <th className="text-right p-2">Conversion</th>
                        <th className="text-right p-2">Avg Value</th>
                        <th className="text-right p-2">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(leadSourceAnalysis || []).map((source: any) => (
                        <tr key={source.source} className="border-b hover-elevate">
                          <td className="p-2 font-medium capitalize">{source.source}</td>
                          <td className="p-2 text-right">{source.count}</td>
                          <td className="p-2 text-right">{source.conversionRate.toFixed(1)}%</td>
                          <td className="p-2 text-right">{formatCurrency(source.averageValue)}</td>
                          <td className={`p-2 text-right font-medium ${source.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {source.roi.toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Job Management</h2>
              <Dialog open={showNewJobDialog} onOpenChange={setShowNewJobDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2" data-testid="button-new-job">
                    <Plus className="h-4 w-4" />
                    New Job
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Job</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createJobMutation.mutate({
                      jobNumber: `JOB-${Date.now()}`,
                      title: formData.get('title'),
                      description: formData.get('description'),
                      address: formData.get('address'),
                      status: 'scheduled',
                      priority: formData.get('priority'),
                      scheduledDate: formData.get('scheduledDate'),
                      totalAmount: formData.get('amount')
                    });
                  }} className="space-y-4">
                    <Input name="title" placeholder="Job Title" required data-testid="input-job-title" />
                    <Textarea name="description" placeholder="Job Description" data-testid="textarea-job-description" />
                    <Input name="address" placeholder="Job Address" required data-testid="input-job-address" />
                    <Select name="priority">
                      <SelectTrigger data-testid="select-job-priority">
                        <SelectValue placeholder="Priority Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input name="scheduledDate" type="datetime-local" data-testid="input-scheduled-date" />
                    <Input name="amount" type="number" placeholder="Job Amount ($)" data-testid="input-job-amount" />
                    <Button type="submit" className="w-full" data-testid="button-create-job">
                      Create Job
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(jobs || []).map((job: any) => (
                <Card key={job.id} className="hover-elevate cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{job.title}</span>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700">{job.address}</span>
                      </div>
                      {job.scheduledDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">
                            {format(new Date(job.scheduledDate), 'PPP')}
                          </span>
                        </div>
                      )}
                      {job.totalAmount && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700 font-medium">
                            {formatCurrency(Number(job.totalAmount))}
                          </span>
                        </div>
                      )}
                      {job.priority && (
                        <Badge variant="secondary" className={`text-xs ${getPriorityColor(job.priority)}`}>
                          {job.priority} priority
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Quote Management</h2>
              <Dialog open={showNewQuoteDialog} onOpenChange={setShowNewQuoteDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2" data-testid="button-new-quote">
                    <Plus className="h-4 w-4" />
                    New Quote
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Quote</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createQuoteMutation.mutate({
                      quoteNumber: `Q-${Date.now()}`,
                      description: formData.get('description'),
                      amount: formData.get('amount'),
                      status: 'draft',
                      validUntil: formData.get('validUntil'),
                      terms: formData.get('terms')
                    });
                  }} className="space-y-4">
                    <Textarea name="description" placeholder="Quote Description" required data-testid="textarea-quote-description" />
                    <Input name="amount" type="number" placeholder="Quote Amount ($)" required data-testid="input-quote-amount" />
                    <Input name="validUntil" type="date" placeholder="Valid Until" data-testid="input-valid-until" />
                    <Textarea name="terms" placeholder="Terms and Conditions" data-testid="textarea-quote-terms" />
                    <Button type="submit" className="w-full" data-testid="button-create-quote">
                      Create Quote
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(quotes || []).map((quote: any) => (
                <Card key={quote.id} className="hover-elevate cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{quote.quoteNumber}</span>
                      <Badge className={getStatusColor(quote.status)}>
                        {quote.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-700">{quote.description}</p>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(Number(quote.amount))}
                        </span>
                      </div>
                      {quote.validUntil && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">
                            Valid until {format(new Date(quote.validUntil), 'PP')}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Customer Management</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search customers..." 
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-customers"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(customers || [])
                .filter((customer: any) => 
                  customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  customer.phone?.includes(searchTerm)
                )
                .map((customer: any) => (
                  <Card key={customer.id} className="hover-elevate cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">{customer.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-700">{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-700">{customer.email}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-700">{customer.address}</span>
                          </div>
                        )}
                        {customer.lifetimeValue && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-700 font-medium">
                              {formatCurrency(Number(customer.lifetimeValue))} lifetime value
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Advanced Analytics
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Monthly Jobs and Revenue */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueStats?.monthlyTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="jobs" fill="#8884D8" name="Jobs Completed" />
                      <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#FF8042" name="Revenue" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quote Rejection Reasons */}
              <Card>
                <CardHeader>
                  <CardTitle>Quote Rejection Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={quoteAnalytics?.rejectionReasons || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="reason" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#FF8042" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Competitor Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Competitor Win Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(quoteAnalytics?.competitorAnalysis || []).map((comp, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{comp.competitor}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{formatCurrency(comp.averagePrice)}</span>
                          <Badge variant={comp.winRate > 50 ? "destructive" : "default"}>
                            {comp.winRate.toFixed(1)}% win rate
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Key Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Average Response Time</span>
                      <span className="font-bold">{quoteAnalytics?.averageResponseTime?.toFixed(1) || 0} days</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Quote Acceptance Rate</span>
                      <span className="font-bold">
                        {quoteAnalytics?.totalQuotes ? 
                          ((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1) 
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Average Job Value</span>
                      <span className="font-bold">{formatCurrency(revenueStats?.averageJobValue || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Customer Retention</span>
                      <span className="font-bold">85%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
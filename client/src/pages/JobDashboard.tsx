import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Eye,
  Upload,
  Download,
  Database,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Camera,
  Image,
  Settings,
  Shield,
  Bell,
  Globe,
  Palette
} from "lucide-react";
import PhotoUpload from "@/components/PhotoUpload";
import { NotificationBell } from "@/components/NotificationBell";

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
  const [showCsvImportDialog, setShowCsvImportDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const [dateRange, setDateRange] = useState("30d");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<'customers' | 'jobs' | 'quotes'>('customers');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResults, setImportResults] = useState<any>(null);
  
  // Mobile optimization states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  
  // Photo management states
  const [selectedJobForPhotos, setSelectedJobForPhotos] = useState<string | null>(null);
  const [showPhotosDialog, setShowPhotosDialog] = useState(false);
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // CSV Import Mutation
  const csvImportMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'customers' | 'jobs' | 'quotes' }) => {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch(`/api/import/${type}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setImportResults(data);
      toast({
        title: "Import Successful",
        description: data.message,
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  // CSV Import file handling
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    // Start import
    setUploadProgress(0);
    setImportResults(null);
    csvImportMutation.mutate({ file, type: importType });
  };

  const handleImportDialogClose = () => {
    setShowCsvImportDialog(false);
    setImportResults(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

  // CSV Export functions
  const handleExportData = async (type: 'leads' | 'customers' | 'jobs' | 'quotes' | 'analytics') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export/${type}`);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `${type}_export.csv`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsExporting(true);
    try {
      // Generate comprehensive report with analytics data
      await handleExportData('analytics');
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: "Report Generation Failed", 
        description: "There was an error generating the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-gradient-to-r from-orange-500 to-red-500 shadow-lg';
      case 'medium': return 'bg-gradient-to-r from-yellow-500 to-orange-400 shadow-lg';
      case 'low': return 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg';
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
      <div className="min-h-screen bg-gradient-to-br from-pink-300 via-purple-300 via-blue-300 via-cyan-300 via-green-300 via-yellow-300 to-orange-300 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-300 via-purple-300 via-blue-300 via-cyan-300 via-green-300 via-yellow-300 to-orange-300 p-4" data-testid="job-dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Mobile-Optimized Header */}
        <div className="space-y-4 card-colorful rounded-2xl p-6">
          {/* Top Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-pink-600" />
              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Treemarkables
                </h1>
                <p className="text-xs sm:text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 via-purple-500 to-blue-500 hidden sm:block animate-pulse">Business Intelligence Dashboard</p>
              </div>
            </div>
            
            {/* Mobile Menu Toggle */}
            <Button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              variant="outline"
              size="sm"
              className="md:hidden"
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>

            {/* Desktop Controls */}
            <div className="hidden md:flex items-center gap-2">
              <NotificationBell />
              
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
                onClick={() => setShowCsvImportDialog(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                data-testid="button-csv-import"
              >
                <Database className="h-4 w-4" />
                <span className="hidden lg:inline">Import ServiceM8</span>
                <span className="lg:hidden">Import</span>
              </Button>
              
              <Button
                onClick={startListening}
                variant={isListening ? "destructive" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                data-testid="button-voice-command"
              >
                <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
                <span className="hidden lg:inline">{isListening ? 'Listening...' : 'Voice Command'}</span>
              </Button>
            </div>
          </div>

          {/* Mobile Controls Menu */}
          {isMobileMenuOpen && (
            <Card className="md:hidden border-4 border-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-gradient-to-br from-pink-200 via-purple-200 via-blue-200 to-cyan-200 shadow-2xl">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Date Range</label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                        <SelectItem value="365d">Last year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => {
                        setShowCsvImportDialog(true);
                        setIsMobileMenuOpen(false);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 justify-center"
                      data-testid="button-csv-import-mobile"
                    >
                      <Database className="h-4 w-4" />
                      Import ServiceM8
                    </Button>
                    
                    <Button
                      onClick={() => {
                        startListening();
                        setIsMobileMenuOpen(false);
                      }}
                      variant={isListening ? "destructive" : "outline"}
                      size="sm"
                      className="flex items-center gap-2 justify-center"
                      data-testid="button-voice-command-mobile"
                    >
                      <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
                      {isListening ? 'Listening...' : 'Voice Command'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Voice Command Feedback */}
        {voiceCommand && (
          <Card className="border-4 border-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 bg-gradient-to-br from-yellow-200 via-orange-200 via-pink-200 to-red-200 shadow-2xl animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 icon-colorful" />
                <span className="text-sm text-gray-700">Command: "{voiceCommand}"</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Collapsible Key Performance Indicators */}
        <div className="space-y-4">
          <div className="flex items-center justify-between md:hidden">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Key Metrics
            </h2>
            <Button
              onClick={() => setKpiCollapsed(!kpiCollapsed)}
              variant="ghost"
              size="sm"
              className="p-1"
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
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-7 h-auto p-1 bg-gradient-to-r from-pink-400 via-purple-400 via-blue-400 via-cyan-400 via-green-400 via-yellow-400 to-orange-400 dark:from-pink-600 dark:via-purple-600 dark:via-blue-600 dark:via-cyan-600 dark:via-green-600 dark:via-yellow-600 dark:to-orange-600 border-4 border-white shadow-2xl rounded-2xl">
            <TabsTrigger value="overview" data-testid="tab-overview" className="min-h-12 sm:min-h-10 text-sm px-2 text-rainbow">
              🌟 Overview
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads" className="min-h-12 sm:min-h-10 text-sm px-2 text-rainbow">
              🎯 Leads
            </TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs" className="min-h-12 sm:min-h-10 text-sm px-2 text-rainbow">
              🌳 Jobs
            </TabsTrigger>
            <TabsTrigger value="quotes" data-testid="tab-quotes" className="min-h-12 sm:min-h-10 text-sm px-2 text-rainbow">
              📋 Quotes
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers" className="min-h-12 sm:min-h-10 text-sm px-2 text-rainbow">
              👥 Customers
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics" className="min-h-12 sm:min-h-10 text-sm px-2 text-rainbow">
              📊 Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings" className="min-h-12 sm:min-h-10 text-sm px-2 text-rainbow">
              ⚙️ Settings
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
                    {Array.isArray(activities) ? activities.slice(0, 10).map((activity: any, index: number) => (
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
                    )) : <div className="text-sm text-gray-500">No recent activity</div>}
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
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={() => handleExportData('leads')}
                  disabled={isExporting}
                  data-testid="button-export-leads"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
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
            </div>

            {/* Follow-Up Queue - Critical Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-red-50 border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    Overdue Follow-ups ({Array.isArray((followUpQueue as any)?.overdue) ? (followUpQueue as any).overdue.length : 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Array.isArray((followUpQueue as any)?.overdue) ? (followUpQueue as any).overdue.map((lead: any) => (
                      <div key={lead.id} className="p-2 bg-white rounded border hover-elevate cursor-pointer">
                        <div className="font-medium text-sm">{lead.name}</div>
                        <div className="text-xs text-gray-600">{lead.phone}</div>
                        <div className="text-xs text-red-600">Due: {format(new Date(lead.followUpDate), 'PP')}</div>
                      </div>
                    )) : <div className="text-sm text-gray-500">No overdue follow-ups</div>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-700">
                    <Clock className="h-5 w-5" />
                    Today ({Array.isArray((followUpQueue as any)?.today) ? (followUpQueue as any).today.length : 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Array.isArray((followUpQueue as any)?.today) ? (followUpQueue as any).today.map((lead: any) => (
                      <div key={lead.id} className="p-2 bg-white rounded border hover-elevate cursor-pointer">
                        <div className="font-medium text-sm">{lead.name}</div>
                        <div className="text-xs text-gray-600">{lead.phone}</div>
                        <div className="text-xs text-yellow-600">{lead.serviceRequested}</div>
                      </div>
                    )) : <div className="text-sm text-gray-500">No follow-ups today</div>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Calendar className="h-5 w-5" />
                    This Week ({Array.isArray((followUpQueue as any)?.thisWeek) ? (followUpQueue as any).thisWeek.length : 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Array.isArray((followUpQueue as any)?.thisWeek) ? (followUpQueue as any).thisWeek.map((lead: any) => (
                      <div key={lead.id} className="p-2 bg-white rounded border hover-elevate cursor-pointer">
                        <div className="font-medium text-sm">{lead.name}</div>
                        <div className="text-xs text-gray-600">{lead.phone}</div>
                        <div className="text-xs text-blue-600">Due: {format(new Date(lead.followUpDate), 'PP')}</div>
                      </div>
                    )) : <div className="text-sm text-gray-500">No follow-ups this week</div>}
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
                    {Array.isArray(leadScoring) ? leadScoring.filter((lead: any) => lead.priority === 'hot').slice(0, 5).map((lead: any) => (
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
                    )) : <div className="text-sm text-gray-500">No high priority leads</div>}
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
                  {conversionFunnel && typeof conversionFunnel === 'object' && 'leads' in conversionFunnel ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Leads</span>
                          <span className="text-sm">{(conversionFunnel as any).leads || 0}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Contacted</span>
                          <span className="text-sm">{(conversionFunnel as any).contacted || 0} ({((conversionFunnel as any).conversionRates?.leadToContact || 0).toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${(conversionFunnel as any).conversionRates?.leadToContact || 0}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Qualified</span>
                          <span className="text-sm">{(conversionFunnel as any).qualified || 0} ({((conversionFunnel as any).conversionRates?.contactToQualified || 0).toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-600 h-2 rounded-full" style={{ width: `${(conversionFunnel as any).conversionRates?.contactToQualified || 0}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Quoted</span>
                          <span className="text-sm">{(conversionFunnel as any).quoted || 0} ({((conversionFunnel as any).conversionRates?.qualifiedToQuote || 0).toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${(conversionFunnel as any).conversionRates?.qualifiedToQuote || 0}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Won</span>
                          <span className="text-sm">{(conversionFunnel as any).won || 0} ({((conversionFunnel as any).conversionRates?.quoteToWin || 0).toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-red-600 h-2 rounded-full" style={{ width: `${(conversionFunnel as any).conversionRates?.quoteToWin || 0}%` }}></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center font-medium">
                          <span className="text-sm">Overall Conversion</span>
                          <span className="text-sm text-green-600">{((conversionFunnel as any).conversionRates?.overallConversion || 0).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No conversion data available</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* All Pipeline Leads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Pipeline Leads
                </CardTitle>
                <CardDescription>Current leads in your sales pipeline</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(() => {
                    console.log('Pipeline leads data:', pipelineLeads);
                    const leadsArray = Array.isArray(pipelineLeads) ? pipelineLeads : (pipelineLeads?.data || []);
                    console.log('Processed leads array:', leadsArray);
                    
                    if (leadsLoading) {
                      return (
                        <div className="col-span-full text-center text-gray-500 py-8">
                          Loading leads...
                        </div>
                      );
                    }
                    
                    if (!leadsArray || leadsArray.length === 0) {
                      return (
                        <div className="col-span-full text-center text-gray-500 py-8">
                          No pipeline leads found
                        </div>
                      );
                    }
                    
                    return leadsArray.map((lead: any) => (
                      <Card key={lead.id} className="border-2 hover-elevate cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-lg">{lead.name}</h4>
                            <Badge className={
                              lead.status === 'new' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                              lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                              lead.status === 'qualified' ? 'bg-green-100 text-green-800 border-green-300' :
                              'bg-gray-100 text-gray-800 border-gray-300'
                            }>
                              {lead.status}
                            </Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-500" />
                              <span>{lead.phone}</span>
                            </div>
                            {lead.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-green-500" />
                                <span>{lead.email}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-purple-500" />
                              <span>{lead.serviceRequested || 'Service not specified'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-orange-500" />
                              <span className="capitalize">{lead.source} • {lead.priority} priority</span>
                            </div>
                            {lead.followUpDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-red-500" />
                                <span>Follow-up: {format(new Date(lead.followUpDate), 'PP')}</span>
                              </div>
                            )}
                            {lead.notes && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                {lead.notes}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

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
                      {Array.isArray(leadSourceAnalysis) ? leadSourceAnalysis.map((source: any) => (
                        <tr key={source.source} className="border-b hover-elevate">
                          <td className="p-2 font-medium capitalize">{source.source}</td>
                          <td className="p-2 text-right">{source.count}</td>
                          <td className="p-2 text-right">{source.conversionRate.toFixed(1)}%</td>
                          <td className="p-2 text-right">{formatCurrency(source.averageValue)}</td>
                          <td className={`p-2 text-right font-medium ${source.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {source.roi.toFixed(0)}%
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-gray-500">No lead source data available</td>
                        </tr>
                      )}
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
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={() => handleExportData('jobs')}
                  disabled={isExporting}
                  data-testid="button-export-jobs"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(jobs) ? jobs.map((job: any) => (
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
                      
                      {/* Photo indicators */}
                      <div className="flex items-center gap-4 pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Camera className="h-3 w-3" />
                          Before: {job.beforePhotos?.length || 0}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Image className="h-3 w-3" />
                          After: {job.afterPhotos?.length || 0}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJobForPhotos(job.id);
                          setShowPhotosDialog(true);
                        }}
                        data-testid={`button-manage-photos-${job.id}`}
                      >
                        <Camera className="h-3 w-3 mr-1" />
                        Photos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        data-testid={`button-view-job-${job.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )) : []}
            </div>
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Quote Management</h2>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={() => handleExportData('quotes')}
                  disabled={isExporting}
                  data-testid="button-export-quotes"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(quotes) ? quotes.map((quote: any) => (
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
              )) : []}
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Customer Management</h2>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={() => handleExportData('customers')}
                  disabled={isExporting}
                  data-testid="button-export-customers"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(customers) ? 
                customers
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
                  ))
                : 
                <div className="text-center text-gray-500 py-8">No customers found</div>
              }
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-rainbow">
                <BarChart3 className="h-6 w-6" />
                Advanced Business Intelligence
              </h2>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={() => handleExportData('analytics')}
                  disabled={isExporting}
                  data-testid="button-export-analytics"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleGenerateReport}
                  disabled={isExporting}
                  data-testid="button-generate-report"
                >
                  📊 {isExporting ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </div>

            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-2 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Monthly Growth</p>
                      <p className="text-2xl font-bold text-blue-900">+24%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">Conversion Rate</p>
                      <p className="text-2xl font-bold text-green-900">67%</p>
                    </div>
                    <Target className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-700">Avg Response</p>
                      <p className="text-2xl font-bold text-purple-900">2.4h</p>
                    </div>
                    <Zap className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-700">Customer LTV</p>
                      <p className="text-2xl font-bold text-orange-900">{formatCurrency(4200)}</p>
                    </div>
                    <Users className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Enhanced Revenue Trend Chart */}
              <Card className="border-2 border-gradient-to-r from-blue-200 via-purple-200 to-pink-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Revenue Growth Trend
                  </CardTitle>
                  <CardDescription>Monthly revenue and job completion trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={[
                      { month: 'Oct', revenue: 15000, jobs: 12 },
                      { month: 'Nov', revenue: 18500, jobs: 15 },
                      { month: 'Dec', revenue: 22000, jobs: 18 },
                      { month: 'Jan', revenue: 16500, jobs: 13 },
                      { month: 'Feb', revenue: 24000, jobs: 20 },
                      { month: 'Mar', revenue: 28500, jobs: 23 }
                    ]}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255,255,255,0.95)', 
                          border: '2px solid #8884d8',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#8884d8" 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                        name="Revenue ($)"
                      />
                      <Line yAxisId="right" type="monotone" dataKey="jobs" stroke="#ff7c7c" strokeWidth={3} name="Jobs Completed" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Lead Source Distribution */}
              <Card className="border-2 border-gradient-to-r from-green-200 via-blue-200 to-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Lead Source Performance
                  </CardTitle>
                  <CardDescription>Distribution and conversion by source</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Google Ads', value: 45, fill: '#ff6b6b' },
                          { name: 'Facebook', value: 30, fill: '#4ecdc4' },
                          { name: 'Website', value: 20, fill: '#45b7d1' },
                          { name: 'Referral', value: 5, fill: '#f9ca24' }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              

              {/* Customer Lifetime Value Analysis */}
              <Card className="border-2 border-gradient-to-r from-yellow-200 via-orange-200 to-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-yellow-500" />
                    Customer Value Analysis
                  </CardTitle>
                  <CardDescription>Customer lifetime value distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { segment: 'High Value', customers: 12, avgValue: 8500, fill: '#ff6b6b' },
                      { segment: 'Medium Value', customers: 28, avgValue: 3200, fill: '#feca57' },
                      { segment: 'Low Value', customers: 45, avgValue: 1200, fill: '#48dbfb' },
                      { segment: 'New Customers', customers: 23, avgValue: 800, fill: '#ff9ff3' }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="segment" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255,255,255,0.95)', 
                          border: '2px solid #feca57',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="customers" name="Customer Count" fill="#feca57" />
                      <Line yAxisId="right" type="monotone" dataKey="avgValue" stroke="#ff6b6b" strokeWidth={3} name="Avg Value ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Advanced Conversion Funnel */}
              <Card className="border-2 border-gradient-to-r from-purple-200 via-pink-200 to-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    Advanced Conversion Funnel
                  </CardTitle>
                  <CardDescription>Lead progression through sales pipeline</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { stage: 'Website Visits', count: 1250, rate: 100, color: 'bg-blue-500' },
                      { stage: 'Leads Generated', count: 78, rate: 6.2, color: 'bg-green-500' },
                      { stage: 'Qualified Leads', count: 52, rate: 66.7, color: 'bg-yellow-500' },
                      { stage: 'Quotes Sent', count: 34, rate: 65.4, color: 'bg-orange-500' },
                      { stage: 'Jobs Won', count: 23, rate: 67.6, color: 'bg-red-500' }
                    ].map((stage, index) => (
                      <div key={index} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{stage.stage}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{stage.count}</span>
                            <Badge variant="outline" className="text-xs">
                              {stage.rate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full ${stage.color} transition-all duration-500`}
                            style={{ width: `${Math.min(stage.rate, 100)}%` }}
                          ></div>
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

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-rainbow">
                <Settings className="h-6 w-6" />
                Business Settings & Configuration
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  💾 Save Changes
                </Button>
                <Button variant="outline" size="sm">
                  🔄 Reset to Default
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Company Information */}
              <Card className="border-2 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    Company Information
                  </CardTitle>
                  <CardDescription>Basic business details and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Company Name</label>
                      <Input 
                        placeholder="Treemarkables Ltd." 
                        defaultValue="Treemarkables Ltd."
                        data-testid="input-company-name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">ABN/Tax Number</label>
                      <Input 
                        placeholder="12 345 678 901" 
                        defaultValue="12 345 678 901"
                        data-testid="input-tax-number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Business Address</label>
                    <Input 
                      placeholder="123 Kauri Street, Auckland, New Zealand" 
                      defaultValue="123 Kauri Street, Auckland, New Zealand"
                      data-testid="input-business-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Phone</label>
                      <Input 
                        placeholder="+64 9 123 4567" 
                        defaultValue="+64 9 123 4567"
                        data-testid="input-business-phone"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <Input 
                        placeholder="info@treemarkables.co.nz" 
                        defaultValue="info@treemarkables.co.nz"
                        data-testid="input-business-email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Website</label>
                    <Input 
                      placeholder="https://www.treemarkables.co.nz" 
                      defaultValue="https://www.treemarkables.co.nz"
                      data-testid="input-business-website"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card className="border-2 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-green-500" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Configure alerts and reminders</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">New Lead Notifications</p>
                        <p className="text-xs text-gray-600">Get alerted when new leads arrive</p>
                      </div>
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Follow-up Reminders</p>
                        <p className="text-xs text-gray-600">Daily reminders for overdue leads</p>
                      </div>
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Quote Expiry Alerts</p>
                        <p className="text-xs text-gray-600">3 days before quotes expire</p>
                      </div>
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Job Completion Reports</p>
                        <p className="text-xs text-gray-600">Weekly summary emails</p>
                      </div>
                      <Badge variant="secondary">Disabled</Badge>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <label className="text-sm font-medium text-gray-700">Email Frequency</label>
                    <Select defaultValue="daily">
                      <SelectTrigger data-testid="select-email-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="hourly">Every Hour</SelectItem>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                        <SelectItem value="weekly">Weekly Summary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* System Preferences */}
              <Card className="border-2 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-purple-500" />
                    System Preferences
                  </CardTitle>
                  <CardDescription>Display and interface options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Theme</label>
                    <Select defaultValue="rainbow">
                      <SelectTrigger data-testid="select-theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rainbow">🌈 Rainbow Theme</SelectItem>
                        <SelectItem value="light">☀️ Light Mode</SelectItem>
                        <SelectItem value="dark">🌙 Dark Mode</SelectItem>
                        <SelectItem value="auto">🔄 Auto (System)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Default View</label>
                    <Select defaultValue="overview">
                      <SelectTrigger data-testid="select-default-view">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overview">🌟 Overview Dashboard</SelectItem>
                        <SelectItem value="leads">🎯 Leads Pipeline</SelectItem>
                        <SelectItem value="jobs">🌳 Job Management</SelectItem>
                        <SelectItem value="analytics">📊 Analytics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Items per Page</label>
                    <Select defaultValue="20">
                      <SelectTrigger data-testid="select-page-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 items</SelectItem>
                        <SelectItem value="20">20 items</SelectItem>
                        <SelectItem value="50">50 items</SelectItem>
                        <SelectItem value="100">100 items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Date Format</label>
                    <Select defaultValue="dd/mm/yyyy">
                      <SelectTrigger data-testid="select-date-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/mm/yyyy">DD/MM/YYYY (NZ)</SelectItem>
                        <SelectItem value="mm/dd/yyyy">MM/DD/YYYY (US)</SelectItem>
                        <SelectItem value="yyyy-mm-dd">YYYY-MM-DD (ISO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Security & Access */}
              <Card className="border-2 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-500" />
                    Security & Access Control
                  </CardTitle>
                  <CardDescription>User permissions and data security</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Two-Factor Authentication</p>
                        <p className="text-xs text-gray-600">Enhanced account security</p>
                      </div>
                      <Badge variant="destructive">Setup Required</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Session Timeout</p>
                        <p className="text-xs text-gray-600">Auto-logout after inactivity</p>
                      </div>
                      <Badge variant="default">8 hours</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Data Backup</p>
                        <p className="text-xs text-gray-600">Automatic daily backups</p>
                      </div>
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <Button variant="outline" size="sm" className="w-full">
                      🔐 Change Password
                    </Button>
                  </div>
                  <div>
                    <Button variant="outline" size="sm" className="w-full">
                      🗃️ Export All Data
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Business Rules & Workflow */}
            <Card className="border-2 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-yellow-600" />
                  Business Rules & Workflow Automation
                </CardTitle>
                <CardDescription>Configure automatic processes and business logic</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Lead Management Rules */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Lead Management</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Auto-assign leads to</label>
                        <Select defaultValue="round-robin">
                          <SelectTrigger data-testid="select-lead-assignment">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="round-robin">Round Robin</SelectItem>
                            <SelectItem value="workload">By Workload</SelectItem>
                            <SelectItem value="manual">Manual Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Follow-up after (days)</label>
                        <Input type="number" defaultValue="3" data-testid="input-followup-days" />
                      </div>
                    </div>
                  </div>

                  {/* Quote Management Rules */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Quote Management</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Quote validity (days)</label>
                        <Input type="number" defaultValue="30" data-testid="input-quote-validity" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Discount threshold</label>
                        <Input type="number" defaultValue="10" placeholder="%" data-testid="input-discount-threshold" />
                      </div>
                    </div>
                  </div>

                  {/* Job Management Rules */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Job Management</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Require photos</label>
                        <Select defaultValue="both">
                          <SelectTrigger data-testid="select-photo-requirements">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">Before & After</SelectItem>
                            <SelectItem value="after">After Only</SelectItem>
                            <SelectItem value="optional">Optional</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Auto-invoice after</label>
                        <Select defaultValue="completion">
                          <SelectTrigger data-testid="select-auto-invoice">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completion">Job Completion</SelectItem>
                            <SelectItem value="24h">24 Hours</SelectItem>
                            <SelectItem value="manual">Manual Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

          </TabsContent>

        </Tabs>

        {/* CSV Import Dialog */}
        <Dialog open={showCsvImportDialog} onOpenChange={handleImportDialogClose}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Import from ServiceM8
              </DialogTitle>
              <CardDescription>
                Import your existing customers, jobs, and quotes from ServiceM8 CSV export files.
                This will help you migrate your data to the new system.
              </CardDescription>
            </DialogHeader>

            <div className="space-y-6">
              {!importResults && (
                <>
                  {/* Import Type Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">What would you like to import?</label>
                    <Select 
                      value={importType} 
                      onValueChange={(value: 'customers' | 'jobs' | 'quotes') => setImportType(value)}
                    >
                      <SelectTrigger data-testid="select-import-type">
                        <SelectValue placeholder="Select import type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customers">Customers</SelectItem>
                        <SelectItem value="jobs">Jobs</SelectItem>
                        <SelectItem value="quotes">Quotes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select CSV File</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center space-y-2">
                      <Database className="h-8 w-8 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Choose your ServiceM8 {importType} export CSV file
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="input-csv-file"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="flex items-center gap-2"
                        data-testid="button-select-file"
                        disabled={csvImportMutation.isPending}
                      >
                        <Upload className="h-4 w-4" />
                        {csvImportMutation.isPending ? 'Importing...' : 'Select File'}
                      </Button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-medium text-blue-900">How to export from ServiceM8:</h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal ml-4">
                      <li>Log into your ServiceM8 account</li>
                      <li>Navigate to the {importType} section</li>
                      <li>Click "Export" and select "CSV format"</li>
                      <li>Download the file and select it here</li>
                    </ol>
                  </div>

                  {csvImportMutation.isPending && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">Importing {importType}...</div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-orange-600 h-2 rounded-full animate-pulse w-full"></div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Import Results */}
              {importResults && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium">Import Complete</h3>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Successfully Imported:</span>
                      <span className="text-sm font-bold text-green-700">
                        {importResults.data.successfulImports} / {importResults.data.totalRows}
                      </span>
                    </div>

                    {importResults.data.errors.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">
                            {importResults.data.errors.length} Errors:
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {importResults.data.errors.slice(0, 5).map((error: any, index: number) => (
                            <div key={index} className="text-xs bg-amber-100 p-2 rounded">
                              Row {error.row}: {error.error}
                            </div>
                          ))}
                          {importResults.data.errors.length > 5 && (
                            <div className="text-xs text-amber-700 italic">
                              ... and {importResults.data.errors.length - 5} more errors
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={handleImportDialogClose}
                    className="w-full"
                    data-testid="button-close-import"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Job Photo Management Dialog */}
        <Dialog open={showPhotosDialog} onOpenChange={setShowPhotosDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Job Photo Documentation
              </DialogTitle>
              <DialogDescription>
                Upload before and after photos to document the work progress
              </DialogDescription>
            </DialogHeader>

            {selectedJobForPhotos && (
              <div className="space-y-6">
                {/* Before Photos Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-blue-600" />
                    Before Photos
                  </h3>
                  <PhotoUpload
                    jobId={selectedJobForPhotos}
                    type="before"
                    existingPhotos={jobs?.find((j: any) => j.id === selectedJobForPhotos)?.beforePhotos || []}
                    maxPhotos={8}
                  />
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Image className="h-5 w-5 text-green-600" />
                    After Photos  
                  </h3>
                  <PhotoUpload
                    jobId={selectedJobForPhotos}
                    type="after"
                    existingPhotos={jobs?.find((j: any) => j.id === selectedJobForPhotos)?.afterPhotos || []}
                    maxPhotos={8}
                  />
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => setShowPhotosDialog(false)}
                    data-testid="button-close-photos-dialog"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
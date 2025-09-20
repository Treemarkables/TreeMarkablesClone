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
import logoUrl from '@assets/treelogo_1758218149788.webp';
import { WeatherWidget } from "@/components/WeatherWidget";
import { CrewManagement } from "@/components/CrewManagement";
import { EquipmentTracker } from "@/components/EquipmentTracker";
import { InvoiceManager } from "@/components/InvoiceManager";
import { PhotoDocumentation } from "@/components/PhotoDocumentation";
import { SafetyReporting } from "@/components/SafetyReporting";
import { RouteOptimizer } from "@/components/RouteOptimizer";
import { PerformanceAnalytics } from "@/components/PerformanceAnalytics";
import { DispatchBoard } from "@/components/DispatchBoard";
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
  Palette,
  Briefcase,
  Save,
  RotateCcw,
  HardDrive,
  Wifi,
  Archive,
  Link as LinkIcon,
  Server,
  Cloud,
  CreditCard
} from "lucide-react";
import PhotoUpload from "@/components/PhotoUpload";
import { NotificationBell } from "@/components/NotificationBell";
import { CalendarView } from "@/components/CalendarView";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Link } from "wouter";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

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

// Single brand color palette
const BRAND_PRIMARY = 'hsl(var(--primary))';
const COLORS = [
  BRAND_PRIMARY,
  'hsl(var(--primary) / 0.8)',
  'hsl(var(--primary) / 0.6)', 
  'hsl(var(--primary) / 0.4)',
  'hsl(var(--primary) / 0.3)',
  'hsl(var(--muted-foreground))'
];

export default function JobDashboard() {
  const [isListening, setIsListening] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState("");
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [showNewQuoteDialog, setShowNewQuoteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
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
  
  // Photo management states
  const [selectedJobForPhotos, setSelectedJobForPhotos] = useState<string | null>(null);
  const [showPhotosDialog, setShowPhotosDialog] = useState(false);
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  
  // Search and filtering states
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<any[]>([]);
  
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
    queryKey: ['/api/dashboard-stats'],
    refetchInterval: 30000 // Refetch every 30 seconds for real-time updates
  });

  // Calculate from date for revenue stats
  const revenueFromDate = (() => {
    const days = parseInt(dateRange.replace('d', ''));
    return format(subDays(new Date(), days), 'yyyy-MM-dd');
  })();

  const { data: revenueStats, isLoading: revenueLoading } = useQuery<RevenueStats>({
    queryKey: ['/api/revenue-stats', revenueFromDate],
    queryFn: () => fetch(`/api/revenue-stats?from=${revenueFromDate}`).then(res => res.json())
  });

  const { data: quoteAnalytics, isLoading: quotesLoading } = useQuery<QuoteAnalytics>({
    queryKey: ['/api/quote-analytics']
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers']
  });

  const { data: pipelineLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/pipeline-leads'],
    refetchInterval: 30000 // Refetch every 30 seconds for lead updates
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs']
  });

  const jobs = jobsData?.data || [];

  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ['/api/calls', '50'],
    queryFn: () => fetch('/api/calls?limit=50').then(res => res.json())
  });

  const { data: quotes, isLoading: quotesDataLoading } = useQuery({
    queryKey: ['/api/quotes']
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/activities', '100'],
    queryFn: () => fetch('/api/activities?limit=100').then(res => res.json())
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
  const handleExportData = async (type: 'leads' | 'customers' | 'jobs' | 'quotes' | 'analytics' | 'performance') => {
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
      case 'urgent': return 'bg-orange-600';
      case 'high': return 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg';
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
      case 'cancelled': return 'bg-orange-600';
      case 'accepted': return 'bg-green-500';
      case 'rejected': return 'bg-orange-600';
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
    { name: 'Website Visits', value: (dashboardStats?.totalLeads || 0) * 10, color: 'hsl(var(--primary))' },
    { name: 'Leads Generated', value: dashboardStats?.totalLeads || 0, color: 'hsl(var(--primary) / 0.8)' },
    { name: 'Quotes Sent', value: quoteAnalytics?.totalQuotes || 0, color: 'hsl(var(--primary) / 0.6)' },
    { name: 'Jobs Won', value: quoteAnalytics?.acceptedQuotes || 0, color: 'hsl(var(--primary) / 0.4)' },
    { name: 'Jobs Completed', value: revenueStats?.jobsCompleted || 0, color: 'hsl(var(--primary) / 0.3)' }
  ];

  if (statsLoading || revenueLoading || quotesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-100 via-orange-200 via-orange-300 to-orange-400 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </div>
    );
  }

  const style = {
    "--sidebar-width": "9.6rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <SidebarInset>
          <div className="min-h-screen bg-gradient-to-br from-orange-100 via-orange-200 via-orange-300 to-orange-400 p-4" data-testid="job-dashboard">
            <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Mobile-Optimized Header */}
        <div className="space-y-4 card-colorful rounded-2xl p-6">
          {/* Top Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="lg:hidden" data-testid="button-sidebar-toggle" />
              <div className="lg:hidden flex items-center">
                <img 
                  src={logoUrl} 
                  alt="Treemarkables Logo" 
                  className="h-8 w-auto"
                  data-testid="logo-treemarkables"
                />
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
              
              <Link href="/metrics">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-metrics-dashboard"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden lg:inline">Metrics</span>
                </Button>
              </Link>
              
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
            <Card className="md:hidden border border-brand shadow-brand">
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
                    
                    <Link href="/metrics">
                      <Button
                        onClick={() => setIsMobileMenuOpen(false)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 justify-center w-full"
                        data-testid="button-metrics-dashboard-mobile"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Metrics Dashboard
                      </Button>
                    </Link>
                    
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

        {/* Compact Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-14 gap-1 h-auto p-2 bg-white/90 backdrop-blur-sm border border-orange-200 shadow-sm rounded-lg">
            <TabsTrigger value="overview" data-testid="tab-overview" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100 flex items-center gap-1">
              <Star className="h-3 w-3" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100 flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="quotes" data-testid="tab-quotes" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100">
              📋 Quotes
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100">
              👥 Customers
            </TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100">
              💰 Invoices
            </TabsTrigger>
            <TabsTrigger value="photos" data-testid="tab-photos" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100">
              📷 Photos
            </TabsTrigger>
            <TabsTrigger value="safety" data-testid="tab-safety" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100">
              🛡️ Safety
            </TabsTrigger>
            <TabsTrigger value="routes" data-testid="tab-routes" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100">
              🗺️ Routes
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100">
              📈 Performance
            </TabsTrigger>
            <TabsTrigger value="dispatch" data-testid="tab-dispatch" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100 flex items-center gap-1">
              <Users className="h-3 w-3" />
              Dispatch
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings" className="h-8 text-xs px-1 font-medium hover:bg-orange-50 data-[state=active]:bg-orange-100 flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Settings
            </TabsTrigger>
          </TabsList>

        {/* Voice Command Feedback */}
        {voiceCommand && (
          <Card className="border border-brand shadow-brand">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 icon-colorful" />
                <span className="text-sm text-gray-700">Command: "{voiceCommand}"</span>
              </div>
            </CardContent>
          </Card>
        )}

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            
            {/* Real-time Dashboard Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-lg hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90">Today's Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(revenueStats?.totalRevenue || 0)}</p>
                      <p className="text-xs opacity-80">+12% from yesterday</p>
                    </div>
                    <DollarSign className="h-8 w-8 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 shadow-lg hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90">Active Jobs</p>
                      <p className="text-2xl font-bold">{Array.isArray(jobs) ? jobs.filter((job: any) => job.status === 'in_progress' || job.status === 'scheduled').length : 0}</p>
                      <p className="text-xs opacity-80">3 scheduled today</p>
                    </div>
                    <Briefcase className="h-8 w-8 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-amber-600 text-white border-0 shadow-lg hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90">Hot Leads</p>
                      <p className="text-2xl font-bold">{Array.isArray(leadScoring) ? leadScoring.filter((lead: any) => lead.priority === 'hot').length : 0}</p>
                      <p className="text-xs opacity-80">Need immediate attention</p>
                    </div>
                    <Target className="h-8 w-8 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0 shadow-lg hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium opacity-90">Pending Quotes</p>
                      <p className="text-2xl font-bold">{quoteAnalytics?.pendingQuotes || 0}</p>
                      <p className="text-xs opacity-80">Awaiting client response</p>
                    </div>
                    <FileText className="h-8 w-8 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Priority Alerts & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="h-5 w-5" />
                    Priority Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardStats?.missedCalls && dashboardStats.missedCalls > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                        <PhoneCall className="h-4 w-4 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium">Missed Calls</p>
                          <p className="text-xs text-gray-600">{dashboardStats.missedCalls} potential leads need follow-up</p>
                        </div>
                      </div>
                    )}
                    {Array.isArray((followUpQueue as any)?.overdue) && (followUpQueue as any).overdue.length > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                        <Clock className="h-4 w-4 text-red-600" />
                        <div>
                          <p className="text-sm font-medium">Overdue Follow-ups</p>
                          <p className="text-xs text-gray-600">{(followUpQueue as any).overdue.length} leads require immediate attention</p>
                        </div>
                      </div>
                    )}
                    {quoteAnalytics?.pendingQuotes && quoteAnalytics.pendingQuotes > 5 && (
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                        <FileText className="h-4 w-4 text-yellow-600" />
                        <div>
                          <p className="text-sm font-medium">Quote Backlog</p>
                          <p className="text-xs text-gray-600">{quoteAnalytics.pendingQuotes} quotes pending response</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <Zap className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white h-auto py-3 flex flex-col items-center gap-1"
                      onClick={() => setShowNewLeadDialog(true)}
                      data-testid="quick-new-lead"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-xs">New Lead</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-blue-50"
                      onClick={() => setShowNewJobDialog(true)}
                      data-testid="quick-new-job"
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">Schedule Job</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-purple-50"
                      onClick={() => setActiveTab('quotes')}
                      data-testid="quick-view-quotes"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="text-xs">Send Quote</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-orange-50"
                      onClick={() => setActiveTab('analytics')}
                      data-testid="quick-view-analytics"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs">View Reports</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Weather, Crew & Equipment Status Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <WeatherWidget compact={true} showForecast={false} />
              <CrewManagement showDetailed={false} />
              <EquipmentTracker compact={true} />
            </div>

            {/* Business Operations Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <InvoiceManager compact={true} />
              <PhotoDocumentation compact={true} />
              <SafetyReporting compact={true} />
            </div>

            {/* Operations & Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <RouteOptimizer compact={true} />
              <PerformanceAnalytics compact={true} />
              <DispatchBoard compact={true} />
            </div>

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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
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
                        fill="hsl(var(--primary))"
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

            {/* Global Search and Filters */}
            <GlobalSearch
              data={Array.isArray(pipelineLeads?.data) ? pipelineLeads.data : []}
              searchFields={['name', 'email', 'phone', 'serviceRequested', 'notes', 'source']}
              onFilteredResults={setFilteredLeads}
              placeholder="Search leads by name, email, phone, service..."
              enableFilters={true}
              filterOptions={[
                {
                  field: 'status',
                  label: 'Status',
                  type: 'select',
                  options: [
                    { value: 'new', label: 'New' },
                    { value: 'contacted', label: 'Contacted' },
                    { value: 'qualified', label: 'Qualified' },
                    { value: 'converted', label: 'Converted' },
                    { value: 'closed', label: 'Closed' }
                  ]
                },
                {
                  field: 'priority',
                  label: 'Priority',
                  type: 'select',
                  options: [
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'emergency', label: 'Emergency' }
                  ]
                },
                {
                  field: 'source',
                  label: 'Source',
                  type: 'select',
                  options: [
                    { value: 'Google Ads', label: 'Google Ads' },
                    { value: 'Facebook', label: 'Facebook' },
                    { value: 'Website', label: 'Website' },
                    { value: 'Referral', label: 'Referral' },
                    { value: 'Manual Entry', label: 'Manual Entry' }
                  ]
                },
                {
                  field: 'serviceRequested',
                  label: 'Service Type',
                  type: 'text'
                },
                {
                  field: 'followUpDate',
                  label: 'Follow-up Date',
                  type: 'date'
                }
              ]}
            />

            {/* Follow-Up Queue - Critical Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-orange-50 border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
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
                        <div className="text-xs text-orange-600">Due: {format(new Date(lead.followUpDate), 'PP')}</div>
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
                          <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${(conversionFunnel as any).conversionRates?.quoteToWin || 0}%` }}></div>
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
                                <Calendar className="h-4 w-4 text-orange-500" />
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
                          <td className={`p-2 text-right font-medium ${source.roi > 0 ? 'text-green-600' : 'text-orange-600'}`}>
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
                    const scheduledDateString = formData.get('scheduledDate') as string;
                    createJobMutation.mutate({
                      jobNumber: `JOB-${Date.now()}`,
                      title: formData.get('title'),
                      description: formData.get('description'),
                      address: formData.get('address'),
                      status: 'scheduled',
                      priority: formData.get('priority'),
                      scheduledDate: scheduledDateString ? new Date(scheduledDateString) : null,
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

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-rainbow">
                <Calendar className="h-6 w-6" />
                Job Schedule
              </h2>
              <div className="flex items-center gap-2">
                <Button 
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg"
                  onClick={() => setShowNewJobDialog(true)}
                  data-testid="button-new-scheduled-job"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Job
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <CalendarView 
                view="week"
                onEventClick={(event) => {
                  console.log('Event clicked:', event);
                  // Could open event details dialog here
                }}
                onAddEvent={(date) => {
                  console.log('Add event for date:', date);
                  setShowNewJobDialog(true);
                }}
              />

              {/* Quick Stats for Scheduling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-xl border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">Today's Jobs</p>
                        <p className="text-2xl font-bold">3</p>
                      </div>
                      <Calendar className="h-8 w-8 text-blue-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-teal-600 text-white shadow-xl border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">This Week</p>
                        <p className="text-2xl font-bold">12</p>
                      </div>
                      <Clock className="h-8 w-8 text-green-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100 text-sm">Crew Members</p>
                        <p className="text-2xl font-bold">8</p>
                      </div>
                      <Users className="h-8 w-8 text-orange-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-xl border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Equipment</p>
                        <p className="text-2xl font-bold">15</p>
                      </div>
                      <Settings className="h-8 w-8 text-purple-200" />
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {isExporting ? 'Generating...' : 'Generate Report'}
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
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background) / 0.95)', 
                          border: '2px solid hsl(var(--primary))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                        name="Revenue ($)"
                        dot={false}
                        activeDot={{ stroke: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' }}
                      />
                      <Line yAxisId="right" type="monotone" dataKey="jobs" stroke="hsl(var(--muted-foreground))" strokeWidth={3} name="Jobs Completed" dot={false} activeDot={{ stroke: 'hsl(var(--muted-foreground))', fill: 'hsl(var(--muted-foreground))' }} />
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
                          { name: 'Google Ads', value: 45, fill: COLORS[0] },
                          { name: 'Facebook', value: 30, fill: COLORS[1] },
                          { name: 'Website', value: 20, fill: COLORS[2] },
                          { name: 'Referral', value: 5, fill: COLORS[3] }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              

              {/* Customer Lifetime Value Analysis */}
              <Card className="border-2 border-gradient-to-r from-yellow-200 via-orange-200 to-orange-300">
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
                      { segment: 'High Value', customers: 12, avgValue: 8500, fill: COLORS[0] },
                      { segment: 'Medium Value', customers: 28, avgValue: 3200, fill: COLORS[1] },
                      { segment: 'Low Value', customers: 45, avgValue: 1200, fill: COLORS[2] },
                      { segment: 'New Customers', customers: 23, avgValue: 800, fill: COLORS[3] }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="segment" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background) / 0.95)', 
                          border: '2px solid hsl(var(--primary))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="customers" name="Customer Count" fill="hsl(var(--primary))" />
                      <Line yAxisId="right" type="monotone" dataKey="avgValue" stroke="hsl(var(--muted-foreground))" strokeWidth={3} name="Avg Value ($)" dot={false} activeDot={{ stroke: 'hsl(var(--muted-foreground))', fill: 'hsl(var(--muted-foreground))' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Advanced Conversion Funnel */}
              <Card className="border-2 border-gradient-to-r from-orange-200 via-orange-300 to-orange-400">
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
                      { stage: 'Website Visits', count: 1250, rate: 100, color: 'bg-brand' },
                      { stage: 'Leads Generated', count: 78, rate: 6.2, color: 'bg-brand' },
                      { stage: 'Qualified Leads', count: 52, rate: 66.7, color: 'bg-brand' },
                      { stage: 'Quotes Sent', count: 34, rate: 65.4, color: 'bg-brand' },
                      { stage: 'Jobs Won', count: 23, rate: 67.6, color: 'bg-brand' }
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

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            <InvoiceManager />
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-6">
            <PhotoDocumentation />
          </TabsContent>

          {/* Safety Tab */}
          <TabsContent value="safety" className="space-y-6">
            <SafetyReporting />
          </TabsContent>

          {/* Routes Tab */}
          <TabsContent value="routes" className="space-y-6">
            <RouteOptimizer />
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                  Performance Analytics Dashboard
                </h2>
                <p className="text-muted-foreground">Comprehensive business performance metrics and trends</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExportData('performance')} disabled={isExporting}>
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export Report'}
                </Button>
              </div>
            </div>

            {/* Key Performance Indicators Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Average Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2.4</div>
                  <p className="text-sm text-gray-600">hours</p>
                  <div className="flex items-center mt-2">
                    <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-500">15% faster than last month</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Quote Acceptance Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {quoteAnalytics?.totalQuotes ? 
                      ((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1) 
                      : 0}%
                  </div>
                  <p className="text-sm text-gray-600">quotes accepted</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-500">8% improvement</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">First Time Fix Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">92%</div>
                  <p className="text-sm text-gray-600">jobs completed first visit</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-500">5% improvement</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Customer Retention</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">85%</div>
                  <p className="text-sm text-gray-600">repeat customers</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-500">3% increase</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Performance Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Performance Trends (Last 6 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={[
                      { month: 'Jan', responseTime: 4.2, quoteAcceptance: 65, customerRetention: 82 },
                      { month: 'Feb', responseTime: 3.8, quoteAcceptance: 68, customerRetention: 83 },
                      { month: 'Mar', responseTime: 3.5, quoteAcceptance: 72, customerRetention: 84 },
                      { month: 'Apr', responseTime: 3.2, quoteAcceptance: 75, customerRetention: 85 },
                      { month: 'May', responseTime: 2.9, quoteAcceptance: 78, customerRetention: 85 },
                      { month: 'Jun', responseTime: 2.6, quoteAcceptance: 81, customerRetention: 85 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="quoteAcceptance" stroke="#2563eb" name="Quote Acceptance %" strokeWidth={3} />
                      <Line type="monotone" dataKey="customerRetention" stroke="#16a34a" name="Customer Retention %" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Response Time Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Response Time Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { timeRange: '< 1hr', count: 45, percentage: 35 },
                      { timeRange: '1-4hrs', count: 38, percentage: 30 },
                      { timeRange: '4-8hrs', count: 25, percentage: 20 },
                      { timeRange: '8-24hrs', count: 15, percentage: 12 },
                      { timeRange: '> 24hrs', count: 4, percentage: 3 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="timeRange" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Job Completion Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Job Completion Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Jobs Completed on Time</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '88%' }}></div>
                        </div>
                        <span className="text-sm font-bold">88%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">First Time Fix Rate</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                        </div>
                        <span className="text-sm font-bold">92%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Customer Satisfaction</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div className="bg-orange-600 h-2 rounded-full" style={{ width: '94%' }}></div>
                        </div>
                        <span className="text-sm font-bold">94%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Safety Compliance</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '98%' }}></div>
                        </div>
                        <span className="text-sm font-bold">98%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Revenue Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Average Job Value</span>
                      <span className="font-bold text-lg">{formatCurrency(revenueStats?.averageJobValue || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Revenue per Lead</span>
                      <span className="font-bold text-lg">{formatCurrency((dashboardStats?.totalRevenue || 0) / Math.max(dashboardStats?.totalLeads || 1, 1))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Gross Profit Margin</span>
                      <span className="font-bold text-lg">68%</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Monthly Growth Rate</span>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="font-bold text-green-600">+12.3%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Detailed Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Detailed Performance Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Metric</th>
                        <th className="text-center p-2 font-medium">Current</th>
                        <th className="text-center p-2 font-medium">Target</th>
                        <th className="text-center p-2 font-medium">Last Month</th>
                        <th className="text-center p-2 font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover-elevate">
                        <td className="p-2 font-medium">Average Response Time</td>
                        <td className="p-2 text-center">2.4 hrs</td>
                        <td className="p-2 text-center">&lt; 2 hrs</td>
                        <td className="p-2 text-center">3.2 hrs</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TrendingDown className="h-4 w-4 text-green-500" />
                            <span className="text-green-500">-15%</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b hover-elevate">
                        <td className="p-2 font-medium">Quote Acceptance Rate</td>
                        <td className="p-2 text-center">
                          {quoteAnalytics?.totalQuotes ? 
                            ((quoteAnalytics.acceptedQuotes / quoteAnalytics.totalQuotes) * 100).toFixed(1) 
                            : 0}%
                        </td>
                        <td className="p-2 text-center">75%</td>
                        <td className="p-2 text-center">73%</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-green-500">+8%</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b hover-elevate">
                        <td className="p-2 font-medium">Customer Retention</td>
                        <td className="p-2 text-center">85%</td>
                        <td className="p-2 text-center">90%</td>
                        <td className="p-2 text-center">82%</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-green-500">+3%</span>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b hover-elevate">
                        <td className="p-2 font-medium">First Time Fix Rate</td>
                        <td className="p-2 text-center">92%</td>
                        <td className="p-2 text-center">95%</td>
                        <td className="p-2 text-center">87%</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-green-500">+5%</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dispatch Tab */}
          <TabsContent value="dispatch" className="space-y-6">
            <DispatchBoard />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-rainbow">
                <Settings className="h-6 w-6" />
                Business Settings & Configuration
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex items-center gap-2" data-testid="button-save-settings">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
                <Button variant="outline" size="sm" className="flex items-center gap-2" data-testid="button-reset-settings">
                  <RotateCcw className="h-4 w-4" />
                  Reset to Default
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
                        <SelectItem value="overview">Overview Dashboard</SelectItem>
                        <SelectItem value="leads">Leads Pipeline</SelectItem>
                        <SelectItem value="jobs">Job Management</SelectItem>
                        <SelectItem value="analytics">Analytics</SelectItem>
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
              <Card className="border-2 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-500" />
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
                    <Button variant="outline" size="sm" className="w-full flex items-center gap-2" data-testid="button-change-password">
                      <Shield className="h-4 w-4" />
                      Change Password
                    </Button>
                  </div>
                  <div>
                    <Button variant="outline" size="sm" className="w-full flex items-center gap-2" data-testid="button-export-data">
                      <Archive className="h-4 w-4" />
                      Export All Data
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Data Management & Backup */}
              <Card className="border-2 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-indigo-500" />
                    Data Management & Backup
                  </CardTitle>
                  <CardDescription>Storage, backup, and data handling preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Cloud Sync</p>
                        <p className="text-xs text-gray-600">Automatic data synchronization</p>
                      </div>
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Backup Frequency</p>
                        <p className="text-xs text-gray-600">How often to backup data</p>
                      </div>
                      <Select defaultValue="daily">
                        <SelectTrigger className="w-32" data-testid="select-backup-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="real-time">Real-time</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Data Retention</p>
                        <p className="text-xs text-gray-600">Keep completed jobs for</p>
                      </div>
                      <Select defaultValue="2-years">
                        <SelectTrigger className="w-32" data-testid="select-data-retention">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-year">1 Year</SelectItem>
                          <SelectItem value="2-years">2 Years</SelectItem>
                          <SelectItem value="5-years">5 Years</SelectItem>
                          <SelectItem value="forever">Forever</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="pt-2 border-t flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 flex items-center gap-2" data-testid="button-backup-now">
                      <Cloud className="h-4 w-4" />
                      Backup Now
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 flex items-center gap-2" data-testid="button-restore-data">
                      <Download className="h-4 w-4" />
                      Restore Data
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Integration Management */}
              <Card className="border-2 bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5 text-teal-500" />
                    Integration Management
                  </CardTitle>
                  <CardDescription>External service connections and API settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">ServiceM8 Integration</p>
                        <p className="text-xs text-gray-600">Sync with existing ServiceM8 data</p>
                      </div>
                      <Badge variant="default" className="bg-blue-500">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Google Calendar</p>
                        <p className="text-xs text-gray-600">Job scheduling integration</p>
                      </div>
                      <Badge variant="outline">Setup Required</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Email Integration</p>
                        <p className="text-xs text-gray-600">SendGrid email service</p>
                      </div>
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Payment Gateway</p>
                        <p className="text-xs text-gray-600">Online payment processing</p>
                      </div>
                      <Badge variant="outline">Not Configured</Badge>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <Button variant="outline" size="sm" className="w-full flex items-center gap-2" data-testid="button-manage-integrations">
                      <Server className="h-4 w-4" />
                      Manage API Keys
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Performance & Optimization Settings */}
            <Card className="border-2 bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-cyan-500" />
                  Performance & Optimization
                </CardTitle>
                <CardDescription>System performance and resource optimization settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Loading & Caching */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Loading & Caching</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Cache Duration</label>
                        <Select defaultValue="30min">
                          <SelectTrigger data-testid="select-cache-duration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5min">5 minutes</SelectItem>
                            <SelectItem value="15min">15 minutes</SelectItem>
                            <SelectItem value="30min">30 minutes</SelectItem>
                            <SelectItem value="1hour">1 hour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Image Quality</label>
                        <Select defaultValue="high">
                          <SelectTrigger data-testid="select-image-quality">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High Quality</SelectItem>
                            <SelectItem value="medium">Medium Quality</SelectItem>
                            <SelectItem value="low">Low (Fast)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Updates */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Real-time Updates</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Update Frequency</label>
                        <Select defaultValue="30s">
                          <SelectTrigger data-testid="select-update-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10s">10 seconds</SelectItem>
                            <SelectItem value="30s">30 seconds</SelectItem>
                            <SelectItem value="1min">1 minute</SelectItem>
                            <SelectItem value="5min">5 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Auto-refresh</label>
                        <Select defaultValue="enabled">
                          <SelectTrigger data-testid="select-auto-refresh">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enabled">Enabled</SelectItem>
                            <SelectItem value="manual">Manual Only</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Resource Usage */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Resource Usage</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Max Photos per Job</label>
                        <Input type="number" defaultValue="20" data-testid="input-max-photos" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Data Usage Mode</label>
                        <Select defaultValue="standard">
                          <SelectTrigger data-testid="select-data-usage">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High Performance</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="low">Data Saver</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Mobile & Field Operations */}
            <Card className="border-2 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-emerald-500" />
                  Mobile & Field Operations
                </CardTitle>
                <CardDescription>Settings for mobile devices and field crew operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Offline Mode */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Offline Mode</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Enable Offline Access</p>
                          <p className="text-xs text-gray-600">Work without internet connection</p>
                        </div>
                        <Badge variant="default" className="bg-green-500">Enabled</Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Sync when online</label>
                        <Select defaultValue="auto">
                          <SelectTrigger data-testid="select-offline-sync">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Automatic</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="wifi-only">WiFi Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* GPS & Location */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">GPS & Location</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Track Crew Location</p>
                          <p className="text-xs text-gray-600">Real-time crew tracking</p>
                        </div>
                        <Badge variant="default" className="bg-blue-500">Active</Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Location Accuracy</label>
                        <Select defaultValue="high">
                          <SelectTrigger data-testid="select-location-accuracy">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High (5m)</SelectItem>
                            <SelectItem value="medium">Medium (20m)</SelectItem>
                            <SelectItem value="low">Low (100m)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t mt-6">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 flex items-center gap-2" data-testid="button-mobile-setup">
                      <Phone className="h-4 w-4" />
                      Mobile App Setup
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 flex items-center gap-2" data-testid="button-field-guide">
                      <FileText className="h-4 w-4" />
                      Field Operations Guide
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
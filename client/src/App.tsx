import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LogoSidebarTrigger } from "@/components/LogoSidebarTrigger";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { TwilioCallProvider } from "@/contexts/TwilioCallContext";
import { lazy, Suspense } from "react";

// Route targets are lazy-loaded so the initial JS bundle stays small. This is
// the biggest lever on first-paint time — previously all ~90 pages were bundled
// into one monolithic chunk that mid-range Android devices spent seconds parsing
// before anything rendered. Each page now becomes its own chunk, fetched on first
// navigation. The router is wrapped in <Suspense> boundaries (sidebar <main> and
// around <Router/>) so an as-yet-unloaded page shows a spinner, not a blank screen.
const Login = lazy(() => import("@/pages/Login"));
const Home = lazy(() => import("@/pages/Home"));
const TreeRemoval = lazy(() => import("@/pages/TreeRemoval"));
const TreePruning = lazy(() => import("@/pages/TreePruning"));
const StumpGrinding = lazy(() => import("@/pages/StumpGrinding"));
const HedgeTrimming = lazy(() => import("@/pages/HedgeTrimming"));
const Mulch = lazy(() => import("@/pages/Mulch"));
const MulchThanks = lazy(() => import("@/pages/MulchThanks"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const SummerOffer = lazy(() => import("@/pages/SummerOffer"));
const Contact = lazy(() => import("@/pages/Contact"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const JobDashboard = lazy(() => import("@/pages/JobDashboard"));
const JobCardPreview = lazy(() => import("@/pages/JobCardPreview"));
const MetricsDashboard = lazy(() => import("@/pages/MetricsDashboard"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Videos = lazy(() => import("@/pages/Videos"));
const Help = lazy(() => import("@/pages/Help"));
const HelpAdmin = lazy(() => import("@/pages/admin/HelpAdmin"));
const Pipeline = lazy(() => import("@/pages/Pipeline"));
const Opportunities = lazy(() => import("@/pages/Opportunities"));
const ConversationDetail = lazy(() => import("@/pages/ConversationDetail"));
const Reputation = lazy(() => import("@/pages/Reputation"));
const Reviews = lazy(() => import("@/pages/Reviews"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const MarketingPlanner = lazy(() => import("@/pages/MarketingPlanner"));
const NotFound = lazy(() => import("@/pages/not-found"));
const CustomerPortal = lazy(() => import("@/pages/CustomerPortal").then((m) => ({ default: m.CustomerPortal })));
const CommunicationsManagement = lazy(() => import("@/pages/CommunicationsManagement"));
const Calls = lazy(() => import("@/pages/Calls"));
const WatchVideo = lazy(() => import("@/pages/WatchVideo"));
const Dispatch = lazy(() => import("@/pages/Dispatch"));
const WorkflowAutomation = lazy(() => import("@/components/WorkflowAutomation").then((m) => ({ default: m.WorkflowAutomation })));
const History = lazy(() => import("@/pages/History"));
const Clients = lazy(() => import("@/pages/Clients"));
const MaterialsServices = lazy(() => import("@/pages/MaterialsServices"));
const Settings = lazy(() => import("@/pages/Settings"));
const StaffManagement = lazy(() => import("@/pages/StaffManagement"));
const PermissionsManagement = lazy(() => import("@/pages/PermissionsManagement"));
const TemplateManagement = lazy(() => import("@/pages/TemplateManagement"));
const Equipment = lazy(() => import("@/pages/Equipment"));
const Developer = lazy(() => import("@/pages/Developer"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const StaffSchedule = lazy(() => import("@/pages/StaffSchedule"));
const SettingsPreferences = lazy(() => import("@/pages/SettingsPreferences"));
const BookingReminderSettings = lazy(() => import("@/pages/BookingReminderSettings"));
const CommunicationTemplates = lazy(() => import("@/pages/CommunicationTemplates"));
const VehicleInspectionSettings = lazy(() => import("@/pages/VehicleInspectionSettings"));
const NotificationPreferences = lazy(() => import("@/pages/NotificationPreferences"));
const VehicleInspection = lazy(() => import("@/pages/VehicleInspection"));
const VehicleInspectionHistory = lazy(() => import("@/pages/VehicleInspectionHistory"));
const EquipmentInductionSettings = lazy(() => import("@/pages/EquipmentInductionSettings"));
const EquipmentInductionRunner = lazy(() => import("@/pages/EquipmentInductionRunner"));
const SignatureCapture = lazy(() => import("@/pages/SignatureCapture"));
const JHATemplates = lazy(() => import("@/pages/JHATemplates"));
const JHARiskControlTemplates = lazy(() => import("@/pages/JHARiskControlTemplates"));
const SmsTemplates = lazy(() => import("@/pages/SmsTemplates"));
const JHAAssessment = lazy(() => import("@/pages/JHAAssessment"));
const JHAHistory = lazy(() => import("@/pages/JHAHistory"));
const SettingsPlaceholder = lazy(() => import("@/components/SettingsPlaceholder").then((m) => ({ default: m.SettingsPlaceholder })));
const JobTemplateManagement = lazy(() => import("@/components/JobTemplateManagement"));
const ProposalViewer = lazy(() => import("@/pages/ProposalViewer"));
const ProposalAccept = lazy(() => import("@/pages/ProposalAccept"));
const QuoteViewer = lazy(() => import("@/pages/QuoteViewer"));
const InvoiceViewer = lazy(() => import("@/pages/InvoiceViewer"));
const InvoiceView = lazy(() => import("@/pages/InvoiceView"));
const PaymentComplete = lazy(() => import("@/pages/PaymentComplete"));
const PublicReview = lazy(() => import("@/pages/PublicReview"));
const MulchDrops = lazy(() => import("@/pages/MulchDrops"));
const NearMissReport = lazy(() => import("@/pages/NearMissReport"));
const NearMissHistory = lazy(() => import("@/pages/NearMissHistory"));
const SafetyHub = lazy(() => import("@/pages/SafetyHub"));
const ToolboxTalks = lazy(() => import("@/pages/ToolboxTalks"));
const PrestartChecklists = lazy(() => import("@/pages/PrestartChecklists"));
const EquipmentInspectionRegister = lazy(() => import("@/pages/EquipmentInspectionRegister"));
const CompetencyRegister = lazy(() => import("@/pages/CompetencyRegister"));
const SWMSBuilder = lazy(() => import("@/pages/SWMSBuilder"));
const NotifiableEvents = lazy(() => import("@/pages/NotifiableEvents"));
const EquipmentRegister = lazy(() => import("@/pages/EquipmentRegister"));
const AIDispatchScheduler = lazy(() => import("@/pages/AIDispatchScheduler"));
const ChecklistTemplatePage = lazy(() => import("@/pages/ChecklistTemplatePage"));
const RoleChecklistSettings = lazy(() => import("@/pages/RoleChecklistSettings"));
const QuotingProcessSettings = lazy(() => import("@/pages/QuotingProcessSettings"));
const DocumentBuilderPage = lazy(() => import("@/pages/DocumentBuilderPage"));
const SettingsCompany = lazy(() => import("@/pages/SettingsCompany"));
const SettingsQuoteFollowup = lazy(() => import("@/pages/SettingsQuoteFollowup"));
const SettingsInquiryAutoReply = lazy(() => import("@/pages/SettingsInquiryAutoReply"));
const TimeTracking = lazy(() => import("@/pages/TimeTracking"));
const FollowUpQueue = lazy(() => import("@/pages/FollowUpQueue"));
const UnlinkedCalls = lazy(() => import("@/pages/UnlinkedCalls"));
const Reconciliation = lazy(() => import("@/pages/Reconciliation"));
const ProfitabilityCalculator = lazy(() => import("@/pages/ProfitabilityCalculator"));
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown, History as HistoryIcon, Users, Package, Settings2, Code, RefreshCw, LogOut, Calendar as CalendarIcon, ChevronLeft, ChevronRight, MessageSquare, Filter, Search, X, User, ArrowLeft } from "lucide-react";
import { useJobFilter, DISPATCH_STATUS_FILTERS, useDispatchSearchOpen } from "@/lib/dispatchHeaderStore";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSSE } from "@/hooks/useSSE";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ScrollToTop component to reset scroll position on navigation
function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location]);
  
  return null;
}

// Fallback shown while a lazy-loaded route chunk is fetched. Renders nothing
// (no spinner) — the sidebar shell stays visible and the content area simply
// fills in once the chunk arrives. Used by both Suspense boundaries.
function PageSpinner() {
  return null;
}
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "@/components/NotificationBell";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { initializeFirebase } from "@/lib/firebase";
import { useQuery } from "@tanstack/react-query";
import { addDays, subDays } from "date-fns";

// Protected Route wrapper - redirects unauthenticated users to login and crew users to allowed pages
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isCrew, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  
  // Wait for auth check to complete before redirecting. Render a neutral
  // background (no spinner) so there's no loading ring on startup.
  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  // Redirect crew users to dispatch board (they don't have access to admin pages)
  // Preserve URL parameters when redirecting
  if (isCrew) {
    const searchParams = window.location.search;
    return <Redirect to={`/dispatch${searchParams}`} />;
  }
  
  return <>{children}</>;
}

// Authenticated Route wrapper - redirects unauthenticated users to login
function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Wait for auth check to complete before redirecting. Render a neutral
  // background (no spinner) so there's no loading ring on startup.
  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <>{children}</>;
}

// Inner component that uses useSidebar hook
function SidebarContent({ children }: { children: React.ReactNode | ((activeTab: string, onTabChange: (tab: string) => void) => React.ReactNode) }) {
  const { isCrew, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("jobs");
  // Live push: invalidate queries instantly when server broadcasts a change
  useSSE();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const [dispatchDate, setDispatchDate] = useState(new Date());

  // Sync activeTab highlight with the current URL
  useEffect(() => {
    if (location.startsWith("/settings")) {
      setActiveTab("settings");
    }
  }, [location]);
  
  // Check if we're on dispatch page
  const isDispatchPage = location === '/dispatch';
  const [dispatchFilter, setDispatchFilter] = useJobFilter();
  const [dispatchSearchOpen, setDispatchSearchOpen] = useDispatchSearchOpen();

  // Close search strip when leaving dispatch page
  useEffect(() => {
    if (!isDispatchPage) setDispatchSearchOpen(false);
  }, [isDispatchPage]);

  // Fetch jobs data for dispatch header
  const { data: jobsResponse } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/jobs'],
    enabled: isDispatchPage,
  });
  
  const jobs = jobsResponse?.data || [];
  const jobCount = jobs.filter((job: any) => job.status !== 'unsuccessful').slice(0, 30).length;
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Use refetchQueries to prevent Safari display issues
    // This keeps existing data visible while fetching new data
    // Refresh all key data endpoints
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['/api/jobs'] }),
      queryClient.refetchQueries({ queryKey: ['/api/customers'] }),
      queryClient.refetchQueries({ queryKey: ['/api/notifications/summary'] }),
      queryClient.refetchQueries({ queryKey: ['/api/leads'] }),
      queryClient.refetchQueries({ queryKey: ['/api/employees'] }),
      queryClient.refetchQueries({ queryKey: ['/api/equipment'] }),
      queryClient.refetchQueries({ queryKey: ['/api/staff-assignments'] }),
      queryClient.refetchQueries({ queryKey: ['/api/job-templates'] }),
    ]);
    
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Bridge for iOS Capacitor: the native Swift layer injects the FCM token
  // into the WKWebView via evaluateJavaScript dispatching 'nativeFcmToken'.
  // index.html captures it early into window.__pendingNativeFcmToken so it
  // is never lost even if React hasn't mounted yet. We drain it here once
  // the authenticated layout is ready, and keep listening for future refreshes.
  useEffect(() => {
    const registerNativeToken = async (token: string) => {
      try {
        console.log('📱 Registering native iOS FCM token with server...');
        const res = await fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token, deviceInfo: 'iOS Capacitor' }),
        });
        const data = await res.json();
        if (data.success) {
          console.log('✅ Native iOS FCM token registered successfully');
        } else {
          console.warn('⚠️ FCM token registration failed:', data.message);
        }
      } catch (err) {
        console.error('❌ Error registering native FCM token:', err);
      }
    };

    // Drain any token captured before React mounted (window global)
    const w = window as Window & { __pendingNativeFcmToken?: string };
    const fromWindow = w.__pendingNativeFcmToken;
    if (fromWindow) {
      w.__pendingNativeFcmToken = undefined;
      registerNativeToken(fromWindow);
    } else {
      // Fallback: token stored in localStorage by the Swift bridge
      try {
        const fromStorage = localStorage.getItem('__nativeFcmToken');
        if (fromStorage) {
          localStorage.removeItem('__nativeFcmToken');
          registerNativeToken(fromStorage);
        }
      } catch (_) {}
    }

    // Keep listening for future token refreshes (Firebase rotates tokens occasionally)
    const handler = (e: Event) => {
      const token = (e as CustomEvent<string>).detail;
      if (token) registerNativeToken(token);
    };

    window.addEventListener('nativeFcmToken', handler);
    return () => window.removeEventListener('nativeFcmToken', handler);
  }, []);
  
  return (
    <div className="flex h-screen overflow-hidden w-full">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Mobile header - sidebar toggle, logo, and actions */}
          <header
            className="md:hidden flex items-center gap-3 px-3 py-3 border-b bg-white"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)", paddingRight: "calc(env(safe-area-inset-right, 0px) + 0.75rem)" }}
          >
            <LogoSidebarTrigger size={44} />
            {/* Notifications Bell — standalone so flex-1 spacer gives it room from actions */}
            {isAdmin && <div className="shrink-0"><NotificationBell /></div>}

            {/* Spacer: pushes action buttons to the right, away from the bell */}
            <div className="flex-1" />
            
            <div className="flex items-center gap-2">

              {/* Dispatch controls — only shown on /dispatch */}
              {isDispatchPage && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        data-testid="create-new-button-mobile"
                        className="rounded-full text-green-700 border-green-400 bg-green-100 shrink-0 h-12 w-12"
                      >
                        <Plus className="h-7 w-7 text-green-700" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-lead"))}
                        data-testid="create-lead-button-mobile"
                      >
                        Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-quote"))}
                        data-testid="create-quote-button-mobile"
                      >
                        Quote
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-job"))}
                        data-testid="create-wo-button-mobile"
                      >
                        Work Order
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-invoice"))}
                        data-testid="create-invoice-button-mobile"
                      >
                        Invoice
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.dispatchEvent(new CustomEvent("dispatch-paste"))}
                    data-testid="paste-message-button-mobile"
                    className="rounded-full text-orange-600 border-orange-400 bg-orange-100 shrink-0 h-12 w-12"
                  >
                    <MessageSquare className="h-7 w-7 text-orange-600" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-11 w-11 ${dispatchFilter !== "all" ? "text-[#1877F2]" : "text-muted-foreground"}`}
                        data-testid="mobile-filter-dropdown-trigger"
                      >
                        <Filter className="h-7 w-7" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDispatchFilter("all")} data-testid="mobile-filter-all">
                        All
                      </DropdownMenuItem>
                      {DISPATCH_STATUS_FILTERS.map(tab => (
                        <DropdownMenuItem
                          key={tab.value}
                          onClick={() => setDispatchFilter(tab.value)}
                          data-testid={`mobile-filter-tab-${tab.value}`}
                        >
                          {tab.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

              {/* Search toggle (dispatch page) or Refresh (other pages) — Mobile */}
              {isDispatchPage ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (dispatchSearchOpen) setDispatchSearchOpen(false);
                    else setDispatchSearchOpen(true);
                  }}
                  data-testid="mobile-search-toggle"
                  className="text-muted-foreground h-11 w-11"
                >
                  {dispatchSearchOpen ? <X className="h-7 w-7" /> : <Search className="h-7 w-7" />}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      data-testid="button-mobile-refresh"
                    >
                      <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh all data</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Logout Button - Crew Only */}
              {isCrew && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={logout}
                  data-testid="button-crew-logout-mobile"
                  className="flex items-center gap-1"
                >
                  <LogOut className="h-8 w-8" />
                  Logout
                </Button>
              )}
              
              {/* Account Dropdown - Admin Only */}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" data-testid="button-account-dropdown-mobile">
                      <User className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem asChild>
                      <Link href="/history" className="flex items-center w-full" data-testid="menu-history-mobile">
                        <HistoryIcon className="w-8 h-8 mr-3 text-gray-600" />
                        <div>
                          <div className="font-medium">History</div>
                          <div className="text-sm text-muted-foreground">Find any past job</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/clients" className="flex items-center w-full" data-testid="menu-clients-mobile">
                        <Users className="w-8 h-8 mr-3 text-blue-600" />
                        <div>
                          <div className="font-medium">Clients</div>
                          <div className="text-sm text-muted-foreground">Import & manage your customer list</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/materials-services" className="flex items-center w-full" data-testid="menu-materials-services-mobile">
                        <Package className="w-8 h-8 mr-3 text-orange-600" />
                        <div>
                          <div className="font-medium">Materials & Services</div>
                          <div className="text-sm text-muted-foreground">Import & manage items you sell</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center w-full" data-testid="menu-settings-mobile">
                        <Settings2 className="w-8 h-8 mr-3 text-gray-600" />
                        <div>
                          <div className="font-medium">Settings</div>
                          <div className="text-sm text-muted-foreground">Add staff & manage your account</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/developer" className="flex items-center w-full" data-testid="menu-developer-mobile">
                        <Code className="w-8 h-8 mr-3 text-purple-600" />
                        <div>
                          <div className="font-medium">Developer</div>
                          <div className="text-sm text-muted-foreground">API access and integrations</div>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={logout} className="flex items-center" data-testid="menu-logout-mobile">
                      <LogOut className="w-8 h-8 mr-3 text-red-600" />
                      <div>
                        <div className="font-medium">Logout</div>
                        <div className="text-sm text-muted-foreground">Sign out of your account</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>
          
          {/* Desktop header - full menu */}
          <header className="hidden md:flex items-center justify-between p-2 border-b bg-white">
            <LogoSidebarTrigger size={36} />
            
            <div className="flex items-center gap-2">
              {/* Notifications Bell */}
              <NotificationBell />
              
              {/* Dispatch action buttons (desktop) or Refresh — same slot */}
              {isDispatchPage ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const input = document.querySelector<HTMLInputElement>('[data-testid="desktop-job-search-input"]');
                      if (input) { input.focus(); input.select(); }
                      setDispatchSearchOpen(!dispatchSearchOpen);
                    }}
                    data-testid="desktop-search-toggle"
                    className="text-black"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1.5 ${dispatchFilter !== "all" ? "text-[#1877F2]" : "text-black"}`}
                        data-testid="desktop-filter-dropdown-trigger"
                      >
                        <Filter className="h-4 w-4" />
                        {DISPATCH_STATUS_FILTERS.find(t => t.value === dispatchFilter)?.label ?? "All"}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDispatchFilter("all")} data-testid="desktop-filter-all">
                        All
                      </DropdownMenuItem>
                      {DISPATCH_STATUS_FILTERS.map(tab => (
                        <DropdownMenuItem
                          key={tab.value}
                          onClick={() => setDispatchFilter(tab.value)}
                          data-testid={`desktop-filter-tab-${tab.value}`}
                        >
                          {tab.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.dispatchEvent(new CustomEvent("dispatch-paste"))}
                    data-testid="paste-message-button-desktop"
                    className="text-black gap-1.5"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Paste
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid="create-new-button-desktop"
                        className="text-black gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        New
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-lead"))}
                        data-testid="create-lead-button-desktop"
                      >
                        Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-quote"))}
                        data-testid="create-quote-button-desktop"
                      >
                        Quote
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-job"))}
                        data-testid="create-wo-button-desktop"
                      >
                        Work Order
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.dispatchEvent(new CustomEvent("dispatch-new-invoice"))}
                        data-testid="create-invoice-button-desktop"
                      >
                        Invoice
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      data-testid="button-desktop-refresh"
                    >
                      <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh all data</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Logout Button - Crew Only */}
              {isCrew && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={logout}
                  data-testid="button-crew-logout"
                  className="flex items-center gap-1"
                >
                  <LogOut className="h-8 w-8" />
                  Logout
                </Button>
              )}
              
              {/* Account Dropdown - Admin Only */}
              {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1" data-testid="button-account-dropdown">
                    Account
                    <ChevronDown className="h-16 w-16" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem asChild>
                    <Link href="/history" className="flex items-center w-full" data-testid="menu-history">
                      <HistoryIcon className="w-8 h-8 mr-3 text-gray-600" />
                      <div>
                        <div className="font-medium">History</div>
                        <div className="text-sm text-muted-foreground">Find any past job, saved forever</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/clients" className="flex items-center w-full" data-testid="menu-clients">
                      <Users className="w-8 h-8 mr-3 text-blue-600" />
                      <div>
                        <div className="font-medium">Clients</div>
                        <div className="text-sm text-muted-foreground">Import & manage your customer list</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/materials-services" className="flex items-center w-full" data-testid="menu-materials-services">
                      <Package className="w-8 h-8 mr-3 text-orange-600" />
                      <div>
                        <div className="font-medium">Materials & Services</div>
                        <div className="text-sm text-muted-foreground">Import & manage items you sell</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center w-full" data-testid="menu-settings">
                      <Settings2 className="w-8 h-8 mr-3 text-gray-600" />
                      <div>
                        <div className="font-medium">Settings</div>
                        <div className="text-sm text-muted-foreground">Add staff & manage your account</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/developer" className="flex items-center w-full" data-testid="menu-developer">
                      <Code className="w-8 h-8 mr-3 text-purple-600" />
                      <div>
                        <div className="font-medium">Developer</div>
                        <div className="text-sm text-muted-foreground">API access and integrations</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}
              
              {/* Global New Job Button — hidden on dispatch */}
              {!isDispatchPage && (
              <Button 
                size="sm" 
                onClick={() => {
                  setLocation('/dispatch?newJob=true');
                }}
                data-testid="global-new-job-btn"
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="h-8 w-8 mr-1" />
                New Job
              </Button>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto w-full max-w-full min-w-0 min-h-0 relative flex flex-col md:pt-6" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="h-full flex flex-col md:pb-0">
              {/* Closest Suspense boundary to sidebar pages — keeps the sidebar
                  + header mounted while the next page's chunk loads, showing the
                  spinner only in the content area instead of full-screen. */}
              <Suspense fallback={<PageSpinner />}>
                {typeof children === 'function' ? children(activeTab, setActiveTab) : children}
              </Suspense>
            </div>
          </main>
        </div>
        
      </div>
  );
}

// Sidebar layout wrapper for dashboard pages
function SidebarLayout({ children }: { children: React.ReactNode | ((activeTab: string, onTabChange: (tab: string) => void) => React.ReactNode) }) {
  const isMobile = useIsMobile();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties} defaultOpen={!isMobile}>
      <SidebarContent>
        {children}
      </SidebarContent>
    </SidebarProvider>
  );
}

function Router() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Handle push notification clicks from service worker
  // When the app is already open and a push notification is tapped,
  // the service worker posts NOTIFICATION_CLICKED — we listen and navigate
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICKED') {
        const url: string | undefined = event.data?.url;
        console.log('🔔 SW NOTIFICATION_CLICKED received:', { url });
        if (url) {
          setLocation(url);
          // If navigating to dispatch with a job, fire the event so DispatchBoard opens that job card
          if (url.startsWith('/dispatch')) {
            const fire = () => window.dispatchEvent(
              new CustomEvent('notification-navigation', { detail: { url } }),
            );
            fire();
            setTimeout(fire, 150);
          }
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
  }, [setLocation]);

  // Handle push notification taps from the iOS Capacitor native shell.
  // AppDelegate+Firebase.swift injects a `nativeNotificationTap` CustomEvent
  // and waits 100ms for `nativeNotificationTapAck` — if we don't ack it falls
  // back to window.location.assign (full reload). Acking gives us SPA-smooth
  // routing instead.
  useEffect(() => {
    const handler = (event: Event) => {
      const url = (event as CustomEvent<string>).detail;
      console.log('🔔 nativeNotificationTap received:', { url, currentPath: window.location.pathname + window.location.search });
      if (typeof url !== 'string' || !url) {
        console.warn('🔔 nativeNotificationTap: empty URL, skipping');
        return;
      }
      window.dispatchEvent(new Event('nativeNotificationTapAck'));
      setLocation(url);
      // Fire the dispatch-board signal immediately AND again at 150ms — the
      // first catches the case where DispatchBoard is already mounted and
      // wouter's same-pathname setLocation doesn't trigger a re-render; the
      // second catches the case where setLocation needed a tick to settle.
      if (url.startsWith('/dispatch')) {
        const fire = () => window.dispatchEvent(
          new CustomEvent('notification-navigation', { detail: { url } }),
        );
        fire();
        setTimeout(fire, 150);
      }
    };
    window.addEventListener('nativeNotificationTap', handler);
    return () => window.removeEventListener('nativeNotificationTap', handler);
  }, [setLocation]);
  
  // Detect Capacitor (iOS Inflow app) once — used to keep marketing/customer pages
  // out of the native app shell. The iOS WebView loads the same URL as the website,
  // but the staff app shouldn't expose Treemarkables marketing content (tree services,
  // mulch ordering, blog, etc.) inside an Inflow-branded shell.
  const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();

  // On native Capacitor app, skip public website and go straight to login
  // Authenticated users hitting '/' go straight to the dispatch board (handles PWA launches,
  // back-button presses, iframe restarts, and any other navigation that lands on the root URL)
  if (location === '/') {
    // While we're still checking auth, show a neutral background rather than flashing the public
    // Home page — this prevents the visible "Home ↔ Dispatch" flicker on every server restart.
    // No spinner: just the background, so there's no loading ring on startup.
    if (isLoading) {
      return <div className="min-h-screen bg-background" />;
    }
    if (isAuthenticated) {
      return <Redirect to="/dispatch" />;
    }
    if (isNative) {
      return <Redirect to="/login" />;
    }
    return <Home />;
  }

  // Native-app guard: if the iOS Capacitor user somehow lands on a marketing/public route
  // (deep link, stale URL, accidental nav), bounce them back into the staff app shell.
  // Customer-facing transactional routes (/quote/:id, /invoice/:id, /proposal/:id, /review/:token,
  // /customer-portal) are intentionally NOT blocked — staff may legitimately want to preview
  // what a customer sees, and these are token-authenticated rather than public marketing pages.
  if (isNative) {
    const MARKETING_ROUTE_PREFIXES = [
      '/home',
      '/tree-removal',
      '/tree-pruning',
      '/stump-grinding',
      '/hedge-trimming',
      '/mulch',
      '/blog',
      '/summer-offer',
      '/contact',
      '/privacy-policy',
    ];
    const isMarketingRoute = MARKETING_ROUTE_PREFIXES.some(
      prefix => location === prefix || location.startsWith(prefix + '/')
    );
    if (isMarketingRoute) {
      return <Redirect to={isAuthenticated ? '/dispatch' : '/login'} />;
    }
  }

  return (
    <Switch>
      <Route path="/login" component={Login}/>
      <Route path="/home" component={Home}/>
      <Route path="/tree-removal" component={TreeRemoval}/>
      <Route path="/tree-pruning" component={TreePruning}/>
      <Route path="/stump-grinding" component={StumpGrinding}/>
      <Route path="/hedge-trimming" component={HedgeTrimming}/>
      <Route path="/mulch">
        <AuthenticatedRoute>
          <Mulch />
        </AuthenticatedRoute>
      </Route>
      <Route path="/mulch/thanks">
        <AuthenticatedRoute>
          <MulchThanks />
        </AuthenticatedRoute>
      </Route>
      <Route path="/blog" component={Blog}/>
      <Route path="/blog/:slug" component={BlogPost}/>
      <Route path="/summer-offer" component={SummerOffer}/>
      <Route path="/contact" component={Contact}/>
      <Route path="/privacy-policy" component={PrivacyPolicy}/>
      
      {/* Redirect /dashboard to /dispatch for convenience (default landing page) */}
      <Route path="/dashboard">
        {() => <Redirect to="/dispatch" />}
      </Route>
      
      {/* JobCardMobile preview — Phase A scaffold. Throwaway route for QA. */}
      <Route path="/job-card-preview/:jobId">
        <ProtectedRoute>
          <JobCardPreview />
        </ProtectedRoute>
      </Route>
      <Route path="/job-card-preview">
        <ProtectedRoute>
          <JobCardPreview />
        </ProtectedRoute>
      </Route>

      {/* Job Dashboard - All Jobs list page */}
      <Route path="/job-dashboard">
        <ProtectedRoute>
          <SidebarLayout activeTab="jobs">
            <JobDashboard activeTab="jobs" />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/metrics">
        <ProtectedRoute>
          <SidebarLayout>
            <MetricsDashboard />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute>
          <SidebarLayout>
            <Tasks />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/videos">
        <ProtectedRoute>
          <SidebarLayout>
            <Videos />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/help">
        <ProtectedRoute>
          <SidebarLayout>
            <Help />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/help">
        <ProtectedRoute>
          <SidebarLayout>
            <HelpAdmin />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/profitability-calculator">
        <ProtectedRoute>
          <SidebarLayout>
            <ProfitabilityCalculator />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/customer-portal" component={CustomerPortal}/>
      <Route path="/proposal/:proposalId/accept" component={ProposalAccept}/>
      <Route path="/proposal/:proposalId" component={ProposalViewer}/>
      <Route path="/quote/:quoteId" component={QuoteViewer}/>
      <Route path="/invoice/:invoiceId/view" component={InvoiceView}/>
      <Route path="/invoice/:invoiceId" component={InvoiceViewer}/>
      <Route path="/payment-complete" component={PaymentComplete}/>
      <Route path="/review/:token" component={PublicReview}/>
      <Route path="/watch/:videoId" component={WatchVideo}/>
      
      {/* Dashboard pages with sidebar - Admin only */}
      <Route path="/pipeline">
        <ProtectedRoute>
          <SidebarLayout>
            <Pipeline />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/opportunities">
        <ProtectedRoute>
          <SidebarLayout>
            <Opportunities />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/follow-up-queue">
        <ProtectedRoute>
          <SidebarLayout>
            <FollowUpQueue />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/reputation">
        <ProtectedRoute>
          <SidebarLayout>
            <Reputation />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/reviews">
        <ProtectedRoute>
          <SidebarLayout>
            <Reviews />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/marketing">
        <ProtectedRoute>
          <SidebarLayout>
            <MarketingPlanner />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/inbox">
        <ProtectedRoute>
          <SidebarLayout>
            <Inbox />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/integrations">
        <ProtectedRoute>
          <SidebarLayout>
            <Integrations />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/reconciliation">
        <ProtectedRoute>
          <SidebarLayout>
            <Reconciliation />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/communications">
        <ProtectedRoute>
          <SidebarLayout>
            <CommunicationsManagement />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/calls">
        <ProtectedRoute>
          <SidebarLayout>
            <Calls />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/conversation/:id">
        <ProtectedRoute>
          <SidebarLayout>
            <ConversationDetail />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/time-tracking">
        <ProtectedRoute>
          <SidebarLayout>
            <TimeTracking />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/unlinked-calls">
        <ProtectedRoute>
          <SidebarLayout>
            <UnlinkedCalls />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/invoices">
        <ProtectedRoute>
          <SidebarLayout>
            <Invoices />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/templates">
        <ProtectedRoute>
          <SidebarLayout>
            <TemplateManagement />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/equipment">
        <ProtectedRoute>
          <SidebarLayout>
            <Equipment />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/dispatch">
        <AuthenticatedRoute>
          <SidebarLayout>
            <Dispatch />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/vehicle-inspection">
        <AuthenticatedRoute>
          <SidebarLayout>
            <VehicleInspection />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/vehicle-inspection-history">
        <AuthenticatedRoute>
          <SidebarLayout>
            <VehicleInspectionHistory />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/apply-signature">
        <AuthenticatedRoute>
          <SidebarLayout>
            <SignatureCapture />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/jha-assessment">
        <AuthenticatedRoute>
          <SidebarLayout>
            <JHAAssessment />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety/jha/new">
        <AuthenticatedRoute>
          <SidebarLayout>
            <JHAAssessment />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/jha-history">
        <AuthenticatedRoute>
          <SidebarLayout>
            <JHAHistory />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/near-miss-report">
        <AuthenticatedRoute>
          <SidebarLayout>
            <NearMissReport />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/near-miss-report/:id">
        <AuthenticatedRoute>
          <SidebarLayout>
            <NearMissReport />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/near-miss-history">
        <AuthenticatedRoute>
          <SidebarLayout>
            <NearMissHistory />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety">
        <AuthenticatedRoute>
          <SidebarLayout>
            <SafetyHub />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety/toolbox-talks">
        <AuthenticatedRoute>
          <SidebarLayout>
            <ToolboxTalks />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety/prestart-checklists">
        <AuthenticatedRoute>
          <SidebarLayout>
            <PrestartChecklists />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety/equipment-register">
        <AuthenticatedRoute>
          <SidebarLayout>
            <EquipmentInspectionRegister />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety/competency-register">
        <AuthenticatedRoute>
          <SidebarLayout>
            <CompetencyRegister />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety/swms">
        <AuthenticatedRoute>
          <SidebarLayout>
            <SWMSBuilder />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/safety/notifiable-events">
        <AuthenticatedRoute>
          <SidebarLayout>
            <NotifiableEvents />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/dispatch-board">
        {() => <Redirect to="/dispatch" />}
      </Route>
      <Route path="/calendar">
        <ProtectedRoute>
          <SidebarLayout>
            <Calendar />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/staff-schedule">
        <AuthenticatedRoute>
          <SidebarLayout>
            <StaffSchedule />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/workflows">
        <ProtectedRoute>
          <SidebarLayout>
            <WorkflowAutomation />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Mulch Drops - accessible to all logged-in users */}
      <Route path="/mulch-drops">
        <AuthenticatedRoute>
          <SidebarLayout>
            <MulchDrops />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>

      <Route path="/history">
        <ProtectedRoute>
          <SidebarLayout>
            <History />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/clients">
        <ProtectedRoute>
          <SidebarLayout>
            <Clients />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/materials-services">
        <ProtectedRoute>
          <SidebarLayout>
            <MaterialsServices />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SidebarLayout>
            <Settings />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Settings sub-pages - placeholders */}
      <Route path="/settings/staff">
        <StaffManagement />
      </Route>
      <Route path="/settings/permissions">
        <ProtectedRoute>
          <SidebarLayout>
            <PermissionsManagement />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings/categories">
        <SidebarLayout>
          <SettingsPlaceholder 
            title="Job Categories"
            description="Organize work types and service categories"
          />
        </SidebarLayout>
      </Route>
      <Route path="/settings/company">
        <SidebarLayout>
          <SettingsCompany />
        </SidebarLayout>
      </Route>
      <Route path="/settings/security">
        <SidebarLayout>
          <SettingsPlaceholder 
            title="Security & API"
            description="Password settings, API keys and access control"
          />
        </SidebarLayout>
      </Route>
      <Route path="/settings/forms">
        <SidebarLayout>
          <div className="flex flex-col h-full">
            <div className="p-4 md:p-6 pb-0">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="self-start"
                data-testid="button-back-to-settings"
              >
                <Link href="/settings" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Settings
                </Link>
              </Button>
            </div>
            <JobTemplateManagement />
          </div>
        </SidebarLayout>
      </Route>
      <Route path="/settings/preferences">
        <SidebarLayout>
          <SettingsPreferences />
        </SidebarLayout>
      </Route>
      <Route path="/settings/notifications">
        <SidebarLayout>
          <div className="p-6 space-y-6">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="self-start"
              data-testid="button-back-to-settings"
            >
              <Link href="/settings" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Settings
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Notification Preferences</h1>
              <p className="text-muted-foreground mt-2">Control which events trigger notifications and how you receive them</p>
            </div>
            <NotificationPreferences />
          </div>
        </SidebarLayout>
      </Route>
      <Route path="/settings/quote-followup">
        <SidebarLayout>
          <SettingsQuoteFollowup />
        </SidebarLayout>
      </Route>
      <Route path="/settings/inquiry-auto-reply">
        <SidebarLayout>
          <SettingsInquiryAutoReply />
        </SidebarLayout>
      </Route>
      <Route path="/settings/booking-reminders">
        <SidebarLayout>
          <BookingReminderSettings />
        </SidebarLayout>
      </Route>
      <Route path="/settings/templates">
        <SidebarLayout>
          <CommunicationTemplates />
        </SidebarLayout>
      </Route>
      <Route path="/settings/sms-templates">
        <SidebarLayout>
          <SmsTemplates />
        </SidebarLayout>
      </Route>
      <Route path="/settings/vehicle-inspections">
        <SidebarLayout>
          <VehicleInspectionSettings />
        </SidebarLayout>
      </Route>
      <Route path="/settings/equipment-inductions">
        <SidebarLayout>
          <EquipmentInductionSettings />
        </SidebarLayout>
      </Route>
      <Route path="/staff-induction/:employeeId/:templateId">
        <AuthenticatedRoute>
          <SidebarLayout>
            <EquipmentInductionRunner />
          </SidebarLayout>
        </AuthenticatedRoute>
      </Route>
      <Route path="/settings/jha-templates">
        <SidebarLayout>
          <JHATemplates />
        </SidebarLayout>
      </Route>
      <Route path="/settings/jha-risk-controls">
        <SidebarLayout>
          <JHARiskControlTemplates />
        </SidebarLayout>
      </Route>

      <Route path="/settings/equipment-register">
        <ProtectedRoute>
          <SidebarLayout>
            <EquipmentRegister />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/ai-scheduler">
        <ProtectedRoute>
          <SidebarLayout>
            <AIDispatchScheduler />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings/checklist-template">
        <SidebarLayout>
          <ChecklistTemplatePage />
        </SidebarLayout>
      </Route>

      <Route path="/settings/role-checklist-tasks">
        <SidebarLayout>
          <RoleChecklistSettings />
        </SidebarLayout>
      </Route>

      <Route path="/settings/quoting-process">
        <SidebarLayout>
          <QuotingProcessSettings />
        </SidebarLayout>
      </Route>

      <Route path="/settings/invoice-builder">
        <ProtectedRoute>
          <SidebarLayout>
            <DocumentBuilderPage documentKind="invoice" />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings/proposal-builder">
        <ProtectedRoute>
          <SidebarLayout>
            <DocumentBuilderPage documentKind="proposal" />
          </SidebarLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/developer">
        <SidebarLayout>
          <Developer />
        </SidebarLayout>
      </Route>
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}


function App() {
  // Initialize Firebase on app startup for push notifications
  useEffect(() => {
    try {
      initializeFirebase();
      console.log('✅ Firebase initialized on app startup');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
    }
  }, []);

  // Watchdog for Radix Dialog/Sheet leaving `body { pointer-events: none }`
  // stuck after rapid nested open/close cycles (notably in the job card).
  // When that happens every click on the page is dead — including the
  // sidebar menu button. If body is locked but no dialog is actually open,
  // clear the lock so the UI self-heals.
  useEffect(() => {
    const clearIfStale = () => {
      if (document.body.style.pointerEvents !== 'none') return;
      const hasOpenDialog = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
      );
      if (!hasOpenDialog) {
        document.body.style.pointerEvents = '';
      }
    };
    const observer = new MutationObserver(clearIfStale);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <TwilioCallProvider>
              <ScrollToTop />
              <Toaster />
              <InstallPrompt />
              {/* Outer Suspense — catches standalone (non-sidebar) routes like
                  Login, Home, marketing and the customer-facing viewers, plus
                  Router's own early <Home/> return. Sidebar pages resolve at the
                  inner boundary above before reaching here. */}
              <Suspense fallback={<PageSpinner />}>
                <Router />
              </Suspense>
            </TwilioCallProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

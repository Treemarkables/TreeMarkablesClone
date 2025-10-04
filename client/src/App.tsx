import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import TreeRemoval from "@/pages/TreeRemoval";
import TreePruning from "@/pages/TreePruning";
import StumpGrinding from "@/pages/StumpGrinding";
import HedgeTrimming from "@/pages/HedgeTrimming";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import SummerOffer from "@/pages/SummerOffer";
import Contact from "@/pages/Contact";
import JobDashboard from "@/pages/JobDashboard";
import MetricsDashboard from "@/pages/MetricsDashboard";
import Pipeline from "@/pages/Pipeline";
import Opportunities from "@/pages/Opportunities";
import ConversationDetail from "@/pages/ConversationDetail";
import Reputation from "@/pages/Reputation";
import Inbox from "@/pages/Inbox";
import Integrations from "@/pages/Integrations";
import Equipment from "@/pages/Equipment";
import Invoices from "@/pages/Invoices";
import NotFound from "@/pages/not-found";
import { CustomerPortal } from "@/pages/CustomerPortal";
import CommunicationsManagement from "@/pages/CommunicationsManagement";
import Dispatch from "@/pages/Dispatch";
import { WorkflowAutomation } from "@/components/WorkflowAutomation";
import History from "@/pages/History";
import Clients from "@/pages/Clients";
import MaterialsServices from "@/pages/MaterialsServices";
import Settings from "@/pages/Settings";
import StaffManagement from "@/pages/StaffManagement";
import TemplateManagement from "@/pages/TemplateManagement";
import Developer from "@/pages/Developer";
import Calendar from "@/pages/Calendar";
import SettingsPreferences from "@/pages/SettingsPreferences";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import { SettingsPlaceholder } from "@/components/SettingsPlaceholder";
import JobTemplateManagement from "@/components/JobTemplateManagement";
import ProposalViewer from "@/pages/ProposalViewer";
import QuoteViewer from "@/pages/QuoteViewer";
import InvoiceViewer from "@/pages/InvoiceViewer";
import PublicReview from "@/pages/PublicReview";
import ActivityDashboard from "@/pages/ActivityDashboard";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown, History as HistoryIcon, Users, Package, Settings2, Code } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "@/components/NotificationBell";
import { InstallPrompt } from "@/components/InstallPrompt";

// Sidebar layout wrapper for dashboard pages
function SidebarLayout({ children }: { children: React.ReactNode | ((activeTab: string, onTabChange: (tab: string) => void) => React.ReactNode) }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showGlobalJobCard, setShowGlobalJobCard] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const style = {
    "--sidebar-width": "12rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties} defaultOpen={!isMobile}>
      <div className="flex h-screen w-full">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="hidden md:flex items-center justify-between p-2 border-b bg-white">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            
            <div className="flex items-center gap-2">
              {/* Notifications Bell */}
              <NotificationBell />
              
              {/* Account Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1" data-testid="button-account-dropdown">
                    Account
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem asChild>
                    <Link href="/history" className="flex items-center w-full" data-testid="menu-history">
                      <HistoryIcon className="w-4 h-4 mr-3 text-gray-600" />
                      <div>
                        <div className="font-medium">History</div>
                        <div className="text-sm text-muted-foreground">Find any past job, saved forever</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/clients" className="flex items-center w-full" data-testid="menu-clients">
                      <Users className="w-4 h-4 mr-3 text-blue-600" />
                      <div>
                        <div className="font-medium">Clients</div>
                        <div className="text-sm text-muted-foreground">Import & manage your customer list</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/materials-services" className="flex items-center w-full" data-testid="menu-materials-services">
                      <Package className="w-4 h-4 mr-3 text-orange-600" />
                      <div>
                        <div className="font-medium">Materials & Services</div>
                        <div className="text-sm text-muted-foreground">Import & manage items you sell</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center w-full" data-testid="menu-settings">
                      <Settings2 className="w-4 h-4 mr-3 text-gray-600" />
                      <div>
                        <div className="font-medium">Settings</div>
                        <div className="text-sm text-muted-foreground">Add staff & manage your account</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/developer" className="flex items-center w-full" data-testid="menu-developer">
                      <Code className="w-4 h-4 mr-3 text-purple-600" />
                      <div>
                        <div className="font-medium">Developer</div>
                        <div className="text-sm text-muted-foreground">API access and integrations</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Global New Job Button */}
              <Button 
                size="sm" 
                onClick={() => setShowGlobalJobCard(true)}
                data-testid="global-new-job-btn"
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Job
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto w-full max-w-full min-w-0 relative">
            {typeof children === 'function' ? children(activeTab, setActiveTab) : children}
          </main>
        </div>
        
        {/* Global Job Card */}
        <GlobalJobCard 
          isOpen={showGlobalJobCard}
          mode="create"
          onClose={() => setShowGlobalJobCard(false)}
          onJobCreated={(job) => {
            toast({
              title: "Job Created",
              description: `${job.title} has been created successfully.`,
            });
            setShowGlobalJobCard(false);
          }}
        />
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/login" component={Login}/>
      <Route path="/home" component={Home}/>
      <Route path="/tree-removal" component={TreeRemoval}/>
      <Route path="/tree-pruning" component={TreePruning}/>
      <Route path="/stump-grinding" component={StumpGrinding}/>
      <Route path="/hedge-trimming" component={HedgeTrimming}/>
      <Route path="/blog" component={Blog}/>
      <Route path="/blog/:slug" component={BlogPost}/>
      <Route path="/summer-offer" component={SummerOffer}/>
      <Route path="/contact" component={Contact}/>
      <Route path="/job-dashboard">
        {() => (
          <SidebarLayout>
            {(activeTab, onTabChange) => (
              <JobDashboard activeTab={activeTab} onTabChange={onTabChange} />
            )}
          </SidebarLayout>
        )}
      </Route>
      <Route path="/metrics">
        <SidebarLayout>
          <MetricsDashboard />
        </SidebarLayout>
      </Route>
      <Route path="/customer-portal" component={CustomerPortal}/>
      <Route path="/proposal/:proposalId" component={ProposalViewer}/>
      <Route path="/quote/:quoteId" component={QuoteViewer}/>
      <Route path="/invoice/:invoiceId" component={InvoiceViewer}/>
      <Route path="/review/:token" component={PublicReview}/>
      
      {/* Dashboard pages with sidebar */}
      <Route path="/overview">
        <SidebarLayout>
          <ActivityDashboard />
        </SidebarLayout>
      </Route>
      <Route path="/pipeline">
        <SidebarLayout>
          <Pipeline />
        </SidebarLayout>
      </Route>
      <Route path="/opportunities">
        <SidebarLayout>
          <Opportunities />
        </SidebarLayout>
      </Route>
      <Route path="/reputation">
        <SidebarLayout>
          <Reputation />
        </SidebarLayout>
      </Route>
      <Route path="/inbox">
        <SidebarLayout>
          <Inbox />
        </SidebarLayout>
      </Route>
      <Route path="/integrations">
        <SidebarLayout>
          <Integrations />
        </SidebarLayout>
      </Route>
      <Route path="/communications">
        <SidebarLayout>
          <CommunicationsManagement />
        </SidebarLayout>
      </Route>
      <Route path="/conversation/:id">
        <SidebarLayout>
          <ConversationDetail />
        </SidebarLayout>
      </Route>
      <Route path="/equipment">
        <SidebarLayout>
          <Equipment />
        </SidebarLayout>
      </Route>
      <Route path="/invoices">
        <SidebarLayout>
          <Invoices />
        </SidebarLayout>
      </Route>
      <Route path="/templates">
        <SidebarLayout>
          <TemplateManagement />
        </SidebarLayout>
      </Route>
      <Route path="/dispatch">
        <SidebarLayout>
          <Dispatch />
        </SidebarLayout>
      </Route>
      <Route path="/calendar">
        <SidebarLayout>
          <Calendar />
        </SidebarLayout>
      </Route>
      <Route path="/workflows">
        <SidebarLayout>
          <WorkflowAutomation />
        </SidebarLayout>
      </Route>
      
      {/* Account dropdown pages */}
      <Route path="/history">
        <SidebarLayout>
          <History />
        </SidebarLayout>
      </Route>
      <Route path="/clients">
        <SidebarLayout>
          <Clients />
        </SidebarLayout>
      </Route>
      <Route path="/materials-services">
        <SidebarLayout>
          <MaterialsServices />
        </SidebarLayout>
      </Route>
      <Route path="/settings">
        <SidebarLayout>
          <Settings />
        </SidebarLayout>
      </Route>
      
      {/* Settings sub-pages - placeholders */}
      <Route path="/settings/staff">
        <StaffManagement />
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
          <SettingsPlaceholder 
            title="Company Info"
            description="Business details, contact information and branding"
          />
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
      <Route path="/settings/notifications">
        <SidebarLayout>
          <SettingsPlaceholder 
            title="Notifications"
            description="Email alerts, SMS settings and reminders"
          />
        </SidebarLayout>
      </Route>
      <Route path="/settings/forms">
        <SidebarLayout>
          <JobTemplateManagement />
        </SidebarLayout>
      </Route>
      <Route path="/settings/preferences">
        <SidebarLayout>
          <SettingsPreferences />
        </SidebarLayout>
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <InstallPrompt />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

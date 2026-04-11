import { useEffect } from "react";
import {
  Calendar,
  CalendarDays,
  BarChart3,
  Users,
  Settings,
  Home,
  Target,
  GitBranch,
  MessageSquare,
  Star,
  Inbox,
  Plug,
  Workflow,
  FileText,
  Layout,
  Briefcase,
  Upload,
  BookOpen,
  Shield,
  LogOut,
  ClipboardCheck,
  ClipboardList,
  History as HistoryIconLucide,
  Megaphone,
  Clock,
  PhoneCall,
  Package,
  Leaf,
  GitMerge,
  Bot
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, useLocation, useRoute } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Dashboard navigation items (tabs within JobDashboard)
const dashboardItems = [
  {
    title: "Overview",
    url: "/overview",
    icon: Home,
    value: "overview",
    isTab: false
  },
  {
    title: "All Jobs",
    url: "/job-dashboard",
    icon: Briefcase,
    value: "jobs",
    isTab: true
  },
  {
    title: "Pipeline",
    url: "/pipeline",
    icon: GitBranch,
    value: "pipeline",
    isTab: false
  },
  {
    title: "Job Import",
    url: "/job-dashboard",
    icon: Upload,
    value: "job-import",
    isTab: true
  },
  {
    title: "Analytics",
    url: "/job-dashboard", 
    icon: BarChart3,
    value: "analytics",
    isTab: true
  },
  {
    title: "Safety",
    url: "/job-dashboard",
    icon: Shield,
    value: "safety",
    isTab: true
  }
];

// Business management items
const businessItems = [
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
    value: "invoices",
    isTab: false
  },
  {
    title: "Templates",
    url: "/templates",
    icon: Layout,
    value: "templates",
    isTab: false
  },
  {
    title: "Equipment",
    url: "/equipment",
    icon: Package,
    value: "equipment",
    isTab: false
  },
  {
    title: "Time Tracking",
    url: "/time-tracking",
    icon: Clock,
    value: "time-tracking",
    isTab: false
  },
  {
    title: "Unlinked Calls",
    url: "/unlinked-calls",
    icon: PhoneCall,
    value: "unlinked-calls",
    isTab: false
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: Plug,
    value: "integrations",
    isTab: false
  },
  {
    title: "Xero Reconciliation",
    url: "/reconciliation",
    icon: GitMerge,
    value: "reconciliation",
    isTab: false
  }
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const { logout, currentUser, isAdmin, isCrew } = useAuth();
  
  // Close sidebar automatically on mobile when location changes
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location, setOpenMobile, isMobile]);
  
  const handleTabClick = (tabValue: string) => {
    // If not on job dashboard, navigate there first
    if (location !== "/job-dashboard") {
      setLocation("/job-dashboard");
    }
    // Set the tab
    onTabChange(tabValue);
    // Close sidebar on mobile only
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  
  const handleLinkClick = (e: React.MouseEvent) => {
    // Close sidebar on mobile only for immediate feedback
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Filter items based on role - crew can only see All Jobs and Safety
  const allowedCrewItems = ['jobs', 'safety'];
  const filteredDashboardItems = isAdmin ? dashboardItems : dashboardItems.filter(item => allowedCrewItems.includes(item.value));

  return (
    <Sidebar>

      <SidebarContent className="pt-safe pt-6 md:pt-0 font-light">
        {/* Core Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel>{isCrew ? "My Work" : "Core Dashboard"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="font-normal text-[16px]">
              {/* Dispatch Board - Available to both crew and admin - TOP OF MENU */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/dispatch"}>
                  <Link href="/dispatch" onClick={handleLinkClick} data-testid="link-dispatch">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                      <Calendar className="h-4 w-4" />
                    </span>
                    <span>Dispatch Board</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* AI Smart Dispatch - Admin only */}
              {!isCrew && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/ai-scheduler"}>
                    <Link href="/ai-scheduler" onClick={handleLinkClick} data-testid="link-ai-scheduler">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-600">
                        <Bot className="h-4 w-4" />
                      </span>
                      <span>AI Smart Dispatch</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {filteredDashboardItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  {item.isTab ? (
                    <SidebarMenuButton 
                      isActive={activeTab === item.value && location === "/job-dashboard"}
                      onClick={() => handleTabClick(item.value)}
                      data-testid={`button-tab-${item.value}`}
                    >
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} onClick={handleLinkClick} data-testid={`link-${item.value}`}>
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
              
              {/* Staff Schedule - Available to both crew and admin */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/staff-schedule"}>
                  <Link href="/staff-schedule" onClick={handleLinkClick} data-testid="link-staff-schedule">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                      <Users className="h-4 w-4" />
                    </span>
                    <span>Staff Schedule</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Vehicle Inspection - Available to both crew and admin */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/vehicle-inspection"}>
                  <Link href="/vehicle-inspection" onClick={handleLinkClick} data-testid="link-vehicle-inspection">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                      <ClipboardCheck className="h-4 w-4" />
                    </span>
                    <span>Vehicle Inspection</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Inspection History - Available to both crew and admin */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/vehicle-inspection-history"}>
                  <Link href="/vehicle-inspection-history" onClick={handleLinkClick} data-testid="link-inspection-history">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                      <HistoryIconLucide className="h-4 w-4" />
                    </span>
                    <span>Inspection History</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* JHA Assessment - Available to both crew and admin */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/jha-assessment"}>
                  <Link href="/jha-assessment" onClick={handleLinkClick} data-testid="link-jha-assessment">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                      <Shield className="h-4 w-4" />
                    </span>
                    <span>JHA Assessment</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* JHA History - Available to both crew and admin */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/jha-history"}>
                  <Link href="/jha-history" onClick={handleLinkClick} data-testid="link-jha-history">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                      <HistoryIconLucide className="h-4 w-4" />
                    </span>
                    <span>JHA History</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Mulch Drops - Available to all users */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/mulch-drops"}>
                  <Link href="/mulch-drops" onClick={handleLinkClick} data-testid="link-mulch-drops">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700">
                      <Leaf className="h-4 w-4" />
                    </span>
                    <span>Mulch Drops</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Daily Briefing - Available to all users */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/daily-briefing"}>
                  <Link href="/daily-briefing" onClick={handleLinkClick} data-testid="link-daily-briefing">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <span>Daily Briefing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Business Management - Admin only */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Business Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="font-normal text-[16px]">
                {businessItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  {item.isTab ? (
                    <SidebarMenuButton
                      isActive={activeTab === item.value && location === "/job-dashboard"}
                      onClick={() => handleTabClick(item.value)}
                      data-testid={`button-tab-${item.value}`}
                    >
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} onClick={handleLinkClick} data-testid={`link-${item.value}`}>
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Operations & Analysis - Admin only */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Operations & Analysis</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="font-normal text-[16px]">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/calendar"}>
                    <Link href="/calendar" onClick={handleLinkClick} data-testid="link-calendar">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <CalendarDays className="h-4 w-4" />
                      </span>
                      <span>Calendar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/workflows"}>
                    <Link href="/workflows" onClick={handleLinkClick} data-testid="link-workflows">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <Workflow className="h-4 w-4" />
                      </span>
                      <span>Workflows</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/opportunities"}>
                    <Link href="/opportunities" onClick={handleLinkClick} data-testid="link-opportunities">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <MessageSquare className="h-4 w-4" />
                      </span>
                      <span>Conversations</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/follow-up-queue"}>
                    <Link href="/follow-up-queue" onClick={handleLinkClick} data-testid="link-follow-up-queue">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <PhoneCall className="h-4 w-4" />
                      </span>
                      <span>Follow-up Queue</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/reputation"}>
                    <Link href="/reputation" onClick={handleLinkClick} data-testid="link-reputation">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <Star className="h-4 w-4" />
                      </span>
                      <span>Reputation</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/reviews"}>
                    <Link href="/reviews" onClick={handleLinkClick} data-testid="link-reviews">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <Star className="h-4 w-4 fill-current" />
                      </span>
                      <span>Reviews</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/marketing"}>
                    <Link href="/marketing" onClick={handleLinkClick} data-testid="link-marketing">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <Megaphone className="h-4 w-4" />
                      </span>
                      <span>Marketing Planner</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/inbox"}>
                    <Link href="/inbox" onClick={handleLinkClick} data-testid="link-inbox">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <Inbox className="h-4 w-4" />
                      </span>
                      <span>Inbox</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/communications"}>
                    <Link href="/communications" onClick={handleLinkClick} data-testid="link-call-log">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <PhoneCall className="h-4 w-4" />
                      </span>
                      <span>Call Log</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/metrics"}>
                    <Link href="/metrics" onClick={handleLinkClick} data-testid="link-metrics">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <span>Metrics Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu className="font-normal text-[16px]">
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeTab === "settings"}
              >
                <button 
                  className="w-full justify-start" 
                  data-testid="button-tab-settings"
                  onClick={() => {
                    onTabChange("settings");
                    setLocation("/settings");
                    if (isMobile) {
                      setOpenMobile(false);
                    }
                  }}
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                    <Settings className="h-4 w-4" />
                  </span>
                  <span>Settings</span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button 
                className="w-full justify-start" 
                data-testid="button-logout"
                onClick={() => {
                  logout();
                  if (isMobile) {
                    setOpenMobile(false);
                  }
                }}
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                  <LogOut className="h-4 w-4" />
                </span>
                <span>Log Out</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
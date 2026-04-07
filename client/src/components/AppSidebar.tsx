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
  TrendingUp,
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
    if (location !== "/job-dashboard") {
      setLocation("/job-dashboard");
    }
    onTabChange(tabValue);
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  
  const handleLinkClick = (e: React.MouseEvent) => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Filter items based on role - crew can only see All Jobs and Safety
  const allowedCrewItems = ['jobs', 'safety'];
  const filteredDashboardItems = isAdmin ? dashboardItems : dashboardItems.filter(item => allowedCrewItems.includes(item.value));

  return (
    <Sidebar>

      <SidebarContent className="pt-safe pt-6 md:pt-0">
        {/* Core Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel>{isCrew ? "My Work" : "Core Dashboard"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dispatch Board */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/dispatch"}>
                  <Link href="/dispatch" onClick={handleLinkClick} data-testid="link-dispatch">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span>Dispatch Board</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {filteredDashboardItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  {item.isTab ? (
                    <SidebarMenuButton 
                      isActive={activeTab === item.value && location === "/job-dashboard"}
                      onClick={() => handleTabClick(item.value)}
                      data-testid={`button-tab-${item.value}`}
                    >
                      <item.icon className={`h-4 w-4 ${item.value === 'safety' ? 'text-amber-500' : 'text-blue-500'}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} onClick={handleLinkClick} data-testid={`link-${item.value}`}>
                        <item.icon className="h-4 w-4 text-blue-500" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
              
              {/* Staff Schedule */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/staff-schedule"}>
                  <Link href="/staff-schedule" onClick={handleLinkClick} data-testid="link-staff-schedule">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span>Staff Schedule</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Vehicle Inspection */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/vehicle-inspection"}>
                  <Link href="/vehicle-inspection" onClick={handleLinkClick} data-testid="link-vehicle-inspection">
                    <ClipboardCheck className="h-4 w-4 text-amber-500" />
                    <span>Vehicle Inspection</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Inspection History */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/vehicle-inspection-history"}>
                  <Link href="/vehicle-inspection-history" onClick={handleLinkClick} data-testid="link-inspection-history">
                    <HistoryIconLucide className="h-4 w-4 text-amber-500" />
                    <span>Inspection History</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* JHA Assessment */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/jha-assessment"}>
                  <Link href="/jha-assessment" onClick={handleLinkClick} data-testid="link-jha-assessment">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span>JHA Assessment</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* JHA History */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/jha-history"}>
                  <Link href="/jha-history" onClick={handleLinkClick} data-testid="link-jha-history">
                    <HistoryIconLucide className="h-4 w-4 text-amber-500" />
                    <span>JHA History</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Mulch Drops */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/mulch-drops"}>
                  <Link href="/mulch-drops" onClick={handleLinkClick} data-testid="link-mulch-drops">
                    <Leaf className="h-4 w-4 text-green-500" />
                    <span>Mulch Drops</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Daily Briefing */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/daily-briefing"}>
                  <Link href="/daily-briefing" onClick={handleLinkClick} data-testid="link-daily-briefing">
                    <ClipboardList className="h-4 w-4 text-orange-500" />
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
              <SidebarMenu>
                {businessItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  {item.isTab ? (
                    <SidebarMenuButton
                      isActive={activeTab === item.value && location === "/job-dashboard"}
                      onClick={() => handleTabClick(item.value)}
                      data-testid={`button-tab-${item.value}`}
                    >
                      <item.icon className="h-4 w-4 text-violet-500" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} onClick={handleLinkClick} data-testid={`link-${item.value}`}>
                        <item.icon className="h-4 w-4 text-violet-500" />
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
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/calendar"}>
                    <Link href="/calendar" onClick={handleLinkClick} data-testid="link-calendar">
                      <CalendarDays className="h-4 w-4 text-indigo-500" />
                      <span>Calendar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/workflows"}>
                    <Link href="/workflows" onClick={handleLinkClick} data-testid="link-workflows">
                      <Workflow className="h-4 w-4 text-indigo-500" />
                      <span>Workflows</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/opportunities"}>
                    <Link href="/opportunities" onClick={handleLinkClick} data-testid="link-opportunities">
                      <MessageSquare className="h-4 w-4 text-indigo-500" />
                      <span>Conversations</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/follow-up-queue"}>
                    <Link href="/follow-up-queue" onClick={handleLinkClick} data-testid="link-follow-up-queue">
                      <PhoneCall className="h-4 w-4 text-indigo-500" />
                      <span>Follow-up Queue</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/reputation"}>
                    <Link href="/reputation" onClick={handleLinkClick} data-testid="link-reputation">
                      <Star className="h-4 w-4 text-indigo-500" />
                      <span>Reputation</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/reviews"}>
                    <Link href="/reviews" onClick={handleLinkClick} data-testid="link-reviews">
                      <Star className="h-4 w-4 fill-indigo-500 text-indigo-500" />
                      <span>Reviews</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/marketing"}>
                    <Link href="/marketing" onClick={handleLinkClick} data-testid="link-marketing">
                      <Megaphone className="h-4 w-4 text-indigo-500" />
                      <span>Marketing Planner</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/inbox"}>
                    <Link href="/inbox" onClick={handleLinkClick} data-testid="link-inbox">
                      <Inbox className="h-4 w-4 text-indigo-500" />
                      <span>Inbox</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/communications"}>
                    <Link href="/communications" onClick={handleLinkClick} data-testid="link-call-log">
                      <PhoneCall className="h-4 w-4 text-indigo-500" />
                      <span>Call Log</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/metrics"}>
                    <Link href="/metrics" onClick={handleLinkClick} data-testid="link-metrics">
                      <TrendingUp className="h-4 w-4 text-indigo-500" />
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
        <SidebarMenu>
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
                    if (isMobile) {
                      setOpenMobile(false);
                    }
                  }}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
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
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span>Log Out</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

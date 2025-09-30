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
  Cloud,
  Shield
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

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Dashboard navigation items (tabs within JobDashboard)
const dashboardItems = [
  {
    title: "Overview",
    url: "/job-dashboard",
    icon: Home,
    value: "overview",
    isTab: true
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
  }
];

// Business management items
const businessItems = [
  {
    title: "Quotes",
    url: "/job-dashboard",
    icon: FileText,
    value: "quotes",
    isTab: true
  },
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
    icon: Settings,
    value: "equipment",
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
  const { setOpen } = useSidebar();
  const isMobile = useIsMobile();
  
  const handleTabClick = (tabValue: string) => {
    // If not on job dashboard, navigate there first
    if (location !== "/job-dashboard") {
      setLocation("/job-dashboard");
    }
    // Set the tab
    onTabChange(tabValue);
    // Collapse sidebar only on mobile
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <Sidebar>

      <SidebarContent>
        {/* Core Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel>Core Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  {item.isTab ? (
                    <SidebarMenuButton 
                      isActive={activeTab === item.value && location === "/job-dashboard"}
                      onClick={() => handleTabClick(item.value)}
                      data-testid={`button-tab-${item.value}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} onClick={() => isMobile && setOpen(false)} data-testid={`link-${item.value}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Business Management */}
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
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} onClick={() => isMobile && setOpen(false)} data-testid={`link-${item.value}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Operations & Analysis */}
        <SidebarGroup>
          <SidebarGroupLabel>Operations & Analysis</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/dispatch"}>
                  <Link href="/dispatch" onClick={() => isMobile && setOpen(false)} data-testid="link-dispatch">
                    <Calendar className="h-4 w-4" />
                    <span>Dispatch Board</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/calendar"}>
                  <Link href="/calendar" onClick={() => isMobile && setOpen(false)} data-testid="link-calendar">
                    <CalendarDays className="h-4 w-4" />
                    <span>Calendar</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "weather" && location === "/job-dashboard"}
                  onClick={() => handleTabClick("weather")}
                  data-testid="button-tab-weather"
                >
                  <Cloud className="h-4 w-4" />
                  <span>Weather</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "safety" && location === "/job-dashboard"}
                  onClick={() => handleTabClick("safety")}
                  data-testid="button-tab-safety"
                >
                  <Shield className="h-4 w-4" />
                  <span>Safety</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/workflows"}>
                  <Link href="/workflows" onClick={() => isMobile && setOpen(false)} data-testid="link-workflows">
                    <Workflow className="h-4 w-4" />
                    <span>Workflows</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/opportunities"}>
                  <Link href="/opportunities" onClick={() => isMobile && setOpen(false)} data-testid="link-opportunities">
                    <MessageSquare className="h-4 w-4" />
                    <span>Conversations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/reputation"}>
                  <Link href="/reputation" onClick={() => isMobile && setOpen(false)} data-testid="link-reputation">
                    <Star className="h-4 w-4" />
                    <span>Reputation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/inbox"}>
                  <Link href="/inbox" onClick={() => isMobile && setOpen(false)} data-testid="link-inbox">
                    <Inbox className="h-4 w-4" />
                    <span>Inbox</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/metrics"}>
                  <Link href="/metrics" onClick={() => isMobile && setOpen(false)} data-testid="link-metrics">
                    <BarChart3 className="h-4 w-4" />
                    <span>Metrics Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-blue-200">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={activeTab === "settings"}
              onClick={() => {
                onTabChange("settings");
                if (isMobile) {
                  setOpen(false);
                }
              }}
            >
              <button className="w-full justify-start" data-testid="button-tab-settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
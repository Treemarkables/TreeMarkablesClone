import {
  Calendar,
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
  Layout
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
} from "@/components/ui/sidebar";
import { Link, useLocation, useRoute } from "wouter";

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
    title: "Pipeline",
    url: "/pipeline",
    icon: GitBranch,
    value: "pipeline",
    isTab: false
  },
  {
    title: "Leads",
    url: "/job-dashboard", 
    icon: Target,
    value: "leads",
    isTab: true
  },
  {
    title: "Customers",
    url: "/job-dashboard",
    icon: Users,
    value: "customers", 
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
    title: "Communications",
    url: "/communications",
    icon: MessageSquare,
    value: "communications",
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
  
  const handleTabClick = (tabValue: string) => {
    // If not on job dashboard, navigate there first
    if (location !== "/job-dashboard") {
      setLocation("/job-dashboard");
    }
    // Set the tab
    onTabChange(tabValue);
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
                      <Link href={item.url} data-testid={`link-${item.value}`}>
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
                      <Link href={item.url} data-testid={`link-${item.value}`}>
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
                  <Link href="/dispatch" data-testid="link-dispatch">
                    <Calendar className="h-4 w-4" />
                    <span>Dispatch Board</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/workflows"}>
                  <Link href="/workflows" data-testid="link-workflows">
                    <Workflow className="h-4 w-4" />
                    <span>Workflows</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/opportunities"}>
                  <Link href="/opportunities" data-testid="link-opportunities">
                    <MessageSquare className="h-4 w-4" />
                    <span>Conversations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/reputation"}>
                  <Link href="/reputation" data-testid="link-reputation">
                    <Star className="h-4 w-4" />
                    <span>Reputation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/inbox"}>
                  <Link href="/inbox" data-testid="link-inbox">
                    <Inbox className="h-4 w-4" />
                    <span>Inbox</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/metrics"}>
                  <Link href="/metrics" data-testid="link-metrics">
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
              onClick={() => onTabChange("settings")}
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
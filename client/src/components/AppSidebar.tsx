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
  FileText
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
import { Link, useLocation } from "wouter";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Dashboard navigation items (tabs within JobDashboard)
const dashboardItems = [
  {
    title: "Overview",
    url: "#",
    icon: Home,
    value: "overview"
  },
  {
    title: "Pipeline",
    url: "#",
    icon: GitBranch,
    value: "pipeline"
  },
  {
    title: "Leads",
    url: "#",
    icon: Target,
    value: "leads"
  },
  {
    title: "Customers",
    url: "#",
    icon: Users,
    value: "customers"
  },
  {
    title: "Analytics",
    url: "#", 
    icon: BarChart3,
    value: "analytics"
  }
];

// Business management items (tabs within JobDashboard)
const businessItems = [
  {
    title: "Quotes",
    url: "#",
    icon: FileText,
    value: "quotes"
  },
  {
    title: "Equipment",
    url: "#",
    icon: Settings,
    value: "equipment"
  },
  {
    title: "Communications",
    url: "#",
    icon: MessageSquare,
    value: "communications"
  },
  {
    title: "Integrations",
    url: "#",
    icon: Plug,
    value: "integrations"
  }
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [location] = useLocation();

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
                  <SidebarMenuButton 
                    asChild
                    isActive={activeTab === item.value}
                    onClick={() => onTabChange(item.value)}
                  >
                    <button className="w-full justify-start" data-testid={`button-tab-${item.value}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
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
                  <SidebarMenuButton
                    asChild
                    isActive={activeTab === item.value}
                    onClick={() => onTabChange(item.value)}
                  >
                    <button className="w-full justify-start" data-testid={`button-tab-${item.value}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
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

      <SidebarFooter className="border-t border-orange-200">
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
import {
  Calendar,
  BarChart3,
  Users,
  FileText,
  DollarSign,
  Camera,
  Shield,
  MapPin,
  TrendingUp,
  Settings,
  Home,
  Target,
  Briefcase,
  GitBranch,
  MessageSquare,
  Star,
  Inbox,
  Plug
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

// Dashboard navigation items
const dashboardItems = [
  {
    title: "Overview",
    url: "#",
    icon: Home,
    value: "overview"
  },
  {
    title: "Leads",
    url: "#",
    icon: Target,
    value: "leads"
  },
  {
    title: "Jobs",
    url: "#",
    icon: Briefcase,
    value: "jobs"
  },
  {
    title: "Quotes", 
    url: "#",
    icon: FileText,
    value: "quotes"
  },
  {
    title: "Customers",
    url: "#",
    icon: Users,
    value: "customers"
  }
];

// Additional features
const featuresItems = [
  {
    title: "Schedule",
    url: "#",
    icon: Calendar,
    value: "schedule"
  },
  {
    title: "Analytics",
    url: "#", 
    icon: BarChart3,
    value: "analytics"
  },
  {
    title: "Invoices",
    url: "#",
    icon: DollarSign,
    value: "invoices"
  },
  {
    title: "Photos",
    url: "#",
    icon: Camera,
    value: "photos"
  }
];

// Operations items  
const operationsItems = [
  {
    title: "Safety",
    url: "#",
    icon: Shield,
    value: "safety"
  },
  {
    title: "Routes",
    url: "#",
    icon: MapPin,
    value: "routes"
  },
  {
    title: "Performance",
    url: "#",
    icon: TrendingUp,
    value: "performance"
  },
  {
    title: "Dispatch",
    url: "#",
    icon: Calendar,
    value: "dispatch"
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
                    <button className="w-full justify-start">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Business Features */}
        <SidebarGroup>
          <SidebarGroupLabel>Business Features</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {featuresItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeTab === item.value}
                    onClick={() => onTabChange(item.value)}
                  >
                    <button className="w-full justify-start">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Operations */}
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeTab === item.value}
                    onClick={() => onTabChange(item.value)}
                  >
                    <button className="w-full justify-start">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* External Links */}
        <SidebarGroup>
          <SidebarGroupLabel>Sales & Analysis</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/pipeline" data-testid="link-pipeline">
                    <GitBranch className="h-4 w-4" />
                    <span>Pipeline</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/opportunities" data-testid="link-opportunities">
                    <MessageSquare className="h-4 w-4" />
                    <span>Conversations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/reputation" data-testid="link-reputation">
                    <Star className="h-4 w-4" />
                    <span>Reputation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/inbox" data-testid="link-inbox">
                    <Inbox className="h-4 w-4" />
                    <span>Inbox</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/integrations" data-testid="link-integrations">
                    <Plug className="h-4 w-4" />
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/equipment" data-testid="link-equipment">
                    <Settings className="h-4 w-4" />
                    <span>Equipment</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
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
              <button className="w-full justify-start">
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
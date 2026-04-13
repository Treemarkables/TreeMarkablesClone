import { useEffect, useState } from "react";
import {
  Calendar,
  CalendarDays,
  BarChart3,
  Users,
  Settings,
  GitBranch,
  MessageSquare,
  Star,
  Inbox,
  Plug,
  Workflow,
  FileText,
  Layout,
  Briefcase,
  Shield,
  LogOut,
  ClipboardCheck,
  Megaphone,
  Clock,
  PhoneCall,
  Package,
  Leaf,
  GitMerge,
  Bot,
  ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const dashboardItems = [
  { title: "All Jobs", url: "/job-dashboard", icon: Briefcase, value: "jobs", isTab: true },
  { title: "Pipeline", url: "/pipeline", icon: GitBranch, value: "pipeline", isTab: false },
];

const businessItems = [
  { title: "Invoices", url: "/invoices", icon: FileText, value: "invoices", isTab: false },
  { title: "Templates", url: "/templates", icon: Layout, value: "templates", isTab: false },
  { title: "Invoice Builder", url: "/settings/invoice-builder", icon: FileText, value: "invoice-builder", isTab: false },
  { title: "Equipment", url: "/equipment", icon: Package, value: "equipment", isTab: false },
  { title: "Time Tracking", url: "/time-tracking", icon: Clock, value: "time-tracking", isTab: false },
  { title: "Unlinked Calls", url: "/unlinked-calls", icon: PhoneCall, value: "unlinked-calls", isTab: false },
  { title: "Integrations", url: "/integrations", icon: Plug, value: "integrations", isTab: false },
  { title: "Xero Reconciliation", url: "/reconciliation", icon: GitMerge, value: "reconciliation", isTab: false },
];

function SidebarNavContent({
  activeTab,
  onTabChange,
  isMobile,
  setOpenMobile,
  setOpen,
  location,
  setLocation,
  isAdmin,
  isCrew,
  logout,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  setOpen: (open: boolean) => void;
  location: string;
  setLocation: (path: string) => void;
  isAdmin: boolean;
  isCrew: boolean;
  logout: () => void;
}) {
  const vehicleActive = location === "/vehicle-inspection" || location === "/vehicle-inspection-history";
  const jhaActive = location === "/jha-assessment" || location === "/jha-history";

  const [vehicleOpen, setVehicleOpen] = useState(vehicleActive);
  const [jhaOpen, setJhaOpen] = useState(jhaActive);

  useEffect(() => {
    if (vehicleActive) setVehicleOpen(true);
  }, [vehicleActive]);

  useEffect(() => {
    if (jhaActive) setJhaOpen(true);
  }, [jhaActive]);

  const close = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleTabClick = (tabValue: string) => {
    if (location !== "/job-dashboard") {
      setLocation("/job-dashboard");
    }
    onTabChange(tabValue);
    close();
  };

  const handleLinkClick = () => {
    close();
  };

  const filteredDashboardItems = isAdmin
    ? dashboardItems
    : dashboardItems.filter((item) => item.value === "jobs");

  return (
    <>
      <SidebarContent className="pt-safe pt-6 md:pt-0 font-light">
        {/* Core Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel>{isCrew ? "My Work" : "Core Dashboard"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="font-normal text-[16px]">
              {/* Dispatch Board */}
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

              {/* Staff Schedule */}
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

              {/* Vehicle Inspection — collapsible group */}
              <Collapsible open={vehicleOpen} onOpenChange={setVehicleOpen} className="group/vehicle-collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={vehicleActive} data-testid="collapsible-vehicle-inspection">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <ClipboardCheck className="h-4 w-4" />
                      </span>
                      <span>Vehicle Inspection</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/vehicle-collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/vehicle-inspection"}>
                          <Link href="/vehicle-inspection" onClick={handleLinkClick} data-testid="link-vehicle-inspection">
                            <span>New Inspection</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/vehicle-inspection-history"}>
                          <Link href="/vehicle-inspection-history" onClick={handleLinkClick} data-testid="link-inspection-history">
                            <span>History</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* JHA — collapsible group */}
              <Collapsible open={jhaOpen} onOpenChange={setJhaOpen} className="group/jha-collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={jhaActive} data-testid="collapsible-jha">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                        <Shield className="h-4 w-4" />
                      </span>
                      <span>JHA</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/jha-collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/jha-assessment"}>
                          <Link href="/jha-assessment" onClick={handleLinkClick} data-testid="link-jha-assessment">
                            <span>Assessment</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/jha-history"}>
                          <Link href="/jha-history" onClick={handleLinkClick} data-testid="link-jha-history">
                            <span>History</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Mulch Drops */}
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
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} onClick={handleLinkClick} data-testid={`link-${item.value}`}>
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
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
              <SidebarMenuButton asChild isActive={location.startsWith("/settings")}>
                <button
                  className="w-full justify-start"
                  data-testid="button-tab-settings"
                  onClick={() => {
                    onTabChange("settings");
                    setLocation("/settings");
                    close();
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
                  close();
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
    </>
  );
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { setOpen, setOpenMobile, openMobile, isMobile } = useSidebar();
  const { logout, currentUser, isAdmin, isCrew } = useAuth();

  // Close sidebar automatically on mobile when location changes
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location, setOpenMobile, isMobile]);

  const navProps = {
    activeTab,
    onTabChange,
    isMobile,
    setOpenMobile,
    setOpen,
    location,
    setLocation,
    isAdmin: !!isAdmin,
    isCrew: !!isCrew,
    logout,
  };

  // Mobile: render a custom fixed overlay drawer — bypasses Radix Sheet/portal entirely
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[200] bg-black/50 transition-opacity duration-300"
          style={{
            opacity: openMobile ? 1 : 0,
            pointerEvents: openMobile ? "auto" : "none",
          }}
          onClick={() => setOpenMobile(false)}
          aria-hidden="true"
        />
        {/* Drawer panel */}
        <div
          className="fixed inset-y-0 left-0 z-[201] flex flex-col w-72 bg-sidebar text-sidebar-foreground overflow-y-auto transition-transform duration-300 ease-in-out"
          style={{
            transform: openMobile ? "translateX(0)" : "translateX(-100%)",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          aria-label="Navigation"
        >
          <SidebarNavContent {...navProps} />
        </div>
      </>
    );
  }

  // Desktop: use the standard shadcn Sidebar component
  return (
    <Sidebar>
      <SidebarNavContent {...navProps} />
    </Sidebar>
  );
}

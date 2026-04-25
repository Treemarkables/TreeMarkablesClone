import { useEffect, useState } from "react";
import {
  Calendar,
  BarChart3,
  Users,
  Settings,
  GitBranch,
  Briefcase,
  Shield,
  LogOut,
  ClipboardCheck,
  Leaf,
  Bot,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
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
  const nearMissActive = location === "/near-miss-report" || location === "/near-miss-history";
  const financeActive = ["/invoices", "/templates", "/settings/invoice-builder", "/settings/proposal-builder", "/equipment", "/time-tracking", "/unlinked-calls", "/integrations", "/reconciliation"].includes(location);
  const opsActive = ["/calendar", "/workflows", "/opportunities", "/follow-up-queue", "/reputation", "/reviews", "/marketing", "/inbox", "/communications", "/metrics", "/profitability-calculator"].includes(location);

  const [vehicleOpen, setVehicleOpen] = useState(vehicleActive);
  const [jhaOpen, setJhaOpen] = useState(jhaActive);
  const [nearMissOpen, setNearMissOpen] = useState(nearMissActive);
  const [financeOpen, setFinanceOpen] = useState(financeActive);
  const [opsOpen, setOpsOpen] = useState(opsActive);

  useEffect(() => {
    if (vehicleActive) setVehicleOpen(true);
  }, [vehicleActive]);

  useEffect(() => {
    if (jhaActive) setJhaOpen(true);
  }, [jhaActive]);

  useEffect(() => {
    if (nearMissActive) setNearMissOpen(true);
  }, [nearMissActive]);

  useEffect(() => {
    if (financeActive) setFinanceOpen(true);
  }, [financeActive]);

  useEffect(() => {
    if (opsActive) setOpsOpen(true);
  }, [opsActive]);

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

              {/* Vehicle Inspection — direct link with collapsible submenu */}
              <Collapsible open={vehicleOpen} onOpenChange={setVehicleOpen} className="group/vehicle-collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={vehicleActive}>
                    <Link href="/vehicle-inspection" onClick={handleLinkClick} data-testid="link-vehicle-inspection">
                      <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-blue-100 text-blue-600">
                        <ClipboardCheck className="h-4 w-4" />
                      </span>
                      <span className="truncate">Vehicle Inspection</span>
                    </Link>
                  </SidebarMenuButton>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction data-testid="collapsible-vehicle-inspection">
                      <ChevronRight className="transition-transform duration-200 group-data-[state=open]/vehicle-collapsible:rotate-90" />
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/vehicle-inspection"}>
                          <Link href="/vehicle-inspection" onClick={handleLinkClick} data-testid="link-vehicle-inspection-new">
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

              {/* Near Miss Reports — collapsible */}
              <Collapsible open={nearMissOpen} onOpenChange={setNearMissOpen} className="group/nearmiss-collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={nearMissActive}>
                    <Link href="/near-miss-report" onClick={handleLinkClick} data-testid="link-near-miss-report">
                      <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full bg-amber-100 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <span className="truncate">Near Miss</span>
                    </Link>
                  </SidebarMenuButton>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction data-testid="collapsible-near-miss">
                      <ChevronRight className="transition-transform duration-200 group-data-[state=open]/nearmiss-collapsible:rotate-90" />
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/near-miss-report"}>
                          <Link href="/near-miss-report" onClick={handleLinkClick} data-testid="link-near-miss-report-new">
                            <span>New Report</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/near-miss-history"}>
                          <Link href="/near-miss-history" onClick={handleLinkClick} data-testid="link-near-miss-history">
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

        {/* Finance & Admin — collapsible, admin only */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="font-normal text-[16px]">
                <Collapsible open={financeOpen} onOpenChange={setFinanceOpen} className="group/finance-collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={financeActive} data-testid="collapsible-finance">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <span>Finance & Admin</span>
                        <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/finance-collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/invoices"}>
                            <Link href="/invoices" onClick={handleLinkClick} data-testid="link-invoices"><span>Invoices</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/templates"}>
                            <Link href="/templates" onClick={handleLinkClick} data-testid="link-templates"><span>Templates</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/settings/invoice-builder"}>
                            <Link href="/settings/invoice-builder" onClick={handleLinkClick} data-testid="link-invoice-builder"><span>Invoice Builder</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/settings/proposal-builder"}>
                            <Link href="/settings/proposal-builder" onClick={handleLinkClick} data-testid="link-proposal-builder"><span>Proposal Builder</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/equipment"}>
                            <Link href="/equipment" onClick={handleLinkClick} data-testid="link-equipment"><span>Equipment</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/time-tracking"}>
                            <Link href="/time-tracking" onClick={handleLinkClick} data-testid="link-time-tracking"><span>Time Tracking</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/integrations"}>
                            <Link href="/integrations" onClick={handleLinkClick} data-testid="link-integrations"><span>Integrations</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/reconciliation"}>
                            <Link href="/reconciliation" onClick={handleLinkClick} data-testid="link-reconciliation"><span>Xero Reconciliation</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/unlinked-calls"}>
                            <Link href="/unlinked-calls" onClick={handleLinkClick} data-testid="link-unlinked-calls"><span>Unlinked Calls</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Operations & Analysis — collapsible, admin only */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="font-normal text-[16px]">
                <Collapsible open={opsOpen} onOpenChange={setOpsOpen} className="group/ops-collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={opsActive} data-testid="collapsible-ops">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                          <BarChart3 className="h-4 w-4" />
                        </span>
                        <span>Operations & Analysis</span>
                        <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/ops-collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/calendar"}>
                            <Link href="/calendar" onClick={handleLinkClick} data-testid="link-calendar"><span>Calendar</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/workflows"}>
                            <Link href="/workflows" onClick={handleLinkClick} data-testid="link-workflows"><span>Workflows</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/opportunities"}>
                            <Link href="/opportunities" onClick={handleLinkClick} data-testid="link-opportunities"><span>Conversations</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/follow-up-queue"}>
                            <Link href="/follow-up-queue" onClick={handleLinkClick} data-testid="link-follow-up-queue"><span>Follow-up Queue</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/reputation"}>
                            <Link href="/reputation" onClick={handleLinkClick} data-testid="link-reputation"><span>Reputation</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/reviews"}>
                            <Link href="/reviews" onClick={handleLinkClick} data-testid="link-reviews"><span>Reviews</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/marketing"}>
                            <Link href="/marketing" onClick={handleLinkClick} data-testid="link-marketing"><span>Marketing Planner</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/inbox"}>
                            <Link href="/inbox" onClick={handleLinkClick} data-testid="link-inbox"><span>Inbox</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/communications"}>
                            <Link href="/communications" onClick={handleLinkClick} data-testid="link-call-log"><span>Call Log</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/metrics"}>
                            <Link href="/metrics" onClick={handleLinkClick} data-testid="link-metrics"><span>Metrics Dashboard</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/profitability-calculator"}>
                            <Link href="/profitability-calculator" onClick={handleLinkClick} data-testid="link-profitability-calculator"><span>Profitability Calculator</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
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

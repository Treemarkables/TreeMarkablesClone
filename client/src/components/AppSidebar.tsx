import { useEffect, useState } from "react";
import {
  Settings,
  LogOut,
  ChevronRight,
  LayoutDashboard,
  Pin,
  ClipboardList,
  ListTodo,
  Video,
  Search,
  BookOpen,
  Briefcase,
  Phone,
  CalendarDays,
  Car,
  Shield,
  Target,
  DollarSign,
  TrendingUp,
  Building2,
  type LucideIcon,
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
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleChecklistFeature } from "@/hooks/useRoleChecklistFeature";
import { PlanGate } from "@/components/PlanGate";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Shared row classes: tall flat row + blue-pill active state. Icons inherit
// currentColor, so the active row tints both the label and the icon blue.
const ITEM = "rounded-lg h-11 gap-3 text-[15px] data-[active=true]:bg-blue-50 data-[active=true]:text-blue-600 data-[active=true]:hover:bg-blue-50 data-[active=true]:hover:text-blue-600";

// Fixed-width icon slot so labels line up. The span wrapper keeps the svg out
// of SidebarMenuButton's [&>svg]:size-4 direct-child rule (we want 20px here
// to match the 15-16px labels on tall h-11 rows).
function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="w-6 flex items-center justify-center shrink-0" aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
  );
}

const dashboardItems = [
  { title: "All Jobs", url: "/job-dashboard", icon: Briefcase, value: "jobs", isTab: true },
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
  userName,
  userEmail,
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
  userName: string;
  userEmail: string;
}) {
  // Platform operator (Treemarkables/Inflow) — gates the Subscribers footer link.
  const platformOperator = useRoleChecklistFeature();

  // Which tenant this session belongs to — the response envelope varies across
  // cached consumers ({data} vs bare row), so coerce both shapes.
  const { data: settingsResp } = useQuery<{ data?: { businessName?: string }; businessName?: string }>({
    queryKey: ["/api/business-settings"],
    staleTime: 5 * 60 * 1000,
  });
  const businessName = settingsResp?.data?.businessName ?? settingsResp?.businessName ?? "";

  const identityPrimary = businessName || userName || userEmail;
  const identitySecondary = businessName ? userName || userEmail : userName ? userEmail : "";
  const identityInitials = identityPrimary
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  const vehicleActive = location === "/vehicle-inspection" || location === "/vehicle-inspection-history";
  const safetyActive = location === "/safety" || location.startsWith("/safety/") || ["/jha-assessment", "/jha-history", "/near-miss-report", "/near-miss-history"].includes(location);
  const financeActive = ["/metrics", "/profitability-calculator"].includes(location);
  const opsActive = ["/calendar", "/workflows", "/opportunities", "/follow-up-queue", "/reputation", "/reviews", "/marketing", "/inbox"].includes(location);

  const [vehicleOpen, setVehicleOpen] = useState(vehicleActive);
  const [safetyOpen, setSafetyOpen] = useState(safetyActive);
  const [financeOpen, setFinanceOpen] = useState(financeActive);
  const [opsOpen, setOpsOpen] = useState(opsActive);

  useEffect(() => {
    if (vehicleActive) setVehicleOpen(true);
  }, [vehicleActive]);

  useEffect(() => {
    if (safetyActive) setSafetyOpen(true);
  }, [safetyActive]);

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
      {identityPrimary && (
        <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-3" data-testid="sidebar-account">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-sm font-semibold">
              {identityInitials}
            </div>
            <div className="min-w-0 flex-1" title={userEmail}>
              <p className="truncate text-[15px] font-semibold leading-tight" data-testid="text-business-name">
                {identityPrimary}
              </p>
              {identitySecondary && (
                <p className="truncate text-[13px] text-muted-foreground leading-tight mt-0.5" data-testid="text-logged-in-user">
                  {identitySecondary}
                </p>
              )}
            </div>
          </div>
        </SidebarHeader>
      )}
      <SidebarContent className="pt-2 md:pt-0 font-light">
        {/* Core Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel>{isCrew ? "My Work" : "Core Dashboard"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="font-normal text-[16px]">
              {/* One Dashboard — top-level overview */}
              {isAdmin && (
                <PlanGate requires="plan:crew">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/metrics"} className={ITEM}>
                    <Link href="/metrics" onClick={handleLinkClick} data-testid="link-one-dashboard">
                      <NavIcon icon={LayoutDashboard} />
                      <span>One Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                </PlanGate>
              )}

              {/* Today — daily command centre */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/today"} className={ITEM}>
                  <Link href="/today" onClick={handleLinkClick} data-testid="link-today">
                    <NavIcon icon={Pin} />
                    <span>Today</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Dispatch Board */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/dispatch"} className={ITEM}>
                  <Link href="/dispatch" onClick={handleLinkClick} data-testid="link-dispatch">
                    <NavIcon icon={ClipboardList} />
                    <span>Dispatch Board</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Tasks — internal Kanban (gear, admin, follow-ups) */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/tasks"} className={ITEM}>
                  <Link href="/tasks" onClick={handleLinkClick} data-testid="link-tasks">
                    <NavIcon icon={ListTodo} />
                    <span>Tasks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Videos — walkthrough + how-to video library */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/videos"} className={ITEM}>
                  <Link href="/videos" onClick={handleLinkClick} data-testid="link-videos">
                    <NavIcon icon={Video} />
                    <span>Videos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Library — unified search across all photos + videos with optional map view */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/library"} className={ITEM}>
                  <Link href="/library" onClick={handleLinkClick} data-testid="link-library">
                    <NavIcon icon={Search} />
                    <span>Library</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Help — subscriber-facing SOPs + how-to videos */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/help"} className={ITEM}>
                  <Link href="/help" onClick={handleLinkClick} data-testid="link-help">
                    <NavIcon icon={BookOpen} />
                    <span>Help</span>
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
                      className={ITEM}
                    >
                      <NavIcon icon={item.icon} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={location === item.url} className={ITEM}>
                      <Link href={item.url} onClick={handleLinkClick} data-testid={`link-${item.value}`}>
                        <NavIcon icon={item.icon} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}

              {/* Calls — recorded call log (paid add-on, any tier) */}
              {isAdmin && (
                <PlanGate requires="addon:call_recording">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/calls"} className={ITEM}>
                      <Link href="/calls" onClick={handleLinkClick} data-testid="link-calls">
                        <NavIcon icon={Phone} />
                        <span>Calls</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </PlanGate>
              )}

              {/* Staff Schedule */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/staff-schedule"} className={ITEM}>
                  <Link href="/staff-schedule" onClick={handleLinkClick} data-testid="link-staff-schedule">
                    <NavIcon icon={CalendarDays} />
                    <span>Staff Schedule</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Vehicle Inspection — direct link with collapsible submenu */}
              <Collapsible open={vehicleOpen} onOpenChange={setVehicleOpen} className="group/vehicle-collapsible">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={vehicleActive} className={ITEM}>
                    <Link href="/vehicle-inspection" onClick={handleLinkClick} data-testid="link-vehicle-inspection">
                      <NavIcon icon={Car} />
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

              {/* Safety — collapsible group (JHA + Near Miss). Crew+ only — hidden on Freemium. */}
              <PlanGate requires="plan:crew">
              <Collapsible open={safetyOpen} onOpenChange={setSafetyOpen} className="group/safety-collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton data-testid="collapsible-safety" isActive={safetyActive} className={ITEM}>
                      <NavIcon icon={Shield} />
                      <span>Safety</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/safety-collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/safety"}>
                          <Link href="/safety" onClick={handleLinkClick} data-testid="link-safety-hub">
                            <span>Safety Hub</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/safety/toolbox-talks"}>
                          <Link href="/safety/toolbox-talks" onClick={handleLinkClick} data-testid="link-toolbox-talks">
                            <span>Toolbox Talks</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/safety/swms"}>
                          <Link href="/safety/swms" onClick={handleLinkClick} data-testid="link-swms">
                            <span>SWMS</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/safety/prestart-checklists"}>
                          <Link href="/safety/prestart-checklists" onClick={handleLinkClick} data-testid="link-prestart-checklists">
                            <span>Pre-start Checklists</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/safety/equipment-register"}>
                          <Link href="/safety/equipment-register" onClick={handleLinkClick} data-testid="link-equipment-register">
                            <span>Inspection Register</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/safety/competency-register"}>
                          <Link href="/safety/competency-register" onClick={handleLinkClick} data-testid="link-competency-register">
                            <span>Training &amp; Competency</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/safety/notifiable-events"}>
                          <Link href="/safety/notifiable-events" onClick={handleLinkClick} data-testid="link-notifiable-events">
                            <span>Notifiable Events</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/jha-assessment"}>
                          <Link href="/jha-assessment" onClick={handleLinkClick} data-testid="link-jha-assessment">
                            <span>JHA Assessment</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/jha-history"}>
                          <Link href="/jha-history" onClick={handleLinkClick} data-testid="link-jha-history">
                            <span>JHA History</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/near-miss-report"}>
                          <Link href="/near-miss-report" onClick={handleLinkClick} data-testid="link-near-miss-report">
                            <span>Near Miss Report</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location === "/near-miss-history"}>
                          <Link href="/near-miss-history" onClick={handleLinkClick} data-testid="link-near-miss-history">
                            <span>Near Miss History</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              </PlanGate>

              {/* Mulch Drops */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/mulch-drops"} className={ITEM}>
                  <Link href="/mulch-drops" onClick={handleLinkClick} data-testid="link-mulch-drops">
                    <NavIcon icon={Target} />
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
                      <SidebarMenuButton data-testid="collapsible-finance" isActive={financeActive} className={ITEM}>
                        <NavIcon icon={DollarSign} />
                        <span>Finance & Admin</span>
                        <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/finance-collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <PlanGate requires="plan:crew">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/metrics"}>
                            <Link href="/metrics" onClick={handleLinkClick} data-testid="link-metrics"><span>Metrics Dashboard</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        </PlanGate>
                        <PlanGate requires="plan:crew">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/profitability-calculator"}>
                            <Link href="/profitability-calculator" onClick={handleLinkClick} data-testid="link-profitability-calculator"><span>Profitability Calculator</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        </PlanGate>
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
                      <SidebarMenuButton data-testid="collapsible-ops" isActive={opsActive} className={ITEM}>
                        <NavIcon icon={TrendingUp} />
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
                        <PlanGate requires="plan:business">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location === "/workflows"}>
                            <Link href="/workflows" onClick={handleLinkClick} data-testid="link-workflows"><span>Workflows</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        </PlanGate>
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
          {/* Platform-operator only: concierge subscriber management. Same
              allowlist gate as the Settings Platform section; the server
              enforces via requirePlatformAdmin regardless. */}
          {isAdmin && platformOperator && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/admin/subscribers"} className={ITEM}>
                <Link href="/admin/subscribers" onClick={handleLinkClick} data-testid="link-subscribers">
                  <Building2 className="h-5 w-5 shrink-0 text-slate-600" />
                  <span>Subscribers</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.startsWith("/settings")} className={ITEM}>
                <button
                  className="w-full justify-start"
                  data-testid="button-tab-settings"
                  onClick={() => {
                    onTabChange("settings");
                    setLocation("/settings");
                    close();
                  }}
                >
                  <Settings className="h-5 w-5 shrink-0 text-slate-600" />
                  <span>Settings</span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild className={ITEM}>
              <button
                className="w-full justify-start"
                data-testid="button-logout"
                onClick={() => {
                  logout();
                  close();
                }}
              >
                <LogOut className="h-5 w-5 shrink-0 text-slate-600" />
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
    userName: [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" "),
    userEmail: currentUser?.email ?? "",
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

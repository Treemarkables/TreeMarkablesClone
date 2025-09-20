import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Home from "@/pages/Home";
import TreeRemoval from "@/pages/TreeRemoval";
import TreePruning from "@/pages/TreePruning";
import StumpGrinding from "@/pages/StumpGrinding";
import HedgeTrimming from "@/pages/HedgeTrimming";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import SummerOffer from "@/pages/SummerOffer";
import JobDashboard from "@/pages/JobDashboard";
import MetricsDashboard from "@/pages/MetricsDashboard";
import Pipeline from "@/pages/Pipeline";
import Opportunities from "@/pages/Opportunities";
import Reputation from "@/pages/Reputation";
import Inbox from "@/pages/Inbox";
import Integrations from "@/pages/Integrations";
import NotFound from "@/pages/not-found";
import { useState } from "react";

// Sidebar layout wrapper for dashboard pages
function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState("overview");
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      <Route path="/tree-removal" component={TreeRemoval}/>
      <Route path="/tree-pruning" component={TreePruning}/>
      <Route path="/stump-grinding" component={StumpGrinding}/>
      <Route path="/hedge-trimming" component={HedgeTrimming}/>
      <Route path="/blog" component={Blog}/>
      <Route path="/blog/:slug" component={BlogPost}/>
      <Route path="/summer-offer" component={SummerOffer}/>
      <Route path="/job-dashboard" component={JobDashboard}/>
      <Route path="/metrics" component={MetricsDashboard}/>
      
      {/* Dashboard pages with sidebar */}
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
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

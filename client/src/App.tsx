import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import TreeRemoval from "@/pages/TreeRemoval";
import TreePruning from "@/pages/TreePruning";
import StumpGrinding from "@/pages/StumpGrinding";
import HedgeTrimming from "@/pages/HedgeTrimming";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import SummerOffer from "@/pages/SummerOffer";
import JobDashboard from "@/pages/JobDashboard";
import NotFound from "@/pages/not-found";

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

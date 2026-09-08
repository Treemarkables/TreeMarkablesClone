import { Component, lazy, ReactNode, Suspense, useState } from "react";
import { TreePine, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isChunkLoadError } from "@/lib/staleChunkReload";

// Leaflet + its CSS only load once the section is expanded, keeping them out of
// the main bundle.
const JobSiteMap = lazy(() =>
  import("@/components/JobSiteMap").then((m) => ({ default: m.JobSiteMap })),
);

// Contains a stale-bundle chunk failure to this section instead of letting it
// reach JobCardErrorBoundary, whose recovery is an immediate full reload — the
// job card is plain React state, so that reload silently dumped the user back
// onto the page underneath (the dispatch board). Here the rest of the job card
// keeps working and the user chooses when to reload. Non-chunk errors rethrow
// to the outer boundary, which owns reporting.
class SiteMapChunkBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      if (!isChunkLoadError(this.state.error)) throw this.state.error;
      return (
        <div className="flex flex-col items-center justify-center gap-3 h-64 bg-muted rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">
            The app has been updated — reload to open the Site Map.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reload app
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface JobSiteMapSectionProps {
  jobId: string;
  address?: string;
  className?: string;
}

export function JobSiteMapSection({
  jobId,
  address,
  className = "",
}: JobSiteMapSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) setHasOpened(true);
      }}
      className={className}
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <TreePine className="h-3.5 w-3.5" />
            Site Map (Mark Trees)
          </span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <Card className="overflow-hidden">
          <CardContent className="p-2">
            {hasOpened && (
              <SiteMapChunkBoundary>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <JobSiteMap jobId={jobId} address={address} />
                </Suspense>
              </SiteMapChunkBoundary>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

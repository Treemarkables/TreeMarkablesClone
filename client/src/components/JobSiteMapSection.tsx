import { lazy, Suspense, useState } from "react";
import { TreePine, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Leaflet + its CSS only load once the section is expanded, keeping them out of
// the main bundle.
const JobSiteMap = lazy(() =>
  import("@/components/JobSiteMap").then((m) => ({ default: m.JobSiteMap })),
);

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
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <JobSiteMap jobId={jobId} address={address} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

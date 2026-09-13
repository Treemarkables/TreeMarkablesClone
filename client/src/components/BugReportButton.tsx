import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBugReport } from "@/contexts/BugReportContext";

// Header entry point for "Report a problem" — visible to every signed-in member
// (crew included) so a beta tester can file from whatever screen misbehaved.
export function BugReportButton({ className }: { className?: string }) {
  const { open } = useBugReport();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={open}
      aria-label="Report a problem"
      title="Report a problem"
      className={className}
      data-testid="button-report-problem"
    >
      <Bug className="h-5 w-5" />
    </Button>
  );
}

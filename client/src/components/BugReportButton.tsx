import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBugReport } from "@/contexts/BugReportContext";

// Header entry point for "Report a problem" — visible to every signed-in member
// (crew included) so a beta tester can file from whatever screen misbehaved.
// Solid violet circle so it reads as a deliberate, findable control next to
// the lime "+" and orange "paste" circles — not a greyed-out utility icon.
export function BugReportButton({ className }: { className?: string }) {
  const { open } = useBugReport();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={open}
      aria-label="Report a problem"
      title="Report a problem"
      className={`rounded-full bg-violet-600 text-white border-violet-700 shadow-sm ${className ?? ""}`}
      data-testid="button-report-problem"
    >
      <Bug className="h-6 w-6 md:h-5 md:w-5" />
    </Button>
  );
}

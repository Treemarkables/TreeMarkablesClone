import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Rocket, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChecklistData {
  requiredDone: number;
  requiredTotal: number;
}

const DISMISS_KEY = "onboarding_banner_dismissed";

/**
 * Slim setup-progress banner for the main dashboard. Shows how many essential
 * setup items remain and links to the full checklist (/settings/setup). Renders
 * nothing when: setup is complete, the user dismissed it, or the user can't read
 * the checklist (non-admins get 401 → query fails → null). Read-only.
 */
export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const { data } = useQuery<{ success: boolean; data: ChecklistData }>({
    queryKey: ["/api/onboarding/checklist"],
    enabled: !dismissed,
    // Don't retry the 401 non-admins get — just stay hidden.
    retry: false,
  });

  const done = data?.data?.requiredDone ?? 0;
  const total = data?.data?.requiredTotal ?? 0;

  // Hide until we have data, when everything's done, or when dismissed.
  if (dismissed || total === 0 || done >= total) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-primary/20 bg-primary/5">
      <Rocket className="h-4 w-4 text-primary shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Finish setting up your account</span>
        <span className="text-muted-foreground"> — {done} of {total} essentials done</span>
      </div>
      <Button size="sm" asChild className="shrink-0">
        <Link href="/settings/setup" className="inline-flex items-center gap-1">
          Continue setup <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
      <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss" className="shrink-0 px-2">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

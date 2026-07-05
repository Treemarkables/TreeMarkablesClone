import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X, ArrowRight } from "lucide-react";

// New-tenant activation checklist. Shows on the dispatch landing while a business still
// has setup to do, and auto-hides once every step is done (so an established business —
// incl. comped Treemarkables — never sees it) or the owner dismisses it.

interface OnboardingStatus {
  business: boolean;
  bank: boolean;
  channel: boolean;
  firstJob: boolean;
}

const STEPS: { key: keyof OnboardingStatus; label: string; href?: string; cta?: string; hint?: string }[] = [
  { key: "business", label: "Add your business details & logo", href: "/settings/company", cta: "Set up" },
  { key: "bank", label: "Add bank details so customers can pay you", href: "/settings/company", cta: "Add" },
  { key: "channel", label: "Register your phone or email", href: "/settings/channels", cta: "Register" },
  { key: "firstJob", label: "Create your first job", hint: "Use “+ New Job” above" },
];

const DISMISS_KEY = "inflow_onboarding_dismissed";

export function GettingStarted() {
  const [location] = useLocation();
  const onDispatch = location === "/dispatch";
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  const { data } = useQuery<{ success: boolean; data: OnboardingStatus }>({
    queryKey: ["/api/onboarding-status"],
    enabled: onDispatch && !dismissed,
    staleTime: 60 * 1000,
  });

  if (!onDispatch || dismissed) return null;
  const status = data?.data;
  if (!status) return null;

  const doneCount = STEPS.filter((s) => status[s.key]).length;
  if (doneCount === STEPS.length) return null; // fully set up → hide

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="m-4 border-primary/30" data-testid="getting-started">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Getting started · {doneCount}/{STEPS.length}</CardTitle>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss getting started">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {STEPS.map((step) => {
          const done = status[step.key];
          return (
            <div key={step.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={`text-sm truncate ${done ? "text-muted-foreground line-through" : ""}`}>
                  {step.label}
                </span>
              </div>
              {!done && step.href ? (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={step.href}>
                    {step.cta} <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              ) : !done && step.hint ? (
                <span className="text-xs text-muted-foreground shrink-0">{step.hint}</span>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

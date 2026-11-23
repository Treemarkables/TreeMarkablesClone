import { useLocation } from "wouter";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jhaAssessmentHref, type RiskAssessmentStatus } from "@shared/jhaJobRisk";

export function riskStatusFromUnknown(value: unknown): RiskAssessmentStatus {
  if (value === "completed" || value === "draft" || value === "none") return value;
  return "none";
}

/** Morning risk chip: completed JHA for this job today vs still needed. */
export function JobRiskStatusChip({
  status,
  testId = "job-risk-status",
}: {
  status: RiskAssessmentStatus | null | undefined;
  testId?: string;
}) {
  const done = status === "completed";
  return (
    <span
      className={
        done
          ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 shrink-0"
          : "inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold px-2.5 py-0.5 shrink-0"
      }
      data-testid={testId}
      data-risk-status={done ? "completed" : status === "draft" ? "draft" : "none"}
    >
      {done ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      {done ? "Risk done" : "Risk needed"}
    </span>
  );
}

/**
 * Chip plus the way to deal with a due assessment.
 * When the checklist owns the role, the card only points at that tab.
 * Tenants without the checklist still get the direct JHA action.
 */
export function JobRiskAssessmentBar({
  jobId,
  status,
  assessmentId,
  onOpenChecklist,
  testId = "job-risk-assessment",
}: {
  jobId: string;
  status: RiskAssessmentStatus | null | undefined;
  assessmentId?: string | null;
  /** Opens the Checklist tab, where the Risk assessment role lives. */
  onOpenChecklist?: () => void;
  testId?: string;
}) {
  const [, navigate] = useLocation();
  const resolved: RiskAssessmentStatus = status ?? "none";
  const due = resolved !== "completed";
  return (
    <div className="flex items-center justify-between gap-3" data-testid={testId}>
      <JobRiskStatusChip status={resolved} />
      {due && onOpenChecklist && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenChecklist}
          data-testid="button-open-risk-checklist"
        >
          Open checklist
        </Button>
      )}
      {due && !onOpenChecklist && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigate(
              jhaAssessmentHref(jobId, {
                riskAssessmentStatus: resolved,
                riskAssessmentId: assessmentId ?? null,
              }),
            )
          }
          data-testid="button-do-risk-assessment"
        >
          Do risk assessment
        </Button>
      )}
    </div>
  );
}

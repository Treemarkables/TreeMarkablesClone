/**
 * Job-card Hazard trees section. Crew-visible when HAZARD_TREE_PINS is on
 * (same /api/hazard-pins/enabled gate as the sidebar + /hazard-pins page).
 * Does not replace JobSiteMap / tree_markers.
 */
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { HazardPinCapture } from "@/components/HazardPinCapture";
import type { TreePinRiskRating } from "@shared/treePins";

interface EnabledPayload {
  success: boolean;
  data: {
    enabled: boolean;
    riskRatings: TreePinRiskRating[];
    workTypes: string[];
  };
}

export function JobHazardTreesSection({
  jobId,
  customerId,
}: {
  jobId: string;
  customerId?: string | null;
}) {
  const { data: enabledResp } = useQuery<EnabledPayload>({
    queryKey: ["/api/hazard-pins/enabled"],
  });
  const enabled = enabledResp?.data?.enabled === true;
  const riskRatings = enabledResp?.data?.riskRatings ?? ["low", "medium", "high", "critical"];
  const workTypes = enabledResp?.data?.workTypes ?? [];

  if (!enabled) return null;

  return (
    <div
      className="bg-card border border-border rounded-2xl p-4"
      data-testid="section-job-hazard-trees"
    >
      <div className="flex items-center gap-2 text-[14px] font-bold text-foreground mb-3">
        <span className="w-1 h-3.5 rounded-full bg-brand-lime" aria-hidden="true" />
        <MapPin className="h-3.5 w-3.5" />
        Hazard trees
      </div>
      {!customerId ? (
        <p className="text-sm text-muted-foreground">
          Link a customer to drop GPS pins for this site.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Drop a GPS pin at a tree. Pins stay on the customer after this job is done.
            They are not the Site Map markers above.
          </p>
          <HazardPinCapture
            customerId={customerId}
            jobId={jobId}
            enabled={enabled}
            riskRatings={riskRatings}
            workTypes={workTypes}
          />
        </div>
      )}
    </div>
  );
}

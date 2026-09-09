/**
 * Hazard-tree pin register — shared constants and status helpers.
 *
 * Distinct from job-scoped `tree_markers` (JobSiteMap overlay that dies with
 * the job). These pins belong to a customer site and survive across quotes
 * and jobs. See HAZARD_TREE_PINS_PLAN.md.
 */

export const TREE_PIN_STATUSES = [
  "assessed",
  "quoted",
  "scheduled",
  "done",
  "monitor",
] as const;

export type TreePinStatus = (typeof TREE_PIN_STATUSES)[number];

export const TREE_PIN_RISK_RATINGS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type TreePinRiskRating = (typeof TREE_PIN_RISK_RATINGS)[number];

/** Suggested work types at the tree. Free text is also allowed (P0). */
export const TREE_PIN_WORK_TYPES = [
  "Remove",
  "Reduce",
  "Deadwood",
  "Prune",
  "Stump grind",
  "Cable / brace",
  "Monitor",
  "Other",
] as const;

export type TreePinWorkType = (typeof TREE_PIN_WORK_TYPES)[number];

const STATUS_SET = new Set<string>(TREE_PIN_STATUSES);

export function isTreePinStatus(value: string): value is TreePinStatus {
  return STATUS_SET.has(value);
}

/**
 * Allowed manual transitions. Office/field can skip quote for urgent work
 * (assessed → scheduled). Done trees can re-enter monitor or a fresh assessment.
 */
export function nextTreePinStatuses(current: TreePinStatus): TreePinStatus[] {
  switch (current) {
    case "assessed":
      return ["quoted", "scheduled", "monitor"];
    case "quoted":
      return ["scheduled", "assessed", "monitor"];
    case "scheduled":
      return ["done", "quoted"];
    case "done":
      return ["monitor", "assessed"];
    case "monitor":
      return ["assessed", "quoted"];
  }
}

export function canTransitionTreePinStatus(
  from: TreePinStatus,
  to: TreePinStatus,
): boolean {
  if (from === to) return true;
  return nextTreePinStatuses(from).includes(to);
}

/**
 * Suggested pin status from a linked Inflow job's status. Pin status is stored
 * explicitly (so monitor/assessed work without a job); P2 may sync this when
 * a job is linked. Returns null when the job status does not imply a pin state
 * (e.g. mulch, invoiced).
 */
export function pinStatusFromJobStatus(jobStatus: string): TreePinStatus | null {
  switch (jobStatus) {
    case "lead":
    case "quote":
      return "quoted";
    case "scheduled":
    case "work_order":
      return "scheduled";
    case "completed":
      return "done";
    case "unsuccessful":
      return "assessed";
    default:
      return null;
  }
}

/** Apple Maps / Google Maps deep link for crew nav (P3). */
export function treePinMapsUrl(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(7);
  const lng = longitude.toFixed(7);
  return `https://maps.google.com/?q=${lat},${lng}`;
}

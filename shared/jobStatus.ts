import type { JobStatusType } from "./schema";

// Returns the status a job should move to when it's "booked in" (a calendar
// date and/or crew gets assigned). Returns null to leave the current status
// alone. Lead → quote means the booking is a site visit; quote/work_order
// → scheduled means the booking is the actual work crew.
export function statusAfterBooking(current?: string | null): JobStatusType | null {
  switch (current) {
    case "lead":
    case "new":
      return "quote";
    case "quote":
    case "work_order":
      return "scheduled";
    default:
      return null;
  }
}

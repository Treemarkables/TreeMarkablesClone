import type { JobStatusType } from "./schema";

// Returns the status a job should move to when it's "booked in" (a calendar
// date and/or crew gets assigned). Returns null to leave the current status
// alone. Lead → quote means the booking is a site visit; work_order →
// scheduled means the booking is the actual work crew. A 'quote' job that
// gets booked in is a quoting site visit — it stays 'quote' until the
// customer accepts (which flips it to work_order via the quote/proposal
// acceptance flow); only then does scheduling it move it to 'scheduled'.
export function statusAfterBooking(current?: string | null): JobStatusType | null {
  switch (current) {
    case "lead":
    case "new":
      return "quote";
    case "work_order":
      return "scheduled";
    default:
      return null;
  }
}

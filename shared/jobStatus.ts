import type { JobStatusType } from "./schema";

// Bookings are pure calendar actions. Assigning a date or crew to a job
// updates its scheduling fields but never changes its status. Owners drive
// status changes explicitly via the job card (Lead → Quote → Work Order →
// Completed / Unsuccessful).
//
// Pre-2026-05 this function moved jobs between statuses on booking
// (lead → quote, work_order → scheduled) and `'scheduled'` was a real
// status value. Both were retired in 2026-05 because the auto-transition
// confused users — once a job became `'scheduled'` it didn't cleanly come
// back to `'work_order'` when the booking was changed, and a lead picking
// up a quote site-visit booking became a quote even when it shouldn't.
//
// The export stays so callers compile without churn; it now always returns
// null. Any remaining call sites can be removed when convenient.
export function statusAfterBooking(_current?: string | null): JobStatusType | null {
  return null;
}

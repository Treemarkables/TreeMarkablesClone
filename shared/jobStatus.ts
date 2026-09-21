import type { JobStatusType } from "./schema";

// Returns the status a job should move to when it gets "booked in" (a calendar
// date / crew is assigned), or null to leave the current status alone.
//
// A 'quote' that gets scheduled is treated as committing to do the work, so it
// advances to 'work_order'. (This is the owner's chosen workflow: scheduling a
// quote = the job is booked. Re-added 2026-06 after being disabled in 2026-05.)
//
// History: pre-2026-05 this also did lead → quote and work_order → 'scheduled',
// with `'scheduled'` as a real status. Both were retired because they confused
// users — a 'scheduled' job didn't cleanly return to 'work_order' when the
// booking changed, and a lead picking up a quoting site-visit booking became a
// quote when it shouldn't. We do NOT reintroduce either of those here;
// `'scheduled'` remains a dead status. Only the quote → work_order transition
// is active. The diary Book button is a separate action — see
// statusAfterDiaryBook().
export function statusAfterBooking(current?: string | null): JobStatusType | null {
  switch (current) {
    case "quote":
      return "work_order";
    default:
      return null;
  }
}

// Diary "Book" only (POST /api/calendar/quick-book from the job diary).
// Booking a lead from an email/text is the quoting visit, so the job becomes
// 'quote' — the same status value used by quote filters and lead→quote
// upgrades elsewhere. Other statuses follow statusAfterBooking.
// Keep this off statusAfterBooking: crew scheduling and dispatch drops use
// that helper and must leave a lead as a lead.
export function statusAfterDiaryBook(current?: string | null): JobStatusType | null {
  if (current === "lead") return "quote";
  return statusAfterBooking(current);
}

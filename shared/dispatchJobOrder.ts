/**
 * Dispatch Unscheduled ordering.
 *
 * The rail used to list work orders FIFO by work_order_at (oldest acceptance
 * first). Jullian wants the job touched most recently at the top.
 *
 * Activity is the latest of:
 *   - jobs.updated_at
 *   - jobs.created_at (fallback when nothing else is stamped)
 *   - jobs.last_activity_at (existing column; many SMS/email paths stamp it)
 *   - proposal sent: jobs.proposal_sent_date, jobs.quote_presented_date,
 *     proposals.sent_date, quotes.sent_date
 *   - proposal accepted: jobs.work_order_at, proposals.response_date /
 *     signed_date, quotes.response_date
 *   - latest job_diary_entries.created_at
 *
 * The SQL in storage.getAllJobs (sort=recentActivity) computes the same
 * greatest in one grouped pass and returns it as recentActivityAt. This
 * function is what the board sorts by, and it also covers a fresher local
 * timestamp (an edit that has not been refetched yet).
 */

export type JobActivityTimestamps = {
  recentActivityAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  lastActivityAt?: Date | string | null;
  proposalSentDate?: Date | string | null;
  quotePresentedDate?: Date | string | null;
  workOrderAt?: Date | string | null;
  /** MAX(job_diary_entries.created_at), when the caller has it separately. */
  latestDiaryAt?: Date | string | null;
  /** Latest proposal/quote sent, accepted, or signed time. */
  latestProposalAt?: Date | string | null;
};

function timeMs(value: Date | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Latest activity instant, or null when the job has no usable timestamp. */
export function recentJobActivityMs(job: JobActivityTimestamps): number | null {
  const candidates = [
    job.recentActivityAt,
    job.updatedAt,
    job.createdAt,
    job.lastActivityAt,
    job.proposalSentDate,
    job.quotePresentedDate,
    job.workOrderAt,
    job.latestDiaryAt,
    job.latestProposalAt,
  ];
  let best: number | null = null;
  for (const value of candidates) {
    const time = timeMs(value);
    if (time == null) continue;
    if (best == null || time > best) best = time;
  }
  return best;
}

function createdAtDesc(a: JobActivityTimestamps, b: JobActivityTimestamps): number {
  const aCreated = timeMs(a.createdAt);
  const bCreated = timeMs(b.createdAt);
  if (aCreated == null && bCreated == null) return 0;
  if (aCreated == null) return 1;
  if (bCreated == null) return -1;
  return bCreated - aCreated;
}

/**
 * Most recent activity first. Equal activity (or no activity) falls back to
 * created_at descending. Jobs with no timestamps sort last.
 */
export function compareByRecentActivity(
  a: JobActivityTimestamps,
  b: JobActivityTimestamps,
): number {
  const aMs = recentJobActivityMs(a);
  const bMs = recentJobActivityMs(b);
  if (aMs == null && bMs == null) return createdAtDesc(a, b);
  if (aMs == null) return 1;
  if (bMs == null) return -1;
  if (aMs !== bMs) return bMs - aMs;
  return createdAtDesc(a, b);
}

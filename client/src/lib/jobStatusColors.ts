// Single source of truth for job-status colours. Previously three components
// (JobCardMobile, JobCardDesktop, JobDetailsPanel) each carried their own
// copy of this palette and they had already drifted.
//
// Two visual treatments of the same palette:
//   solid — filled badge, white text (job-card headers)
//   soft  — tinted chip, dark text (mobile details panel)
//
// NOTE: DispatchBoard still renders its own divergent scheme (lead=yellow-500,
// quote=orange, plus board-only statuses like invoiced/mulch/archived) in
// getJobStatusColor/getJobStatusColorValue. Unifying it onto this palette
// changes visible board colours, so that's a deliberate follow-up, not an
// accidental repaint.

export type JobStatusVisual = {
  label: string;
  /** Filled badge background — pair with white text. */
  solid: string;
  /** Tinted chip background — pair with softFg text. */
  soft: string;
  /** Text colour on the soft chip. */
  softFg: string;
};

const JOB_STATUS: Record<string, JobStatusVisual> = {
  lead: { label: "Lead", solid: "#f59e0b", soft: "#fef3c7", softFg: "#9a3412" },
  quote: { label: "Quote", solid: "#f59e0b", soft: "#fef3c7", softFg: "#9a3412" },
  work_order: { label: "Work Order", solid: "#2563eb", soft: "#eff6ff", softFg: "#1d4ed8" },
  scheduled: { label: "Scheduled", solid: "#8b5cf6", soft: "#f3e8ff", softFg: "#6b21a8" },
  completed: { label: "Completed", solid: "#16a34a", soft: "#dcfce7", softFg: "#15803d" },
  unsuccessful: { label: "Unsuccessful", solid: "#ef4444", soft: "#fee2e2", softFg: "#b91c1c" },
};

/** Solid badge (job-card header). Unknown statuses fall back to slate. */
export function getJobStatusBadge(status: string): { label: string; bg: string } {
  const meta = JOB_STATUS[status];
  return meta ? { label: meta.label, bg: meta.solid } : { label: status, bg: "#64748b" };
}

/** Soft chip (details panel). Unknown statuses fall back to a slate tint. */
export function getJobStatusChip(status: string): { label: string; bg: string; fg: string } {
  const meta = JOB_STATUS[status];
  return meta
    ? { label: meta.label, bg: meta.soft, fg: meta.softFg }
    : { label: status, bg: "#f1f5f9", fg: "#475569" };
}

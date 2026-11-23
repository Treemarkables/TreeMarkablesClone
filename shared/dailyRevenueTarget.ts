/**
 * Per-business Despatch daily revenue target.
 *
 * Stored on `business_settings.daily_revenue_target` (NZD, exclusive of GST).
 * Despatch bundling and the schedule revenue bar must call
 * `parseDailyRevenueTarget` on the stored value. Do not substitute a
 * hardcoded daily target when the field is missing.
 */

/** Label already used beside this KPI on Despatch and Staff Schedule. */
export const DAILY_REVENUE_TARGET_GST_LABEL = "exc. GST";

/** Positive NZD amount, or null when the business has no usable target yet. */
export function parseDailyRevenueTarget(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

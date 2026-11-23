/**
 * Ex-GST price string for a Despatch job tile.
 *
 * `jobs.subtotal` is ex-GST. `jobs.total_including_gst` is the GST-inclusive
 * total. `jobs.total_amount` is also ex-GST (convert-to-invoice and the job
 * card store it that way). Older rows often have a real `total_amount` and
 * zeros in the other two columns — dividing that by 1.15 shows a price that
 * was never charged (job 4131: 600 ex-GST displayed as $522).
 *
 * Order: subtotal if > 0; else totalIncludingGst / 1.15 if > 0; else
 * totalAmount as stored, divided by 1.15 only when taxMode is GST-inclusive.
 */

export interface DispatchJobPrice {
  subtotal?: string | number | null;
  totalIncludingGst?: string | number | null;
  totalAmount?: string | number | null;
  taxMode?: string | null;
}

function positiveAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function asStored(value: string | number): string {
  return typeof value === "string" ? value : String(value);
}

function dividedByGst(amount: number): string {
  return String(Math.round((amount / 1.15) * 100) / 100);
}

/** True only for the job tax mode that stores the price GST-inclusive. */
export function taxModeIsGstInclusive(taxMode: string | null | undefined): boolean {
  return String(taxMode ?? "").trim().toLowerCase() === "tax_inclusive";
}

/** Ex-GST total used by both Despatch job-assignment mappings. */
export function dispatchJobTotalExGst(job: DispatchJobPrice): string {
  if (job.subtotal != null && job.subtotal !== "" && positiveAmount(job.subtotal) > 0) {
    return asStored(job.subtotal);
  }
  const includingGst = positiveAmount(job.totalIncludingGst);
  if (includingGst > 0) return dividedByGst(includingGst);
  if (job.totalAmount != null && job.totalAmount !== "" && positiveAmount(job.totalAmount) > 0) {
    if (taxModeIsGstInclusive(job.taxMode)) return dividedByGst(positiveAmount(job.totalAmount));
    return asStored(job.totalAmount);
  }
  return "0";
}

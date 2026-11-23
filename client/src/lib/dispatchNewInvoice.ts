/**
 * Despatch → New → Invoice.
 *
 * The menu used to POST /api/jobs with status "invoiced". That value is not
 * in JobStatus, so insertJobSchema rejects the body and the job card never
 * opens. Invoicing is a document on a job, not a job status. The draft is a
 * work order (the status the board already lists) and the card opens the
 * invoice builder once a customer is on the job.
 */

export function dispatchNewInvoiceJobStatus(): "work_order" {
  return "work_order";
}

export function dispatchNewInvoiceRequest(): {
  status: "work_order";
  openInvoice: true;
} {
  return { status: dispatchNewInvoiceJobStatus(), openInvoice: true };
}

/** A second click while the draft POST is in flight must not create another job. */
export function shouldStartDispatchInvoiceCreate(createAlreadyInFlight: boolean): boolean {
  return !createAlreadyInFlight;
}

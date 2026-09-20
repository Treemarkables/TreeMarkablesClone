import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import {
  extractInvoiceLineItems,
  pickInvoiceSourceDocument,
} from "@/lib/invoiceLineItemSources";

// One-button "job's done" flow: mark the job complete, generate the invoice
// (same line items the InvoiceBuilder would pre-fill), email it to the
// customer, then ASK whether to push it to Xero as well. Chains the existing
// endpoints — it adds no invoice logic of its own, so an invoice made here is
// indistinguishable from one made in the builder.

interface CompleteAndInvoiceDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Escape hatch when the job can't be invoiced blind (no price, no email…). */
  onOpenInvoiceBuilder: () => void;
  /** The job card's existing Send-to-Xero mutation (owns its own error toast). */
  sendToXero: () => Promise<unknown>;
}

type Step = "review" | "working" | "xero" | "done";

const formatNzd = (n: number) =>
  n.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });

const isInvoiceIssued = (invoice: any) =>
  !!invoice?.sentDate || ["sent", "paid", "overdue"].includes(invoice?.status);

export function CompleteAndInvoiceDialog({
  jobId,
  open,
  onOpenChange,
  onOpenInvoiceBuilder,
  sendToXero,
}: CompleteAndInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [step, setStep] = useState<Step>("review");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [xeroSending, setXeroSending] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("review");
      setProgress("");
      setError(null);
      setSentTo(null);
      setXeroSending(false);
    }
  }, [open]);

  // Same query keys the job card + InvoiceBuilder use, so these are normally
  // cache hits. The job itself is always refetched on open — the button acts on
  // billing fields, and a stale email/address would send to the wrong place.
  const { data: jobResp, isLoading: loadingJob } = useQuery<{ data?: any }>({
    queryKey: ["/api/jobs", jobId],
    enabled: open && !!jobId,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const job = jobResp?.data;

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["/api/customers", job?.customerId],
    enabled: open && !!job?.customerId,
    select: (response: any) => response?.data || response,
  });

  const { data: proposalsResponse, isLoading: loadingProposals } = useQuery({
    queryKey: ["/api/proposals", jobId],
    queryFn: async () => {
      const response = await fetch(
        `/api/proposals?jobId=${jobId}&includeSections=true`,
      );
      if (!response.ok) throw new Error("Failed to fetch proposals");
      return response.json();
    },
    enabled: open && !!jobId,
  });

  const { data: quotesResponse, isLoading: loadingQuotes } = useQuery({
    queryKey: ["/api/quotes", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes?jobId=${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: open && !!jobId,
  });

  const { data: invoicesResponse, isLoading: loadingInvoices } = useQuery({
    queryKey: ["/api/invoices", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?jobId=${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: open && !!jobId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: businessSettings } = useQuery({
    queryKey: ["/api/business-settings"],
    enabled: open,
  });

  const { data: xeroStatus } = useQuery<{ connected?: boolean }>({
    queryKey: ["/api/xero/status"],
    enabled: open && can("plan:crew"),
  });

  const loading =
    loadingJob ||
    loadingCustomer ||
    loadingProposals ||
    loadingQuotes ||
    loadingInvoices;

  // Coerce: these shared keys have been cached with inconsistent shapes.
  const proposals: any[] = useMemo(
    () => (Array.isArray(proposalsResponse?.data) ? proposalsResponse.data : []),
    [proposalsResponse],
  );
  const quotes: any[] = useMemo(
    () => (Array.isArray(quotesResponse?.data) ? quotesResponse.data : []),
    [quotesResponse],
  );
  const existingInvoice = Array.isArray(invoicesResponse?.data)
    ? invoicesResponse.data[0]
    : undefined;
  const alreadyIssued = isInvoiceIssued(existingInvoice);

  const lineItems = useMemo(
    () =>
      extractInvoiceLineItems({
        proposals,
        quotes,
        jobLineItems: job?.lineItems,
      }).filter((item) => item.description.trim()),
    [proposals, quotes, job?.lineItems],
  );

  // Ex-GST, matching invoice.amount. An existing draft wins over a re-derive:
  // it may carry edits made in the builder.
  const subtotal = existingInvoice
    ? parseFloat(existingInvoice.amount ?? "0") || 0
    : lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const total = subtotal * 1.15;

  // Recipient/address/contact resolve in the same order as the InvoiceBuilder:
  // Billing-tab overrides, then the job's current contact, then the customer.
  const recipient: string =
    job?.billingContactEmail ||
    job?.jobContactEmail ||
    existingInvoice?.email ||
    customer?.email ||
    "";
  const cc: string | undefined = customer?.invoiceCcEmail || undefined;
  const address: string =
    job?.billingAddress || job?.address || customer?.address || "";
  const jobContactName =
    job?.jobContactFirstName && job?.jobContactLastName
      ? `${job.jobContactFirstName} ${job.jobContactLastName}`
      : job?.jobContactFirstName || job?.jobContactLastName || "";
  const contactName: string =
    job?.billingNameOverride || jobContactName || customer?.name || "";

  const invoiceNumber: string =
    existingInvoice?.invoiceNumber || (job?.jobNumber ? String(job.jobNumber) : "");

  const blocker: string | null = (() => {
    if (loading || !job) return null;
    if (job.status === "cancelled") return "This job is cancelled, so it can't be invoiced.";
    if (!job.customerId) return "This job has no customer assigned.";
    if (alreadyIssued) return null;
    if (!recipient.trim()) return "There's no email address for this customer or job contact.";
    if (!address.trim()) return "This job has no address for the invoice.";
    if (!existingInvoice && lineItems.length === 0)
      return "There are no line items on the proposal, quote or job to invoice.";
    if (subtotal <= 0) return "The line items add up to $0.00, so there's nothing to invoice yet.";
    return null;
  })();

  const xeroEligible =
    can("plan:crew") && !!xeroStatus?.connected && job?.xeroStatus !== "sent";

  const invalidate = () => {
    // ["/api/jobs"] and ["/api/invoices"] prefix-match the per-job keys.
    queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({
      queryKey: ["/api/jobs", jobId, "diary-timeline"],
    });
  };

  const run = async () => {
    if (!job || blocker) return;
    setError(null);
    setStep("working");
    try {
      if (job.status !== "completed") {
        setProgress("Marking job complete...");
        await apiRequest("PUT", `/api/jobs/${jobId}`, { status: "completed" });
      }

      if (!alreadyIssued) {
        let invoice = existingInvoice;
        if (!invoice) {
          setProgress("Creating invoice...");
          const proposal = pickInvoiceSourceDocument(proposals);
          const quote = pickInvoiceSourceDocument(quotes);
          const paymentDays: number =
            (businessSettings as any)?.data?.invoicePaymentDays ?? 7;
          const res = await apiRequest(
            "POST",
            `/api/jobs/${jobId}/convert-to-invoice`,
            {
              invoiceType: "full",
              customData: {
                address,
                contactName: contactName || undefined,
                dueDate: new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                notes: job.notes || "",
                description:
                  proposal?.introduction ||
                  quote?.description ||
                  job.description ||
                  "",
                lineItems: lineItems.map((item) => ({
                  description: item.description,
                  quantity: item.quantity,
                  rate: item.unitPrice,
                  amount: item.total,
                  category: item.category || "other",
                  materialId: item.materialId,
                  serviceId: item.serviceId,
                  unitCost: item.unitCost,
                })),
              },
            },
          );
          const created = await res.json();
          if (!created?.success || !created?.data?.id) {
            throw new Error(created?.message || "Failed to create the invoice.");
          }
          invoice = created.data;
        }

        setProgress("Emailing invoice...");
        const businessName: string =
          (businessSettings as any)?.data?.businessName || "";
        await apiRequest("POST", `/api/invoices/${invoice.id}/send-email`, {
          to: recipient.trim(),
          cc,
          subject: `Invoice ${invoice.invoiceNumber}${businessName ? ` from ${businessName}` : ""}`,
        });
        setSentTo(recipient.trim());
      }

      invalidate();
      setStep(xeroEligible ? "xero" : "done");
    } catch (err: any) {
      // A half-finished run is safe to retry: the next pass finds the draft
      // invoice (or the completed status) and carries on from there.
      invalidate();
      setError(
        err?.body?.message || err?.message || "Something went wrong. Please try again.",
      );
      setStep("review");
    }
  };

  const handleSendToXero = async () => {
    setXeroSending(true);
    try {
      await sendToXero();
      onOpenChange(false);
    } catch {
      // The mutation's own onError toast explains the Xero failure; the job
      // card's Send to Xero control stays available for a retry.
      onOpenChange(false);
    } finally {
      setXeroSending(false);
    }
  };

  const busy = step === "working" || xeroSending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't let an outside click abandon a run mid-flight.
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="dialog-complete-and-invoice">
        {step === "xero" || step === "done" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                {sentTo ? "Invoice sent" : "Job complete"}
              </DialogTitle>
              <DialogDescription>
                {sentTo
                  ? `Invoice ${invoiceNumber} was emailed to ${sentTo}.`
                  : `Invoice ${invoiceNumber} had already been sent to the customer.`}
                {step === "xero" && " Do you want to send it to Xero as well?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {step === "xero" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={xeroSending}
                    data-testid="button-skip-xero"
                  >
                    Not now
                  </Button>
                  <Button
                    onClick={handleSendToXero}
                    disabled={xeroSending}
                    data-testid="button-confirm-send-to-xero"
                  >
                    {xeroSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {xeroSending ? "Sending to Xero..." : "Send to Xero"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => onOpenChange(false)} data-testid="button-done">
                  Done
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Complete &amp; invoice</DialogTitle>
              <DialogDescription>
                Marks the job complete, creates the invoice and emails it to the
                customer.
              </DialogDescription>
            </DialogHeader>

            {loading || !job ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading job...
              </div>
            ) : blocker ? (
              <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-destructive" />
                <span>{blocker} Open the invoice builder to fix it.</span>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-medium">
                    {invoiceNumber}
                    {existingInvoice && !alreadyIssued ? " (existing draft)" : ""}
                  </span>
                </div>
                {alreadyIssued ? (
                  <p className="text-muted-foreground">
                    This invoice has already been sent, so it won't be emailed
                    again.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">To</span>
                      <span className="font-medium text-right break-all">
                        {recipient}
                        {cc ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            CC {cc}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {!existingInvoice && (
                      <ul className="border-t border-border pt-2 space-y-1">
                        {lineItems.map((item) => (
                          <li key={item.id} className="flex justify-between gap-4">
                            <span className="truncate">{item.description}</span>
                            <span className="tabular-nums">{formatNzd(item.total || 0)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <div className="flex justify-between gap-4 border-t border-border pt-2">
                  <span className="text-muted-foreground">Total incl. GST</span>
                  <span className="font-semibold tabular-nums">{formatNzd(total)}</span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" data-testid="text-complete-invoice-error">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onOpenInvoiceBuilder();
                }}
                disabled={busy}
                data-testid="button-open-invoice-builder"
              >
                Open invoice builder
              </Button>
              <Button
                onClick={run}
                disabled={busy || loading || !job || !!blocker}
                data-testid="button-run-complete-and-invoice"
              >
                {step === "working" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {step === "working"
                  ? progress
                  : !alreadyIssued
                    ? "Send invoice"
                    : job?.status === "completed"
                      ? "Continue"
                      : "Mark complete"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

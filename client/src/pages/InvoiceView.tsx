import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { composeCustomerAddress } from "@shared/customerAddress";
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  X,
} from "lucide-react";

interface InvoiceSection {
  id: string;
  sectionType: string;
  title: string;
  content: string | null;
  images: string[];
  sortOrder: number;
  isVisible: boolean;
}

interface PublicInvoiceData {
  id: string;
  invoiceNumber: string;
  jobTitle: string;
  address: string | null;
  contactName: string | null;
  issueDate: string;
  dueDate: string;
  amount: string;
  status: string;
  onlinePaymentEnabled?: boolean;
  items: any;
  description: string | null;
  notes: string | null;
  createdAt: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    region: string | null;
  } | null;
  job: { description: string | null; billingNameOverride: string | null } | null;
  sections: InvoiceSection[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(amount);

export default function InvoiceView() {
  const { invoiceId } = useParams();
  const [lightbox, setLightbox] = useState<{
    images: string[];
    index: number;
  } | null>(null);

  // "Book another job" — request another job inline, no login required.
  const [bookOpen, setBookOpen] = useState(false);
  const [bookDone, setBookDone] = useState(false);
  const [bookForm, setBookForm] = useState({
    description: "",
    address: "",
    preferredDate: "",
  });

  const { toast } = useToast();

  const { data: response, isLoading, refetch } = useQuery<{
    success: boolean;
    data?: PublicInvoiceData;
  }>({
    queryKey: [`/api/invoices/${invoiceId}/public`],
    enabled: !!invoiceId,
  });

  const { data: templateResponse } = useQuery<{
    success?: boolean;
    data?: { logoUrl?: string };
  }>({
    queryKey: ["/api/templates/default/invoice"],
  });
  const logoUrl =
    templateResponse?.data?.logoUrl || "/treemarkables-logo.png";

  const { data: paymentConfig } = useQuery<{
    success?: boolean;
    data?: { stripeConfigured?: boolean };
  }>({
    queryKey: ["/api/payments/config"],
  });
  const stripeConfigured = paymentConfig?.data?.stripeConfigured === true;

  // Customer just returned from Stripe Checkout. The webhook may take a beat to
  // mark the invoice paid, so refetch a couple of times to pick up the update.
  const justPaid =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("payment") === "success";

  useEffect(() => {
    if (!justPaid) return;
    const timers = [1500, 4000].map((ms) => setTimeout(() => refetch(), ms));
    return () => timers.forEach(clearTimeout);
  }, [justPaid, refetch]);

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/invoices/${invoiceId}/payment-checkout`,
        {},
      );
      return res.json();
    },
    onSuccess: (data: any) => {
      const url = data?.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      toast({
        variant: "destructive",
        title: "Payment unavailable",
        description:
          data?.message ||
          "Could not start the payment. Please try again or contact us.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Payment unavailable",
        description:
          err?.message ||
          "Could not start the payment. Please try again or contact us.",
      });
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/invoices/${invoiceId}/request-service`,
        {
          description: bookForm.description.trim(),
          address: bookForm.address.trim(),
          preferredDate: bookForm.preferredDate || undefined,
        },
      );
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        setBookDone(true);
        return;
      }
      toast({
        variant: "destructive",
        title: "Couldn't send request",
        description:
          data?.message || "Please try again, or contact us directly.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Couldn't send request",
        description:
          err?.message || "Please try again, or contact us directly.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-16 h-16 text-orange-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Loading Invoice
            </h1>
            <p className="text-gray-600">Please wait...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = response?.data;
  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Invoice Not Found
            </h1>
            <p className="text-gray-600">
              The invoice you're looking for doesn't exist or may have been
              removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customer = invoice.customer;
  const job = invoice.job;
  // Per-tenant identity from the server payload (scoped to the invoice's business).
  // All fields are blank for a business that hasn't configured them — we never
  // fall back to another business's contact or bank details.
  const company = (invoice as any).company ?? {};
  // Mirror the PDF/email precedence (server/routes.ts): the per-invoice billing
  // name override on the job wins over the invoice contact name and the linked
  // customer's name.
  const billingName =
    job?.billingNameOverride || invoice.contactName || customer?.name || null;

  const lineItems: any[] = Array.isArray(invoice.items) ? invoice.items : [];
  const lineItemTotal = lineItems.reduce((sum, item) => {
    const t = item.total ?? item.amount;
    const n = typeof t === "string" ? parseFloat(t) : t || 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const hasLineItems = lineItems.length > 0 && lineItemTotal > 0;
  let subtotal: number;
  if (hasLineItems) {
    subtotal = lineItemTotal;
  } else {
    subtotal = parseFloat(invoice.amount || "0") || 0;
  }
  const gst = subtotal * 0.15;
  const total = subtotal + gst;

  const isOverdue =
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date() &&
    invoice.status !== "paid";

  const visibleSections = (invoice.sections || []).filter(
    (s) => s.isVisible !== false,
  );

  const openLightbox = (images: string[], index: number) =>
    setLightbox({ images, index });
  const closeLightbox = () => setLightbox(null);
  const lightboxNext = () => {
    if (!lightbox) return;
    setLightbox({
      images: lightbox.images,
      index: (lightbox.index + 1) % lightbox.images.length,
    });
  };
  const lightboxPrev = () => {
    if (!lightbox) return;
    setLightbox({
      images: lightbox.images,
      index:
        (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 w-full">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-gray-100">
            <img
              src={logoUrl}
              alt={company.name || "Logo"}
              className="h-9 sm:h-11 object-contain flex-shrink-0"
            />
            <div className="text-right">
              <p className="text-xs text-gray-500">Invoice</p>
              <p className="text-sm font-semibold text-gray-900">
                #{invoice.invoiceNumber}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-7 space-y-6">

            {/* Hero: amount due + book panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-xl bg-gray-50 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-600">
                    {invoice.status === "paid" ? "Amount paid" : "Amount due"}
                  </span>
                  {invoice.status === "paid" ? (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Paid
                    </span>
                  ) : justPaid ? (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Payment received
                    </span>
                  ) : isOverdue ? (
                    <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      Overdue
                    </span>
                  ) : null}
                </div>
                <p className="text-3xl font-semibold text-gray-900 tracking-tight">
                  {formatCurrency(total)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.status === "paid"
                    ? "Thank you for your payment."
                    : justPaid
                      ? "Confirming now — this page will update shortly."
                      : `Issued ${new Date(invoice.issueDate).toLocaleDateString("en-NZ")}${invoice.dueDate ? ` · Due ${new Date(invoice.dueDate).toLocaleDateString("en-NZ")}` : ""}`}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {/* Pay online — only when this business can take card payments (single
                      Stripe account = Treemarkables until Connect); others pay by bank transfer. */}
                  {stripeConfigured &&
                    invoice.onlinePaymentEnabled &&
                    !justPaid &&
                    invoice.status !== "paid" &&
                    invoice.status !== "cancelled" &&
                    total > 0 && (
                      <Button
                        size="lg"
                        onClick={() => payMutation.mutate()}
                        disabled={payMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        data-testid="button-pay-invoice"
                      >
                        {payMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4 mr-2" />
                        )}
                        Pay now
                      </Button>
                    )}
                  <Button asChild variant="outline" size="lg">
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                </div>
              </div>
              {/* Book another job */}
              <aside className="lg:col-span-1">
                <div className="lg:sticky lg:top-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col">
                    <h3 className="text-base font-semibold text-gray-900">
                      Need more work done?
                    </h3>
                    <p className="text-sm text-gray-600 mt-1 mb-4">
                      Book another job or request a fresh quote — we'd love to
                      help you again.
                    </p>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                      data-testid="button-book-another-job"
                      onClick={() => {
                        setBookDone(false);
                        setBookForm((f) => ({
                          ...f,
                          address:
                            f.address ||
                            invoice.address ||
                            composeCustomerAddress(customer) ||
                            "",
                        }));
                        setBookOpen(true);
                      }}
                    >
                      <CalendarPlus className="w-4 h-4 mr-2" />
                      Book another job
                    </Button>
                  </div>
                </div>
              </aside>
            </div>

            {/* Invoice details + bill to */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Invoice details
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice number</span>
                    <span className="font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Issued</span>
                    <span className="font-medium text-gray-900">
                      {new Date(invoice.issueDate).toLocaleDateString("en-NZ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due</span>
                    <span className="font-medium text-gray-900">
                      {invoice.dueDate
                        ? new Date(invoice.dueDate).toLocaleDateString("en-NZ")
                        : "On receipt"}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Bill to</p>
                <div className="text-sm space-y-0.5">
                  <p className="font-medium text-gray-900">
                    {billingName || "Customer"}
                  </p>
                  {(composeCustomerAddress(customer) || invoice.address) && (
                    <p className="text-gray-600">
                      {composeCustomerAddress(customer) || invoice.address}
                    </p>
                  )}
                  {customer?.email && (
                    <p className="text-gray-600">{customer.email}</p>
                  )}
                  {customer?.phone && (
                    <p className="text-gray-600">{customer.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {(invoice.description || job?.description || invoice.notes) && (
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Description
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {invoice.description || job?.description || invoice.notes}
                </p>
              </div>
            )}

            {/* Line items */}
            {hasLineItems && (
              <div className="border-t border-gray-100 pt-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left font-normal pb-2">
                          Description
                        </th>
                        <th className="text-center font-normal pb-2">Qty</th>
                        <th className="text-right font-normal pb-2">Unit</th>
                        <th className="text-right font-normal pb-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => {
                        const unitPrice = item.rate ?? item.unitPrice ?? 0;
                        const unitNum =
                          typeof unitPrice === "string"
                            ? parseFloat(unitPrice)
                            : unitPrice;
                        const t = item.total ?? item.amount ?? 0;
                        const tNum =
                          typeof t === "string" ? parseFloat(t) : t;
                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-50 last:border-b-0 text-gray-900"
                          >
                            <td className="py-3 pr-2">
                              {item.description || "Tree Service"}
                            </td>
                            <td className="text-center py-3">
                              {item.quantity || 1}
                            </td>
                            <td className="text-right py-3">
                              {formatCurrency(unitNum || 0)}
                            </td>
                            <td className="text-right py-3">
                              {formatCurrency((tNum || 0) * 1.15)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sections (photos + narrative) */}
            {visibleSections.map((section) => (
              <div
                key={section.id}
                className="border-t border-gray-100 pt-5 space-y-3"
              >
                <h3 className="text-base font-semibold text-gray-900">
                  {section.title}
                </h3>
                {section.content && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {section.content}
                  </p>
                )}
                {section.images && section.images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {section.images.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => openLightbox(section.images, i)}
                        className="relative aspect-square rounded-md overflow-hidden border bg-gray-100"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Totals */}
            <div className="border-t border-gray-100 pt-5 flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal (excl GST)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GST (15%)</span>
                  <span>{formatCurrency(gst)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-100 pt-2 mt-1">
                  <span>Total due</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Payment info — only when the business has set its bank details,
                so a customer is never told to pay into another business's account. */}
            {company.bankAccountNumber ? (
              <div className="rounded-xl bg-gray-50 p-4 sm:p-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Landmark className="w-4 h-4 text-gray-400" />
                  <span>
                    {company.bankAccountName || company.name || "Bank transfer"}
                  </span>
                </div>
                <span className="font-mono text-gray-900">
                  {company.bankAccountNumber}
                </span>
                <span className="text-gray-500">
                  Reference:{" "}
                  <span className="text-gray-700">#{invoice.invoiceNumber}</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-5 pb-4">
          <p>
            {company.name
              ? `Thank you for choosing ${company.name}.`
              : "Thank you."}
          </p>
          {company.email || company.phone ? (
            <p className="mt-1">
              Questions? Contact{" "}
              {[company.email, company.phone].filter(Boolean).join(" or ")}.
            </p>
          ) : null}
        </div>
      </div>

      {/* Book another job dialog */}
      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="sm:max-w-md">
          {bookDone ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <DialogTitle className="text-lg">Request sent</DialogTitle>
              <p className="text-sm text-gray-600 mt-2">
                Thanks{customer?.name ? `, ${customer.name.split(" ")[0]}` : ""}!
                We've got your request and will be in touch soon to sort the
                details.
              </p>
              <Button
                className="mt-5"
                onClick={() => {
                  setBookOpen(false);
                  setBookForm({
                    description: "",
                    address: "",
                    preferredDate: "",
                  });
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Request another job</DialogTitle>
                <DialogDescription>
                  Tell us what you need — no login required. We'll follow up to
                  confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="book-description">
                    What do you need done?
                  </Label>
                  <Textarea
                    id="book-description"
                    value={bookForm.description}
                    onChange={(e) =>
                      setBookForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="e.g. Remove a large gum tree near the driveway"
                    rows={4}
                    data-testid="input-book-description"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="book-address">Job address</Label>
                  <Input
                    id="book-address"
                    value={bookForm.address}
                    onChange={(e) =>
                      setBookForm((f) => ({ ...f, address: e.target.value }))
                    }
                    placeholder="Where's the work?"
                    data-testid="input-book-address"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="book-date">Preferred date (optional)</Label>
                  <Input
                    id="book-date"
                    type="date"
                    value={bookForm.preferredDate}
                    onChange={(e) =>
                      setBookForm((f) => ({
                        ...f,
                        preferredDate: e.target.value,
                      }))
                    }
                    data-testid="input-book-date"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setBookOpen(false)}
                  disabled={bookMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => bookMutation.mutate()}
                  disabled={
                    bookMutation.isPending || !bookForm.description.trim()
                  }
                  data-testid="button-submit-book"
                >
                  {bookMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Send request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white p-2"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {lightbox.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxPrev();
                }}
                className="absolute left-2 sm:left-6 text-white p-2"
                aria-label="Previous"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxNext();
                }}
                className="absolute right-2 sm:right-6 text-white p-2"
                aria-label="Next"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}
          <img
            src={lightbox.images[lightbox.index]}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

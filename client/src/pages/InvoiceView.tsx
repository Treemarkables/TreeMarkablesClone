import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Receipt,
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
  items: any;
  description: string | null;
  notes: string | null;
  createdAt: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  job: { description: string | null } | null;
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

  const { data: response, isLoading } = useQuery<{
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
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 w-full">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt="Treemarkables"
              className="h-10 sm:h-12 object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                Invoice #{invoice.invoiceNumber}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                {customer?.name || "Customer"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-4 px-4 w-full space-y-4">
        {/* Status banners */}
        {invoice.status === "paid" && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-3">
            <div className="flex items-center text-sm">
              <Receipt className="w-4 h-4 text-green-600 mr-2" />
              <span className="text-green-800 font-medium">
                Payment Received — Thank you!
              </span>
            </div>
          </div>
        )}
        {isOverdue && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3">
            <div className="flex items-center text-sm">
              <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
              <span className="text-red-800 font-medium">
                Payment overdue — please contact us
              </span>
            </div>
          </div>
        )}

        {/* Invoice meta + bill-to */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Invoice Details
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Number:</span>
                  <span className="font-medium">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Issue Date:</span>
                  <span className="font-medium">
                    {new Date(invoice.issueDate).toLocaleDateString("en-NZ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="font-medium">
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString("en-NZ")
                      : "On receipt"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Bill To
              </h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>{" "}
                  <span className="font-medium">
                    {customer?.name || "N/A"}
                  </span>
                </div>
                {customer?.email && (
                  <div>
                    <span className="text-gray-600">Email:</span>{" "}
                    <span className="font-medium">{customer.email}</span>
                  </div>
                )}
                {customer?.phone && (
                  <div>
                    <span className="text-gray-600">Phone:</span>{" "}
                    <span className="font-medium">{customer.phone}</span>
                  </div>
                )}
                {(invoice.address ||
                  customer?.address) && (
                  <div>
                    <span className="text-gray-600">Address:</span>{" "}
                    <span className="font-medium">
                      {invoice.address || customer?.address}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        {(invoice.description || job?.description || invoice.notes) && (
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Description
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {invoice.description || job?.description || invoice.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Line items */}
        {hasLineItems && (
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Line Items
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-2 py-2">Description</th>
                      <th className="text-center px-2 py-2">Qty</th>
                      <th className="text-right px-2 py-2">Unit Price</th>
                      <th className="text-right px-2 py-2">Total (incl GST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const unitPrice =
                        item.rate ?? item.unitPrice ?? 0;
                      const unitNum =
                        typeof unitPrice === "string"
                          ? parseFloat(unitPrice)
                          : unitPrice;
                      const t = item.total ?? item.amount ?? 0;
                      const tNum =
                        typeof t === "string" ? parseFloat(t) : t;
                      return (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="px-2 py-2">
                            {item.description || "Tree Service"}
                          </td>
                          <td className="text-center px-2 py-2">
                            {item.quantity || 1}
                          </td>
                          <td className="text-right px-2 py-2">
                            {formatCurrency(unitNum || 0)}
                          </td>
                          <td className="text-right px-2 py-2">
                            {formatCurrency((tNum || 0) * 1.15)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sections (photos + narrative) */}
        {visibleSections.map((section) => (
          <Card key={section.id} className="bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6 space-y-3">
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
            </CardContent>
          </Card>
        ))}

        {/* Totals */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-1 text-sm">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal (excl GST):</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>GST (15%):</span>
                  <span>{formatCurrency(gst)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-1 text-gray-900">
                  <span>Total Due:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment info */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Payment Information
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                <span className="text-gray-600">Account Name:</span>{" "}
                Treemarkables Ltd
              </p>
              <p>
                <span className="text-gray-600">Account:</span>{" "}
                06-0637-0768850-00
              </p>
              <p className="pt-2">
                Please use Invoice #{invoice.invoiceNumber} as the reference.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* PDF link */}
        <div className="flex justify-center pt-2 pb-8">
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
          </Button>
        </div>

        <div className="text-center text-xs text-gray-500 pb-8">
          <p>Thank you for choosing Treemarkables.</p>
          <p className="mt-1">
            Questions? Contact quotes@treemarkables.nz or 027 216 6882.
          </p>
        </div>
      </div>

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

import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Mail, Receipt, AlertCircle } from "lucide-react";
import { Link } from "wouter";

interface InvoiceViewerProps {}

export default function InvoiceViewer({}: InvoiceViewerProps) {
  const { invoiceId } = useParams();
  
  // Fetch invoice data
  const { data: invoiceResponse, isLoading: invoiceLoading } = useQuery({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
  });

  // Fetch customer data if invoice has customerId
  const { data: customerResponse } = useQuery({
    queryKey: ["/api/customers", invoiceResponse?.data?.customerId],
    enabled: !!invoiceResponse?.data?.customerId,
  });

  // Fetch job data if invoice has jobId
  const { data: jobResponse } = useQuery({
    queryKey: ["/api/jobs", invoiceResponse?.data?.jobId],
    enabled: !!invoiceResponse?.data?.jobId,
  });

  if (invoiceLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoiceResponse?.success || !invoiceResponse?.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Invoice Not Found</h1>
            <p className="text-gray-600 mb-4">
              The invoice you're looking for doesn't exist or may have been removed.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoice = invoiceResponse.data;
  const customer = customerResponse?.data;
  const job = jobResponse?.data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600';
      case 'overdue': return 'text-red-600';
      case 'sent': return 'text-blue-600';
      default: return 'text-orange-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'overdue': return 'Overdue';
      case 'sent': return 'Sent';
      case 'draft': return 'Draft';
      default: return 'Pending';
    }
  };

  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Invoice #{invoice.invoiceNumber || invoice.id}
              </h1>
              <p className="text-sm text-gray-600">
                {customer?.name || 'Customer'} - {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="button-email-invoice">
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            <Button variant="outline" size="sm" data-testid="button-download-invoice">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        <Card className="bg-white shadow-sm">
          <CardContent className="p-8">
            {/* Company Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-orange-600 mb-2">Treemarkables</h1>
              <p className="text-gray-600">Professional Tree Care Services</p>
              <p className="text-sm text-gray-500">Gisborne, New Zealand | Phone: +64 6 867 1234 | Email: info@treemarkables.co.nz</p>
            </div>

            {/* Status Banner */}
            {invoice.status === 'paid' && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <Receipt className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-green-800 font-medium">Payment Received</span>
                  <span className="text-green-600 ml-2">- Thank you for your payment!</span>
                </div>
              </div>
            )}

            {isOverdue && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-800 font-medium">Payment Overdue</span>
                  <span className="text-red-600 ml-2">- Please contact us to arrange payment</span>
                </div>
              </div>
            )}

            {/* Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Number:</span>
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Date:</span>
                    <span className="font-medium">{new Date(invoice.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Due Date:</span>
                    <span className="font-medium">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'On receipt'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${getStatusColor(invoice.status)}`}>
                      {getStatusText(invoice.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill To</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium ml-2">{customer?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium ml-2">{customer?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium ml-2">{customer?.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Address:</span>
                    <span className="font-medium ml-2">{job?.address || customer?.address || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Work Description */}
            {job?.description && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Work Performed</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{job.description}</p>
                </div>
              </div>
            )}

            {/* Line Items */}
            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Services & Materials</h3>
                <div className="overflow-x-auto max-w-full">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">Quantity</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Unit Price</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems.map((item: any, index: number) => (
                        <tr key={index}>
                          <td className="border border-gray-300 px-4 py-2">{item.description}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{item.quantity}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal (excl GST):</span>
                  <span>{formatCurrency(invoice.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>GST (15%):</span>
                  <span>{formatCurrency((invoice.totalAmount || 0) - (invoice.subtotal || 0))}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Total Due:</span>
                    <span>{formatCurrency(invoice.totalAmount || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Bank Transfer Details:</p>
                    <p className="text-gray-700">Account Name: Treemarkables Ltd</p>
                    <p className="text-gray-700">Bank: ANZ</p>
                    <p className="text-gray-700">Account: 01-0123-0123456-00</p>
                    <p className="text-gray-700">Reference: {invoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Other Payment Methods:</p>
                    <p className="text-gray-700">Cash on completion</p>
                    <p className="text-gray-700">EFTPOS available</p>
                    <p className="text-gray-700">Credit Card (Visa/Mastercard)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 text-sm">
                  {invoice.terms || 'Payment due within 7 days of invoice date. Late payments may incur additional charges. GST included where applicable.'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-gray-600 mt-8 pt-6 border-t">
              <p>Thank you for choosing Treemarkables!</p>
              <p className="mt-1">
                For any questions about this invoice, please contact us at info@treemarkables.co.nz or +64 6 867 1234.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
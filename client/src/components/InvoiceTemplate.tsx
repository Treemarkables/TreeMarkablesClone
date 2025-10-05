import { useState, forwardRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { format, addDays } from 'date-fns';
import { FileText, Download, Mail, Copy, Calendar, CreditCard, MapPin, Phone, Mail as MailIcon } from 'lucide-react';
import type { DocumentTemplate, Customer } from '@shared/schema';

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string;
  category?: string;
  taxable?: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  amount: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  issueDate: string;
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  paidDate?: string;
  paidAmount?: number;
}

interface InvoiceTemplateProps {
  template: DocumentTemplate;
  invoice: Invoice;
  customer?: Customer;
  lineItems?: InvoiceLineItem[];
  description?: string;
  className?: string;
  showActions?: boolean;
  onEmail?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onAddPayment?: () => void;
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(({
  template,
  invoice,
  customer,
  lineItems = [],
  description,
  className = '',
  showActions = false,
  onEmail,
  onDownload,
  onCopy,
  onAddPayment
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);

  // Calculate totals - use line items if available, otherwise fall back to invoice amount
  const lineItemSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const hasLineItems = lineItems.length > 0 && lineItemSubtotal > 0;
  
  const gstRate = 0.15; // 15% GST for New Zealand
  
  let subtotal: number;
  let gstAmount: number;
  let totalAmount: number;
  
  if (hasLineItems) {
    // Line items already contain GST-inclusive amounts
    totalAmount = lineItemSubtotal;
    // Reverse calculate subtotal from total (total = subtotal + GST = subtotal * 1.15)
    subtotal = totalAmount / (1 + gstRate);
    gstAmount = totalAmount - subtotal;
  } else {
    // Fall back to invoice amount and calculate GST
    const invoiceAmount = typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
    totalAmount = invoiceAmount || 0;
    // Reverse calculate subtotal from total
    subtotal = totalAmount / (1 + gstRate);
    gstAmount = totalAmount - subtotal;
  }

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      viewed: 'bg-purple-100 text-purple-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Format currency as NZD
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  // Get invoice dates
  const issueDate = new Date(invoice.issueDate);
  const dueDate = new Date(invoice.dueDate);
  const isOverdue = dueDate < new Date() && invoice.status !== 'paid';

  // Calculate payment status
  const paidAmount = invoice.paidAmount || 0;
  const remainingAmount = totalAmount - paidAmount;
  const isPartiallyPaid = paidAmount > 0 && paidAmount < totalAmount;

  return (
    <div ref={ref} className={`w-full max-w-4xl mx-auto bg-white ${className}`}>
      {/* Action Bar */}
      {showActions && (
        <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-orange-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Invoice #{invoice.invoiceNumber}</h3>
              <p className="text-sm text-gray-600">Using template: {template.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {onCopy && (
              <Button variant="outline" size="sm" onClick={onCopy} data-testid="button-copy-invoice">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            )}
            {onAddPayment && invoice.status !== 'paid' && (
              <Button variant="outline" size="sm" onClick={onAddPayment} data-testid="button-add-payment">
                <CreditCard className="w-4 h-4 mr-2" />
                Add Payment
              </Button>
            )}
            {onEmail && (
              <Button variant="outline" size="sm" onClick={onEmail} data-testid="button-email-invoice">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            )}
            {onDownload && (
              <Button variant="outline" size="sm" onClick={onDownload} data-testid="button-download-invoice">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="shadow-lg">
        <CardContent className="p-0">
          {/* Header with Treemarkables Branding */}
          <div className="bg-gradient-to-r from-orange-500 to-blue-600 p-1 sm:p-3 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-1 sm:gap-0">
              <div className="flex-1 min-w-0">
                <h1 className="text-xs sm:text-lg font-bold mb-0 sm:mb-1 truncate">{template.companyName || 'Treemarkables LTD'}</h1>
                <p className="text-orange-100 text-[8px] sm:text-xs">Professional Tree Services</p>
                <div className="mt-0.5 sm:mt-1.5 space-y-0 text-[8px] sm:text-xs text-orange-100">
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <Phone className="w-2 h-2 sm:w-3 sm:h-3" />
                    <span className="break-all">{template.companyPhone || '027 216 6882'}</span>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <MapPin className="w-2 h-2 sm:w-3 sm:h-3" />
                    <span className="break-all">{template.companyAddress || '213 Stanley road, Gisborne'}</span>
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                <div className="bg-white/20 rounded p-1 sm:p-1.5 backdrop-blur-sm">
                  <h2 className="text-xs sm:text-base font-bold mb-0 sm:mb-0.5">INVOICE</h2>
                  <div className="mt-0.5 space-y-0 text-[8px] sm:text-xs">
                    <p><strong>Number:</strong> {invoice.invoiceNumber}</p>
                    <p><strong>Issue Date:</strong> {format(issueDate, 'dd MMM yyyy')}</p>
                    <p><strong>Due Date:</strong> {format(dueDate, 'dd MMM yyyy')}</p>
                    <div className="mt-0.5">
                      <Badge className={`${getStatusColor(invoice.status)} text-[7px] sm:text-[10px] px-1 py-0`}>
                        {invoice.status.toUpperCase()}
                      </Badge>
                      {isOverdue && (
                        <Badge className="ml-0.5 sm:ml-1 bg-red-500 text-white text-[7px] sm:text-[10px] px-1 py-0">
                          OVERDUE
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          {customer && (
            <div className="p-3 sm:p-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill To</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900" data-testid="text-customer-name">
                      {customer.name}
                    </h4>
                    {customer.address && (
                      <p className="text-gray-700 mt-2">{customer.address}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MailIcon className="w-4 h-4" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Line Items */}
          {hasLineItems ? (
            <div className="p-3 sm:p-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Services Provided</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Description</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-900">Qty</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-900">Unit</th>
                      <th className="border border-gray-200 px-4 py-3 text-right font-semibold text-gray-900">Unit Price</th>
                      <th className="border border-gray-200 px-4 py-3 text-right font-semibold text-gray-900">Total (inc GST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={item.id} className="even:bg-gray-50" data-testid={`row-line-item-${index}`}>
                        <td className="border border-gray-200 px-4 py-3 text-gray-900">
                          <span className="font-medium">{item.description}</span>
                          {item.category && (
                            <p className="text-sm text-gray-600">{item.category}</p>
                          )}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-700">{item.quantity}</td>
                        <td className="border border-gray-200 px-4 py-3 text-center text-gray-700">{item.unit || 'ea'}</td>
                        <td className="border border-gray-200 px-4 py-3 text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                        <td className="border border-gray-200 px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Fallback for invoices without line items
            <div className="p-3 sm:p-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Services Provided</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">{description || 'Professional Tree Services'}</p>
                {!description && (
                  <p className="text-sm text-gray-600 mt-2">Total amount includes all services as agreed</p>
                )}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="p-3 sm:p-8 border-b border-gray-200">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal (excl GST):</span>
                  <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>GST (15%):</span>
                  <span data-testid="text-gst-amount">{formatCurrency(gstAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xl font-bold text-gray-900">
                  <span>Total Amount:</span>
                  <span data-testid="text-total-amount">{formatCurrency(totalAmount)}</span>
                </div>
                {paidAmount > 0 && (
                  <>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Amount Paid:</span>
                      <span data-testid="text-paid-amount">{formatCurrency(paidAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-xl font-bold text-red-600">
                      <span>Amount Due:</span>
                      <span data-testid="text-amount-due">{formatCurrency(remainingAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="p-3 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-w-md">
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Terms:</span>
                <span className="font-medium">{invoice.paymentTerms || template.paymentTerms || '7 days'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Total:</span>
                <span className="font-semibold">{formatCurrency(totalAmount)}</span>
              </div>
              {paidAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-medium text-green-600">{formatCurrency(paidAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Due:</span>
                <span className={`font-bold ${remainingAmount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-3 sm:p-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap" data-testid="text-invoice-notes">
                  {invoice.notes}
                </p>
              </div>
            </div>
          )}

          {/* Payment Instructions */}
          <div className="p-3 sm:p-8 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Instructions</h3>
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-gray-900 font-semibold text-sm mb-2">Bank Transfer Details:</p>
                <div className="bg-white rounded p-3 space-y-1">
                  <p className="text-gray-700 text-sm"><strong>Bank:</strong> ANZ</p>
                  <p className="text-gray-700 text-sm"><strong>Account:</strong> 06 0637 0768850 00</p>
                </div>
              </div>
              <p className="text-gray-700 text-sm">
                Please pay this invoice within {invoice.paymentTerms || template.paymentTerms || '7 days'} of the issue date.
                For questions about this invoice, please contact us at {template.companyPhone || '027 216 6882'}.
              </p>
              {template.gstNumber && (
                <p className="text-gray-600 text-sm">
                  <strong>GST Number:</strong> {template.gstNumber}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-8 pt-6">
            <div className="text-center text-sm text-gray-600">
              <p>Thank you for choosing {template.companyName || 'Treemarkables'}!</p>
              <p className="mt-1">Professional tree services you can trust.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;
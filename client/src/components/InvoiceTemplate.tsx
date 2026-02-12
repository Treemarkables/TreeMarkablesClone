import { useState, forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, addDays } from 'date-fns';
import { Download, Mail, Copy, CreditCard, MessageSquare } from 'lucide-react';
import type { DocumentTemplate, Customer } from '@shared/schema';
import { LinkifiedText } from '@/utils/linkify';

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string;
  category?: string;
  taxable?: boolean;
  rate?: number;
  amount?: number;
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
  invoice: Invoice & { contactName?: string };
  customer?: Customer;
  lineItems?: InvoiceLineItem[];
  description?: string;
  photos?: any[];
  className?: string;
  showActions?: boolean;
  jobAddress?: string;
  contactName?: string;
  billingName?: string;
  jobNumber?: number;
  onEmail?: () => void;
  onSms?: () => void;
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
  photos = [],
  className = '',
  showActions = false,
  jobAddress,
  contactName,
  billingName,
  jobNumber,
  onEmail,
  onSms,
  onDownload,
  onCopy,
  onAddPayment
}, ref) => {
  // Use contact name from prop, invoice, or empty string
  const displayContactName = contactName || invoice.contactName || '';
  const [isLoading, setIsLoading] = useState(false);

  // Calculate totals
  const lineItemSubtotal = lineItems.reduce((sum, item) => {
    const itemTotal = item.total || item.amount;
    const total = typeof itemTotal === 'string' ? parseFloat(itemTotal) : itemTotal;
    return sum + (total || 0);
  }, 0);
  const hasLineItems = lineItems.length > 0 && lineItemSubtotal > 0;
  
  const gstRate = 0.15;
  
  let subtotal: number;
  let gstAmount: number;
  let totalAmount: number;
  
  if (hasLineItems) {
    subtotal = lineItemSubtotal;
    gstAmount = subtotal * gstRate;
    totalAmount = subtotal + gstAmount;
  } else {
    const invoiceAmount = typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
    subtotal = invoiceAmount;
    gstAmount = subtotal * gstRate;
    totalAmount = subtotal + gstAmount;
  }

  // Format currency as NZD
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  // Get invoice dates with fallbacks
  const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : addDays(issueDate, 14);

  return (
    <div ref={ref} className={`w-full max-w-full sm:max-w-4xl mx-auto bg-white ${className}`}>
      {/* Action Bar */}
      {showActions && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">Invoice #{invoice.invoiceNumber}</h3>
              <p className="text-sm text-gray-600">Using template: {template.name}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
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
            {onSms && (
              <Button variant="outline" size="sm" onClick={onSms} data-testid="button-sms-invoice">
                <MessageSquare className="w-4 h-4 mr-2" />
                SMS
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

      <Card className="shadow-lg overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          {/* Header with Logo */}
          <div className="border-b-[3px] border-black pb-5 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4">
              {/* Logo */}
              <div className="flex-shrink-0">
                <img 
                  src="/treemarkables-logo.webp" 
                  alt="Treemarkables" 
                  className="h-10 w-auto object-contain"
                />
              </div>
              
              {/* Invoice Details */}
              <div className="flex-1 text-left sm:text-right">
                <h1 className="text-base font-bold text-black">Invoice #{invoice.invoiceNumber}</h1>
                <p className="text-xs text-gray-600 mt-1">
                  {billingName || customer?.name || 'Customer'} - {format(issueDate, 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-4">
            <h2 className="text-xs font-semibold text-black mb-2">Bill To</h2>
            <div>
              <p className="font-semibold text-black text-xs mb-1" data-testid="text-customer-name">
                {billingName || customer?.name || 'Customer'}
              </p>
              {(jobAddress || customer?.address) && (
                <p className="text-xs text-gray-600 mb-1">{jobAddress || customer.address}</p>
              )}
              {billingName && customer?.name && billingName !== customer.name && (
                <p className="text-xs text-gray-600 mb-1">
                  <span className="mr-1">c/o</span>{customer.name}
                </p>
              )}
              {displayContactName && (!billingName || displayContactName !== customer?.name) && (
                <p className="text-xs text-gray-600 mb-1">
                  <span className="mr-1">c/o</span>{displayContactName}
                </p>
              )}
              {customer?.email && (
                <p className="text-xs text-gray-600">
                  <span className="mr-1">✉</span>{customer.email}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          {(description || invoice.notes) && (
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-black mb-2">Description</h2>
              <div className="text-xs text-gray-700 whitespace-pre-wrap" data-testid="text-invoice-description">
                <LinkifiedText text={description || invoice.notes || ''} />
              </div>
            </div>
          )}

          {/* Line Items Table */}
          {hasLineItems && (
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-black mb-2">Services & Pricing</h2>
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-2 py-2 text-left text-xs font-semibold text-gray-900">Service</th>
                      <th className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-900 w-16">Qty</th>
                      <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900 w-20">Rate</th>
                      <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900 w-20">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => {
                      const qty = item.quantity || 1;
                      const rate = item.unitPrice || item.rate || 0;
                      const itemTotal = item.total || item.amount || (qty * rate);
                      
                      return (
                        <tr key={item.id} className="even:bg-gray-50" data-testid={`row-line-item-${index}`}>
                          <td className="border border-gray-200 px-2 py-2 text-xs text-gray-900">
                            <LinkifiedText text={item.description} />
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-xs text-center text-gray-900">
                            {qty}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-xs text-right text-gray-900">
                            {formatCurrency(rate)}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-xs text-right font-medium text-gray-900">
                            {formatCurrency(typeof itemTotal === 'string' ? parseFloat(itemTotal) : itemTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Subtotal (excl GST):</span>
                  <span className="text-black" data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-gray-200 pb-1">
                  <span className="text-gray-600">GST (15%):</span>
                  <span className="text-black" data-testid="text-gst-amount">{formatCurrency(gstAmount)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-sm font-bold text-black">Total Amount:</span>
                  <span className="text-sm font-bold text-black" data-testid="text-total-amount">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-xs font-semibold text-black mb-2">Payment Information</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><span className="font-medium text-black">Bank:</span> ANZ</p>
              <p><span className="font-medium text-black">Account Number:</span> 06 0637 0768850 00</p>
              <p><span className="font-medium text-black">Account Name:</span> Treemarkables LTD</p>
            </div>
          </div>

          {/* Business Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500 break-words">
              Treemarkables LTD | 213 Stanley Road, Gisborne | Phone: 027 216 6882 | Email: quotes@treemarkables.nz
            </p>
            <p className="text-xs text-gray-500 mt-1">
              GST Number: 131-047-592
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;

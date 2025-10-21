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
  invoice: Invoice;
  customer?: Customer;
  lineItems?: InvoiceLineItem[];
  description?: string;
  photos?: any[];
  className?: string;
  showActions?: boolean;
  jobAddress?: string;
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
  onEmail,
  onSms,
  onDownload,
  onCopy,
  onAddPayment
}, ref) => {
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
    <div ref={ref} className={`w-full max-w-4xl mx-auto bg-white ${className}`}>
      {/* Action Bar */}
      {showActions && (
        <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
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

      <Card className="shadow-lg">
        <CardContent className="p-8">
          {/* Header */}
          <div className="border-b-[3px] border-black pb-5 mb-8">
            <h1 className="text-3xl font-bold text-black">Invoice #{invoice.invoiceNumber}</h1>
            <p className="text-sm text-gray-600 mt-2">
              {customer?.name || 'Customer'} - {format(issueDate, 'dd/MM/yyyy')}
            </p>
          </div>

          {/* Bill To */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-black mb-3">Bill To</h2>
            <div>
              <p className="font-semibold text-black mb-2" data-testid="text-customer-name">
                {customer?.name || 'Customer'}
              </p>
              {(jobAddress || customer?.address) && (
                <p className="text-sm text-gray-600 mb-1">{jobAddress || customer.address}</p>
              )}
              {customer?.email && (
                <p className="text-sm text-gray-600">
                  <span className="mr-2">✉</span>{customer.email}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-black mb-3">Description</h2>
            <div>
              {hasLineItems ? (
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="py-2 border-b border-gray-100 last:border-0" data-testid={`row-line-item-${index}`}>
                      <p className="text-sm text-black">
                        <LinkifiedText text={item.description} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap" data-testid="text-invoice-notes">
                  <LinkifiedText text={[invoice.notes, description].filter(Boolean).join('\n\n')} />
                </p>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="pt-5 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal (excl GST):</span>
                  <span className="text-black" data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm border-b border-gray-200 pb-2">
                  <span className="text-gray-600">GST (15%):</span>
                  <span className="text-black" data-testid="text-gst-amount">{formatCurrency(gstAmount)}</span>
                </div>
                <div className="flex justify-between pt-3">
                  <span className="text-xl font-bold text-black">Total Amount:</span>
                  <span className="text-xl font-bold text-black" data-testid="text-total-amount">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Business Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Treemarkables LTD | 213 Stanley Road, Gisborne | Phone: 027 216 6882 | Email: quotes@treemarkables.nz
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;

import { useState, forwardRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { FileText, Download, Mail, Copy, CheckCircle } from 'lucide-react';
import type { DocumentTemplate, Quote, Customer } from '@shared/schema';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  total: number;
}

interface QuoteTemplateProps {
  template: DocumentTemplate;
  quote: Quote;
  customer?: Customer;
  lineItems?: LineItem[];
  className?: string;
  showActions?: boolean;
  onSave?: () => void;
  onEmail?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onAccept?: () => void;
  isAccepting?: boolean;
}

export const QuoteTemplate = forwardRef<HTMLDivElement, QuoteTemplateProps>(({
  template,
  quote,
  customer,
  lineItems = [],
  className = '',
  showActions = false,
  onSave,
  onEmail,
  onDownload,
  onCopy,
  onAccept,
  isAccepting = false
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);

  // Calculate totals - use line items if available, otherwise fall back to quote amount
  const lineItemSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const hasLineItems = lineItems.length > 0 && lineItemSubtotal > 0;
  
  const gstRate = 0.15; // 15% GST for New Zealand
  
  let subtotal: number;
  let gstAmount: number;
  let totalAmount: number;
  
  if (hasLineItems) {
    // Line items already contain GST-inclusive amounts, so treat them like lump-sum
    totalAmount = lineItemSubtotal;
    // Reverse calculate subtotal from total (total = subtotal + GST = subtotal * 1.15)
    subtotal = totalAmount / (1 + gstRate);
    gstAmount = totalAmount - subtotal;
  } else {
    // Fall back to quote amount and calculate GST
    const quoteAmount = typeof quote.amount === 'string' ? parseFloat(quote.amount) : quote.amount;
    totalAmount = quoteAmount || 0;
    // Reverse calculate subtotal from total (total = subtotal + GST = subtotal * 1.15)
    subtotal = totalAmount / (1 + gstRate);
    gstAmount = totalAmount - subtotal;
  }

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      viewed: 'bg-purple-100 text-purple-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800'
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

  // Get quote expiry date
  const expiryDate = quote.validUntil ? new Date(quote.validUntil) : null;
  const isExpired = expiryDate && expiryDate < new Date();

  return (
    <div ref={ref} className={`w-full max-w-4xl mx-auto bg-white ${className}`}>
      {/* Action Bar */}
      {showActions && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Quote #{quote.quoteNumber}</h3>
              <p className="text-xs sm:text-sm text-gray-600">Using template: {template.name}</p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            {onAccept && quote.status !== 'accepted' && !isExpired && (
              <Button 
                size="sm" 
                onClick={onAccept} 
                disabled={isAccepting}
                data-testid="button-accept-quote" 
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isAccepting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    <span className="hidden sm:inline">Accepting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Accept & Create Work Order</span>
                    <span className="sm:hidden">Accept</span>
                  </>
                )}
              </Button>
            )}
            {onSave && (
              <Button size="sm" onClick={onSave} data-testid="button-save-quote" className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileText className="w-4 h-4 mr-2" />
                Save Quote
              </Button>
            )}
            {onCopy && (
              <Button variant="outline" size="sm" onClick={onCopy} data-testid="button-copy-quote">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            )}
            {onEmail && (
              <Button variant="outline" size="sm" onClick={onEmail} data-testid="button-email-quote">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            )}
            {onDownload && (
              <Button variant="outline" size="sm" onClick={onDownload} data-testid="button-download-quote">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Quote Document */}
      <Card className="shadow-lg border-0 overflow-hidden">
        {/* Header */}
        <CardHeader 
          className="p-2 pb-1.5 sm:p-8 sm:pb-6"
          style={{ 
            background: `linear-gradient(135deg, ${template.primaryColor || '#f97316'} 0%, ${template.secondaryColor || '#3b82f6'} 100%)`,
            color: 'white'
          }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start gap-1.5 sm:gap-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-3xl font-bold mb-0.5 sm:mb-2 truncate" data-testid="text-company-name">
                {template.companyName || 'Treemarkables LTD'}
              </h1>
              <p className="text-xs sm:text-lg opacity-90">Professional Tree Services</p>
              <div className="mt-1 sm:mt-4 space-y-0 sm:space-y-1 text-[10px] sm:text-sm opacity-90">
                <p data-testid="text-company-address" className="whitespace-pre-line">{template.companyAddress || 'Hauroa rd\nGisborne, 4010'}</p>
                <p data-testid="text-company-contact" className="break-all">
                  Phone: {template.companyPhone || '027 216 6882'} | Email: {template.companyEmail || 'quotes@treemarkables.nz'}
                </p>
                {template.gstNumber && (
                  <p data-testid="text-gst-number">GST: {template.gstNumber}</p>
                )}
              </div>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <div className="bg-white/20 rounded-lg p-1.5 sm:p-4 backdrop-blur-sm">
                <h2 className="text-base sm:text-2xl font-bold mb-0.5 sm:mb-2">QUOTE</h2>
                <Badge className={`${getStatusColor(quote.status)} border-0 text-[10px] sm:text-sm`} data-testid="badge-quote-status">
                  {quote.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-8">
          {/* Quote Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quote Details</h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Quote Number:</span>
                  <span className="font-semibold" data-testid="text-quote-number">{quote.quoteNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quote Date:</span>
                  <span data-testid="text-quote-date">
                    {quote.createdAt ? format(new Date(quote.createdAt), 'dd MMM yyyy') : 'N/A'}
                  </span>
                </div>
                {expiryDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid Until:</span>
                    <span className={isExpired ? 'text-red-600 font-semibold' : ''} data-testid="text-quote-expiry">
                      {format(expiryDate, 'dd MMM yyyy')}
                      {isExpired && ' (EXPIRED)'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Customer Details</h3>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <p className="font-semibold" data-testid="text-customer-name">
                    {customer?.name || 'Customer Name'}
                  </p>
                </div>
                {customer?.email && (
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p data-testid="text-customer-email">{customer.email}</p>
                  </div>
                )}
                {customer?.phone && (
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <p data-testid="text-customer-phone">{customer.phone}</p>
                  </div>
                )}
                {customer?.address && (
                  <div>
                    <span className="text-gray-600">Address:</span>
                    <p data-testid="text-customer-address">{customer.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quote Description */}
          {quote.description && (
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Service Description</h3>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap" data-testid="text-quote-description">
                  {quote.description}
                </p>
              </div>
            </div>
          )}

          {/* Line Items or Service Summary */}
          {hasLineItems ? (
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Service Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Description</th>
                      <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900">Qty</th>
                      <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900">Unit</th>
                      <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">Unit Price (inc GST)</th>
                      <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">Total (inc GST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={item.id} className="even:bg-gray-50" data-testid={`row-line-item-${index}`}>
                        <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">{item.description}</td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-gray-700">{item.quantity}</td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-gray-700">{item.unit || 'each'}</td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm text-gray-700">{formatCurrency(item.unitPrice)}</td>
                        <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Show service summary when no line items
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Service Summary</h3>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base text-gray-700">Total Service Cost:</span>
                  <span className="text-lg sm:text-xl font-bold text-gray-900" data-testid="text-service-total">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2">
                  Total amount including GST as quoted
                </p>
              </div>
            </div>
          )}

          <Separator className="my-6 sm:my-8" />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2 sm:space-y-3">
              <div className="flex justify-between text-sm sm:text-base text-gray-700">
                <span>Subtotal (excl GST):</span>
                <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base text-gray-700">
                <span>GST (15%):</span>
                <span data-testid="text-gst-amount">{formatCurrency(gstAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg sm:text-xl font-bold text-gray-900">
                <span>Total (inc GST):</span>
                <span data-testid="text-total-amount">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          {(quote.terms || template.paymentTerms) && (
            <div className="mt-6 sm:mt-8">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Terms & Conditions</h3>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <p className="text-gray-700 text-sm whitespace-pre-wrap" data-testid="text-quote-terms">
                  {quote.terms || template.paymentTerms || 'Payment due within 7 days of acceptance.'}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center text-sm text-gray-600">
              <p>Thank you for considering {template.companyName || 'Treemarkables'}!</p>
              <p className="mt-1">This quote is valid until {expiryDate ? format(expiryDate, 'dd MMM yyyy') : '30 days from quote date'}.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

QuoteTemplate.displayName = 'QuoteTemplate';

export default QuoteTemplate;
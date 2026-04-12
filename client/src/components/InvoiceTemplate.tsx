import { useState, forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, addDays } from 'date-fns';
import { Download, Mail, Copy, CreditCard, MessageSquare } from 'lucide-react';
import type { DocumentTemplate, Customer, InvoiceSectionConfig, InvoiceBlock } from '@shared/schema';
import type {
  InvoiceBlockConfigHeader,
  InvoiceBlockConfigBillTo,
  InvoiceBlockConfigLineItems,
  InvoiceBlockConfigTotals,
  InvoiceBlockConfigPayment,
  InvoiceBlockConfigFooter,
  InvoiceBlockConfigJobDescription,
  InvoiceBlockConfigCompanyInfo,
  InvoiceBlockConfigInvoiceMeta,
  InvoiceBlockConfigDivider,
  InvoiceBlockConfigCustomText,
} from '@shared/schema';
import { LinkifiedText } from '@/utils/linkify';

const DEFAULT_SECTION_ORDER = [
  'header', 'billTo', 'description', 'lineItems', 'totals', 'payment', 'footer'
];

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
  sectionConfig?: InvoiceSectionConfig[];
  blockConfig?: InvoiceBlock[];
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
  sectionConfig,
  blockConfig,
  onEmail,
  onSms,
  onDownload,
  onCopy,
  onAddPayment
}, ref) => {
  // Use contact name from prop, invoice, or empty string
  const displayContactName = contactName || invoice.contactName || '';
  const [isLoading, setIsLoading] = useState(false);

  // When blockConfig is provided, use it as the rendering source (new block-based renderer)
  // Otherwise fall back to legacy sectionConfig/DEFAULT_SECTION_ORDER
  const activeBlocks: InvoiceBlock[] | null = blockConfig && blockConfig.length > 0
    ? [...blockConfig].sort((a, b) => a.order - b.order)
    : null;

  // Build an ordered list of section IDs that are visible (legacy path)
  const orderedVisibleIds: string[] = sectionConfig
    ? sectionConfig.filter(s => s.visible).map(s => s.id)
    : DEFAULT_SECTION_ORDER;

  // Build a label lookup so custom section names appear on the invoice
  const sectionLabel: Record<string, string> = {
    billTo: "Bill To",
    description: "Description",
    lineItems: "Services & Pricing",
    payment: "Payment Information",
  };
  if (sectionConfig) {
    sectionConfig.forEach(s => { sectionLabel[s.id] = s.label; });
  }

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
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : addDays(issueDate, 7);

  // Render blocks (new block-based path) — computed before JSX return
  const renderedBlocks: JSX.Element[] | null = activeBlocks
    ? activeBlocks.filter(b => b.visible).map(block => {
        switch (block.type) {
          case 'header': {
            const cfg = block.config as InvoiceBlockConfigHeader;
            const hdrBg = cfg.headerColor || "#ffffff";
            const isLight = (() => {
              const hex = hdrBg.replace("#", "");
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              return (r * 299 + g * 587 + b * 114) / 1000 > 128;
            })();
            const textPrimary = isLight ? "#000000" : "#ffffff";
            const textSecondary = isLight ? "#4b5563" : "#d1d5db";
            const logoAlign = cfg.logoAlignment || template.logoAlignment || 'left';
            return (
              <div key={block.id} className="mb-8 rounded-sm overflow-hidden" style={{ backgroundColor: hdrBg, height: 80 }}>
                <div className="h-full px-4 flex items-center">
                  {logoAlign === "center" ? (
                    <div className="w-full flex items-center justify-center gap-3 text-center">
                      <img src={template.logoUrl || "/treemarkables-logo.webp"} alt={template.companyName || "Treemarkables"} style={{ height: `${template.logoSize ?? 40}px` }} className="w-auto object-contain flex-shrink-0" />
                      <div>
                        <h1 className="text-base font-bold" style={{ color: textPrimary }}>Invoice #{invoice.invoiceNumber}</h1>
                        {cfg.showCompanyName && <p className="text-xs mt-1" style={{ color: textSecondary }}>{template.companyName}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full flex items-center justify-between gap-3 ${logoAlign === "right" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className="flex-shrink-0">
                        <img src={template.logoUrl || "/treemarkables-logo.webp"} alt={template.companyName || "Treemarkables"} style={{ height: `${template.logoSize ?? 40}px` }} className="w-auto object-contain" />
                      </div>
                      <div className={`flex-1 ${logoAlign === "right" ? "text-left" : "text-right"}`}>
                        <h1 className="text-base font-bold" style={{ color: textPrimary }}>Invoice #{invoice.invoiceNumber}</h1>
                        {cfg.showCompanyName && <p className="text-xs mt-1" style={{ color: textSecondary }}>{template.companyName}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          case 'companyInfo': {
            const cfg = block.config as InvoiceBlockConfigCompanyInfo;
            return (
              <div key={block.id} className="mb-4 text-xs space-y-0.5 text-gray-700">
                {cfg.showName && <div className="font-semibold text-gray-900">{template.companyName || 'Treemarkables LTD'}</div>}
                {cfg.showAddress && <div>{template.companyAddress || '213 Stanley Road, Gisborne'}</div>}
                {cfg.showPhone && <div>Ph: {template.companyPhone || '027 216 6882'}</div>}
                {cfg.showEmail && <div>{template.companyEmail || 'quotes@treemarkables.nz'}</div>}
                {cfg.showGST && <div>GST: {template.gstNumber || '131-047-592'}</div>}
              </div>
            );
          }
          case 'invoiceMeta': {
            const cfg = block.config as InvoiceBlockConfigInvoiceMeta;
            return (
              <div key={block.id} className="mb-4 text-xs space-y-1">
                {cfg.showInvoiceNumber && <div className="flex justify-between gap-2"><span className="text-gray-600">{cfg.labelInvoice || 'Invoice #'}</span><span className="font-medium">{invoice.invoiceNumber}</span></div>}
                {cfg.showIssueDate && <div className="flex justify-between gap-2"><span className="text-gray-600">{cfg.labelIssueDate || 'Issue Date'}</span><span>{format(issueDate, 'dd/MM/yyyy')}</span></div>}
                {cfg.showDueDate && <div className="flex justify-between gap-2"><span className="text-gray-600">{cfg.labelDueDate || 'Due Date'}</span><span>{format(dueDate, 'dd/MM/yyyy')}</span></div>}
                {cfg.showJobNumber && jobNumber ? <div className="flex justify-between gap-2"><span className="text-gray-600">Job #</span><span>{jobNumber}</span></div> : null}
              </div>
            );
          }
          case 'billTo': {
            const cfg = block.config as InvoiceBlockConfigBillTo;
            return (
              <div key={block.id} className="mb-4">
                <h2 className="text-xs font-semibold text-black mb-2">{cfg.label || 'Bill To'}</h2>
                <div>
                  <p className="font-semibold text-black text-xs mb-1" data-testid="text-customer-name">{billingName || customer?.name || 'Customer'}</p>
                  {cfg.showAddress && (jobAddress || customer?.address) && <p className="text-xs text-gray-600 mb-1">{jobAddress || customer?.address}</p>}
                  {billingName && customer?.name && billingName !== customer.name && <p className="text-xs text-gray-600 mb-1"><span className="mr-1">c/o</span>{customer.name}</p>}
                  {displayContactName && (!billingName || displayContactName !== customer?.name) && <p className="text-xs text-gray-600 mb-1"><span className="mr-1">c/o</span>{displayContactName}</p>}
                  {cfg.showEmail && customer?.email && <p className="text-xs text-gray-600"><span className="mr-1">&#9993;</span>{customer.email}</p>}
                </div>
              </div>
            );
          }
          case 'jobDescription': {
            const cfg = block.config as InvoiceBlockConfigJobDescription;
            if (!description && !invoice.notes) return null;
            return (
              <div key={block.id} className="mb-4">
                <h2 className="text-xs font-semibold text-black mb-2">{cfg.label || 'Description'}</h2>
                <div className="text-xs text-gray-700 whitespace-pre-wrap" data-testid="text-invoice-description">
                  <LinkifiedText text={description || invoice.notes || ''} />
                </div>
              </div>
            );
          }
          case 'lineItems': {
            const cfg = block.config as InvoiceBlockConfigLineItems;
            if (!hasLineItems) return null;
            return (
              <div key={block.id} className="mb-4">
                <h2 className="text-xs font-semibold text-black mb-2">{cfg.labelDescription || 'Services & Pricing'}</h2>
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-200 px-2 py-2 text-left text-xs font-semibold text-gray-900">{cfg.labelDescription || 'Service'}</th>
                        {cfg.showQty && <th className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-900 w-16">{cfg.labelQty || 'Qty'}</th>}
                        {cfg.showRate && <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900 w-20">{cfg.labelRate || 'Rate'}</th>}
                        <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900 w-20">{cfg.labelAmount || 'Price'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, index) => {
                        const qty = item.quantity || 1;
                        const rate = item.unitPrice || item.rate || 0;
                        const itemTotal = item.total || item.amount || (qty * rate);
                        return (
                          <tr key={item.id} className="even:bg-gray-50" data-testid={`row-line-item-${index}`}>
                            <td className="border border-gray-200 px-2 py-2 text-xs text-gray-900"><LinkifiedText text={item.description} /></td>
                            {cfg.showQty && <td className="border border-gray-200 px-2 py-2 text-xs text-center text-gray-900">{qty}</td>}
                            {cfg.showRate && <td className="border border-gray-200 px-2 py-2 text-xs text-right text-gray-900">{formatCurrency(rate)}</td>}
                            <td className="border border-gray-200 px-2 py-2 text-xs text-right font-medium text-gray-900">{formatCurrency(typeof itemTotal === 'string' ? parseFloat(itemTotal) : itemTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          case 'totals': {
            const cfg = block.config as InvoiceBlockConfigTotals;
            return (
              <div key={block.id} className="pt-3 border-t border-gray-200">
                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-1">
                    {cfg.showSubtotal && <div className="flex justify-between text-xs"><span className="text-gray-600">{cfg.labelSubtotal || 'Subtotal (excl GST)'}:</span><span className="text-black" data-testid="text-subtotal">{formatCurrency(subtotal)}</span></div>}
                    {cfg.showGST && <div className="flex justify-between text-xs border-b border-gray-200 pb-1"><span className="text-gray-600">{cfg.labelGST || 'GST (15%)'}:</span><span className="text-black" data-testid="text-gst-amount">{formatCurrency(gstAmount)}</span></div>}
                    <div className="flex justify-between pt-2"><span className="text-sm font-bold text-black">{cfg.labelTotal || 'Total Amount'}:</span><span className="text-sm font-bold text-black" data-testid="text-total-amount">{formatCurrency(totalAmount)}</span></div>
                  </div>
                </div>
              </div>
            );
          }
          case 'payment': {
            const cfg = block.config as InvoiceBlockConfigPayment;
            return (
              <div key={block.id} className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-xs font-semibold text-black mb-2">{cfg.label || 'Payment Information'}</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  {cfg.showDueDate && <p><span className="font-medium text-black">Due Date:</span> {format(dueDate, 'dd MMM yyyy')}</p>}
                  {cfg.showBank && <p><span className="font-medium text-black">Bank:</span> ANZ</p>}
                  {cfg.showAccountNumber && <p><span className="font-medium text-black">Account Number:</span> 06 0637 0768850 00</p>}
                  {cfg.showAccountName && <p><span className="font-medium text-black">Account Name:</span> {template.companyName || 'Treemarkables LTD'}</p>}
                  {cfg.showTerms && template.paymentTerms && <p><span className="font-medium text-black">Terms:</span> {template.paymentTerms}</p>}
                </div>
              </div>
            );
          }
          case 'divider': {
            const cfg = block.config as InvoiceBlockConfigDivider;
            return <hr key={block.id} className="my-3" style={{ borderColor: cfg.color || '#e5e7eb', borderTopWidth: cfg.thickness || 1 }} />;
          }
          case 'customText': {
            const cfg = block.config as InvoiceBlockConfigCustomText;
            const sizeMap: Record<string, string> = { xs: 'text-xs', sm: 'text-sm', base: 'text-base' };
            const alignMap: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
            return (
              <div key={block.id} className={`my-2 ${sizeMap[cfg.fontSize] || 'text-sm'} ${alignMap[cfg.align] || 'text-left'} text-gray-700 whitespace-pre-wrap`}>
                {cfg.text}
              </div>
            );
          }
          case 'footer': {
            const cfg = block.config as InvoiceBlockConfigFooter;
            const parts: string[] = [];
            if (cfg.showCompanyName) parts.push(template.companyName || 'Treemarkables LTD');
            if (cfg.showAddress) parts.push(template.companyAddress?.replace(/\n/g, ', ') || '213 Stanley Road, Gisborne');
            if (cfg.showPhone) parts.push(`Phone: ${template.companyPhone || '027 216 6882'}`);
            if (cfg.showEmail) parts.push(`Email: ${template.companyEmail || 'quotes@treemarkables.nz'}`);
            return (
              <div key={block.id} className="mt-4 pt-3 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500 break-words">{parts.join(' | ')}</p>
                {cfg.showGST && <p className="text-xs text-gray-500 mt-1">GST Number: {template.gstNumber || '131-047-592'}</p>}
                {cfg.showPaymentTerms && template.paymentTerms && <p className="text-xs text-gray-500 mt-1">{template.paymentTerms}</p>}
              </div>
            );
          }
          default:
            return null;
        }
      }).filter((el): el is JSX.Element => el !== null)
    : null;

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
          {renderedBlocks ?? (
          /* ─── Legacy section-based rendering (fallback) ─── */
          orderedVisibleIds.map(sectionId => {
            switch (sectionId) {
              case 'header': {
                const hdrBg = (template as { headerColor?: string }).headerColor || "#ffffff";
                const isLight = (() => {
                  const hex = hdrBg.replace("#", "");
                  const r = parseInt(hex.substring(0,2),16);
                  const g = parseInt(hex.substring(2,4),16);
                  const b = parseInt(hex.substring(4,6),16);
                  return (r*299 + g*587 + b*114) / 1000 > 128;
                })();
                const textPrimary = isLight ? "#000000" : "#ffffff";
                const textSecondary = isLight ? "#4b5563" : "#d1d5db";
                return (
                  <div
                    key="header"
                    className="mb-8 rounded-sm overflow-hidden"
                    style={{ backgroundColor: hdrBg, height: 80 }}
                  >
                    <div className="h-full px-4 flex items-center">
                    {template.logoAlignment === "center" ? (
                      <div className="w-full flex items-center justify-center gap-3 text-center">
                        <img
                          src={template.logoUrl || "/treemarkables-logo.webp"}
                          alt={template.companyName || "Treemarkables"}
                          style={{ height: `${template.logoSize ?? 40}px` }}
                          className="w-auto object-contain flex-shrink-0"
                        />
                        <div>
                          <h1 className="text-base font-bold" style={{ color: textPrimary }}>Invoice #{invoice.invoiceNumber}</h1>
                          <p className="text-xs mt-1" style={{ color: textSecondary }}>
                            {billingName || customer?.name || 'Customer'} - {format(issueDate, 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className={`w-full flex items-center justify-between gap-3 ${template.logoAlignment === "right" ? "flex-row-reverse" : "flex-row"}`}>
                        <div className="flex-shrink-0">
                          <img
                            src={template.logoUrl || "/treemarkables-logo.webp"}
                            alt={template.companyName || "Treemarkables"}
                            style={{ height: `${template.logoSize ?? 40}px` }}
                            className="w-auto object-contain"
                          />
                        </div>
                        <div className={`flex-1 ${template.logoAlignment === "right" ? "text-left" : "text-right"}`}>
                          <h1 className="text-base font-bold" style={{ color: textPrimary }}>Invoice #{invoice.invoiceNumber}</h1>
                          <p className="text-xs mt-1" style={{ color: textSecondary }}>
                            {billingName || customer?.name || 'Customer'} - {format(issueDate, 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                );
              }

              case 'billTo':
                return (
                  <div key="billTo" className="mb-4">
                    <h2 className="text-xs font-semibold text-black mb-2">{sectionLabel['billTo']}</h2>
                    <div>
                      <p className="font-semibold text-black text-xs mb-1" data-testid="text-customer-name">
                        {billingName || customer?.name || 'Customer'}
                      </p>
                      {(jobAddress || customer?.address) && (
                        <p className="text-xs text-gray-600 mb-1">{jobAddress || customer?.address}</p>
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
                );

              case 'description':
                if (!description && !invoice.notes) return null;
                return (
                  <div key="description" className="mb-4">
                    <h2 className="text-xs font-semibold text-black mb-2">{sectionLabel['description']}</h2>
                    <div className="text-xs text-gray-700 whitespace-pre-wrap" data-testid="text-invoice-description">
                      <LinkifiedText text={description || invoice.notes || ''} />
                    </div>
                  </div>
                );

              case 'lineItems':
                if (!hasLineItems) return null;
                return (
                  <div key="lineItems" className="mb-4">
                    <h2 className="text-xs font-semibold text-black mb-2">{sectionLabel['lineItems']}</h2>
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
                                <td className="border border-gray-200 px-2 py-2 text-xs text-center text-gray-900">{qty}</td>
                                <td className="border border-gray-200 px-2 py-2 text-xs text-right text-gray-900">{formatCurrency(rate)}</td>
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
                );

              case 'totals':
                return (
                  <div key="totals" className="pt-3 border-t border-gray-200">
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
                );

              case 'payment':
                return (
                  <div key="payment" className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-xs font-semibold text-black mb-2">{sectionLabel['payment']}</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p><span className="font-medium text-black">Due Date:</span> {format(dueDate, 'dd MMM yyyy')}</p>
                      <p><span className="font-medium text-black">Bank:</span> ANZ</p>
                      <p><span className="font-medium text-black">Account Number:</span> 06 0637 0768850 00</p>
                      <p><span className="font-medium text-black">Account Name:</span> {template.companyName || 'Treemarkables LTD'}</p>
                      {template.paymentTerms && (
                        <p><span className="font-medium text-black">Terms:</span> {template.paymentTerms}</p>
                      )}
                    </div>
                  </div>
                );

              case 'footer':
                return (
                  <div key="footer" className="mt-4 pt-3 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500 break-words">
                      {template.companyName || 'Treemarkables LTD'}
                      {template.companyAddress ? ` | ${template.companyAddress.replace(/\n/g, ', ')}` : ' | 213 Stanley Road, Gisborne'}
                      {template.companyPhone ? ` | Phone: ${template.companyPhone}` : ' | Phone: 027 216 6882'}
                      {template.companyEmail ? ` | Email: ${template.companyEmail}` : ' | Email: quotes@treemarkables.nz'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {template.gstNumber ? `GST Number: ${template.gstNumber}` : 'GST Number: 131-047-592'}
                      {template.paymentTerms ? ` · ${template.paymentTerms}` : ' · Payment terms: 7 days'}
                    </p>
                  </div>
                );

              default:
                return null;
            }
          }))}
        </CardContent>
      </Card>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;

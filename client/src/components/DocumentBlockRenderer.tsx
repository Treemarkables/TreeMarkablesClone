/**
 * Shared document block renderer.
 * Single source of truth for rendering document blocks —
 * used by both InvoiceTemplate.tsx (final output) and
 * InvoiceBuilderPage.tsx (live WYSIWYG canvas).
 */
import { format, addDays } from 'date-fns';
import type { DocumentBlock, DocumentTemplate } from '@shared/schema';
import type {
  DocumentBlockConfigHeader,
  DocumentBlockConfigBillTo,
  DocumentBlockConfigLineItems,
  DocumentBlockConfigTotals,
  DocumentBlockConfigPayment,
  DocumentBlockConfigFooter,
  DocumentBlockConfigJobDescription,
  DocumentBlockConfigCompanyInfo,
  DocumentBlockConfigInvoiceMeta,
  DocumentBlockConfigDivider,
  DocumentBlockConfigCustomText,
} from '@shared/schema';
import type { CompanyInfo } from '@shared/documentBlockDefaults';
import { LinkifiedText } from '@/utils/linkify';

export interface DocumentRenderContext {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  billingName: string;
  displayContactName?: string;
  jobAddress?: string;
  customerAddress?: string;
  customerEmail?: string;
  description?: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity?: number;
    unitPrice?: number;
    rate?: number;
    total?: number;
    amount?: number;
  }>;
  hasLineItems: boolean;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  jobNumber?: number;
}

/** Sample context used by the invoice builder's WYSIWYG canvas. */
export function buildSampleContext(): DocumentRenderContext {
  const now = new Date();
  return {
    invoiceNumber: 'INV-SAMPLE',
    issueDate: now,
    dueDate: addDays(now, 14),
    billingName: 'Sample Customer',
    jobAddress: '123 Demo Street, City',
    customerAddress: '123 Demo Street, City',
    customerEmail: 'customer@example.com',
    description: 'Professional tree removal and site cleanup services.',
    lineItems: [
      { id: '1', description: 'Tree removal service', quantity: 1, unitPrice: 500, total: 500 },
      { id: '2', description: 'Site cleanup', quantity: 1, unitPrice: 150, total: 150 },
    ],
    hasLineItems: true,
    subtotal: 650,
    gstAmount: 97.50,
    totalAmount: 747.50,
    jobNumber: 1001,
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(amount);

/**
 * Render a single invoice block to JSX.
 * Returns null for invisible or inapplicable blocks.
 */
export function renderDocumentBlock(
  block: DocumentBlock,
  template: DocumentTemplate,
  ctx: DocumentRenderContext,
  co: CompanyInfo,
): JSX.Element | null {
  switch (block.type) {
    case 'header': {
      const cfg = block.config as DocumentBlockConfigHeader;
      const hdrBg = cfg.headerColor || '#ffffff';
      const hex = hdrBg.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 255;
      const g = parseInt(hex.substring(2, 4), 16) || 255;
      const b = parseInt(hex.substring(4, 6), 16) || 255;
      const isLight = (r * 299 + g * 587 + b * 114) / 1000 > 128;
      const textPrimary = isLight ? '#000000' : '#ffffff';
      const textSecondary = isLight ? '#4b5563' : '#d1d5db';
      const logoAlign = cfg.logoAlignment || template.logoAlignment || 'left';
      return (
        <div key={block.id} className="mb-8 rounded-sm overflow-hidden" style={{ backgroundColor: hdrBg, height: 80 }}>
          <div className="h-full px-4 flex items-center">
            {logoAlign === 'center' ? (
              <div className="w-full flex items-center justify-center gap-3 text-center">
                <img src={template.logoUrl || '/treemarkables-logo.webp'} alt={co.name} style={{ height: `${template.logoSize ?? 40}px` }} className="w-auto object-contain flex-shrink-0" />
                <div>
                  <h1 className="text-base font-bold" style={{ color: textPrimary }}>Invoice #{ctx.invoiceNumber}</h1>
                  {cfg.showCompanyName && <p className="text-xs mt-1" style={{ color: textSecondary }}>{co.name}</p>}
                </div>
              </div>
            ) : (
              <div className={`w-full flex items-center justify-between gap-3 ${logoAlign === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="flex-shrink-0">
                  <img src={template.logoUrl || '/treemarkables-logo.webp'} alt={co.name} style={{ height: `${template.logoSize ?? 40}px` }} className="w-auto object-contain" />
                </div>
                <div className={`flex-1 ${logoAlign === 'right' ? 'text-left' : 'text-right'}`}>
                  <h1 className="text-base font-bold" style={{ color: textPrimary }}>Invoice #{ctx.invoiceNumber}</h1>
                  {cfg.showCompanyName && <p className="text-xs mt-1" style={{ color: textSecondary }}>{co.name}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    case 'companyInfo': {
      const cfg = block.config as DocumentBlockConfigCompanyInfo;
      return (
        <div key={block.id} className="mb-4 text-xs space-y-0.5 text-gray-700">
          {cfg.showName && <div className="font-semibold text-gray-900">{co.name}</div>}
          {cfg.showAddress && <div>{co.address}</div>}
          {cfg.showPhone && <div>Ph: {co.phone}</div>}
          {cfg.showEmail && <div>{co.email}</div>}
          {cfg.showGST && <div>GST: {co.gstNumber}</div>}
        </div>
      );
    }
    case 'invoiceMeta': {
      const cfg = block.config as DocumentBlockConfigInvoiceMeta;
      return (
        <div key={block.id} className="mb-4 text-xs space-y-1">
          {cfg.showInvoiceNumber && <div className="flex justify-between gap-2"><span className="text-gray-600">{cfg.labelInvoice || 'Invoice #'}</span><span className="font-medium">{ctx.invoiceNumber}</span></div>}
          {cfg.showIssueDate && <div className="flex justify-between gap-2"><span className="text-gray-600">{cfg.labelIssueDate || 'Issue Date'}</span><span>{format(ctx.issueDate, 'dd/MM/yyyy')}</span></div>}
          {cfg.showDueDate && <div className="flex justify-between gap-2"><span className="text-gray-600">{cfg.labelDueDate || 'Due Date'}</span><span>{format(ctx.dueDate, 'dd/MM/yyyy')}</span></div>}
          {cfg.showJobNumber && ctx.jobNumber ? <div className="flex justify-between gap-2"><span className="text-gray-600">Job #</span><span>{ctx.jobNumber}</span></div> : null}
        </div>
      );
    }
    case 'billTo': {
      const cfg = block.config as DocumentBlockConfigBillTo;
      return (
        <div key={block.id} className="mb-4">
          <h2 className="text-xs font-semibold text-black mb-2">{cfg.label || 'Bill To'}</h2>
          <div>
            <p className="font-semibold text-black text-xs mb-1">{ctx.billingName}</p>
            {cfg.showAddress && (ctx.jobAddress || ctx.customerAddress) && (
              <p className="text-xs text-gray-600 mb-1">{ctx.jobAddress || ctx.customerAddress}</p>
            )}
            {ctx.displayContactName && ctx.displayContactName !== ctx.billingName && (
              <p className="text-xs text-gray-600 mb-1"><span className="mr-1">c/o</span>{ctx.displayContactName}</p>
            )}
            {cfg.showEmail && ctx.customerEmail && (
              <p className="text-xs text-gray-600"><span className="mr-1">&#9993;</span>{ctx.customerEmail}</p>
            )}
          </div>
        </div>
      );
    }
    case 'jobDescription': {
      const cfg = block.config as DocumentBlockConfigJobDescription;
      if (!ctx.description) return null;
      return (
        <div key={block.id} className="mb-4">
          <h2 className="text-xs font-semibold text-black mb-2">{cfg.label || 'Description'}</h2>
          <div className="text-xs text-gray-700 whitespace-pre-wrap">
            <LinkifiedText text={ctx.description} />
          </div>
        </div>
      );
    }
    case 'lineItems': {
      const cfg = block.config as DocumentBlockConfigLineItems;
      if (!ctx.hasLineItems) return null;
      const descPct = cfg.descColPct ?? 60;
      return (
        <div key={block.id} className="mb-4">
          <h2 className="text-xs font-semibold text-black mb-2">{cfg.labelDescription || 'Services & Pricing'}</h2>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-2 py-2 text-left text-xs font-semibold text-gray-900" style={{ width: `${descPct}%` }}>{cfg.labelDescription || 'Service'}</th>
                  {cfg.showQty && <th className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-900">{cfg.labelQty || 'Qty'}</th>}
                  {cfg.showRate && <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900">{cfg.labelRate || 'Rate'}</th>}
                  <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900">{cfg.labelAmount || 'Price'}</th>
                </tr>
              </thead>
              <tbody>
                {ctx.lineItems.map((item, i) => {
                  const qty = item.quantity || 1;
                  const rate = item.unitPrice || item.rate || 0;
                  const itemTotal = item.total || item.amount || qty * rate;
                  return (
                    <tr key={item.id} className="even:bg-gray-50">
                      <td className="border border-gray-200 px-2 py-2 text-xs text-gray-900"><LinkifiedText text={item.description} /></td>
                      {cfg.showQty && <td className="border border-gray-200 px-2 py-2 text-xs text-center text-gray-900">{qty}</td>}
                      {cfg.showRate && <td className="border border-gray-200 px-2 py-2 text-xs text-right text-gray-900">{formatCurrency(rate)}</td>}
                      <td className="border border-gray-200 px-2 py-2 text-xs text-right font-medium text-gray-900">{formatCurrency(typeof itemTotal === 'string' ? parseFloat(itemTotal as string) : (itemTotal as number))}</td>
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
      const cfg = block.config as DocumentBlockConfigTotals;
      return (
        <div key={block.id} className="pt-3 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-1">
              {cfg.showSubtotal && <div className="flex justify-between text-xs"><span className="text-gray-600">{cfg.labelSubtotal || 'Subtotal (excl GST)'}:</span><span className="text-black">{formatCurrency(ctx.subtotal)}</span></div>}
              {cfg.showGST && <div className="flex justify-between text-xs border-b border-gray-200 pb-1"><span className="text-gray-600">{cfg.labelGST || 'GST (15%)'}:</span><span className="text-black">{formatCurrency(ctx.gstAmount)}</span></div>}
              <div className="flex justify-between pt-2"><span className="text-sm font-bold text-black">{cfg.labelTotal || 'Total Amount'}:</span><span className="text-sm font-bold text-black">{formatCurrency(ctx.totalAmount)}</span></div>
            </div>
          </div>
        </div>
      );
    }
    case 'payment': {
      const cfg = block.config as DocumentBlockConfigPayment;
      return (
        <div key={block.id} className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-xs font-semibold text-black mb-2">{cfg.label || 'Payment Information'}</h3>
          <div className="text-xs text-gray-600 space-y-1">
            {cfg.showDueDate && <p><span className="font-medium text-black">Due Date:</span> {format(ctx.dueDate, 'dd MMM yyyy')}</p>}
            {cfg.showBank && <p><span className="font-medium text-black">Bank:</span> ANZ</p>}
            {cfg.showAccountNumber && <p><span className="font-medium text-black">Account Number:</span> 06 0637 0768850 00</p>}
            {cfg.showAccountName && <p><span className="font-medium text-black">Account Name:</span> {co.name}</p>}
            {cfg.showTerms && template.paymentTerms && <p><span className="font-medium text-black">Terms:</span> {template.paymentTerms}</p>}
          </div>
        </div>
      );
    }
    case 'divider': {
      const cfg = block.config as DocumentBlockConfigDivider;
      return <hr key={block.id} className="my-3" style={{ borderColor: cfg.color || '#e5e7eb', borderTopWidth: cfg.thickness || 1 }} />;
    }
    case 'customText': {
      const cfg = block.config as DocumentBlockConfigCustomText;
      const sizeMap: Record<string, string> = { xs: 'text-xs', sm: 'text-sm', base: 'text-base' };
      const alignMap: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
      return (
        <div key={block.id} className={`my-2 ${sizeMap[cfg.fontSize] || 'text-sm'} ${alignMap[cfg.align] || 'text-left'} text-gray-700 whitespace-pre-wrap`}>
          {cfg.text}
        </div>
      );
    }
    case 'footer': {
      const cfg = block.config as DocumentBlockConfigFooter;
      const parts: string[] = [];
      if (cfg.showCompanyName) parts.push(co.name);
      if (cfg.showAddress) parts.push(co.address.replace(/\n/g, ', '));
      if (cfg.showPhone) parts.push(`Phone: ${co.phone}`);
      if (cfg.showEmail) parts.push(`Email: ${co.email}`);
      return (
        <div key={block.id} className="mt-4 pt-3 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500 break-words">{parts.join(' | ')}</p>
          {cfg.showGST && <p className="text-xs text-gray-500 mt-1">GST Number: {co.gstNumber}</p>}
          {cfg.showPaymentTerms && template.paymentTerms && <p className="text-xs text-gray-500 mt-1">{template.paymentTerms}</p>}
        </div>
      );
    }
    default:
      return null;
  }
}

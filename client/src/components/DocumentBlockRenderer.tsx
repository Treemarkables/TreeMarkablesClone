/**
 * Shared document block renderer.
 * Single source of truth for rendering document blocks —
 * used by both InvoiceTemplate.tsx (final output) and
 * DocumentBuilderPage.tsx (live WYSIWYG canvas).
 */
import type { FocusEvent, MouseEvent } from 'react';
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
  DocumentBlockConfigProposalMeta,
  DocumentBlockConfigLineItemsWithChoices,
  DocumentBlockConfigPhotoGallery,
  DocumentBlockConfigAcceptance,
  DocumentBlockConfigGoogleReview,
} from '@shared/schema';
import type { CompanyInfo } from '@shared/documentBlockDefaults';
import { LinkifiedText } from '@/utils/linkify';
import { ProposalReviewsWidget } from '@/components/ProposalReviewsWidget';

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
  // Dollar discount applied to the (pre-GST) subtotal. When > 0 the totals
  // block renders a "Discount" line between subtotal and GST. Optional —
  // invoice callers and discount-free proposals omit it.
  discountAmount?: number;
  jobNumber?: number;

  // Proposal-flavoured fields — all optional; invoice callers can omit.
  proposalNumber?: string;
  expiryDate?: Date;
  lineItemsWithChoices?: Array<{
    id: string;
    description: string;
    quantity?: number;
    unit?: string;
    notes?: string;
    pricingType: 'normal' | 'choice' | 'fixed';
    unitPrice?: number;
    total?: number;
    fixedPrice?: number;
    choices?: Array<{ id: string; label: string; description?: string; price: number; isDefault?: boolean }>;
    selectedChoiceId?: string;
    isOptional?: boolean;
    selected?: boolean;
  }>;
  photos?: Array<{ id: string; url: string; caption?: string; altText?: string }>;
  acceptance?: {
    accepted: boolean;
    signedAt?: Date;
    signatureName?: string;
  };

  // Customer-facing proposal pages render their own page-level "Accept
  // proposal" button at the top of the viewport — set this to suppress the
  // duplicate in-document acceptance block. The accepted-state stamp still
  // renders so customers see confirmation after signing.
  hidePageAcceptance?: boolean;
}

/** Sample context used by the document builder's WYSIWYG canvas. */
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

    // Sample proposal data — used by the builder preview when proposal blocks are placed.
    proposalNumber: 'PRO-SAMPLE',
    expiryDate: addDays(now, 30),
    lineItemsWithChoices: [
      {
        id: '1', description: 'Tree removal (large oak)', quantity: 1, pricingType: 'normal',
        unitPrice: 1200, total: 1200,
      },
      {
        id: '2', description: 'Stump grinding', quantity: 1, pricingType: 'choice',
        choices: [
          { id: 'c1', label: 'Surface (10 cm)', price: 180, isDefault: true },
          { id: 'c2', label: 'Deep (30 cm)', price: 320 },
        ],
      },
      {
        id: '3', description: 'Mulch delivery (optional)', quantity: 1, pricingType: 'normal',
        unitPrice: 90, total: 90, isOptional: true, selected: true,
      },
    ],
    photos: [
      { id: 'p1', url: '/treemarkables-logo.webp', caption: 'Site overview' },
      { id: 'p2', url: '/treemarkables-logo.webp', caption: 'Tree to remove' },
    ],
    acceptance: { accepted: false },
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(amount);

/**
 * Optional inline-edit handler. Builder canvas passes one in; final/customer
 * rendering callers leave it undefined for read-only output.
 */
export interface EditableHandler {
  onEdit: (field: string, value: string) => void;
}

/** Small contenteditable wrapper used on the builder canvas. */
function EditableText({
  value,
  onChange,
  as = 'span',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  as?: 'span' | 'div';
  className?: string;
}) {
  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    const next = (e.currentTarget.textContent ?? '').trim();
    if (next !== value) onChange(next);
  };
  const stop = (e: MouseEvent<HTMLElement>) => e.stopPropagation();
  const baseClass =
    'pointer-events-auto outline-none rounded-sm hover:bg-orange-50/60 focus:bg-orange-50 focus:ring-1 focus:ring-orange-300 px-0.5 -mx-0.5 cursor-text';
  if (as === 'div') {
    return (
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onClick={stop}
        onMouseDown={stop}
        className={`${baseClass} ${className ?? ''}`}
      >
        {value}
      </div>
    );
  }
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onClick={stop}
      onMouseDown={stop}
      className={`${baseClass} ${className ?? ''}`}
    >
      {value}
    </span>
  );
}

/**
 * Render a single invoice block to JSX.
 * Returns null for invisible or inapplicable blocks.
 */
export function renderDocumentBlock(
  block: DocumentBlock,
  template: DocumentTemplate,
  ctx: DocumentRenderContext,
  co: CompanyInfo,
  editable?: EditableHandler,
): JSX.Element | null {
  // Helper: when editable is set, return an inline-editable span/div; otherwise
  // the raw text. The renderer is shared with customer rendering, which passes
  // no editable handler — same JSX, no behaviour change there.
  const editText = (
    field: string,
    value: string,
    as: 'span' | 'div' = 'span',
  ): JSX.Element | string =>
    editable
      ? (
          <EditableText
            value={value}
            onChange={(v) => editable.onEdit(field, v)}
            as={as}
          />
        )
      : value;
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
      const logoMaxH = template.logoSize ?? 40;
      return (
        <div key={block.id} className="mb-8 rounded-sm overflow-hidden" style={{ backgroundColor: hdrBg, minHeight: 80 }}>
          <div className="px-4 py-2 flex items-center min-h-20">
            {logoAlign === 'center' ? (
              <div className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
                <img
                  src={template.logoUrl || '/treemarkables-logo.webp'}
                  alt={co.name}
                  style={{ maxHeight: `${logoMaxH}px` }}
                  className="w-auto max-w-full h-auto object-contain flex-shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-base font-bold break-words" style={{ color: textPrimary }}>Invoice #{ctx.invoiceNumber}</h1>
                  {cfg.showCompanyName && <p className="text-xs mt-1 break-words" style={{ color: textSecondary }}>{co.name}</p>}
                </div>
              </div>
            ) : (
              <div className={`w-full flex items-center justify-between gap-3 ${logoAlign === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="flex-shrink min-w-0">
                  <img
                    src={template.logoUrl || '/treemarkables-logo.webp'}
                    alt={co.name}
                    style={{ maxHeight: `${logoMaxH}px` }}
                    className="w-auto max-w-full h-auto object-contain"
                  />
                </div>
                <div className={`flex-1 min-w-0 ${logoAlign === 'right' ? 'text-left' : 'text-right'}`}>
                  <h1 className="text-base font-bold break-words" style={{ color: textPrimary, wordBreak: 'break-word' }}>Invoice #{ctx.invoiceNumber}</h1>
                  {cfg.showCompanyName && <p className="text-xs mt-1 break-words" style={{ color: textSecondary, wordBreak: 'break-word' }}>{co.name}</p>}
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
          <h2 className="text-xs font-semibold text-black mb-2">{editText('label', cfg.label || 'Bill To')}</h2>
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
          <h2 className="text-xs font-semibold text-black mb-2">{editText('label', cfg.label || 'Description')}</h2>
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
                  <th className="border border-gray-200 px-2 py-2 text-left text-xs font-semibold text-gray-900" style={{ width: `${descPct}%` }}>{editText('labelDescription', cfg.labelDescription || 'Service')}</th>
                  {cfg.showQty && <th className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-900">{editText('labelQty', cfg.labelQty || 'Qty')}</th>}
                  {cfg.showRate && <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900">{editText('labelRate', cfg.labelRate || 'Rate')}</th>}
                  <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900">{editText('labelAmount', cfg.labelAmount || 'Price')}</th>
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
              {cfg.showSubtotal && <div className="flex justify-between text-xs"><span className="text-gray-600">{editText('labelSubtotal', cfg.labelSubtotal || 'Subtotal (excl GST)')}:</span><span className="text-black">{formatCurrency(ctx.subtotal)}</span></div>}
              {ctx.discountAmount !== undefined && ctx.discountAmount > 0 && <div className="flex justify-between text-xs"><span className="text-gray-600">Discount:</span><span className="text-black">-{formatCurrency(ctx.discountAmount)}</span></div>}
              {cfg.showGST && <div className="flex justify-between text-xs border-b border-gray-200 pb-1"><span className="text-gray-600">{editText('labelGST', cfg.labelGST || 'GST (15%)')}:</span><span className="text-black">{formatCurrency(ctx.gstAmount)}</span></div>}
              <div className="flex justify-between pt-2"><span className="text-sm font-bold text-black">{editText('labelTotal', cfg.labelTotal || 'Total Amount')}:</span><span className="text-sm font-bold text-black">{formatCurrency(ctx.totalAmount)}</span></div>
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
          {editText('text', cfg.text, 'div')}
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
    case 'proposalMeta': {
      const cfg = block.config as DocumentBlockConfigProposalMeta;
      return (
        <div key={block.id} className="mb-4 text-xs space-y-1">
          {cfg.showProposalNumber && ctx.proposalNumber && (
            <div className="flex justify-between gap-2">
              <span className="text-gray-600">{cfg.labelProposal || 'Proposal #'}</span>
              <span className="font-medium">{ctx.proposalNumber}</span>
            </div>
          )}
          {cfg.showIssueDate && (
            <div className="flex justify-between gap-2">
              <span className="text-gray-600">{cfg.labelIssueDate || 'Issue Date'}</span>
              <span>{format(ctx.issueDate, 'dd/MM/yyyy')}</span>
            </div>
          )}
          {cfg.showExpiryDate && ctx.expiryDate && (
            <div className="flex justify-between gap-2">
              <span className="text-gray-600">{cfg.labelExpiryDate || 'Valid Until'}</span>
              <span>{format(ctx.expiryDate, 'dd/MM/yyyy')}</span>
            </div>
          )}
          {cfg.showJobNumber && ctx.jobNumber ? (
            <div className="flex justify-between gap-2">
              <span className="text-gray-600">Job #</span>
              <span>{ctx.jobNumber}</span>
            </div>
          ) : null}
        </div>
      );
    }
    case 'lineItemsWithChoices': {
      const cfg = block.config as DocumentBlockConfigLineItemsWithChoices;
      const items = ctx.lineItemsWithChoices ?? [];
      if (items.length === 0) return null;
      const descPct = cfg.descColPct ?? 60;
      return (
        <div key={block.id} className="mb-4">
          <h2 className="text-xs font-semibold text-black mb-2">{cfg.labelDescription || 'Services & Pricing'}</h2>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-2 py-2 text-left text-xs font-semibold text-gray-900" style={{ width: `${descPct}%` }}>{editText('labelDescription', cfg.labelDescription || 'Service')}</th>
                  {cfg.showQty && <th className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-900">{editText('labelQty', cfg.labelQty || 'Qty')}</th>}
                  {cfg.showRate && <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900">{editText('labelRate', cfg.labelRate || 'Rate')}</th>}
                  <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-900">{editText('labelAmount', cfg.labelAmount || 'Price')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const qty = item.quantity ?? 1;
                  let rate = 0;
                  let total = 0;
                  if (item.pricingType === 'fixed' && item.fixedPrice !== undefined) {
                    rate = item.fixedPrice;
                    total = item.fixedPrice;
                  } else if (item.pricingType === 'choice' && item.choices && item.choices.length > 0) {
                    const chosen = item.choices.find(c => c.id === item.selectedChoiceId)
                      ?? item.choices.find(c => c.isDefault)
                      ?? item.choices[0];
                    rate = chosen.price;
                    total = chosen.price * qty;
                  } else {
                    rate = item.unitPrice ?? 0;
                    total = item.total ?? qty * rate;
                  }
                  const dimmed = item.isOptional && item.selected === false;
                  return (
                    <tr key={item.id} className={`even:bg-gray-50 ${dimmed ? 'opacity-50' : ''}`}>
                      <td className="border border-gray-200 px-2 py-2 text-xs text-gray-900">
                        <div className="flex items-start gap-2">
                          {cfg.showOptionalToggle && item.isOptional && (
                            <span className="inline-block mt-0.5 w-3 h-3 rounded border border-gray-400 flex-shrink-0" style={item.selected !== false ? { backgroundColor: '#2563eb', borderColor: '#2563eb' } : undefined} />
                          )}
                          <div className="flex-1">
                            <LinkifiedText text={item.description} />
                            {item.notes && <div className="text-[10px] text-gray-500 mt-0.5">{item.notes}</div>}
                            {cfg.showChoiceSelector && item.pricingType === 'choice' && item.choices && (
                              <div className="mt-1 space-y-0.5">
                                {item.choices.map(c => {
                                  const selectedId = item.selectedChoiceId ?? item.choices!.find(x => x.isDefault)?.id ?? item.choices![0].id;
                                  const isSel = selectedId === c.id;
                                  return (
                                    <div key={c.id} className={`flex items-center gap-1.5 text-[10px] ${isSel ? 'font-semibold text-black' : 'text-gray-600'}`}>
                                      <span className="inline-block w-2 h-2 rounded-full border border-gray-400 flex-shrink-0" style={isSel ? { backgroundColor: '#2563eb', borderColor: '#2563eb' } : undefined} />
                                      <span>{c.label}</span>
                                      <span className="ml-auto">{formatCurrency(c.price)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {cfg.showQty && <td className="border border-gray-200 px-2 py-2 text-xs text-center text-gray-900">{qty}</td>}
                      {cfg.showRate && <td className="border border-gray-200 px-2 py-2 text-xs text-right text-gray-900">{formatCurrency(rate)}</td>}
                      <td className="border border-gray-200 px-2 py-2 text-xs text-right font-medium text-gray-900">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    case 'photoGallery': {
      const cfg = block.config as DocumentBlockConfigPhotoGallery;
      const photos = ctx.photos ?? [];
      if (photos.length === 0) return null;
      const aspectClass = ({
        square: 'aspect-square',
        '4:3': 'aspect-[4/3]',
        '16:9': 'aspect-video',
        auto: '',
      } as const)[cfg.aspectRatio] ?? 'aspect-[4/3]';
      if (cfg.layout === 'single' || cfg.layout === 'slideshow') {
        const p = photos[0];
        return (
          <div key={block.id} className="mb-4">
            {cfg.label && <h2 className="text-xs font-semibold text-black mb-2">{editText('label', cfg.label)}</h2>}
            <div className={`w-full ${aspectClass} bg-gray-100 rounded overflow-hidden relative`}>
              <img src={p.url} alt={p.altText ?? p.caption ?? 'Photo'} className="w-full h-full object-cover" />
              {cfg.layout === 'slideshow' && photos.length > 1 && (
                <div className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 rounded">1 / {photos.length}</div>
              )}
            </div>
            {cfg.showCaptions && p.caption && <p className="text-xs text-gray-600 mt-1">{p.caption}</p>}
          </div>
        );
      }
      const cols = cfg.columns ?? 2;
      const gridClass = ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const)[cols];
      return (
        <div key={block.id} className="mb-4">
          {cfg.label && <h2 className="text-xs font-semibold text-black mb-2">{editText('label', cfg.label)}</h2>}
          <div className={`grid ${gridClass} gap-2`}>
            {photos.map(p => (
              <div key={p.id}>
                <div className={`w-full ${aspectClass} bg-gray-100 rounded overflow-hidden`}>
                  <img src={p.url} alt={p.altText ?? p.caption ?? 'Photo'} className="w-full h-full object-cover" />
                </div>
                {cfg.showCaptions && p.caption && <p className="text-[10px] text-gray-600 mt-1">{p.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'acceptance': {
      const cfg = block.config as DocumentBlockConfigAcceptance;
      const acc = ctx.acceptance;
      if (acc?.accepted) {
        return (
          <div key={block.id} className="mt-4 p-4 border-2 border-green-600 rounded-lg bg-green-50">
            {cfg.showAcceptedStamp && (
              <div className="flex items-center gap-2 mb-2">
                <div className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded tracking-wider">ACCEPTED</div>
                {acc.signedAt && <span className="text-xs text-gray-700">{format(acc.signedAt, 'dd MMM yyyy')}</span>}
              </div>
            )}
            {acc.signatureName && (
              <p className="text-xs text-gray-700">Signed by <span className="font-semibold">{acc.signatureName}</span></p>
            )}
          </div>
        );
      }
      // Suppress the in-document acceptance block when the consuming page
      // already renders a page-level Accept button (customer proposal viewer).
      if (ctx.hidePageAcceptance) return null;
      // Visual placeholder — interactive accept UX is layered on by ProposalAccept in a later PR.
      return (
        <div key={block.id} className="mt-4 p-4 border border-gray-300 rounded-lg">
          <h3 className="text-sm font-semibold text-black mb-2">{editText('label', cfg.label || 'Accept This Proposal')}</h3>
          {cfg.termsText && <p className="text-xs text-gray-600 mb-3 whitespace-pre-wrap">{editText('termsText', cfg.termsText, 'div')}</p>}
          <p className="text-xs text-gray-700 mb-3">{editText('signaturePromptText', cfg.signaturePromptText || 'By signing below you agree to the scope and pricing shown above.')}</p>
          {cfg.requireSignature && (
            <div className="mb-3 text-[10px] text-gray-500 italic">Signature field appears here</div>
          )}
          <div className="text-center py-2 bg-blue-600 text-white text-xs font-semibold rounded">
            {editText('buttonText', cfg.buttonText || 'Accept & Sign')}
          </div>
        </div>
      );
    }
    case 'googleReview': {
      const cfg = block.config as DocumentBlockConfigGoogleReview;
      return (
        <div key={block.id} className="mt-4">
          {cfg.showLabel && cfg.label && (
            <h2 className="text-xs font-semibold text-black mb-2 text-center">{editText('label', cfg.label)}</h2>
          )}
          <ProposalReviewsWidget />
        </div>
      );
    }
    default:
      return null;
  }
}

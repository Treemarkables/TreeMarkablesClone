/**
 * Renders a proposal via the shared DocumentBlockRenderer.
 *
 * Used by ProposalViewer and ProposalAccept when a proposal has a
 * blockConfig set. When it doesn't, callers fall back to the legacy
 * ProposalTemplate. PR 4 (migration) populates blockConfig for existing
 * proposals, which is when this path actually runs in production.
 */
import type { DocumentBlock, DocumentTemplate } from '@shared/schema';
import { resolveCompanyInfo } from '@shared/documentBlockDefaults';
import {
  renderDocumentBlock,
  type DocumentRenderContext,
} from '@/components/DocumentBlockRenderer';

interface ProposalLike {
  id: string;
  proposalNumber?: string;
  templateUsed?: string | null;
  status?: string;
  createdAt?: string | Date;
  expiryDate?: string | Date | null;
  validUntil?: string | Date | null;
  introduction?: string | null;
  conclusion?: string | null;
  subtotal?: string | number;
  gstAmount?: string | number;
  totalAmount?: string | number;
  discountAmount?: string | number;
  taxRate?: string | number;
  customerSignature?: string | null;
  signedDate?: string | Date | null;
  sections?: Array<{
    id: string;
    sectionType?: string;
    title?: string;
    content?: string | null;
    images?: string[] | null;
    lineItems?: Array<ProposalLineItemLike>;
  }>;
  lineItems?: Array<ProposalLineItemLike>;
}

interface ProposalLineItemLike {
  id: string;
  description: string;
  quantity?: string | number;
  unitPrice?: string | number;
  totalPrice?: string | number;
  unit?: string;
  notes?: string | null;
  isOptional?: boolean;
  pricingType?: 'normal' | 'choice' | 'fixed';
  fixedPrice?: string | number | null;
  selected?: boolean;
  selectedChoiceId?: string | null;
  priceIncludesTax?: boolean;
  choices?: Array<{
    id: string;
    label: string;
    description?: string | null;
    price: string | number;
    isDefault?: boolean;
  }>;
}

interface CustomerLike {
  name?: string;
  email?: string | null;
  address?: string | null;
}

interface JobLike {
  jobNumber?: number;
  address?: string | null;
}

const toNum = (v: string | number | null | undefined): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const toDate = (v: string | Date | null | undefined): Date | undefined => {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export function buildProposalRenderContext(
  proposal: ProposalLike,
  customer?: CustomerLike,
  job?: JobLike,
  overrides?: {
    selectedChoices?: Record<string, string>;
    selectedOptionalItems?: Record<string, boolean>;
    onOptionalToggle?: (lineItemId: string, selected: boolean) => void;
    onChoiceSelect?: (lineItemId: string, choiceId: string) => void;
  },
): DocumentRenderContext {
  const issueDate = toDate(proposal.createdAt) ?? new Date();
  const expiryDate = toDate(proposal.expiryDate ?? proposal.validUntil);
  let subtotal = toNum(proposal.subtotal);
  let gstAmount = toNum(proposal.gstAmount);
  let totalAmount = toNum(proposal.totalAmount);
  // Derive the dollar discount from the stored totals rather than the raw
  // discountAmount/discountType fields (whose units are inconsistent across
  // the codebase). subtotal is pre-discount ex-GST; (totalAmount - gstAmount)
  // is post-discount ex-GST, so the difference is the discount in dollars.
  let discountAmount = Math.round((subtotal - (totalAmount - gstAmount)) * 100) / 100;

  // Fallback: some proposals were saved before the totals were recomputed with
  // the discount applied, so the stored totals don't reflect it and the
  // derivation above comes out ~0 — the discount then silently vanished from
  // the customer-facing page even though the in-app preview (which reads the
  // discountAmount field directly) still showed it. When that happens, trust
  // the explicit discountAmount field (stored in dollars, matching the
  // server's save/accept/email handlers) and recompute the discounted GST and
  // total so the page stays internally consistent.
  const explicitDiscount = toNum(proposal.discountAmount);
  if (discountAmount < 0.005 && explicitDiscount > 0.005 && subtotal > explicitDiscount) {
    const rate = subtotal > 0 ? gstAmount / subtotal : 0;
    const afterDiscount = subtotal - explicitDiscount;
    gstAmount = Math.round(afterDiscount * rate * 100) / 100;
    totalAmount = Math.round((afterDiscount + gstAmount) * 100) / 100;
    discountAmount = explicitDiscount;
  }

  // Flatten line items from either proposal.lineItems or nested in sections,
  // carrying each section's id/type so optional and multiple-choice sections
  // stay recognisable after flattening.
  type FlatItem = ProposalLineItemLike & { sectionId?: string; sectionType?: string };
  const rawLineItems: FlatItem[] = proposal.lineItems
    ?? proposal.sections?.flatMap(s =>
      (s.lineItems ?? []).map(li => ({ ...li, sectionId: s.id, sectionType: s.sectionType })),
    )
    ?? [];

  // Once accepted, the customer's picks were persisted into each item's
  // `selected` flag and the stored totals reflect the accepted deal — render
  // those as-is instead of re-deriving defaults.
  const selectionsLocked = proposal.status === 'accepted' || proposal.status === 'accepted_pending_deposit';

  const lineItemsWithChoices = rawLineItems.map(li => {
    const sectionInteractive = li.sectionType === 'optional' || li.sectionType === 'multipleChoice';
    const toggleable = (li.isOptional ?? false) || sectionInteractive;
    // Toggleable items start UNSELECTED — they're excluded from the stored
    // totals and only count once the customer explicitly taps them on. This
    // matches the builder's totals and the legacy ProposalTemplate. (Their
    // stored `selected` flag defaults to true and can't be trusted here,
    // except after acceptance, when the server has stamped the real picks.)
    const defaultSelected = (selectionsLocked || !toggleable) && li.selected !== false;
    return {
      id: li.id,
      description: li.description,
      quantity: li.quantity !== undefined ? toNum(li.quantity) : 1,
      unit: li.unit,
      notes: li.notes ?? undefined,
      pricingType: (li.pricingType ?? 'normal') as 'normal' | 'choice' | 'fixed',
      unitPrice: li.unitPrice !== undefined ? toNum(li.unitPrice) : undefined,
      total: li.totalPrice !== undefined ? toNum(li.totalPrice) : undefined,
      fixedPrice: li.fixedPrice !== null && li.fixedPrice !== undefined
        ? toNum(li.fixedPrice) : undefined,
      choices: li.choices?.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description ?? undefined,
        price: toNum(c.price),
        isDefault: c.isDefault ?? false,
      })),
      selectedChoiceId: overrides?.selectedChoices?.[li.id] ?? li.selectedChoiceId ?? undefined,
      isOptional: li.isOptional ?? false,
      selected: overrides?.selectedOptionalItems?.[li.id] ?? defaultSelected,
      sectionId: li.sectionId,
      sectionType: li.sectionType,
      priceIncludesTax: li.priceIncludesTax ?? false,
    };
  });

  // Per-item ex-GST value under the current selections — shared by the live
  // totals recompute and the "Includes optional extras" info line.
  const gstRate = (toNum(proposal.taxRate) || 15) / 100;
  const itemExGst = (item: (typeof lineItemsWithChoices)[number]): number => {
    let itemPrice = 0;
    if (item.pricingType === 'choice' && item.choices && item.choices.length > 0) {
      const chosen = item.choices.find(c => c.id === item.selectedChoiceId)
        ?? item.choices.find(c => c.isDefault)
        ?? item.choices[0];
      itemPrice = chosen.price * (item.quantity ?? 1);
    } else if (item.pricingType === 'fixed' && item.fixedPrice !== undefined) {
      itemPrice = item.fixedPrice;
    } else {
      itemPrice = item.total ?? (item.unitPrice ?? 0) * (item.quantity ?? 1);
    }
    return item.priceIncludesTax ? itemPrice / (1 + gstRate) : itemPrice;
  };

  // Live totals: when the proposal has customer-selectable content (optional
  // items, optional/multipleChoice sections, or choice items) the stored
  // totals can't reflect the customer's current picks — recompute from the
  // effective selections, mirroring ProposalTemplate.calculateTotals and the
  // server's accept-time recompute. Static proposals keep their stored totals
  // untouched.
  const hasInteractive = lineItemsWithChoices.some(i =>
    i.isOptional
    || i.sectionType === 'optional'
    || i.sectionType === 'multipleChoice'
    || (i.pricingType === 'choice' && (i.choices?.length ?? 0) > 0),
  );
  if (hasInteractive && !selectionsLocked) {
    let subtotalExGst = 0;
    for (const item of lineItemsWithChoices) {
      if (item.selected === false) continue;
      subtotalExGst += itemExGst(item);
    }
    const liveDiscount = toNum(proposal.discountAmount);
    const afterDiscount = Math.max(0, subtotalExGst - liveDiscount);
    const liveGst = afterDiscount * gstRate;
    subtotal = Math.round(subtotalExGst * 100) / 100;
    gstAmount = Math.round(liveGst * 100) / 100;
    totalAmount = Math.round((afterDiscount + liveGst) * 100) / 100;
    discountAmount = liveDiscount;
  }

  // Ex-GST value of the selected optional extras — surfaces in the totals
  // block so a tap visibly changes the price.
  const optionsSelectedExGst = Math.round(lineItemsWithChoices.reduce((sum, item) => {
    const toggleable = item.isOptional || item.sectionType === 'optional' || item.sectionType === 'multipleChoice';
    if (!toggleable || item.selected === false) return sum;
    return sum + itemExGst(item);
  }, 0) * 100) / 100;

  // Ordered content flow mirroring the builder's sections (description, line
  // items, description, …). The renderer uses this to interleave text and
  // tables in authored order instead of merging all text into one Overview
  // and all items into one table.
  const itemsBySection = new Map<string, typeof lineItemsWithChoices>();
  for (const it of lineItemsWithChoices) {
    if (!it.sectionId) continue;
    const arr = itemsBySection.get(it.sectionId) ?? [];
    arr.push(it);
    itemsBySection.set(it.sectionId, arr);
  }
  const sectionFlow = !proposal.lineItems && proposal.sections
    ? proposal.sections
      .map(s => ({
        id: s.id,
        title: s.title,
        content: s.content ?? undefined,
        items: itemsBySection.get(s.id) ?? [],
      }))
      .filter(s => (s.content && s.content.trim().length > 0) || s.items.length > 0)
    : undefined;

  // Pull photos from section images
  const photos = (proposal.sections ?? [])
    .filter(s => s.sectionType === 'photos' || (s.images && s.images.length > 0))
    .flatMap(s => (s.images ?? []).map((url, i) => ({
      id: `${s.id}-${i}`,
      url,
      caption: s.title,
    })));

  return {
    docLabel: proposal.templateUsed === 'quote' ? 'Quote' : 'Proposal',
    invoiceNumber: proposal.proposalNumber ?? '',
    proposalNumber: proposal.proposalNumber,
    issueDate,
    dueDate: expiryDate ?? issueDate, // proposals don't have a due date per se
    expiryDate,
    billingName: customer?.name ?? 'Customer',
    customerAddress: customer?.address ?? undefined,
    customerEmail: customer?.email ?? undefined,
    jobAddress: job?.address ?? undefined,
    // Prefer the explicit introduction field. Section text renders in authored
    // order via sectionFlow, so it must NOT also be joined into the description
    // block (that's what stacked every description on top of the tables). The
    // joined fallback only survives for section-less legacy data.
    description: (() => {
      if (proposal.introduction && proposal.introduction.trim().length > 0) {
        return proposal.introduction;
      }
      if (sectionFlow && sectionFlow.length > 0) return undefined;
      const fromSections = (proposal.sections ?? [])
        .filter(s =>
          s.sectionType !== 'photos'
          && (!s.images || s.images.length === 0)
          && (!s.lineItems || s.lineItems.length === 0)
          && !!s.content
          && s.content.trim().length > 0,
        )
        .map(s => s.content!.trim())
        .join('\n\n');
      return fromSections.length > 0 ? fromSections : undefined;
    })(),
    lineItems: [], // legacy field — proposals use lineItemsWithChoices
    hasLineItems: false,
    subtotal,
    gstAmount,
    totalAmount,
    discountAmount: discountAmount > 0.005 ? discountAmount : undefined,
    jobNumber: job?.jobNumber,
    lineItemsWithChoices,
    sectionFlow,
    photos: photos.length > 0 ? photos : undefined,
    acceptance: {
      accepted: proposal.status === 'accepted',
      signedAt: toDate(proposal.signedDate),
      signatureName: proposal.customerSignature ?? undefined,
    },
    // Customer-facing proposal pages render their own page-level Accept
    // button at the top — suppress the duplicate in-document acceptance block.
    hidePageAcceptance: true,
    optionsSelectedExGst: optionsSelectedExGst > 0 ? optionsSelectedExGst : undefined,
    onOptionalToggle: selectionsLocked ? undefined : overrides?.onOptionalToggle,
    onChoiceSelect: selectionsLocked ? undefined : overrides?.onChoiceSelect,
  };
}

interface BlockRenderedProposalProps {
  proposal: ProposalLike;
  customer?: CustomerLike;
  job?: JobLike;
  template: DocumentTemplate;
  blocks: DocumentBlock[];
  selectedChoices?: Record<string, string>;
  selectedOptionalItems?: Record<string, boolean>;
  // Pass these to make optional / multiple-choice items tappable — the
  // customer-facing pages own the selection state and feed it back through
  // selectedChoices / selectedOptionalItems.
  onOptionalToggle?: (lineItemId: string, selected: boolean) => void;
  onChoiceSelect?: (lineItemId: string, choiceId: string) => void;
  className?: string;
}

export function BlockRenderedProposal({
  proposal,
  customer,
  job,
  template,
  blocks,
  selectedChoices,
  selectedOptionalItems,
  onOptionalToggle,
  onChoiceSelect,
  className = '',
}: BlockRenderedProposalProps) {
  const ctx = buildProposalRenderContext(proposal, customer, job, {
    selectedChoices,
    selectedOptionalItems,
    onOptionalToggle,
    onChoiceSelect,
  });
  const co = resolveCompanyInfo(template as unknown as Record<string, unknown>);
  const ordered = [...blocks].sort((a, b) => a.order - b.order).filter(b => b.visible);

  return (
    <div className={`w-full max-w-full sm:max-w-4xl mx-auto bg-white px-4 py-6 sm:px-8 sm:py-8 ${className}`}>
      {ordered.map(block => renderDocumentBlock(block, template, ctx, co))}
    </div>
  );
}

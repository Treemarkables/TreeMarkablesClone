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
  status?: string;
  createdAt?: string | Date;
  expiryDate?: string | Date | null;
  validUntil?: string | Date | null;
  introduction?: string | null;
  conclusion?: string | null;
  subtotal?: string | number;
  gstAmount?: string | number;
  totalAmount?: string | number;
  customerSignature?: string | null;
  signedDate?: string | Date | null;
  sections?: Array<{
    id: string;
    sectionType?: string;
    title?: string;
    content?: string;
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
  },
): DocumentRenderContext {
  const issueDate = toDate(proposal.createdAt) ?? new Date();
  const expiryDate = toDate(proposal.expiryDate ?? proposal.validUntil);
  const subtotal = toNum(proposal.subtotal);
  const gstAmount = toNum(proposal.gstAmount);
  const totalAmount = toNum(proposal.totalAmount);

  // Flatten line items from either proposal.lineItems or nested in sections
  const rawLineItems: ProposalLineItemLike[] = proposal.lineItems
    ?? proposal.sections?.flatMap(s => s.lineItems ?? [])
    ?? [];

  const lineItemsWithChoices = rawLineItems.map(li => ({
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
    selected: overrides?.selectedOptionalItems?.[li.id] ?? li.selected ?? true,
  }));

  // Pull photos from section images
  const photos = (proposal.sections ?? [])
    .filter(s => s.sectionType === 'photos' || (s.images && s.images.length > 0))
    .flatMap(s => (s.images ?? []).map((url, i) => ({
      id: `${s.id}-${i}`,
      url,
      caption: s.title,
    })));

  return {
    invoiceNumber: proposal.proposalNumber ?? '',
    proposalNumber: proposal.proposalNumber,
    issueDate,
    dueDate: expiryDate ?? issueDate, // proposals don't have a due date per se
    expiryDate,
    billingName: customer?.name ?? 'Customer',
    customerAddress: customer?.address ?? undefined,
    customerEmail: customer?.email ?? undefined,
    jobAddress: job?.address ?? undefined,
    description: proposal.introduction ?? undefined,
    lineItems: [], // legacy field — proposals use lineItemsWithChoices
    hasLineItems: false,
    subtotal,
    gstAmount,
    totalAmount,
    jobNumber: job?.jobNumber,
    lineItemsWithChoices,
    photos: photos.length > 0 ? photos : undefined,
    acceptance: {
      accepted: proposal.status === 'accepted',
      signedAt: toDate(proposal.signedDate),
      signatureName: proposal.customerSignature ?? undefined,
    },
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
  className = '',
}: BlockRenderedProposalProps) {
  const ctx = buildProposalRenderContext(proposal, customer, job, {
    selectedChoices,
    selectedOptionalItems,
  });
  const co = resolveCompanyInfo(template as unknown as Record<string, unknown>);
  const ordered = [...blocks].sort((a, b) => a.order - b.order).filter(b => b.visible);

  return (
    <div className={`w-full max-w-full sm:max-w-4xl mx-auto bg-white px-4 py-6 sm:px-8 sm:py-8 ${className}`}>
      {ordered.map(block => renderDocumentBlock(block, template, ctx, co))}
    </div>
  );
}

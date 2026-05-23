/**
 * Reusable block-builder surface — palette + canvas + inspector + DnD.
 *
 * Extracted from DocumentBuilderPage so the same UI can be embedded inside
 * the per-job proposal modal in a later step. The host owns the blocks state
 * + persistence + topbar; this component is a controlled view that emits
 * onBlocksChange whenever the user adds / removes / reorders / edits a block.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  GripVertical,
  X,
  Plus,
  Eye,
  EyeOff,
  AlignCenter,
  Type,
  Table,
  FileText,
  Building2,
  User,
  Hash,
  DollarSign,
  CreditCard,
  Minus,
  StickyNote,
  Image,
  LayoutTemplate,
  Search,
} from 'lucide-react';
import type {
  DocumentTemplate,
  DocumentBlock,
  DocumentBlockType,
} from '@shared/schema';
import { resolveCompanyInfo } from '@shared/documentBlockDefaults';
import { renderDocumentBlock, buildSampleContext } from '@/components/DocumentBlockRenderer';

export type DocumentKind = 'invoice' | 'proposal';

const INVOICE_ONLY_BLOCKS: DocumentBlockType[] = ['invoiceMeta', 'payment'];
const PROPOSAL_ONLY_BLOCKS: DocumentBlockType[] = ['proposalMeta', 'lineItemsWithChoices', 'photoGallery', 'acceptance', 'googleReview'];

type PaletteCategory = 'header' | 'content' | 'close';
const PALETTE_CATEGORY: Record<DocumentBlockType, PaletteCategory> = {
  header: 'header',
  companyInfo: 'header',
  billTo: 'header',
  invoiceMeta: 'header',
  proposalMeta: 'header',
  jobDescription: 'content',
  lineItems: 'content',
  lineItemsWithChoices: 'content',
  photoGallery: 'content',
  customText: 'content',
  divider: 'content',
  totals: 'close',
  payment: 'close',
  acceptance: 'close',
  googleReview: 'close',
  footer: 'close',
};
const CATEGORY_LABELS: Record<PaletteCategory, string> = {
  header: 'Header & info',
  content: 'Content',
  close: 'Totals & close',
};
const CATEGORY_ORDER: PaletteCategory[] = ['header', 'content', 'close'];

export function paletteForKind(kind: DocumentKind, all: PaletteItem[]): PaletteItem[] {
  if (kind === 'invoice') {
    return all.filter(p => !PROPOSAL_ONLY_BLOCKS.includes(p.type));
  }
  // Proposals use lineItemsWithChoices instead of plain lineItems.
  return all.filter(p => !INVOICE_ONLY_BLOCKS.includes(p.type) && p.type !== 'lineItems');
}

export interface PaletteItem {
  type: DocumentBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultConfig: DocumentBlock['config'];
}

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'header',
    label: 'Header',
    description: 'Logo + invoice title',
    icon: Image,
    defaultConfig: { logoAlignment: 'left', headerColor: '#ffffff', showCompanyName: true },
  },
  {
    type: 'companyInfo',
    label: 'Company Info',
    description: 'Your business details',
    icon: Building2,
    defaultConfig: { showName: true, showAddress: true, showPhone: true, showEmail: true, showGST: true },
  },
  {
    type: 'billTo',
    label: 'Bill To',
    description: 'Customer billing info',
    icon: User,
    defaultConfig: { label: 'Bill To', showEmail: true, showAddress: true },
  },
  {
    type: 'invoiceMeta',
    label: 'Invoice Details',
    description: 'Number, dates, job reference',
    icon: Hash,
    defaultConfig: { showInvoiceNumber: true, showIssueDate: true, showDueDate: true, showJobNumber: true, labelInvoice: 'Invoice #', labelIssueDate: 'Issue Date', labelDueDate: 'Due Date' },
  },
  {
    type: 'jobDescription',
    label: 'Job Description',
    description: 'Work description and notes',
    icon: FileText,
    defaultConfig: { label: 'Description' },
  },
  {
    type: 'lineItems',
    label: 'Line Items',
    description: 'Services & pricing table',
    icon: Table,
    defaultConfig: { labelDescription: 'Service', labelQty: 'Qty', labelRate: 'Rate', labelAmount: 'Price', showQty: true, showRate: true },
  },
  {
    type: 'totals',
    label: 'Totals',
    description: 'Subtotal, GST, total',
    icon: DollarSign,
    defaultConfig: { showSubtotal: true, showGST: true, labelSubtotal: 'Subtotal (excl GST)', labelGST: 'GST (15%)', labelTotal: 'Total Amount' },
  },
  {
    type: 'payment',
    label: 'Payment Details',
    description: 'Bank account and due date',
    icon: CreditCard,
    defaultConfig: { label: 'Payment Information', showBank: true, showAccountNumber: true, showAccountName: true, showDueDate: true, showTerms: true },
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'Horizontal rule separator',
    icon: Minus,
    defaultConfig: { color: '#e5e7eb', thickness: 1 },
  },
  {
    type: 'customText',
    label: 'Custom Text',
    description: 'Any custom text or note',
    icon: StickyNote,
    defaultConfig: { text: 'Add your custom text here...', fontSize: 'sm', align: 'left' },
  },
  {
    type: 'footer',
    label: 'Footer',
    description: 'Company footer with GST',
    icon: AlignCenter,
    defaultConfig: { showCompanyName: true, showAddress: true, showPhone: true, showEmail: true, showGST: true, showPaymentTerms: true },
  },
  {
    type: 'proposalMeta',
    label: 'Proposal Details',
    description: 'Number, dates, expiry',
    icon: Hash,
    defaultConfig: { showProposalNumber: true, showIssueDate: true, showExpiryDate: true, showJobNumber: true, labelProposal: 'Proposal #', labelIssueDate: 'Issue Date', labelExpiryDate: 'Valid Until' },
  },
  {
    type: 'lineItemsWithChoices',
    label: 'Line Items (with choices)',
    description: 'Pricing with options and optional items',
    icon: Table,
    defaultConfig: { labelDescription: 'Service', labelQty: 'Qty', labelRate: 'Rate', labelAmount: 'Price', showQty: true, showRate: true, showOptionalToggle: true, showChoiceSelector: true, descColPct: 60 },
  },
  {
    type: 'photoGallery',
    label: 'Photo Gallery',
    description: 'Site photos in grid or single layout',
    icon: Image,
    defaultConfig: { label: 'Site Photos', layout: 'grid', columns: 2, showCaptions: true, aspectRatio: '4:3' },
  },
  {
    type: 'acceptance',
    label: 'Accept & Sign',
    description: 'Customer acceptance + signature',
    icon: FileText,
    defaultConfig: { label: 'Accept This Proposal', buttonText: 'Accept & Sign', requireSignature: true, signaturePromptText: 'By signing below you agree to the above scope and pricing.', showAcceptedStamp: true },
  },
  {
    type: 'googleReview',
    label: 'Customer Reviews',
    description: 'Featured Google reviews carousel',
    icon: StickyNote,
    defaultConfig: { label: 'What our customers say', showLabel: true },
  },
];

export const BLOCK_LABELS: Record<DocumentBlockType, string> = {
  header: 'Header',
  companyInfo: 'Company Info',
  billTo: 'Bill To',
  invoiceMeta: 'Invoice Details',
  jobDescription: 'Job Description',
  lineItems: 'Line Items',
  totals: 'Totals',
  payment: 'Payment Details',
  divider: 'Divider',
  customText: 'Custom Text',
  footer: 'Footer',
  proposalMeta: 'Proposal Details',
  lineItemsWithChoices: 'Line Items (with choices)',
  photoGallery: 'Photo Gallery',
  acceptance: 'Accept & Sign',
  googleReview: 'Customer Reviews',
};

export const BLOCK_ICONS: Record<DocumentBlockType, React.ElementType> = {
  header: Image,
  companyInfo: Building2,
  billTo: User,
  invoiceMeta: Hash,
  jobDescription: FileText,
  lineItems: Table,
  totals: DollarSign,
  payment: CreditCard,
  divider: Minus,
  customText: StickyNote,
  footer: AlignCenter,
  proposalMeta: Hash,
  lineItemsWithChoices: Table,
  photoGallery: Image,
  acceptance: FileText,
  googleReview: StickyNote,
};

// ─── Inspector Panel ───────────────────────────────────────────────────────────

function InspectorPanel({
  block,
  onUpdate,
}: {
  block: DocumentBlock;
  template: DocumentTemplate;
  onUpdate: (id: string, config: DocumentBlock['config']) => void;
}) {
  const cfg = block.config as Record<string, unknown>;

  const set = useCallback(
    (key: string, value: unknown) => {
      onUpdate(block.id, { ...cfg, [key]: value } as DocumentBlock['config']);
    },
    [block.id, cfg, onUpdate],
  );

  const Toggle = ({ label, field }: { label: string; field: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-sm">{label}</Label>
      <Switch checked={!!cfg[field]} onCheckedChange={(v) => set(field, v)} />
    </div>
  );

  const TextInput = ({ label, field, placeholder }: { label: string; field: string; placeholder?: string }) => (
    <div className="space-y-1 py-1">
      <Label className="text-sm">{label}</Label>
      <Input value={String(cfg[field] ?? '')} placeholder={placeholder} onChange={(e) => set(field, e.target.value)} />
    </div>
  );

  switch (block.type) {
    case 'header':
      return (
        <div className="space-y-3">
          <div className="space-y-1 py-1">
            <Label className="text-sm">Logo Alignment</Label>
            <Select value={String(cfg.logoAlignment ?? 'left')} onValueChange={(v) => set('logoAlignment', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 py-1">
            <Label className="text-sm">Header Background Colour</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={String(cfg.headerColor ?? '#ffffff')} onChange={(e) => set('headerColor', e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
              <Input value={String(cfg.headerColor ?? '#ffffff')} onChange={(e) => set('headerColor', e.target.value)} className="flex-1" />
            </div>
          </div>
          <Toggle label="Show company name" field="showCompanyName" />
        </div>
      );

    case 'companyInfo':
      return (
        <div className="space-y-1">
          <Toggle label="Company name" field="showName" />
          <Toggle label="Address" field="showAddress" />
          <Toggle label="Phone" field="showPhone" />
          <Toggle label="Email" field="showEmail" />
          <Toggle label="GST number" field="showGST" />
        </div>
      );

    case 'billTo':
      return (
        <div className="space-y-2">
          <TextInput label="Section label" field="label" placeholder="Bill To" />
          <Toggle label="Show email" field="showEmail" />
          <Toggle label="Show address" field="showAddress" />
        </div>
      );

    case 'invoiceMeta':
      return (
        <div className="space-y-2">
          <Toggle label="Invoice number" field="showInvoiceNumber" />
          <TextInput label="Invoice label" field="labelInvoice" placeholder="Invoice #" />
          <Separator />
          <Toggle label="Issue date" field="showIssueDate" />
          <TextInput label="Issue date label" field="labelIssueDate" placeholder="Issue Date" />
          <Separator />
          <Toggle label="Due date" field="showDueDate" />
          <TextInput label="Due date label" field="labelDueDate" placeholder="Due Date" />
          <Separator />
          <Toggle label="Job number" field="showJobNumber" />
        </div>
      );

    case 'jobDescription':
      return (
        <div className="space-y-2">
          <TextInput label="Section label" field="label" placeholder="Description" />
        </div>
      );

    case 'lineItems':
      return (
        <div className="space-y-2">
          <TextInput label="Description column" field="labelDescription" placeholder="Service" />
          <Toggle label="Show Qty column" field="showQty" />
          <TextInput label="Qty column label" field="labelQty" placeholder="Qty" />
          <Toggle label="Show Rate column" field="showRate" />
          <TextInput label="Rate column label" field="labelRate" placeholder="Rate" />
          <TextInput label="Amount column" field="labelAmount" placeholder="Price" />
          <Separator />
          <div className="space-y-1 py-1">
            <Label className="text-sm">Description column width (%)</Label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min={35}
                max={80}
                value={Number(cfg.descColPct ?? 60)}
                onChange={(e) => set('descColPct', Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm w-8 text-right">{Number(cfg.descColPct ?? 60)}</span>
            </div>
          </div>
        </div>
      );

    case 'totals':
      return (
        <div className="space-y-2">
          <Toggle label="Show subtotal" field="showSubtotal" />
          <TextInput label="Subtotal label" field="labelSubtotal" placeholder="Subtotal (excl GST)" />
          <Separator />
          <Toggle label="Show GST" field="showGST" />
          <TextInput label="GST label" field="labelGST" placeholder="GST (15%)" />
          <Separator />
          <TextInput label="Total label" field="labelTotal" placeholder="Total Amount" />
        </div>
      );

    case 'payment':
      return (
        <div className="space-y-2">
          <TextInput label="Section label" field="label" placeholder="Payment Information" />
          <Toggle label="Show due date" field="showDueDate" />
          <Toggle label="Show bank name" field="showBank" />
          <Toggle label="Show account number" field="showAccountNumber" />
          <Toggle label="Show account name" field="showAccountName" />
          <Toggle label="Show payment terms" field="showTerms" />
        </div>
      );

    case 'divider':
      return (
        <div className="space-y-2">
          <div className="space-y-1 py-1">
            <Label className="text-sm">Line Colour</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={String(cfg.color ?? '#e5e7eb')} onChange={(e) => set('color', e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
              <Input value={String(cfg.color ?? '#e5e7eb')} onChange={(e) => set('color', e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="space-y-1 py-1">
            <Label className="text-sm">Thickness (px)</Label>
            <Input type="number" min={1} max={8} value={String(cfg.thickness ?? 1)} onChange={(e) => set('thickness', parseInt(e.target.value) || 1)} />
          </div>
        </div>
      );

    case 'customText':
      return (
        <div className="space-y-2">
          <div className="space-y-1 py-1">
            <Label className="text-sm">Text content</Label>
            <Textarea value={String(cfg.text ?? '')} onChange={(e) => set('text', e.target.value)} rows={4} />
          </div>
          <div className="space-y-1 py-1">
            <Label className="text-sm">Font size</Label>
            <Select value={String(cfg.fontSize ?? 'sm')} onValueChange={(v) => set('fontSize', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xs">Small</SelectItem>
                <SelectItem value="sm">Medium</SelectItem>
                <SelectItem value="base">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 py-1">
            <Label className="text-sm">Alignment</Label>
            <Select value={String(cfg.align ?? 'left')} onValueChange={(v) => set('align', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'footer':
      return (
        <div className="space-y-1">
          <Toggle label="Company name" field="showCompanyName" />
          <Toggle label="Address" field="showAddress" />
          <Toggle label="Phone" field="showPhone" />
          <Toggle label="Email" field="showEmail" />
          <Toggle label="GST number" field="showGST" />
          <Toggle label="Payment terms" field="showPaymentTerms" />
        </div>
      );

    case 'proposalMeta':
      return (
        <div className="space-y-2">
          <Toggle label="Proposal number" field="showProposalNumber" />
          <TextInput label="Proposal label" field="labelProposal" placeholder="Proposal #" />
          <Separator />
          <Toggle label="Issue date" field="showIssueDate" />
          <TextInput label="Issue date label" field="labelIssueDate" placeholder="Issue Date" />
          <Separator />
          <Toggle label="Expiry date" field="showExpiryDate" />
          <TextInput label="Expiry date label" field="labelExpiryDate" placeholder="Valid Until" />
          <Separator />
          <Toggle label="Job number" field="showJobNumber" />
        </div>
      );

    case 'lineItemsWithChoices':
      return (
        <div className="space-y-2">
          <TextInput label="Description column" field="labelDescription" placeholder="Service" />
          <Toggle label="Show Qty column" field="showQty" />
          <TextInput label="Qty column label" field="labelQty" placeholder="Qty" />
          <Toggle label="Show Rate column" field="showRate" />
          <TextInput label="Rate column label" field="labelRate" placeholder="Rate" />
          <TextInput label="Amount column" field="labelAmount" placeholder="Price" />
          <Separator />
          <Toggle label="Optional-item toggles" field="showOptionalToggle" />
          <Toggle label="Choice selector" field="showChoiceSelector" />
          <Separator />
          <div className="space-y-1 py-1">
            <Label className="text-sm">Description column width (%)</Label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min={35}
                max={80}
                value={Number(cfg.descColPct ?? 60)}
                onChange={(e) => set('descColPct', Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm w-8 text-right">{Number(cfg.descColPct ?? 60)}</span>
            </div>
          </div>
        </div>
      );

    case 'photoGallery':
      return (
        <div className="space-y-2">
          <TextInput label="Section label" field="label" placeholder="Site Photos" />
          <div className="space-y-1 py-1">
            <Label className="text-sm">Layout</Label>
            <Select value={String(cfg.layout ?? 'grid')} onValueChange={(v) => set('layout', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="single">Single photo</SelectItem>
                <SelectItem value="slideshow">Slideshow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 py-1">
            <Label className="text-sm">Columns (grid only)</Label>
            <Select value={String(cfg.columns ?? 2)} onValueChange={(v) => set('columns', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 py-1">
            <Label className="text-sm">Aspect ratio</Label>
            <Select value={String(cfg.aspectRatio ?? '4:3')} onValueChange={(v) => set('aspectRatio', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="4:3">4 : 3</SelectItem>
                <SelectItem value="16:9">16 : 9</SelectItem>
                <SelectItem value="auto">Natural</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Toggle label="Show captions" field="showCaptions" />
        </div>
      );

    case 'acceptance':
      return (
        <div className="space-y-2">
          <TextInput label="Section label" field="label" placeholder="Accept This Proposal" />
          <TextInput label="Button text" field="buttonText" placeholder="Accept & Sign" />
          <div className="space-y-1 py-1">
            <Label className="text-sm">Signature prompt</Label>
            <Textarea value={String(cfg.signaturePromptText ?? '')} onChange={(e) => set('signaturePromptText', e.target.value)} rows={2} />
          </div>
          <div className="space-y-1 py-1">
            <Label className="text-sm">Terms (optional)</Label>
            <Textarea value={String(cfg.termsText ?? '')} onChange={(e) => set('termsText', e.target.value)} rows={3} placeholder="Any terms shown above the accept button" />
          </div>
          <Toggle label="Require signature field" field="requireSignature" />
          <Toggle label="Show ACCEPTED stamp once accepted" field="showAcceptedStamp" />
        </div>
      );

    case 'googleReview':
      return (
        <div className="space-y-2">
          <TextInput label="Section heading" field="label" placeholder="What our customers say" />
          <Toggle label="Show heading" field="showLabel" />
          <p className="text-xs text-gray-500 italic pt-1">
            Reviews are pulled from your featured reviews. The block hides automatically when none are featured.
          </p>
        </div>
      );

    default:
      return <div className="text-sm text-gray-500 italic">No settings for this block.</div>;
  }
}

// ─── Inline "+ Add block" between canvas blocks ──────────────────────────────

function InlineAddZone({
  palette,
  onPick,
  variant = 'inline',
}: {
  palette: PaletteItem[];
  onPick: (item: PaletteItem) => void;
  variant?: 'inline' | 'empty';
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = palette.filter(
    (p) =>
      !q ||
      p.label.toLowerCase().includes(q.toLowerCase()) ||
      p.description.toLowerCase().includes(q.toLowerCase()),
  );
  const wrapperClass =
    variant === 'empty'
      ? 'flex items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-lg'
      : 'relative group/zone h-4 -my-1 flex items-center justify-center';
  const triggerClass =
    variant === 'empty'
      ? 'inline-flex items-center gap-2 px-4 py-2 rounded-md border border-orange-300 bg-orange-50 text-sm font-semibold text-orange-700 hover:bg-orange-100 hover:border-orange-400'
      : 'relative z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-gray-300 bg-white text-[11px] text-gray-500 opacity-0 group-hover/zone:opacity-100 hover:border-orange-400 hover:text-orange-600 transition-opacity';
  return (
    <div className={wrapperClass}>
      {variant === 'inline' && (
        <div className="absolute inset-x-6 h-px bg-gray-200 opacity-0 group-hover/zone:opacity-100 transition-opacity" />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={triggerClass}
            data-testid={variant === 'empty' ? 'empty-add-block' : 'inline-add-block'}
          >
            <Plus className={variant === 'empty' ? 'w-4 h-4' : 'w-3 h-3'} />
            {variant === 'empty' ? 'Add your first block' : 'Add block'}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="bottom"
          className="w-64 p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-1.5 py-1 mb-1 border border-gray-200 rounded">
            <Search className="w-3 h-3 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search blocks…"
              className="flex-1 text-xs outline-none bg-transparent"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-xs text-gray-400 italic px-2 py-3 text-center">No blocks match.</div>
            ) : (
              filtered.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => { onPick(p); setOpen(false); setQ(''); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-gray-100"
                  >
                    <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3 h-3 text-orange-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-gray-800 leading-tight">{p.label}</div>
                      <div className="text-[11px] text-gray-500 leading-tight truncate">{p.description}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Sortable Canvas Block (WYSIWYG) ──────────────────────────────────────────

const SAMPLE_CTX = buildSampleContext();

function SortableCanvasBlock({
  block,
  template,
  selected,
  previewMode = false,
  onSelect,
  onRemove,
  onToggleVisible,
  onUpdateConfig,
}: {
  block: DocumentBlock;
  template: DocumentTemplate;
  selected: boolean;
  previewMode?: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onUpdateConfig?: (id: string, config: DocumentBlock['config']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const co = resolveCompanyInfo(template as unknown as Record<string, unknown>);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const editable = !previewMode && onUpdateConfig
    ? {
        onEdit: (field: string, value: string) => {
          const current = block.config as unknown as Record<string, unknown>;
          const next = { ...current, [field]: value } as unknown as DocumentBlock['config'];
          onUpdateConfig(block.id, next);
        },
      }
    : undefined;

  const rendered = renderDocumentBlock(block, template, SAMPLE_CTX, co, editable);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={previewMode ? undefined : () => onSelect(block.id)}
      className={`group relative rounded-sm transition-all
        ${previewMode ? '' : 'cursor-pointer'}
        ${selected && !previewMode ? 'ring-2 ring-orange-400' : !previewMode ? 'hover:ring-1 hover:ring-orange-300' : ''}
        ${!block.visible ? 'opacity-40' : ''}
      `}
      data-testid={`canvas-block-${block.type}`}
    >
      {/* Hover toolbar — always above the block, persists on selection, hidden in customer view */}
      {!previewMode && (
      <div
        className={`absolute -top-8 left-1 flex items-center gap-0.5 bg-slate-900 text-slate-200 rounded-md shadow-md px-1.5 py-1 z-20 transition-opacity
          ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-white px-0.5"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-semibold text-slate-300 px-1.5 select-none uppercase tracking-wide">{BLOCK_LABELS[block.type]}</span>
        <button
          type="button"
          onClick={() => onToggleVisible(block.id)}
          title={block.visible ? 'Hide block' : 'Show block'}
          data-testid={`btn-toggle-${block.id}`}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          title="Remove block"
          data-testid={`btn-remove-${block.id}`}
          className="w-6 h-6 rounded flex items-center justify-center text-red-300 hover:bg-slate-800 hover:text-red-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      )}

      {/* True invoice content from shared renderer */}
      <div className="pointer-events-none">
        {rendered ?? (
          <div className="text-xs text-gray-300 italic py-2 text-center border border-dashed border-gray-200 rounded">
            {BLOCK_LABELS[block.type]}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Canvas Drop Zone ──────────────────────────────────────────────────────────

function CanvasDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop-zone' });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-20 rounded-lg transition-colors ${isOver ? 'ring-2 ring-orange-300 bg-orange-50' : ''}`}
    >
      {children}
    </div>
  );
}

// ─── Palette Item ──────────────────────────────────────────────────────────────

function PaletteCard({
  item,
  onAdd,
}: {
  item: PaletteItem;
  onAdd: (item: PaletteItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { type: 'palette', paletteItem: item },
  });

  const Icon = item.icon;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`w-full rounded-md border border-gray-200 bg-white p-2.5 cursor-grab active:cursor-grabbing transition-colors hover-elevate ${isDragging ? 'opacity-40 ring-2 ring-orange-400' : ''}`}
      data-testid={`palette-${item.type}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-orange-600" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-800 leading-tight">{item.label}</div>
          <div className="text-xs text-gray-500 leading-tight truncate">{item.description}</div>
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAdd(item); }}
          className="ml-auto flex-shrink-0 p-0.5"
          title={`Add ${item.label}`}
          data-testid={`palette-add-${item.type}`}
        >
          <Plus className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Main exported surface ─────────────────────────────────────────────────────

export interface BlockBuilderSurfaceProps {
  blocks: DocumentBlock[];
  onBlocksChange: (next: DocumentBlock[]) => void;
  template: DocumentTemplate;
  documentKind: DocumentKind;
  previewMode?: boolean;
  deviceWidth?: 'desktop' | 'mobile';
}

export function BlockBuilderSurface({
  blocks,
  onBlocksChange,
  template,
  documentKind,
  previewMode = false,
  deviceWidth = 'desktop',
}: BlockBuilderSurfaceProps) {
  const kindPalette = paletteForKind(documentKind, PALETTE_ITEMS);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [paletteQuery, setPaletteQuery] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Custom collision detection: palette items use pointer-within (cross-zone),
  // canvas blocks use closestCenter (sortable reorder).
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    if (args.active.data.current?.type === 'palette') {
      const pw = pointerWithin(args);
      return pw.length > 0 ? pw : closestCenter(args);
    }
    return closestCenter(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    // ── Palette → Canvas drop ─────────────────────────────────────────────────
    if (active.data.current?.type === 'palette') {
      const item = active.data.current?.paletteItem as PaletteItem;
      if (!item) return;

      // Only create a block when dropped on the canvas drop zone or over a canvas block.
      const isCanvasTarget =
        over !== null &&
        (String(over.id) === 'canvas-drop-zone' ||
          blocks.some((b) => b.id === String(over.id)));
      if (!isCanvasTarget) return;

      const newBlockId = `${item.type}-${crypto.randomUUID().slice(0, 8)}`;
      const newBlock: DocumentBlock = {
        id: newBlockId,
        type: item.type,
        order: 0,
        visible: true,
        config: item.defaultConfig as DocumentBlock['config'],
      };

      const overIdx = over ? blocks.findIndex((b) => b.id === String(over.id)) : -1;
      const insertIdx = overIdx >= 0 ? overIdx + 1 : blocks.length;
      const updated = [...blocks.slice(0, insertIdx), newBlock, ...blocks.slice(insertIdx)];
      onBlocksChange(updated.map((b, i) => ({ ...b, order: i })));
      setSelectedId(newBlockId);
      return;
    }

    // ── Canvas → Canvas reorder ───────────────────────────────────────────────
    if (over && active.id !== over.id) {
      const oldIdx = blocks.findIndex((b) => b.id === active.id);
      const newIdx = blocks.findIndex((b) => b.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      onBlocksChange(arrayMove(blocks, oldIdx, newIdx).map((b, i) => ({ ...b, order: i })));
    }
  }, [blocks, onBlocksChange]);

  const addBlock = useCallback((item: PaletteItem) => {
    const newBlock: DocumentBlock = {
      id: `${item.type}-${crypto.randomUUID().slice(0, 8)}`,
      type: item.type,
      order: blocks.length,
      visible: true,
      config: item.defaultConfig as DocumentBlock['config'],
    };
    onBlocksChange([...blocks, newBlock]);
    setSelectedId(newBlock.id);
  }, [blocks, onBlocksChange]);

  const addBlockAt = useCallback((index: number, item: PaletteItem) => {
    const newBlock: DocumentBlock = {
      id: `${item.type}-${crypto.randomUUID().slice(0, 8)}`,
      type: item.type,
      order: 0,
      visible: true,
      config: item.defaultConfig as DocumentBlock['config'],
    };
    const safeIdx = Math.max(0, Math.min(index, blocks.length));
    const updated = [...blocks.slice(0, safeIdx), newBlock, ...blocks.slice(safeIdx)];
    onBlocksChange(updated.map((b, i) => ({ ...b, order: i })));
    setSelectedId(newBlock.id);
  }, [blocks, onBlocksChange]);

  const removeBlock = useCallback((id: string) => {
    onBlocksChange(blocks.filter((b) => b.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, [blocks, onBlocksChange]);

  const toggleVisible = useCallback((id: string) => {
    onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)));
  }, [blocks, onBlocksChange]);

  const updateBlockConfig = useCallback((id: string, config: DocumentBlock['config']) => {
    onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, config } : b)));
  }, [blocks, onBlocksChange]);

  const selectedBlock = selectedId ? blocks.find((b) => b.id === selectedId) ?? null : null;

  // Default-select the first block so the inspector is populated on first open.
  useEffect(() => {
    if (!selectedId && blocks.length > 0) {
      setSelectedId(blocks[0].id);
    }
  }, [selectedId, blocks]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Left: Block Palette (hidden in customer-view preview) */}
        {!previewMode && (
          <div className="w-52 flex-shrink-0 border-r bg-gray-50 overflow-y-auto p-3 space-y-1.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Block Palette</div>
            <div className="flex items-center gap-2 px-2 py-1.5 mb-2 bg-white border border-gray-200 rounded">
              <Search className="w-3 h-3 text-gray-400" />
              <input
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Search blocks…"
                className="flex-1 text-xs outline-none bg-transparent"
                data-testid="palette-search"
              />
            </div>
            {(() => {
              const q = paletteQuery.trim().toLowerCase();
              const filtered = q
                ? kindPalette.filter(
                    (i) =>
                      i.label.toLowerCase().includes(q) ||
                      i.description.toLowerCase().includes(q),
                  )
                : kindPalette;
              if (filtered.length === 0) {
                return <p className="text-xs text-gray-400 italic px-1 py-3">No blocks match.</p>;
              }
              return CATEGORY_ORDER.map((cat) => {
                const items = filtered.filter((i) => PALETTE_CATEGORY[i.type] === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 mb-1.5 mt-2">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    {items.map((item) => (
                      <PaletteCard key={item.type} item={item} onAdd={addBlock} />
                    ))}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Center: canvas — true WYSIWYG surface */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <div
            className="mx-auto transition-[max-width] duration-200"
            style={{ maxWidth: deviceWidth === 'mobile' ? '390px' : '42rem' }}
          >
            <p className="text-xs text-center mb-3 select-none" style={{ color: previewMode ? '#1e40af' : '#9ca3af' }}>
              {previewMode
                ? 'Customer view — this is how the proposal will look to the customer.'
                : 'Live preview — hover a block to drag or configure it'}
            </p>

            <div className="bg-white rounded-sm shadow border border-gray-200 px-8 py-8 relative">
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <CanvasDropZone>
                  {blocks.map((block, idx) => (
                    <div key={block.id}>
                      {!previewMode && (
                        <InlineAddZone
                          palette={kindPalette}
                          onPick={(p) => addBlockAt(idx, p)}
                        />
                      )}
                      <SortableCanvasBlock
                        block={block}
                        template={template}
                        selected={selectedId === block.id}
                        previewMode={previewMode}
                        onSelect={setSelectedId}
                        onRemove={removeBlock}
                        onToggleVisible={toggleVisible}
                        onUpdateConfig={updateBlockConfig}
                      />
                    </div>
                  ))}
                  {!previewMode && blocks.length > 0 && (
                    <InlineAddZone
                      palette={kindPalette}
                      onPick={(p) => addBlockAt(blocks.length, p)}
                    />
                  )}
                </CanvasDropZone>
              </SortableContext>

              {blocks.length === 0 && !previewMode && (
                <InlineAddZone
                  palette={kindPalette}
                  variant="empty"
                  onPick={(p) => addBlockAt(0, p)}
                />
              )}
              {blocks.length === 0 && previewMode && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
                  <LayoutTemplate className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No blocks in this proposal</p>
                </div>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeDragId ? (
              activeDragId.startsWith('palette-') ? (
                (() => {
                  const paletteType = activeDragId.replace('palette-', '') as DocumentBlockType;
                  const Icon = BLOCK_ICONS[paletteType] ?? BLOCK_ICONS['header'];
                  return (
                    <div className="bg-white border-2 border-orange-400 rounded-md px-3 py-2 shadow-lg opacity-90 flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-xs font-semibold text-orange-600">{BLOCK_LABELS[paletteType]}</span>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-white border-2 border-orange-400 rounded-md p-3 shadow-lg opacity-90">
                  <div className="text-xs font-semibold text-orange-600">
                    {BLOCK_LABELS[blocks.find((b) => b.id === activeDragId)?.type ?? 'header']}
                  </div>
                </div>
              )
            ) : null}
          </DragOverlay>
        </div>

        {/* Right: Inspector (hidden in customer-view preview) */}
        {!previewMode && (
        <div className="w-64 flex-shrink-0 border-l bg-white overflow-y-auto">
          {selectedBlock ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                {(() => { const Icon = BLOCK_ICONS[selectedBlock.type]; return <Icon className="w-4 h-4 text-orange-500" />; })()}
                <h3 className="font-semibold text-sm text-gray-900">{BLOCK_LABELS[selectedBlock.type]}</h3>
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => setSelectedId(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Separator className="mb-4" />
              <InspectorPanel
                block={selectedBlock}
                template={template}
                onUpdate={updateBlockConfig}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <Type className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Select a block to configure it</p>
              <p className="text-xs text-gray-400 mt-1">Click any block on the canvas</p>
            </div>
          )}
        </div>
        )}
      </div>
    </DndContext>
  );
}

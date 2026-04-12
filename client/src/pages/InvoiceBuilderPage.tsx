import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import {
  GripVertical,
  X,
  Plus,
  Eye,
  EyeOff,
  ChevronLeft,
  Save,
  LayoutTemplate,
  AlignLeft,
  AlignCenter,
  AlignRight,
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
} from 'lucide-react';
import type {
  DocumentTemplate,
  InvoiceBlock,
  InvoiceBlockType,
  InvoiceBlockConfigHeader,
  InvoiceBlockConfigCompanyInfo,
  InvoiceBlockConfigBillTo,
  InvoiceBlockConfigInvoiceMeta,
  InvoiceBlockConfigJobDescription,
  InvoiceBlockConfigLineItems,
  InvoiceBlockConfigTotals,
  InvoiceBlockConfigPayment,
  InvoiceBlockConfigDivider,
  InvoiceBlockConfigCustomText,
  InvoiceBlockConfigFooter,
} from '@shared/schema';
import { DEFAULT_INVOICE_BLOCKS } from '@shared/schema';

// ─── Block metadata ────────────────────────────────────────────────────────────

interface PaletteItem {
  type: InvoiceBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultConfig: InvoiceBlock['config'];
}

const PALETTE_ITEMS: PaletteItem[] = [
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
];

const BLOCK_LABELS: Record<InvoiceBlockType, string> = {
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
};

const BLOCK_ICONS: Record<InvoiceBlockType, React.ElementType> = {
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
};

// ─── Canvas Block Preview ──────────────────────────────────────────────────────

function BlockPreview({ block, template }: { block: InvoiceBlock; template: DocumentTemplate }) {
  switch (block.type) {
    case 'header': {
      const cfg = block.config as InvoiceBlockConfigHeader;
      const bg = cfg.headerColor || '#ffffff';
      const isLight = (() => {
        const hex = bg.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 128;
      })();
      const textCol = isLight ? '#111' : '#fff';
      return (
        <div className="rounded overflow-hidden" style={{ backgroundColor: bg, minHeight: 64 }}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ flexDirection: cfg.logoAlignment === 'right' ? 'row-reverse' : 'row', justifyContent: cfg.logoAlignment === 'center' ? 'center' : 'space-between' }}>
            <img src="/logos/treemarkables-logo.png" alt="Logo" style={{ height: 36 }} className="object-contain" />
            <div className={cfg.logoAlignment === 'center' ? 'text-center' : cfg.logoAlignment === 'right' ? 'text-left' : 'text-right'}>
              <div className="font-bold text-sm" style={{ color: textCol }}>Invoice #INV-0001</div>
              {cfg.showCompanyName && <div className="text-xs mt-0.5" style={{ color: isLight ? '#555' : '#ccc' }}>{template.companyName}</div>}
            </div>
          </div>
        </div>
      );
    }
    case 'companyInfo': {
      const cfg = block.config as InvoiceBlockConfigCompanyInfo;
      return (
        <div className="text-xs space-y-0.5 text-gray-700">
          {cfg.showName && <div className="font-semibold text-gray-900">{template.companyName || 'Treemarkables LTD'}</div>}
          {cfg.showAddress && <div>{template.companyAddress || '213 Stanley Road, Gisborne'}</div>}
          {cfg.showPhone && <div>Ph: {template.companyPhone || '027 216 6882'}</div>}
          {cfg.showEmail && <div>{template.companyEmail || 'quotes@treemarkables.nz'}</div>}
          {cfg.showGST && <div>GST: {template.gstNumber || '131-047-592'}</div>}
        </div>
      );
    }
    case 'billTo': {
      const cfg = block.config as InvoiceBlockConfigBillTo;
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-gray-800 text-xs mb-1">{cfg.label || 'Bill To'}</div>
          <div className="font-semibold text-gray-900">Sample Customer</div>
          {cfg.showAddress && <div className="text-gray-600">123 Sample Street, City</div>}
          {cfg.showEmail && <div className="text-gray-600">customer@example.com</div>}
        </div>
      );
    }
    case 'invoiceMeta': {
      const cfg = block.config as InvoiceBlockConfigInvoiceMeta;
      return (
        <div className="text-xs space-y-1">
          {cfg.showInvoiceNumber && <div className="flex justify-between"><span className="text-gray-600">{cfg.labelInvoice || 'Invoice #'}</span><span className="font-medium">INV-0001</span></div>}
          {cfg.showIssueDate && <div className="flex justify-between"><span className="text-gray-600">{cfg.labelIssueDate || 'Issue Date'}</span><span>01/01/2026</span></div>}
          {cfg.showDueDate && <div className="flex justify-between"><span className="text-gray-600">{cfg.labelDueDate || 'Due Date'}</span><span>08/01/2026</span></div>}
          {cfg.showJobNumber && <div className="flex justify-between"><span className="text-gray-600">Job #</span><span>1234</span></div>}
        </div>
      );
    }
    case 'jobDescription': {
      const cfg = block.config as InvoiceBlockConfigJobDescription;
      return (
        <div className="text-xs">
          <div className="font-semibold text-gray-800 mb-1">{cfg.label || 'Description'}</div>
          <div className="text-gray-600 italic">Job description and notes will appear here...</div>
        </div>
      );
    }
    case 'lineItems': {
      const cfg = block.config as InvoiceBlockConfigLineItems;
      return (
        <div className="text-xs overflow-hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-2 py-1 font-semibold border border-gray-200">{cfg.labelDescription || 'Service'}</th>
                {cfg.showQty && <th className="px-2 py-1 font-semibold border border-gray-200 text-center w-12">{cfg.labelQty || 'Qty'}</th>}
                {cfg.showRate && <th className="px-2 py-1 font-semibold border border-gray-200 text-right w-16">{cfg.labelRate || 'Rate'}</th>}
                <th className="px-2 py-1 font-semibold border border-gray-200 text-right w-16">{cfg.labelAmount || 'Price'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1 border border-gray-200 text-gray-700">Tree removal service</td>
                {cfg.showQty && <td className="px-2 py-1 border border-gray-200 text-center text-gray-700">1</td>}
                {cfg.showRate && <td className="px-2 py-1 border border-gray-200 text-right text-gray-700">$500.00</td>}
                <td className="px-2 py-1 border border-gray-200 text-right text-gray-700">$500.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    case 'totals': {
      const cfg = block.config as InvoiceBlockConfigTotals;
      return (
        <div className="text-xs space-y-1 flex flex-col items-end">
          <div className="w-48 space-y-1">
            {cfg.showSubtotal && <div className="flex justify-between"><span className="text-gray-600">{cfg.labelSubtotal || 'Subtotal'}:</span><span>$500.00</span></div>}
            {cfg.showGST && <div className="flex justify-between"><span className="text-gray-600">{cfg.labelGST || 'GST (15%)'}:</span><span>$75.00</span></div>}
            <div className="flex justify-between font-bold border-t border-gray-200 pt-1"><span>{cfg.labelTotal || 'Total Amount'}:</span><span>$575.00</span></div>
          </div>
        </div>
      );
    }
    case 'payment': {
      const cfg = block.config as InvoiceBlockConfigPayment;
      return (
        <div className="text-xs bg-gray-50 border border-gray-200 rounded p-2 space-y-0.5">
          <div className="font-semibold text-gray-800 mb-1">{cfg.label || 'Payment Information'}</div>
          {cfg.showDueDate && <div><span className="font-medium">Due:</span> 08/01/2026</div>}
          {cfg.showBank && <div><span className="font-medium">Bank:</span> ANZ</div>}
          {cfg.showAccountNumber && <div><span className="font-medium">Account:</span> 06-0637-0768850-00</div>}
          {cfg.showAccountName && <div><span className="font-medium">Name:</span> {template.companyName || 'Treemarkables LTD'}</div>}
          {cfg.showTerms && template.paymentTerms && <div><span className="font-medium">Terms:</span> {template.paymentTerms}</div>}
        </div>
      );
    }
    case 'divider': {
      const cfg = block.config as InvoiceBlockConfigDivider;
      return <hr style={{ borderColor: cfg.color || '#e5e7eb', borderTopWidth: cfg.thickness || 1 }} />;
    }
    case 'customText': {
      const cfg = block.config as InvoiceBlockConfigCustomText;
      const sizeMap = { xs: 'text-xs', sm: 'text-sm', base: 'text-base' };
      const alignMap = { left: 'text-left', center: 'text-center', right: 'text-right' };
      return <div className={`${sizeMap[cfg.fontSize] || 'text-sm'} ${alignMap[cfg.align] || 'text-left'} text-gray-700 whitespace-pre-wrap`}>{cfg.text || '...'}</div>;
    }
    case 'footer': {
      const cfg = block.config as InvoiceBlockConfigFooter;
      const parts: string[] = [];
      if (cfg.showCompanyName) parts.push(template.companyName || 'Treemarkables LTD');
      if (cfg.showAddress) parts.push(template.companyAddress?.replace(/\n/g, ', ') || '213 Stanley Road, Gisborne');
      if (cfg.showPhone) parts.push(`Ph: ${template.companyPhone || '027 216 6882'}`);
      if (cfg.showEmail) parts.push(template.companyEmail || 'quotes@treemarkables.nz');
      return (
        <div className="text-center text-xs text-gray-500 border-t border-gray-200 pt-2 space-y-0.5">
          <div>{parts.join(' | ')}</div>
          {cfg.showGST && <div>GST Number: {template.gstNumber || '131-047-592'}</div>}
          {cfg.showPaymentTerms && template.paymentTerms && <div>{template.paymentTerms}</div>}
        </div>
      );
    }
    default:
      return <div className="text-xs text-gray-400 italic">Unknown block type</div>;
  }
}

// ─── Inspector Panel ───────────────────────────────────────────────────────────

function InspectorPanel({
  block,
  template,
  onUpdate,
}: {
  block: InvoiceBlock;
  template: DocumentTemplate;
  onUpdate: (id: string, config: InvoiceBlock['config']) => void;
}) {
  const cfg = block.config as Record<string, unknown>;

  const set = useCallback(
    (key: string, value: unknown) => {
      onUpdate(block.id, { ...cfg, [key]: value } as InvoiceBlock['config']);
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

    default:
      return <div className="text-sm text-gray-500 italic">No settings for this block.</div>;
  }
}

// ─── Sortable Canvas Card ──────────────────────────────────────────────────────

function SortableCanvasBlock({
  block,
  template,
  selected,
  onSelect,
  onRemove,
  onToggleVisible,
}: {
  block: InvoiceBlock;
  template: DocumentTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleVisible: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const Icon = BLOCK_ICONS[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(block.id)}
      className={`group relative rounded-md border-2 p-3 cursor-pointer transition-colors ${
        selected
          ? 'border-orange-400 bg-orange-50'
          : 'border-gray-200 bg-white hover:border-orange-200'
      } ${block.visible ? '' : 'opacity-50'}`}
      data-testid={`canvas-block-${block.type}`}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-700">{BLOCK_LABELS[block.type]}</span>
            {selected && <Badge className="text-xs ml-1 no-default-active-elevate">Selected</Badge>}
          </div>
          <div className="pointer-events-none">
            <BlockPreview block={block} template={template} />
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onToggleVisible(block.id)}
            title={block.visible ? 'Hide block' : 'Show block'}
            data-testid={`btn-toggle-${block.id}`}
          >
            {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onRemove(block.id)}
            title="Remove block"
            data-testid={`btn-remove-${block.id}`}
          >
            <X className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      </div>
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
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className="w-full text-left rounded-md border border-gray-200 bg-white p-2.5 hover-elevate active-elevate-2 transition-colors"
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
        <Plus className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-auto" />
      </div>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function InvoiceBuilderPage() {
  const { toast } = useToast();

  const { data: templatesRes, isLoading } = useQuery<{ success: boolean; data: DocumentTemplate[] }>({
    queryKey: ['/api/templates'],
    refetchOnWindowFocus: false,
  });

  const invoiceTemplate = templatesRes?.data?.find((t) => t.type === 'invoice') ?? null;

  const [blocks, setBlocks] = useState<InvoiceBlock[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const effectiveBlocks: InvoiceBlock[] = blocks
    ?? (invoiceTemplate?.blockConfig as InvoiceBlock[] | null)
    ?? DEFAULT_INVOICE_BLOCKS;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const cur = prev ?? effectiveBlocks;
        const oldIdx = cur.findIndex((b) => b.id === active.id);
        const newIdx = cur.findIndex((b) => b.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return cur;
        return arrayMove(cur, oldIdx, newIdx);
      });
    }
  }, [effectiveBlocks]);

  const addBlock = useCallback((item: PaletteItem) => {
    const newBlock: InvoiceBlock = {
      id: `${item.type}-${crypto.randomUUID().slice(0, 8)}`,
      type: item.type,
      visible: true,
      config: item.defaultConfig as InvoiceBlock['config'],
    };
    setBlocks((prev) => [...(prev ?? effectiveBlocks), newBlock]);
    setSelectedId(newBlock.id);
  }, [effectiveBlocks]);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => (prev ?? effectiveBlocks).filter((b) => b.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, [effectiveBlocks]);

  const toggleVisible = useCallback((id: string) => {
    setBlocks((prev) =>
      (prev ?? effectiveBlocks).map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
    );
  }, [effectiveBlocks]);

  const updateBlockConfig = useCallback((id: string, config: InvoiceBlock['config']) => {
    setBlocks((prev) =>
      (prev ?? effectiveBlocks).map((b) => (b.id === id ? { ...b, config } : b)),
    );
  }, [effectiveBlocks]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceTemplate) throw new Error('No invoice template found');
      return apiRequest('PUT', `/api/templates/${invoiceTemplate.id}`, { blockConfig: effectiveBlocks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({ title: 'Invoice layout saved', variant: 'default' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    },
  });

  const resetToDefault = useCallback(() => {
    setBlocks(DEFAULT_INVOICE_BLOCKS);
    setSelectedId(null);
  }, []);

  const selectedBlock = selectedId ? effectiveBlocks.find((b) => b.id === selectedId) ?? null : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading template...</div>
      </div>
    );
  }

  if (!invoiceTemplate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-gray-500">No invoice template found. Please create one first.</div>
        <Link href="/templates">
          <Button variant="outline">Go to Templates</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-shrink-0">
        <Link href="/settings">
          <Button size="icon" variant="ghost">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-orange-500" />
          <div>
            <h1 className="font-semibold text-gray-900 leading-tight">Invoice Block Builder</h1>
            <p className="text-xs text-gray-500 leading-tight">Drag blocks to reorder · Click to configure</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            Reset to Default
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="btn-save-layout"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Block Palette */}
        <div className="w-52 flex-shrink-0 border-r bg-gray-50 overflow-y-auto p-3 space-y-1.5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Block Palette</div>
          {PALETTE_ITEMS.map((item) => (
            <PaletteCard key={item.type} item={item} onAdd={addBlock} />
          ))}
        </div>

        {/* Center: Invoice Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 mb-2">
              <div className="text-xs text-gray-400 text-center py-1">Invoice Canvas — {effectiveBlocks.filter(b => b.visible).length} visible blocks</div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={effectiveBlocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {effectiveBlocks.map((block) => (
                    <SortableCanvasBlock
                      key={block.id}
                      block={block}
                      template={invoiceTemplate}
                      selected={selectedId === block.id}
                      onSelect={setSelectedId}
                      onRemove={removeBlock}
                      onToggleVisible={toggleVisible}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeDragId ? (
                  <div className="bg-white border-2 border-orange-400 rounded-md p-3 shadow-lg opacity-90">
                    <div className="text-xs font-semibold text-orange-600">
                      {BLOCK_LABELS[effectiveBlocks.find((b) => b.id === activeDragId)?.type ?? 'header']}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {effectiveBlocks.length === 0 && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <LayoutTemplate className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No blocks added yet</p>
                <p className="text-xs text-gray-400 mt-1">Click a block in the palette to add it</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Inspector */}
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
                template={invoiceTemplate}
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
      </div>
    </div>
  );
}

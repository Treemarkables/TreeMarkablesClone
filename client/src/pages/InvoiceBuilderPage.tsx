import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
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
} from 'lucide-react';
import type {
  DocumentTemplate,
  DocumentBlock,
  DocumentBlockType,
} from '@shared/schema';
import { DEFAULT_INVOICE_BLOCKS } from '@shared/schema';
import { resolveCompanyInfo } from '@shared/documentBlockDefaults';
import { renderDocumentBlock, buildSampleContext } from '@/components/DocumentBlockRenderer';

// ─── Block metadata ────────────────────────────────────────────────────────────

interface PaletteItem {
  type: DocumentBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultConfig: DocumentBlock['config'];
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

const BLOCK_LABELS: Record<DocumentBlockType, string> = {
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

const BLOCK_ICONS: Record<DocumentBlockType, React.ElementType> = {
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

// ─── Inspector Panel ───────────────────────────────────────────────────────────

function InspectorPanel({
  block,
  template,
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

    default:
      return <div className="text-sm text-gray-500 italic">No settings for this block.</div>;
  }
}

// ─── Sortable Canvas Block (WYSIWYG) ──────────────────────────────────────────
// Uses the shared renderDocumentBlock() from DocumentBlockRenderer.tsx so the
// canvas matches the final invoice output exactly (no separate BlockPreview).

const SAMPLE_CTX = buildSampleContext();

function SortableCanvasBlock({
  block,
  template,
  selected,
  onSelect,
  onRemove,
  onToggleVisible,
}: {
  block: DocumentBlock;
  template: DocumentTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleVisible: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const co = resolveCompanyInfo(template as unknown as Record<string, unknown>);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const rendered = renderDocumentBlock(block, template, SAMPLE_CTX, co);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(block.id)}
      className={`group relative cursor-pointer rounded-sm transition-all
        ${selected ? 'ring-2 ring-orange-400' : 'hover:ring-1 hover:ring-orange-300'}
        ${!block.visible ? 'opacity-40' : ''}
      `}
      data-testid={`canvas-block-${block.type}`}
    >
      {/* Hover toolbar — stays in DOM (visibility toggle, not display) for layout stability */}
      <div
        className="absolute -top-8 left-0 flex items-center gap-1 bg-white border border-gray-200 rounded shadow-sm px-2 py-0.5 z-10 invisible group-hover:visible group-focus-within:visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs text-gray-500 px-1 select-none">{BLOCK_LABELS[block.type]}</span>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function InvoiceBuilderPage() {
  const { toast } = useToast();

  const { data: templatesRes, isLoading } = useQuery<{ success: boolean; data: DocumentTemplate[] }>({
    queryKey: ['/api/templates'],
    refetchOnWindowFocus: false,
  });

  const invoiceTemplate = templatesRes?.data?.find((t) => t.type === 'invoice') ?? null;

  const [blocks, setBlocks] = useState<DocumentBlock[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const effectiveBlocks: DocumentBlock[] = blocks
    ?? (invoiceTemplate?.blockConfig as DocumentBlock[] | null)
    ?? DEFAULT_INVOICE_BLOCKS;

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
      // Drops outside the canvas (over === null, or over.id is another palette item) are no-ops.
      const isCanvasTarget =
        over !== null &&
        (String(over.id) === 'canvas-drop-zone' ||
          effectiveBlocks.some((b) => b.id === String(over.id)));
      if (!isCanvasTarget) return;

      const newBlockId = `${item.type}-${crypto.randomUUID().slice(0, 8)}`;
      const newBlock: DocumentBlock = {
        id: newBlockId,
        type: item.type,
        order: 0,
        visible: true,
        config: item.defaultConfig as DocumentBlock['config'],
      };

      setBlocks((prev) => {
        const base = prev ?? effectiveBlocks;
        // Insert after the block that was hovered, or at the end
        const overIdx = over ? base.findIndex((b) => b.id === String(over.id)) : -1;
        const insertIdx = overIdx >= 0 ? overIdx + 1 : base.length;
        const updated = [...base.slice(0, insertIdx), newBlock, ...base.slice(insertIdx)];
        return updated.map((b, i) => ({ ...b, order: i }));
      });

      setSelectedId(newBlockId);
      return;
    }

    // ── Canvas → Canvas reorder ───────────────────────────────────────────────
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const cur = prev ?? effectiveBlocks;
        const oldIdx = cur.findIndex((b) => b.id === active.id);
        const newIdx = cur.findIndex((b) => b.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return cur;
        return arrayMove(cur, oldIdx, newIdx).map((b, i) => ({ ...b, order: i }));
      });
    }
  }, [effectiveBlocks]);

  const addBlock = useCallback((item: PaletteItem) => {
    const cur = blocks ?? effectiveBlocks;
    const newBlock: DocumentBlock = {
      id: `${item.type}-${crypto.randomUUID().slice(0, 8)}`,
      type: item.type,
      order: cur.length,
      visible: true,
      config: item.defaultConfig as DocumentBlock['config'],
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

  const updateBlockConfig = useCallback((id: string, config: DocumentBlock['config']) => {
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

      {/* Three-column layout — DndContext wraps palette + canvas for cross-zone drops */}
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Block Palette */}
        <div className="w-52 flex-shrink-0 border-r bg-gray-50 overflow-y-auto p-3 space-y-1.5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Block Palette</div>
          <p className="text-xs text-gray-400 px-1 mb-1">Drag onto canvas or click +</p>
          {PALETTE_ITEMS.map((item) => (
            <PaletteCard key={item.type} item={item} onAdd={addBlock} />
          ))}
        </div>

        {/* Center: Invoice canvas — true WYSIWYG invoice surface */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs text-gray-400 text-center mb-3 select-none">
              Live preview — hover a block to drag or configure it
            </p>

            {/* White paper invoice surface */}
            <div className="bg-white rounded-sm shadow border border-gray-200 px-8 py-8 relative">
              <SortableContext
                items={effectiveBlocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <CanvasDropZone>
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
                </CanvasDropZone>
              </SortableContext>

              {effectiveBlocks.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
                  <LayoutTemplate className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No blocks added yet</p>
                  <p className="text-xs text-gray-400 mt-1">Drag a block from the palette or click +</p>
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
                    {BLOCK_LABELS[effectiveBlocks.find((b) => b.id === activeDragId)?.type ?? 'header']}
                  </div>
                </div>
              )
            ) : null}
          </DragOverlay>
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
      </DndContext>
    </div>
  );
}

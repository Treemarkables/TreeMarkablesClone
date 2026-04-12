import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  X, Plus, Upload, Trash2, Mail, MessageSquare, Check, Crown,
  GripVertical, Mic, AlignLeft, Image as ImageIcon, List, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LineItem, LineItemChoice, UploadedPhoto } from "@/types/proposal";

const LOGO_URL = "/treemarkables-logo.webp";

type BlockType = "description" | "photos" | "lineItems";

interface WysiwygBlock {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  photos: UploadedPhoto[];
  lineItems: LineItem[];
  sortOrder: number;
}

interface DraftLineItem {
  description: string;
  itemCode: string;
  quantity: number;
  unitPrice: number;
  pricingType: "normal" | "fixed" | "choice";
  fixedPrice: number;
  isOptional: boolean;
  priceIncludesTax: boolean;
  choices: LineItemChoice[];
}

const defaultDraft = (): DraftLineItem => ({
  description: "",
  itemCode: "",
  quantity: 1,
  unitPrice: 0,
  pricingType: "normal",
  fixedPrice: 0,
  isOptional: false,
  priceIncludesTax: false,
  choices: [],
});

interface ProposalBuilderV2Props {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
  customerId?: string;
  mode?: "create" | "edit";
  proposalId?: string;
  onRequestJobSave?: () => Promise<string>;
  jobDescription?: string;
  customEmail?: string;
  lineItems?: unknown;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtNZD(amount: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
}

function inferBlockType(section: { description: string; photos: UploadedPhoto[]; lineItems: LineItem[] }): BlockType {
  if ((section.lineItems || []).length > 0) return "lineItems";
  if ((section.photos || []).length > 0) return "photos";
  return "description";
}

function calcLineItemPrice(item: Partial<DraftLineItem>): number {
  if (item.pricingType === "fixed") return item.fixedPrice ?? 0;
  return (item.quantity ?? 0) * (item.unitPrice ?? 0);
}

function calcBlockSubtotal(block: WysiwygBlock): number {
  return (block.lineItems || [])
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + i.totalPrice, 0);
}

function calcTotals(blocks: WysiwygBlock[]) {
  let subtotalExGst = 0;
  let gstAmount = 0;
  blocks.forEach((b) =>
    (b.lineItems || []).filter((i) => i.selected).forEach((item) => {
      if (item.priceIncludesTax) {
        const ex = item.totalPrice / 1.15;
        subtotalExGst += ex;
        gstAmount += item.totalPrice - ex;
      } else {
        subtotalExGst += item.totalPrice;
        gstAmount += item.totalPrice * 0.15;
      }
    })
  );
  return { subtotal: subtotalExGst, gst: gstAmount, total: subtotalExGst + gstAmount };
}

// ─── Add-Block Button ─────────────────────────────────────────────────────────

function AddBlockButton({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-center my-1 group/add">
      <div className="flex-1 h-px bg-gray-200 opacity-0 group-hover/add:opacity-100 transition-opacity" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-300 text-gray-400 text-xs hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover/add:opacity-100 mx-2"
          >
            <Plus className="w-3 h-3" /> Add block
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="center">
          <button
            type="button"
            onClick={() => { onAdd("description"); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
          >
            <AlignLeft className="w-4 h-4 text-blue-500" /> Description
          </button>
          <button
            type="button"
            onClick={() => { onAdd("photos"); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
          >
            <ImageIcon className="w-4 h-4 text-green-500" /> Photos
          </button>
          <button
            type="button"
            onClick={() => { onAdd("lineItems"); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
          >
            <List className="w-4 h-4 text-orange-500" /> Line Items
          </button>
        </PopoverContent>
      </Popover>
      <div className="flex-1 h-px bg-gray-200 opacity-0 group-hover/add:opacity-100 transition-opacity" />
    </div>
  );
}

// ─── Section Title (inline editable) ─────────────────────────────────────────

function InlineTitle({
  value,
  onChange,
  placeholder = "Section Title",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
        placeholder={placeholder}
        className={`border-b border-blue-400 outline-none bg-transparent font-semibold text-gray-700 w-full ${className}`}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={`font-semibold text-gray-700 cursor-text select-none ${!value ? "text-gray-400 italic" : ""} ${className}`}
    >
      {value || placeholder}
    </span>
  );
}

// ─── Block Header Row ─────────────────────────────────────────────────────────

const BADGE_LABELS: Record<BlockType, string> = {
  description: "Description",
  photos: "Photos",
  lineItems: "Line Items",
};

function BlockHeader({
  block,
  onTitleChange,
  onRemove,
}: {
  block: WysiwygBlock;
  onTitleChange: (t: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80 rounded-t-md">
      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <InlineTitle value={block.title} onChange={onTitleChange} />
      </div>
      <Badge variant="secondary" className="text-xs flex-shrink-0">
        {BADGE_LABELS[block.type]}
      </Badge>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        title="Remove block"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Description Block ────────────────────────────────────────────────────────

function DescriptionBlock({
  block,
  onUpdate,
}: {
  block: WysiwygBlock;
  onUpdate: (updates: Partial<WysiwygBlock>) => void;
}) {
  const { toast } = useToast();

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Not supported", description: "Speech recognition is not available in this browser.", variant: "destructive" });
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: { results: { 0: { 0: { transcript: string } } } }) => {
      const transcript = e.results[0][0].transcript;
      onUpdate({ description: block.description ? `${block.description}\n${transcript}` : transcript });
    };
    rec.onerror = () => toast({ title: "Error", description: "Could not capture voice. Please try again.", variant: "destructive" });
    rec.start();
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          onClick={startVoice}
          className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
        >
          <Mic className="w-3.5 h-3.5" /> Voice
        </button>
      </div>
      <Textarea
        value={block.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="Describe this section of work..."
        className="min-h-[120px] resize-none border-0 p-0 focus-visible:ring-0 text-gray-700 text-sm leading-relaxed shadow-none"
      />
    </div>
  );
}

// ─── Photo Block ──────────────────────────────────────────────────────────────

function PhotoBlock({
  block,
  jobId,
  diaryPhotos,
  onUpdate,
}: {
  block: WysiwygBlock;
  jobId?: string;
  diaryPhotos: string[];
  onUpdate: (updates: Partial<WysiwygBlock>) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showDiary, setShowDiary] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      if (jobId) {
        const { compressImages } = await import("@/lib/imageCompression");
        const compressed = await compressImages(files, { maxWidth: 1920, maxHeight: 1920, quality: 0.8 });
        const fd = new FormData();
        compressed.forEach((f) => fd.append("photos", f));
        fd.append("type", "before");
        fd.append("category", "documentation");
        const res = await fetch(`/api/jobs/${jobId}/photos/batch`, { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        const newPhotos: UploadedPhoto[] = (data.photos || []).map((url: string, i: number) => ({
          id: `job-photo-${Date.now()}-${i}`,
          url,
          filename: url.split("/").pop() || `photo-${i}`,
          type: "before",
          category: "documentation",
          capturedAt: new Date().toISOString(),
        }));
        onUpdate({ photos: [...block.photos, ...newPhotos] });
      } else {
        const newPhotos: UploadedPhoto[] = Array.from(files).map((f, i) => ({
          id: `tmp-${Date.now()}-${i}`,
          url: URL.createObjectURL(f),
          filename: f.name,
          type: "before",
          category: "documentation",
          capturedAt: new Date().toISOString(),
        }));
        onUpdate({ photos: [...block.photos, ...newPhotos] });
      }
    } catch {
      toast({ title: "Upload Error", description: "Failed to upload photos", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (id: string) => onUpdate({ photos: block.photos.filter((p) => p.id !== id) });

  const addFromDiary = () => {
    const newPhotos: UploadedPhoto[] = selected.map((url, i) => ({
      id: `diary-${Date.now()}-${i}`,
      url,
      filename: url.split("/").pop() || "diary-photo",
      type: "before",
      category: "documentation",
      capturedAt: new Date().toISOString(),
    }));
    onUpdate({ photos: [...block.photos, ...newPhotos] });
    setSelected([]);
    setShowDiary(false);
  };

  return (
    <div className="px-4 py-3">
      {block.photos.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {block.photos.map((photo) => (
            <div key={photo.id} className="relative group/photo rounded-md overflow-hidden bg-gray-100" style={{ paddingBottom: "100%" }}>
              <img
                src={photo.thumbnailUrl || photo.url}
                alt={photo.filename}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover/photo:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : "Upload Photos"}
        </Button>
        {jobId && diaryPhotos.length > 0 && (
          <Popover open={showDiary} onOpenChange={setShowDiary}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> From Diary
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <p className="text-sm font-medium mb-2">Select diary photos</p>
              <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto mb-3">
                {diaryPhotos.map((url) => (
                  <div
                    key={url}
                    onClick={() => setSelected((prev) => prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url])}
                    className={`relative rounded cursor-pointer overflow-hidden border-2 ${selected.includes(url) ? "border-blue-500" : "border-transparent"}`}
                    style={{ paddingBottom: "100%" }}
                  >
                    <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    {selected.includes(url) && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" onClick={addFromDiary} disabled={selected.length === 0} className="w-full">
                Add {selected.length > 0 ? `${selected.length} ` : ""}Photo{selected.length !== 1 ? "s" : ""}
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

// ─── Line Items Block ─────────────────────────────────────────────────────────

function LineItemsBlock({
  block,
  materials,
  onUpdate,
}: {
  block: WysiwygBlock;
  materials: Array<{ id: string; name: string; itemNumber?: string; price?: number; category?: string }>;
  onUpdate: (updates: Partial<WysiwygBlock>) => void;
}) {
  const [draft, setDraft] = useState<DraftLineItem>(defaultDraft());
  const [showAdd, setShowAdd] = useState(false);
  const [matSearch, setMatSearch] = useState("");
  const [showMats, setShowMats] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftLineItem>(defaultDraft());

  const subtotal = calcBlockSubtotal(block);

  const filteredMats = materials.filter((m) =>
    !matSearch || m.name?.toLowerCase().includes(matSearch.toLowerCase()) || m.itemNumber?.toString().includes(matSearch)
  );

  const selectMaterial = (m: typeof materials[0]) => {
    setDraft((prev) => ({
      ...prev,
      itemCode: m.itemNumber || "",
      description: m.name || "",
      unitPrice: typeof m.price === "string" ? parseFloat(m.price as string) || 0 : m.price || 0,
    }));
    setMatSearch(m.name || "");
    setShowMats(false);
  };

  const commitDraft = () => {
    if (!draft.description) return;
    const totalPrice = calcLineItemPrice(draft);
    const item: LineItem = {
      id: `item-${Date.now()}`,
      description: draft.description,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      totalPrice,
      unit: "each",
      category: draft.itemCode,
      isOptional: draft.isOptional,
      selected: true,
      pricingType: draft.pricingType,
      choices: draft.choices,
      fixedPrice: draft.pricingType === "fixed" ? draft.fixedPrice : undefined,
      priceIncludesTax: draft.priceIncludesTax,
    };
    onUpdate({ lineItems: [...block.lineItems, item] });
    setDraft(defaultDraft());
    setMatSearch("");
    setShowAdd(false);
  };

  const removeItem = (id: string) => onUpdate({ lineItems: block.lineItems.filter((i) => i.id !== id) });

  const startEdit = (item: LineItem) => {
    setEditingId(item.id ?? null);
    setEditDraft({
      description: item.description,
      itemCode: item.category || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      pricingType: item.pricingType,
      fixedPrice: item.fixedPrice || 0,
      isOptional: item.isOptional,
      priceIncludesTax: item.priceIncludesTax || false,
      choices: item.choices || [],
    });
  };

  const commitEdit = () => {
    if (!editingId) return;
    onUpdate({
      lineItems: block.lineItems.map((i) => {
        if (i.id !== editingId) return i;
        const totalPrice = calcLineItemPrice(editDraft);
        return {
          ...i,
          description: editDraft.description,
          category: editDraft.itemCode,
          quantity: editDraft.quantity,
          unitPrice: editDraft.unitPrice,
          totalPrice,
          pricingType: editDraft.pricingType,
          fixedPrice: editDraft.pricingType === "fixed" ? editDraft.fixedPrice : undefined,
          isOptional: editDraft.isOptional,
          priceIncludesTax: editDraft.priceIncludesTax,
        };
      }),
    });
    setEditingId(null);
  };

  return (
    <div className="px-0 py-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[600px]">
        <thead className="bg-green-50">
          <tr>
            <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600 w-24">Item Code</th>
            <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600">Item Name</th>
            <th className="border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-600 w-12">Qty</th>
            <th className="border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 w-28">Cost ex GST</th>
            <th className="border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">Markup</th>
            <th className="border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 w-28">Price ex GST</th>
            <th className="border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 w-28">Total ex GST</th>
            <th className="border border-gray-200 px-2 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {block.lineItems.map((item) =>
            editingId === item.id ? (
              <tr key={item.id} className="bg-blue-50">
                <td className="border border-gray-200 px-1 py-1">
                  <Input
                    value={editDraft.itemCode}
                    onChange={(e) => setEditDraft((d) => ({ ...d, itemCode: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Code"
                  />
                </td>
                <td className="border border-gray-200 px-1 py-1">
                  <Input
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Description"
                  />
                </td>
                <td className="border border-gray-200 px-1 py-1">
                  <Input
                    type="number"
                    value={editDraft.quantity}
                    onChange={(e) => setEditDraft((d) => ({ ...d, quantity: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs text-center"
                  />
                </td>
                <td className="border border-gray-200 px-1 py-1" colSpan={2}>
                  <Input
                    type="number"
                    value={editDraft.pricingType === "fixed" ? editDraft.fixedPrice : editDraft.unitPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditDraft((d) => d.pricingType === "fixed" ? { ...d, fixedPrice: val } : { ...d, unitPrice: val });
                    }}
                    className="h-8 text-xs text-right"
                    placeholder="Price"
                  />
                </td>
                <td className="border border-gray-200 px-2 py-1 text-right text-xs text-gray-500">
                  {fmtNZD(calcLineItemPrice(editDraft))}
                </td>
                <td className="border border-gray-200 px-2 py-1 text-right text-xs font-medium">
                  {fmtNZD(calcLineItemPrice(editDraft))}
                </td>
                <td className="border border-gray-200 px-1 py-1">
                  <div className="flex gap-1">
                    <button type="button" onClick={commitEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={item.id}
                className="hover:bg-gray-50 cursor-pointer group/row"
                onClick={() => startEdit(item)}
              >
                <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{item.category || "—"}</td>
                <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900 font-medium">{item.description}</td>
                <td className="border border-gray-200 px-3 py-2 text-center text-sm text-gray-700">{item.quantity}</td>
                <td className="border border-gray-200 px-3 py-2 text-right text-sm text-gray-700">{fmtNZD(item.unitPrice)}</td>
                <td className="border border-gray-200 px-3 py-2 text-right text-sm text-gray-400">—</td>
                <td className="border border-gray-200 px-3 py-2 text-right text-sm text-gray-700">{fmtNZD(item.unitPrice)}</td>
                <td className="border border-gray-200 px-3 py-2 text-right text-sm font-semibold text-gray-900">{fmtNZD(item.totalPrice)}</td>
                <td className="border border-gray-200 px-2 py-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id!); }}
                    className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover/row:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )
          )}

          {/* Search or Add New row */}
          {showAdd ? (
            <tr className="bg-blue-50/60">
              <td className="border border-gray-200 px-1 py-1">
                <Input
                  value={draft.itemCode}
                  onChange={(e) => setDraft((d) => ({ ...d, itemCode: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="Code"
                />
              </td>
              <td className="border border-gray-200 px-1 py-1 relative">
                <Input
                  value={matSearch || draft.description}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMatSearch(v);
                    setDraft((d) => ({ ...d, description: v }));
                    setShowMats(true);
                  }}
                  onFocus={() => setShowMats(true)}
                  className="h-8 text-xs"
                  placeholder="Description or search catalogue…"
                  autoFocus
                />
                {showMats && filteredMats.length > 0 && (
                  <div className="absolute top-full left-0 z-50 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto mt-0.5">
                    {filteredMats.slice(0, 20).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMaterial(m)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 text-left"
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className="text-gray-400">${typeof m.price === "number" ? m.price.toFixed(2) : parseFloat(m.price as string || "0").toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </td>
              <td className="border border-gray-200 px-1 py-1">
                <Input
                  type="number"
                  value={draft.quantity}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: parseFloat(e.target.value) || 0 }))}
                  className="h-8 text-xs text-center"
                />
              </td>
              <td className="border border-gray-200 px-1 py-1" colSpan={2}>
                <Input
                  type="number"
                  value={draft.unitPrice}
                  onChange={(e) => setDraft((d) => ({ ...d, unitPrice: parseFloat(e.target.value) || 0 }))}
                  className="h-8 text-xs text-right"
                  placeholder="Price"
                />
              </td>
              <td className="border border-gray-200 px-2 py-1 text-right text-xs text-gray-500">
                {fmtNZD(calcLineItemPrice(draft))}
              </td>
              <td className="border border-gray-200 px-2 py-1 text-right text-xs font-medium">
                {fmtNZD(calcLineItemPrice(draft))}
              </td>
              <td className="border border-gray-200 px-1 py-1">
                <div className="flex gap-1">
                  <button type="button" onClick={commitDraft} className="p-1 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => { setShowAdd(false); setDraft(defaultDraft()); setMatSearch(""); }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={8} className="border border-gray-200 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="text-sm text-gray-400 hover:text-blue-600 hover:underline transition-colors text-left w-full"
                >
                  Search or Add New...
                </button>
              </td>
            </tr>
          )}

          {/* Section subtotal */}
          <tr className="bg-gray-50">
            <td colSpan={5} />
            <td className="border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">SUBTOTAL</td>
            <td className="border border-gray-200 px-3 py-2 text-right text-sm font-bold text-gray-900">{fmtNZD(subtotal)}</td>
            <td className="border border-gray-200" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProposalBuilderV2({
  isOpen,
  onClose,
  jobId,
  customerId,
  mode = "create",
  proposalId,
  onRequestJobSave,
  jobDescription,
  customEmail,
}: ProposalBuilderV2Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: templateData } = useQuery({ queryKey: ["/api/templates/default/proposal"], enabled: isOpen });
  const { data: jobData } = useQuery({ queryKey: ["/api/jobs", jobId], enabled: !!jobId && isOpen });
  const { data: customerData } = useQuery({ queryKey: ["/api/customers", customerId], enabled: !!customerId && isOpen });
  const { data: diaryData } = useQuery({ queryKey: ["/api/jobs", jobId, "diary"], enabled: !!jobId && isOpen });
  const { data: existingData } = useQuery({
    queryKey: ["/api/proposals", proposalId],
    enabled: !!proposalId && mode === "edit" && isOpen,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  const { data: materialsData } = useQuery({ queryKey: ["/api/materials"], enabled: isOpen });

  const template = (templateData as { success?: boolean; data?: Record<string, unknown> })?.success
    ? (templateData as { success: boolean; data: Record<string, unknown> }).data
    : null;
  const job = (jobData as { success?: boolean; data?: Record<string, unknown> })?.success
    ? (jobData as { success: boolean; data: Record<string, unknown> }).data
    : null;
  const customer = (customerData as { success?: boolean; data?: Record<string, unknown> })?.success
    ? (customerData as { success: boolean; data: Record<string, unknown> }).data
    : null;
  const materials: Array<{ id: string; name: string; itemNumber?: string; price?: number; category?: string }> =
    (materialsData as { data?: unknown[] })?.data || [];

  const diaryPhotos: string[] = (() => {
    if (!(diaryData as { success?: boolean })?.success) return [];
    const entries = (diaryData as { success: boolean; data: Array<{ photos?: string[]; photoUrl?: string }> }).data || [];
    const all: string[] = [];
    entries.forEach((e) => {
      if (e.photos) all.push(...e.photos);
      if (e.photoUrl) all.push(e.photoUrl);
    });
    return [...new Set(all)];
  })();

  // ── Local state ────────────────────────────────────────────────────────────

  const [blocks, setBlocks] = useState<WysiwygBlock[]>([]);
  const [proposalTitle, setProposalTitle] = useState("Treemarkables Quote");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [taxRate] = useState(15);
  const [validUntil, setValidUntil] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", subject: "", message: "" });
  const [smsForm, setSmsForm] = useState({ to: "", message: "" });

  const initCreateRef = useRef(false);
  const initEditRef = useRef<string | null>(null);

  // ── Initialization guards ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      initCreateRef.current = false;
      initEditRef.current = null;
      setDraftId(null);
      setBlocks([]);
      setProposalTitle("Treemarkables Quote");
    }
  }, [isOpen]);

  useEffect(() => { initEditRef.current = null; }, [proposalId]);

  // Initialize from existing proposal (edit mode)
  useEffect(() => {
    if (!existingData || !(existingData as { success?: boolean }).success || mode !== "edit" || !isOpen) return;
    const key = `${proposalId}-${isOpen}`;
    if (initEditRef.current === key) return;
    initEditRef.current = key;

    const p = (existingData as { data: Record<string, unknown> }).data;
    setProposalTitle((p.title as string) || "Treemarkables Quote");
    setDraftId((p.id as string) || proposalId || null);

    if (Array.isArray(p.sections)) {
      const loadedBlocks: WysiwygBlock[] = (p.sections as Array<{
        id: string;
        title: string;
        description?: string;
        photos?: UploadedPhoto[];
        lineItems?: Array<Record<string, unknown>>;
        sortOrder?: number;
      }>).map((s, idx) => {
        const photos = (s.photos || []) as UploadedPhoto[];
        const lineItems: LineItem[] = (s.lineItems || []).map((item) => ({
          id: item.id as string,
          description: (item.description as string) || "",
          quantity: parseFloat(item.quantity as string) || 1,
          unitPrice: parseFloat(item.unitPrice as string) || 0,
          totalPrice: parseFloat(item.totalPrice as string) || 0,
          unit: (item.unit as string) || "each",
          category: (item.category as string) || "",
          isOptional: (item.isOptional as boolean) || false,
          selected: item.selected !== false,
          pricingType: (item.pricingType as LineItem["pricingType"]) || "normal",
          choices: (item.choices as LineItemChoice[]) || [],
          priceIncludesTax: (item.priceIncludesTax as boolean) || false,
          fixedPrice: item.fixedPrice ? parseFloat(item.fixedPrice as string) : undefined,
        }));
        return {
          id: s.id || `block-${idx}`,
          type: inferBlockType({ description: s.description || "", photos, lineItems }),
          title: s.title || "",
          description: s.description || "",
          photos,
          lineItems,
          sortOrder: s.sortOrder ?? idx,
        };
      });
      setBlocks(loadedBlocks);
    }
  }, [existingData, mode, isOpen, proposalId]);

  // Initialize from job data (create mode)
  useEffect(() => {
    if (!job || !isOpen || mode !== "create") return;
    if (initCreateRef.current) return;
    initCreateRef.current = true;

    setProposalTitle((job.title as string) || "Treemarkables Quote");

    const includeDesc = (job.includeDescriptionInQuotesProposals as boolean) !== false;
    const desc = includeDesc ? (jobDescription ?? (job.description as string) ?? "") : "";

    const initialBlock: WysiwygBlock = {
      id: "block-1",
      type: "description",
      title: (job.serviceType as string) || "Job Description",
      description: desc,
      photos: [],
      lineItems: [],
      sortOrder: 0,
    };

    setBlocks((cur) => {
      const hasContent = cur.some((b) => b.lineItems.length > 0 || b.photos.length > 0 || b.description);
      return hasContent ? cur : [initialBlock];
    });
  }, [job, isOpen, mode, jobDescription]);

  // If mode=edit, pre-set draftId on open
  useEffect(() => {
    if (mode === "edit" && proposalId && isOpen && !draftId) setDraftId(proposalId);
  }, [mode, proposalId, isOpen, draftId]);

  // ── Block management ───────────────────────────────────────────────────────

  const addBlock = useCallback((type: BlockType, afterIndex?: number) => {
    const newBlock: WysiwygBlock = {
      id: `block-${Date.now()}`,
      type,
      title: type === "description" ? "Description" : type === "photos" ? "Photos" : "Line Items",
      description: "",
      photos: [],
      lineItems: [],
      sortOrder: 0,
    };
    setBlocks((prev) => {
      const next = [...prev];
      if (afterIndex !== undefined) next.splice(afterIndex + 1, 0, newBlock);
      else next.push(newBlock);
      return next.map((b, i) => ({ ...b, sortOrder: i }));
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      if (prev.length <= 1) {
        toast({ title: "Cannot Remove", description: "At least one section is required.", variant: "destructive" });
        return prev;
      }
      return prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, sortOrder: i }));
    });
  }, [toast]);

  const updateBlock = useCallback((id: string, updates: Partial<WysiwygBlock>) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, ...updates } : b));
  }, []);

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totals = calcTotals(blocks);
  const discountValue = discountType === "percentage" ? (totals.subtotal * discountAmount) / 100 : discountAmount;
  const subtotalAfterDiscount = Math.max(0, totals.subtotal - discountValue);
  const gst = subtotalAfterDiscount * (taxRate / 100);
  const grandTotal = subtotalAfterDiscount + gst;

  // ── Save / Auto-save ───────────────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    const actualCustomerId = (customer as { id?: string } | null)?.id || customerId;
    const actualJobId = (job as { id?: string } | null)?.id || jobId;
    return {
      customerId: actualCustomerId,
      jobId: actualJobId,
      proposalNumber: draftId ? undefined : `PROP-${Date.now()}`,
      title: proposalTitle,
      subtotal: subtotalAfterDiscount.toString(),
      gstAmount: gst.toString(),
      totalAmount: grandTotal.toString(),
      taxRate: taxRate.toString(),
      discountAmount: discountValue.toString(),
      discountType,
      validUntil: validUntil || undefined,
      status: "draft",
      deliveryMethod: "email",
      createdBy: "system",
      sections: blocks.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        photos: b.photos,
        lineItems: b.lineItems,
        sortOrder: b.sortOrder,
      })),
    };
  }, [blocks, proposalTitle, customer, customerId, job, jobId, draftId, subtotalAfterDiscount, gst, grandTotal, taxRate, discountValue, discountType, validUntil]);

  const saveDraftMutation = useMutation({
    mutationFn: async (data: ReturnType<typeof buildPayload>) => {
      if (draftId) {
        const res = await apiRequest("PUT", `/api/proposals/${draftId}`, data);
        return await res.json();
      }
      const res = await apiRequest("POST", "/api/proposals", data);
      return await res.json();
    },
    onSuccess: (res) => {
      const id = res?.data?.id || res?.id;
      if (!draftId && id) setDraftId(id);
      setAutoSaveStatus("saved");
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      if (jobId) queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary-timeline"] });
    },
    onError: () => setAutoSaveStatus("unsaved"),
  });

  // Auto-save every 3 seconds when blocks or title change
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshot = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || blocks.length === 0) return;
    const snap = JSON.stringify({ blocks, proposalTitle });
    if (snap === lastSnapshot.current) return;
    setAutoSaveStatus("unsaved");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const hasContent = proposalTitle || blocks.some((b) => b.description || b.photos.length > 0 || b.lineItems.length > 0);
      if (!hasContent) return;
      setAutoSaveStatus("saving");
      try {
        await saveDraftMutation.mutateAsync(buildPayload());
        lastSnapshot.current = snap;
      } catch {
        // handled in mutation
      }
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [blocks, proposalTitle, isOpen]);

  // ── Email / SMS ────────────────────────────────────────────────────────────

  const sendEmailMutation = useMutation({
    mutationFn: async (d: { proposalId: string; to: string; subject: string; message?: string; cc?: string }) => {
      const res = await apiRequest("POST", `/api/proposals/${d.proposalId}/send-email`, { to: d.to, subject: d.subject, message: d.message, cc: d.cc });
      return res;
    },
    onSuccess: () => { setShowEmailDialog(false); setEmailForm({ to: "", cc: "", subject: "", message: "" }); },
    onError: (err: Error) => toast({ title: "Email Failed", description: err.message || "Failed to send email", variant: "destructive" }),
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (d: { to: string; message: string; jobId?: string; customerId?: string }) => {
      const res = await apiRequest("POST", "/api/communications/sms", d);
      return await res.json();
    },
    onSuccess: () => { setShowSmsDialog(false); setSmsForm({ to: "", message: "" }); },
    onError: (err: Error) => toast({ title: "SMS Failed", description: err.message || "Failed to send SMS", variant: "destructive" }),
  });

  const initEmailForm = () => {
    const email = customEmail || (job as { jobContactEmail?: string } | null)?.jobContactEmail || (customer as { email?: string } | null)?.email || "";
    setEmailForm({ to: email, cc: "", subject: "Treemarkables Quote", message: "Thank you for your inquiry, we are pleased to provide you with the following proposal." });
  };

  const initSmsForm = () => {
    const phone = (customer as { phone?: string } | null)?.phone || (job as { jobContactMobile?: string; jobContactPhone?: string } | null)?.jobContactMobile || (job as { jobContactPhone?: string } | null)?.jobContactPhone || "";
    const name = (customer as { name?: string } | null)?.name || "Valued Customer";
    const first = name.split(" ")[0];
    const link = draftId ? `https://${window.location.host}/proposal/${draftId}` : "";
    setSmsForm({ to: phone, message: link ? `Hi ${first}, your proposal is ready! Total: ${fmtNZD(grandTotal)}. View: ${link}\nJules\nTreemarkables` : `Hi ${first}, your proposal is ready! Total: ${fmtNZD(grandTotal)}.\nJules\nTreemarkables` });
  };

  const handleSendEmail = async () => {
    if (!emailForm.to.trim() || !emailForm.subject.trim()) {
      toast({ title: "Missing Information", description: "Please enter recipient email and subject.", variant: "destructive" });
      return;
    }
    let effectiveDraftId = draftId;
    if (!effectiveDraftId) {
      setAutoSaveStatus("saving");
      try {
        const res = await saveDraftMutation.mutateAsync(buildPayload());
        effectiveDraftId = res?.data?.id || res?.id || null;
        if (effectiveDraftId) setDraftId(effectiveDraftId);
      } catch {
        toast({ title: "Save Failed", description: "Could not save proposal before sending.", variant: "destructive" });
        return;
      }
    }
    if (!effectiveDraftId) {
      toast({ title: "Save Failed", description: "Could not save proposal before sending.", variant: "destructive" });
      return;
    }
    await sendEmailMutation.mutateAsync({ proposalId: effectiveDraftId, to: emailForm.to, subject: emailForm.subject, message: emailForm.message, cc: emailForm.cc });
  };

  const handleSendSms = async () => {
    if (!smsForm.to.trim() || !smsForm.message.trim()) {
      toast({ title: "Missing Information", description: "Please enter phone number and message.", variant: "destructive" });
      return;
    }
    await sendSmsMutation.mutateAsync({ to: smsForm.to, message: smsForm.message, jobId, customerId: (customer as { id?: string } | null)?.id || customerId });
  };

  const handleClose = async () => {
    if (autoSaveStatus === "unsaved") {
      setAutoSaveStatus("saving");
      try { await saveDraftMutation.mutateAsync(buildPayload()); } catch { /* close anyway */ }
    }
    onClose();
  };

  // ── VIP check ──────────────────────────────────────────────────────────────

  const vip = (customer as { isVipMember?: boolean; name?: string; vipDiscountPercent?: string } | null);
  const isVip = vip?.isVipMember;

  // ── Company/header data ────────────────────────────────────────────────────

  const companyName = (template?.companyName as string) || "Treemarkables";
  const companyAddress = (template?.companyAddress as string) || "";
  const companyPhone = (template?.companyPhone as string) || "";
  const companyEmail = (template?.companyEmail as string) || "";
  const gstNumber = (template?.gstNumber as string) || "";
  const logoUrl = (template?.logoUrl as string) || LOGO_URL;

  const proposalDate = new Date();
  const proposalNum = draftId ? `#${draftId.slice(-6).toUpperCase()}` : "#—";

  // Customer display info
  const customerName = (customer as { name?: string } | null)?.name || (job as { clientName?: string } | null)?.clientName || "";
  const customerCompany = (customer as { company?: string } | null)?.company || "";
  const customerAddress = (job as { address?: string } | null)?.address || (customer as { address?: string } | null)?.address || "";

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-full h-screen sm:h-[95vh] sm:max-w-5xl overflow-hidden flex flex-col p-0 gap-0">
          {/* ── Toolbar ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b bg-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { initEmailForm(); setShowEmailDialog(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                type="button"
                onClick={() => { initSmsForm(); setShowSmsDialog(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-green-600" /> SMS
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-save indicator */}
              {autoSaveStatus === "saving" && (
                <div className="flex items-center gap-1 text-xs text-blue-500">
                  <div className="w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Saving
                </div>
              )}
              {autoSaveStatus === "saved" && lastSavedAt && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3 h-3" /> Saved
                </div>
              )}
              {/* Settings popover */}
              <Popover open={showSettings} onOpenChange={setShowSettings}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Settings <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <p className="text-sm font-semibold mb-3">Proposal Settings</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Discount</label>
                      <div className="flex gap-1.5 mt-1">
                        <Input
                          type="number"
                          value={discountAmount || ""}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          placeholder="0"
                        />
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as "fixed" | "percentage")}
                          className="h-8 border border-input rounded-md text-sm px-2"
                        >
                          <option value="fixed">$ Fixed</option>
                          <option value="percentage">% Percent</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Valid Until</label>
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── VIP Banner ── */}
          {isVip && (
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-800">
                  VIP Member — {vip?.name?.split(" ")[0]} receives{vip?.vipDiscountPercent ? ` a ${parseFloat(vip.vipDiscountPercent)}% discount` : " a VIP discount"}
                </span>
              </div>
              {vip?.vipDiscountPercent && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-800 bg-white flex-shrink-0"
                  onClick={() => { setDiscountAmount(parseFloat(vip.vipDiscountPercent!)); setDiscountType("percentage"); }}
                >
                  Apply {parseFloat(vip.vipDiscountPercent)}%
                </Button>
              )}
            </div>
          )}

          {/* ── Document Canvas ── */}
          <div className="flex-1 overflow-y-auto bg-gray-100 px-2 py-4 sm:px-6 sm:py-6">
            <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-sm">

              {/* Document Header */}
              <div className="flex items-start justify-between px-6 sm:px-10 py-6 sm:py-8 border-b border-gray-200">
                <div>
                  <img src={logoUrl} alt="Company Logo" className="h-16 sm:h-20 w-auto object-contain" />
                </div>
                <div className="text-right text-xs sm:text-sm text-gray-600 space-y-0.5">
                  {companyAddress && <p>{companyAddress}</p>}
                  {companyPhone && <p>{companyPhone}</p>}
                  {companyEmail && <p>{companyEmail}</p>}
                  {gstNumber && <p>GST Number: {gstNumber}</p>}
                </div>
              </div>

              {/* Customer + Proposal number */}
              <div className="flex items-start justify-between px-6 sm:px-10 py-5 border-b border-gray-200 gap-4">
                <div className="border border-gray-300 rounded-md px-4 py-3 min-w-[200px] text-sm text-gray-700">
                  {customerName && <p className="font-semibold">{customerName}</p>}
                  {customerCompany && <p>{customerCompany}</p>}
                  {customerAddress && <p className="whitespace-pre-line text-gray-600">{customerAddress}</p>}
                </div>
                <div className="text-right text-sm text-gray-700">
                  <p className="font-semibold">Proposal {proposalNum}</p>
                  <p className="text-gray-500">{format(proposalDate, "do MMMM yyyy")}</p>
                  {validUntil && <p className="text-xs text-gray-400 mt-1">Valid until: {format(new Date(validUntil), "dd MMM yyyy")}</p>}
                </div>
              </div>

              {/* Editable Proposal Title */}
              <div className="px-6 sm:px-10 py-4 border-b border-gray-100">
                {/* Inline-edit for proposal title */}
                <input
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className="text-2xl sm:text-3xl font-bold text-[#2a6e2e] w-full border-0 border-b-2 border-transparent focus:border-green-400 focus:outline-none bg-transparent"
                  placeholder="Proposal Title"
                />
              </div>

              {/* Block list */}
              <div className="px-6 sm:px-10 py-2">
                <AddBlockButton onAdd={(type) => addBlock(type, -1)} />

                {blocks.map((block, idx) => (
                  <div key={block.id} className="mb-1">
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      <BlockHeader
                        block={block}
                        onTitleChange={(t) => updateBlock(block.id, { title: t })}
                        onRemove={() => removeBlock(block.id)}
                      />
                      {block.type === "description" && (
                        <DescriptionBlock block={block} onUpdate={(u) => updateBlock(block.id, u)} />
                      )}
                      {block.type === "photos" && (
                        <PhotoBlock
                          block={block}
                          jobId={jobId}
                          diaryPhotos={diaryPhotos}
                          onUpdate={(u) => updateBlock(block.id, u)}
                        />
                      )}
                      {block.type === "lineItems" && (
                        <LineItemsBlock
                          block={block}
                          materials={materials}
                          onUpdate={(u) => updateBlock(block.id, u)}
                        />
                      )}
                    </div>
                    <AddBlockButton onAdd={(type) => addBlock(type, idx)} />
                  </div>
                ))}
              </div>

              {/* Totals */}
              <Separator />
              <div className="px-6 sm:px-10 py-4">
                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>SUBTOTAL</span>
                      <span className="font-medium">{fmtNZD(subtotalAfterDiscount)}</span>
                    </div>
                    {discountValue > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Discount</span>
                        <span>-{fmtNZD(discountValue)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>GST ({taxRate}%)</span>
                      <span className="font-medium">{fmtNZD(gst)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base text-gray-900">
                      <span>TOTAL</span>
                      <span>{fmtNZD(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 sm:px-10 py-4 border-t border-gray-100 text-center text-xs text-gray-500">
                <p>Thank you for choosing {companyName}!</p>
                <p>Professional tree services you can trust.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Email Dialog ── */}
      {showEmailDialog && (
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent className="max-w-md">
            <div className="p-2">
              <h2 className="text-base font-semibold mb-4">Send Proposal via Email</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">To</label>
                  <Input value={emailForm.to} onChange={(e) => setEmailForm((f) => ({ ...f, to: e.target.value }))} className="mt-1" placeholder="recipient@email.com" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">CC (optional)</label>
                  <Input value={emailForm.cc} onChange={(e) => setEmailForm((f) => ({ ...f, cc: e.target.value }))} className="mt-1" placeholder="cc@email.com" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Subject</label>
                  <Input value={emailForm.subject} onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Message</label>
                  <Textarea value={emailForm.message} onChange={(e) => setEmailForm((f) => ({ ...f, message: e.target.value }))} className="mt-1 min-h-[80px]" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
                <Button type="button" className="flex-1" onClick={handleSendEmail} disabled={sendEmailMutation.isPending}>
                  {sendEmailMutation.isPending ? "Sending…" : "Send Email"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── SMS Dialog ── */}
      {showSmsDialog && (
        <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
          <DialogContent className="max-w-md">
            <div className="p-2">
              <h2 className="text-base font-semibold mb-4">Send Proposal via SMS</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Phone Number</label>
                  <Input value={smsForm.to} onChange={(e) => setSmsForm((f) => ({ ...f, to: e.target.value }))} className="mt-1" placeholder="+64 21 xxx xxxx" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Message</label>
                  <Textarea value={smsForm.message} onChange={(e) => setSmsForm((f) => ({ ...f, message: e.target.value }))} className="mt-1 min-h-[100px]" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSmsDialog(false)}>Cancel</Button>
                <Button type="button" className="flex-1" onClick={handleSendSms} disabled={sendSmsMutation.isPending}>
                  {sendSmsMutation.isPending ? "Sending…" : "Send SMS"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

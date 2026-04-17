import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  X, Plus, Upload, Trash2, Mail, MessageSquare, Check, Crown,
  GripVertical, Mic, AlignLeft, Image as ImageIcon, List, ChevronDown, MoreHorizontal, Eye, ArrowLeft,
} from "lucide-react";
import { ProposalTemplate } from "@/components/ProposalTemplate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LineItem, LineItemChoice, UploadedPhoto, PricingType } from "@/types/proposal";
import type { DocumentTemplate, Customer, Proposal } from "@shared/schema";

// Minimal typed interfaces for browser SpeechRecognition (not in TypeScript lib by default)
interface SpeechRecognitionAlternative { readonly transcript: string; }
interface SpeechRecognitionResult { readonly 0: SpeechRecognitionAlternative; }
interface SpeechRecognitionResultList { readonly 0: SpeechRecognitionResult; }
interface SpeechRecognitionEvent extends Event { readonly results: SpeechRecognitionResultList; }
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
}
interface BrowserSpeechRecognitionCtor { new(): SpeechRecognitionInstance; }
type WindowWithSpeech = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionCtor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
};

// Typed shape for the raw lineItems coming from the parent job form
interface IncomingLineItemRaw {
  id?: string;
  description?: string;
  name?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  price?: string | number;
  costPrice?: string | number;
  unit?: string;
  category?: string;
  itemCode?: string;
  isOptional?: boolean;
  pricingType?: PricingType;
  choices?: LineItemChoice[];
  priceIncludesTax?: boolean;
  markupPct?: string | number;
}

const LOGO_URL = "/treemarkables-logo.webp";

type BlockType = "description" | "photos" | "lineItems";
type SectionType = "fixed" | "subtotalOnly" | "multipleChoice" | "optional";

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  fixed: "Fixed Items",
  subtotalOnly: "Fixed Items (Subtotal Only)",
  multipleChoice: "Multiple Choice",
  optional: "Optional",
};

interface WysiwygBlock {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  photos: UploadedPhoto[];
  lineItems: LineItem[];
  sortOrder: number;
  sectionType?: SectionType;
}

interface DraftLineItem {
  description: string;
  itemCode: string;
  quantity: number;
  costExGst: number;
  markupPct: number;
  pricingType: PricingType;
  fixedPrice: number;
  isOptional: boolean;
  priceIncludesTax: boolean;
  choices: LineItemChoice[];
}

const defaultDraft = (): DraftLineItem => ({
  description: "",
  itemCode: "",
  quantity: 1,
  costExGst: 0,
  markupPct: 0,
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

function fmtPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

function inferBlockType(section: {
  description?: string;
  photos?: UploadedPhoto[];
  lineItems?: LineItem[];
}): BlockType {
  if ((section.lineItems || []).length > 0) return "lineItems";
  if ((section.photos || []).length > 0) return "photos";
  return "description";
}

function draftPriceExGst(draft: DraftLineItem): number {
  if (draft.pricingType === "fixed") {
    return draft.priceIncludesTax ? draft.fixedPrice / 1.15 : draft.fixedPrice;
  }
  const costEx = draft.priceIncludesTax ? draft.costExGst / 1.15 : draft.costExGst;
  return costEx * (1 + draft.markupPct / 100);
}

function draftTotal(draft: DraftLineItem): number {
  return draft.quantity * draftPriceExGst(draft);
}

function calcBlockSubtotal(block: WysiwygBlock): number {
  return (block.lineItems || []).reduce((sum, i) => {
    // Optional items are excluded from subtotal — only added when customer clicks to accept
    if (!i.selected || i.isOptional) return sum;
    // Normalize to ex-GST so section subtotal matches the overall totals basis
    return sum + (i.priceIncludesTax ? i.totalPrice / 1.15 : i.totalPrice);
  }, 0);
}

function calcTotals(blocks: WysiwygBlock[]) {
  let subtotalExGst = 0;
  let gstAmount = 0;
  blocks.forEach((b) =>
    // Optional items excluded from totals by default — customer must explicitly add them
    (b.lineItems || []).filter((i) => i.selected && !i.isOptional).forEach((item) => {
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
    <div className="flex items-center justify-center my-2">
      <div className="flex-1 h-px bg-gray-200" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 text-xs hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors mx-2"
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
      <div className="flex-1 h-px bg-gray-200" />
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
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  onSectionTypeChange,
}: {
  block: WysiwygBlock;
  onTitleChange: (t: string) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
  onSectionTypeChange?: (t: SectionType) => void;
}) {
  const currentSectionType = block.sectionType ?? "fixed";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 transition-colors ${isDragOver ? "bg-blue-50 border-blue-200" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 flex-shrink-0"
        draggable
        onDragStart={onDragStart}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <InlineTitle value={block.title} onChange={onTitleChange} />
      </div>
      {block.type === "lineItems" && onSectionTypeChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs text-gray-500">
              <span className="hidden sm:inline">{SECTION_TYPE_LABELS[currentSectionType]}</span>
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {(Object.keys(SECTION_TYPE_LABELS) as SectionType[]).map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={() => onSectionTypeChange(type)}
                className={currentSectionType === type ? "bg-accent font-medium" : ""}
              >
                {SECTION_TYPE_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [block.description]);

  const startVoice = () => {
    const w = window as WindowWithSpeech;
    const SRCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SRCtor) {
      toast({ title: "Not supported", description: "Speech recognition is not available in this browser.", variant: "destructive" });
      return;
    }
    const rec: SpeechRecognitionInstance = new SRCtor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
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
        ref={textareaRef}
        value={block.description}
        rows={1}
        onChange={(e) => { onUpdate({ description: e.target.value }); autoResize(); }}
        placeholder="Describe this section of work..."
        className="min-h-0 resize-none border-0 p-0 focus-visible:ring-0 bg-transparent text-gray-700 text-sm leading-relaxed shadow-none overflow-hidden max-w-prose"
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
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);

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
    const existing = new Set(block.photos.map((p) => p.url));
    const newPhotos: UploadedPhoto[] = selectedUrls
      .filter((url) => !existing.has(url))
      .map((url, i) => ({
        id: `diary-${Date.now()}-${i}`,
        url,
        filename: url.split("/").pop() || "diary-photo",
        type: "before",
        category: "documentation",
        capturedAt: new Date().toISOString(),
      }));
    onUpdate({ photos: [...block.photos, ...newPhotos] });
    setSelectedUrls([]);
    setShowDiary(false);
  };

  return (
    <div className="px-4 py-3">
      {block.photos.length > 0 && (
        <div className="grid grid-cols-12 gap-1 mb-3">
          {block.photos.map((photo, photoIndex) => (
            <div
              key={photo.id}
              className="relative group/photo rounded-md overflow-hidden bg-gray-100 cursor-pointer"
              style={{ paddingBottom: "100%" }}
              onClick={() => {
                const photos = block.photos;
                let currentIndex = photoIndex;
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/95';
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '×';
                closeBtn.className = 'text-white text-4xl w-14 h-14 flex items-center justify-center bg-black/40 rounded-full transition-colors';
                closeBtn.style.cssText = 'position:fixed;right:1rem;top:max(1rem,env(safe-area-inset-top));z-index:201;pointer-events:auto;';
                const imgContainer = document.createElement('div');
                imgContainer.className = 'w-full h-full flex items-center justify-center p-4';
                const img = document.createElement('img');
                img.style.cssText = 'max-width: calc(100vw - 4rem); max-height: calc(100vh - 4rem); width: auto; height: auto; object-fit: contain; display: block; border-radius: 4px;';
                const counter = document.createElement('div');
                counter.className = 'absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full';
                const prevBtn = document.createElement('button');
                prevBtn.innerHTML = '‹';
                prevBtn.className = 'absolute left-2 top-1/2 transform -translate-y-1/2 text-white text-5xl w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors';
                const nextBtn = document.createElement('button');
                nextBtn.innerHTML = '›';
                nextBtn.className = 'absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-5xl w-12 h-12 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors';
                const updateImage = () => {
                  img.src = photos[currentIndex].url;
                  counter.textContent = `${currentIndex + 1} / ${photos.length}`;
                  prevBtn.style.display = currentIndex === 0 ? 'none' : 'flex';
                  nextBtn.style.display = currentIndex === photos.length - 1 ? 'none' : 'flex';
                };
                const openedAt = Date.now();
                const safeClose = () => {
                  if (Date.now() - openedAt < 400) return;
                  document.removeEventListener('keydown', handleKeyDown);
                  modal.remove();
                };
                const handleKeyDown = (e: KeyboardEvent) => {
                  if (e.key === 'ArrowLeft' && currentIndex > 0) { currentIndex--; updateImage(); }
                  else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) { currentIndex++; updateImage(); }
                  else if (e.key === 'Escape') { document.removeEventListener('keydown', handleKeyDown); modal.remove(); }
                };
                closeBtn.onclick = (e) => { e.stopPropagation(); document.removeEventListener('keydown', handleKeyDown); modal.remove(); };
                prevBtn.onclick = (e) => { e.stopPropagation(); if (currentIndex > 0) { currentIndex--; updateImage(); } };
                nextBtn.onclick = (e) => { e.stopPropagation(); if (currentIndex < photos.length - 1) { currentIndex++; updateImage(); } };
                let touchStartX = 0;
                imgContainer.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
                imgContainer.addEventListener('touchend', (e) => {
                  const dx = e.changedTouches[0].screenX - touchStartX;
                  if (dx < -50 && currentIndex < photos.length - 1) { currentIndex++; updateImage(); }
                  else if (dx > 50 && currentIndex > 0) { currentIndex--; updateImage(); }
                });
                modal.onclick = safeClose;
                // Stop pointer/mouse events bubbling to document so Radix dialogs don't
                // treat them as outside-clicks and close the underlying panel.
                modal.addEventListener('pointerdown', (e) => e.stopPropagation());
                modal.addEventListener('mousedown', (e) => e.stopPropagation());
                document.addEventListener('keydown', handleKeyDown);
                imgContainer.appendChild(img);
                modal.appendChild(closeBtn);
                modal.appendChild(imgContainer);
                modal.appendChild(counter);
                if (photos.length > 1) { modal.appendChild(prevBtn); modal.appendChild(nextBtn); }
                updateImage();
                document.body.appendChild(modal);
              }}
            >
              <img
                src={photo.thumbnailUrl || photo.url}
                alt={photo.filename}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* X button: pointer-events-none when invisible so taps reach the lightbox handler */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 pointer-events-none group-hover/photo:opacity-100 group-hover/photo:pointer-events-auto transition-opacity"
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Select diary photos</p>
                <button
                  type="button"
                  className="text-xs text-blue-600 underline"
                  onClick={() =>
                    selectedUrls.length === diaryPhotos.length
                      ? setSelectedUrls([])
                      : setSelectedUrls([...diaryPhotos])
                  }
                >
                  {selectedUrls.length === diaryPhotos.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto mb-3">
                {diaryPhotos.map((url) => (
                  <div
                    key={url}
                    onClick={() => setSelectedUrls((prev) => prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url])}
                    className={`relative rounded cursor-pointer overflow-hidden border-2 ${selectedUrls.includes(url) ? "border-blue-500" : "border-transparent"}`}
                    style={{ paddingBottom: "100%" }}
                  >
                    <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    {selectedUrls.includes(url) && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" onClick={addFromDiary} disabled={selectedUrls.length === 0} className="w-full">
                Add {selectedUrls.length > 0 ? `${selectedUrls.length} ` : ""}Photo{selectedUrls.length !== 1 ? "s" : ""}
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

// ─── Choice Editor ─────────────────────────────────────────────────────────────

function ChoiceEditor({
  choices,
  onChange,
}: {
  choices: LineItemChoice[];
  onChange: (c: LineItemChoice[]) => void;
}) {
  const add = () =>
    onChange([...choices, { id: `c-${Date.now()}`, label: "", description: "", price: 0 }]);
  const remove = (id: string) => onChange(choices.filter((c) => c.id !== id));
  const update = (id: string, field: keyof LineItemChoice, value: string | number) =>
    onChange(choices.map((c) => c.id === id ? { ...c, [field]: value } : c));

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 font-medium mb-1">Choices</p>
      <div className="space-y-1">
        {choices.map((c) => (
          <div key={c.id} className="flex gap-1 items-center">
            <Input
              value={c.label}
              onChange={(e) => update(c.id, "label", e.target.value)}
              className="h-7 text-xs flex-1"
              placeholder="Label"
            />
            <Input
              type="number"
              value={c.price}
              onChange={(e) => update(c.id, "price", parseFloat(e.target.value) || 0)}
              className="h-7 text-xs w-20"
              placeholder="Price"
            />
            <button type="button" onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-1 text-xs text-blue-500 hover:text-blue-600 hover:underline"
      >
        + Add choice
      </button>
    </div>
  );
}

// ─── Line Items Block ─────────────────────────────────────────────────────────

function LineItemsBlock({
  block,
  materials,
  onUpdate,
  onDraftTotalChange,
}: {
  block: WysiwygBlock;
  materials: Array<{ id: string; name: string; itemNumber?: string; price?: number; category?: string }>;
  onUpdate: (updates: Partial<WysiwygBlock>) => void;
  onDraftTotalChange?: (extra: number) => void;
}) {
  const [draft, setDraft] = useState<DraftLineItem>(defaultDraft());
  const [showAdd, setShowAdd] = useState(false);
  const [matSearch, setMatSearch] = useState("");
  const [showMats, setShowMats] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftLineItem>(defaultDraft());
  const [addRowKey, setAddRowKey] = useState(0);

  // Close the catalogue dropdown when clicking anywhere outside the description cell
  const descCellRef = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    if (!showMats) return;
    const handler = (e: MouseEvent) => {
      if (descCellRef.current && !descCellRef.current.contains(e.target as Node)) {
        setShowMats(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMats]);

  // When opening the add-row or edit-row, scroll it into view so the iOS keyboard doesn't hide it
  useEffect(() => {
    if (!showAdd && !editingId) return;
    const t = setTimeout(() => {
      const el = descCellRef.current;
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const input = el.querySelector("input") as HTMLInputElement | null;
      input?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [showAdd, editingId]);

  // Calculate draft extra (non-optional items being typed should count toward the total immediately)
  const draftExtra = (() => {
    let extra = 0;
    // New item being added (not optional/choice) — include in subtotal live
    if (showAdd && draft.description && draft.pricingType !== "choice" && !draft.isOptional) {
      extra += draftTotal(draft);
    }
    // Existing item being edited — replace its old committed value with the new draft value
    if (editingId && editDraft.description && editDraft.pricingType !== "choice" && !editDraft.isOptional) {
      const original = block.lineItems.find((i) => i.id === editingId);
      if (original && original.selected && !original.isOptional) {
        extra -= (original.priceIncludesTax ? original.totalPrice / 1.15 : original.totalPrice);
      }
      extra += draftTotal(editDraft);
    }
    return extra;
  })();

  // Notify parent so overall totals reflect the draft
  useEffect(() => {
    onDraftTotalChange?.(draftExtra);
  }, [draftExtra, onDraftTotalChange]);

  const subtotal = calcBlockSubtotal(block) + draftExtra;

  const filteredMats = materials.filter(
    (m) => !matSearch || m.name?.toLowerCase().includes(matSearch.toLowerCase()) || String(m.itemNumber || "").includes(matSearch)
  );

  const selectMaterial = (m: typeof materials[0]) => {
    // Catalogue price is the sell price (ex GST); cost = sell price, markup = 0
    const sellPrice = typeof m.price === "string" ? parseFloat(m.price as string) || 0 : m.price || 0;
    setDraft((prev) => ({
      ...prev,
      itemCode: m.itemNumber || "",
      description: m.name || "",
      costExGst: sellPrice,
      markupPct: 0,
    }));
    setMatSearch(m.name || "");
    setShowMats(false);
  };

  const itemToEdit = (item: LineItem): DraftLineItem => ({
    description: item.description,
    itemCode: item.category || "",
    quantity: item.quantity,
    costExGst: item.costPrice ?? item.unitPrice,
    markupPct: item.markupPct ?? 0,
    pricingType: item.pricingType,
    fixedPrice: item.fixedPrice || 0,
    isOptional: item.isOptional,
    priceIncludesTax: item.priceIncludesTax || false,
    choices: item.choices || [],
  });

  const draftToItem = (d: DraftLineItem, existing?: LineItem): LineItem => {
    const priceExGst = draftPriceExGst(d);
    const total = d.pricingType === "choice"
      ? (d.choices.find((c) => c.isDefault)?.price || d.choices[0]?.price || 0)
      : draftTotal(d);
    return {
      id: existing?.id || `item-${Date.now()}`,
      description: d.description,
      quantity: d.quantity,
      unitPrice: priceExGst,
      totalPrice: total,
      unit: existing?.unit || "each",
      category: d.itemCode,
      isOptional: d.isOptional,
      selected: existing?.selected !== undefined ? existing.selected : true,
      pricingType: d.pricingType,
      choices: d.choices,
      fixedPrice: d.pricingType === "fixed" ? d.fixedPrice : undefined,
      priceIncludesTax: d.priceIncludesTax,
      costPrice: d.costExGst,
      markupPct: d.markupPct,
    };
  };

  const commitDraft = () => {
    if (!draft.description) return;
    onUpdate({ lineItems: [...block.lineItems, draftToItem(draft)] });
    setDraft(defaultDraft());
    setMatSearch("");
    setAddRowKey((k) => k + 1); // Remount add row so autoFocus re-fires on the description field
  };

  const removeItem = (id: string) => onUpdate({ lineItems: block.lineItems.filter((i) => i.id !== id) });

  const startEdit = (item: LineItem) => {
    setEditingId(item.id ?? null);
    setEditDraft(itemToEdit(item));
  };

  const commitEdit = () => {
    if (!editingId) return;
    onUpdate({
      lineItems: block.lineItems.map((i) => i.id !== editingId ? i : draftToItem(editDraft, i)),
    });
    setEditingId(null);
  };

  // Shared row editor for add/edit
  function RowEditor({
    d,
    setD,
    onCommit,
    onCancel,
    matSearchVal,
    setMatSearchVal,
  }: {
    d: DraftLineItem;
    setD: (fn: (prev: DraftLineItem) => DraftLineItem) => void;
    onCommit: () => void;
    onCancel: () => void;
    matSearchVal: string;
    setMatSearchVal: (v: string) => void;
  }) {
    const priceEx = draftPriceExGst(d);
    const total = draftTotal(d);
    return (
      <>
        <tr className="bg-blue-50/60">
          <td className="hidden sm:table-cell border border-gray-200 px-1 py-1">
            <Input
              value={d.itemCode}
              onChange={(e) => setD((prev) => ({ ...prev, itemCode: e.target.value }))}
              className="h-7 text-xs"
              placeholder="Code"
            />
          </td>
          <td ref={descCellRef} className="border border-gray-200 px-1 py-1 relative">
            <Input
              value={matSearchVal || d.description}
              onChange={(e) => {
                setMatSearchVal(e.target.value);
                setD((prev) => ({ ...prev, description: e.target.value }));
                setShowMats(true);
              }}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowMats(false); e.currentTarget.blur(); } }}
              className="h-7 text-xs"
              placeholder="Description or catalogue search…"
              autoFocus={!editingId}
            />
            {showMats && filteredMats.length > 0 && (
              <div className="absolute top-full left-0 z-50 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto mt-0.5">
                {filteredMats.slice(0, 20).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent blur before click fires
                      selectMaterial(m);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 text-left"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400">
                      ${typeof m.price === "number" ? m.price.toFixed(2) : parseFloat(m.price as string || "0").toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </td>
          <td className="border border-gray-200 px-1 py-1">
            <Input
              type="text"
              inputMode="numeric"
              value={d.quantity}
              onChange={(e) => setD((prev) => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
              className="h-7 text-xs text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </td>
          <td className="hidden sm:table-cell border border-gray-200 px-1 py-1">
            {d.pricingType === "fixed" ? (
              <Input
                type="number"
                value={d.fixedPrice === 0 ? '' : d.fixedPrice}
                onChange={(e) => setD((prev) => ({ ...prev, fixedPrice: parseFloat(e.target.value) || 0 }))}
                onBlur={() => { if (d.description?.trim() && (d.quantity || 0) > 0 && (d.fixedPrice || 0) > 0) { onCommit(); onCancel(); } }}
                className="h-7 text-xs text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder=""
              />
            ) : (
              <Input
                type="number"
                value={d.costExGst === 0 ? '' : d.costExGst}
                onChange={(e) => setD((prev) => ({ ...prev, costExGst: parseFloat(e.target.value) || 0 }))}
                onBlur={() => { if (d.description?.trim() && (d.quantity || 0) > 0 && (d.costExGst || 0) > 0) { onCommit(); onCancel(); } }}
                className="h-7 text-xs text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder=""
              />
            )}
          </td>
          <td className="hidden sm:table-cell border border-gray-200 px-1 py-1">
            {d.pricingType !== "fixed" ? (
              <div className="flex items-center">
                <Input
                  type="number"
                  value={d.markupPct}
                  onChange={(e) => setD((prev) => ({ ...prev, markupPct: parseFloat(e.target.value) || 0 }))}
                  className="h-7 text-xs text-right"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 ml-0.5">%</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400 px-2">—</span>
            )}
          </td>
          <td className="hidden sm:table-cell border border-gray-200 px-2 py-1 text-right text-xs text-gray-700">
            {d.pricingType === "choice" ? "varies" : fmtNZD(priceEx)}
          </td>
          <td className="border border-gray-200 px-2 py-1 text-right text-xs font-medium">
            {d.pricingType === "choice" ? (
              "varies"
            ) : (
              <>
                {/* Mobile: editable fixed-price input (since cost/markup columns are hidden) */}
                <Input
                  type="number"
                  inputMode="decimal"
                  value={d.fixedPrice === 0 ? '' : d.fixedPrice}
                  onChange={(e) => setD((prev) => ({
                    ...prev,
                    pricingType: "fixed",
                    fixedPrice: parseFloat(e.target.value) || 0,
                  }))}
                  onBlur={() => { if (d.description?.trim() && (d.quantity || 0) > 0 && (d.fixedPrice || 0) > 0) { onCommit(); onCancel(); } }}
                  className="sm:hidden h-7 text-xs text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0.00"
                />
                {/* Desktop: read-only computed total */}
                <span className="hidden sm:inline">{fmtNZD(total)}</span>
              </>
            )}
          </td>
          <td className="border border-gray-200 px-1 py-1 align-top">
            <div className="flex gap-1">
              <button type="button" onClick={onCommit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
        {/* Pricing type selector */}
        <tr className="bg-blue-50/40">
          <td colSpan={8} className="border border-gray-200 px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Pricing:</span>
                <Select
                  value={d.pricingType}
                  onValueChange={(v) => setD((prev) => ({ ...prev, pricingType: v as PricingType }))}
                >
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="choice">Choice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {d.pricingType !== "choice" && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Price entered:</span>
                  <button
                    type="button"
                    onClick={() => setD((prev) => ({ ...prev, priceIncludesTax: false }))}
                    className={`px-1.5 py-0.5 text-xs rounded transition-colors ${!d.priceIncludesTax ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    ex GST
                  </button>
                  <button
                    type="button"
                    onClick={() => setD((prev) => ({ ...prev, priceIncludesTax: true }))}
                    className={`px-1.5 py-0.5 text-xs rounded transition-colors ${d.priceIncludesTax ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    inc GST
                  </button>
                </div>
              )}
              {d.pricingType === "choice" && (
                <div className="flex-1">
                  <ChoiceEditor
                    choices={d.choices}
                    onChange={(choices) => setD((prev) => ({ ...prev, choices }))}
                  />
                </div>
              )}
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <div className="px-0 py-0">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-green-50">
          <tr>
            <th className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600 w-20">Item Code</th>
            <th className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600">Item Name</th>
            <th className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-600 w-10">Qty</th>
            <th className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">Cost ex GST</th>
            <th className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 w-20">Markup</th>
            <th className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 w-24">Price ex GST</th>
            <th className="border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-600 w-24">Total ex GST</th>
            <th className="border border-gray-200 px-1 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {block.lineItems.map((item) =>
            editingId === item.id ? (
              <Fragment key={item.id + "-edit"}>
                {RowEditor({
                  d: editDraft,
                  setD: (fn) => setEditDraft((prev) => fn(prev)),
                  onCommit: commitEdit,
                  onCancel: () => setEditingId(null),
                  matSearchVal: matSearch,
                  setMatSearchVal: setMatSearch,
                })}
              </Fragment>
            ) : (
              <tr
                key={item.id}
                className="hover:bg-gray-50 cursor-pointer group/row"
                onClick={() => startEdit(item)}
              >
                <td className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-xs text-gray-500">{item.category || "—"}</td>
                <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900 font-medium">
                  {item.description}
                  {item.pricingType === "choice" && <span className="ml-1 text-xs text-blue-500">(choice)</span>}
                  {item.isOptional && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
                </td>
                <td className="border border-gray-200 px-2 py-2 text-center text-sm text-gray-700">{item.quantity}</td>
                <td className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-right text-sm text-gray-600">{fmtNZD(item.costPrice ?? item.unitPrice)}</td>
                <td className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-right text-sm text-gray-600">
                  {item.markupPct ? fmtPct(item.markupPct) : "—"}
                </td>
                <td className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-right text-sm text-gray-700">{fmtNZD(item.unitPrice)}</td>
                <td className="border border-gray-200 px-2 py-2 text-right text-sm font-semibold text-gray-900">{fmtNZD(item.totalPrice)}</td>
                <td className="border border-gray-200 px-1 py-2">
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
            <Fragment key={`add-row-${addRowKey}`}>
              {RowEditor({
                d: draft,
                setD: (fn) => setDraft((prev) => fn(prev)),
                onCommit: commitDraft,
                onCancel: () => { setShowAdd(false); setDraft(defaultDraft()); setMatSearch(""); },
                matSearchVal: matSearch,
                setMatSearchVal: setMatSearch,
              })}
            </Fragment>
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
            <td className="hidden sm:table-cell" colSpan={5} />
            <td className="sm:hidden" colSpan={1} />
            <td className="hidden sm:table-cell border border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">SUBTOTAL</td>
            <td className="sm:hidden border border-gray-200 px-2 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">SUBTOTAL</td>
            <td className="border border-gray-200 px-2 py-2 text-right text-sm font-bold text-gray-900">{fmtNZD(subtotal)}</td>
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
  lineItems: incomingLineItems,
}: ProposalBuilderV2Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: templateData } = useQuery({ queryKey: ["/api/templates/default/proposal"], enabled: isOpen });
  const { data: jobData } = useQuery({ queryKey: ["/api/jobs", jobId], enabled: !!jobId && isOpen });
  const { data: customerData } = useQuery({ queryKey: ["/api/customers", customerId], enabled: !!customerId && isOpen });
  const { data: diaryData } = useQuery({ queryKey: ["/api/jobs", jobId, "diary"], enabled: !!jobId && isOpen });
  const { data: jobPhotosData } = useQuery({ queryKey: ["/api/jobs", jobId, "photos"], enabled: !!jobId && isOpen });
  const { data: existingData } = useQuery({
    queryKey: ["/api/proposals", proposalId],
    enabled: !!proposalId && mode === "edit" && isOpen,
    staleTime: 0,
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
    const all: string[] = [];
    // Diary entry photos
    if ((diaryData as { success?: boolean })?.success) {
      const entries = (diaryData as { success: boolean; data: Array<{ photos?: string[]; photoUrl?: string }> }).data || [];
      entries.forEach((e) => {
        if (e.photos) all.push(...e.photos);
        if (e.photoUrl) all.push(e.photoUrl);
      });
    }
    // Job before/after photos uploaded via job card
    const jpd = jobPhotosData as { beforePhotos?: string[]; afterPhotos?: string[] } | null;
    if (jpd?.beforePhotos) all.push(...jpd.beforePhotos);
    if (jpd?.afterPhotos) all.push(...jpd.afterPhotos);
    return [...new Set(all.filter(Boolean))];
  })();

  // ── Local state ────────────────────────────────────────────────────────────

  const [blocks, setBlocks] = useState<WysiwygBlock[]>([]);
  const [proposalTitle, setProposalTitle] = useState("Treemarkables Quote");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewSelectedChoices, setPreviewSelectedChoices] = useState<Record<string, string>>({});
  const [previewSelectedOptional, setPreviewSelectedOptional] = useState<Record<string, boolean>>({});
  const [previewServerData, setPreviewServerData] = useState<{ sections: Array<{
    id: string; title: string; description: string;
    photos: UploadedPhoto[]; lineItems: LineItem[];
    sortOrder: number; sectionType?: SectionType;
  }> } | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [taxRate] = useState(15);
  const [draftTotalExtra, setDraftTotalExtra] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", subject: "", message: "" });
  const [smsForm, setSmsForm] = useState({ to: "", message: "" });
  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const initCreateRef = useRef(false);
  const initEditRef = useRef<string | null>(null);
  const editHasLineItemsRef = useRef(false);

  // ── Initialization guards ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      initCreateRef.current = false;
      initEditRef.current = null;
      editHasLineItemsRef.current = false;
      setDraftId(null);
      setBlocks([]);
      setProposalTitle("Treemarkables Quote");
      setDiscountAmount(0);
      setDiscountType("fixed");
      setValidUntil("");
      setPreviewMode(false);
      setPreviewServerData(null);
    }
  }, [isOpen]);

  useEffect(() => { initEditRef.current = null; editHasLineItemsRef.current = false; }, [proposalId]);

  // Initialize from existing proposal (edit mode)
  useEffect(() => {
    if (!existingData || !(existingData as { success?: boolean }).success || mode !== "edit" || !isOpen) return;
    // Wait for job data when a jobId is associated, so we can auto-import line items.
    // Only wait if jobId prop is set (meaning the job query is enabled and will return data).
    const linkedJobId = (existingData as { data?: { jobId?: string } }).data?.jobId;
    if (linkedJobId && jobId && !job) return;
    const key = `${proposalId}-${isOpen}`;

    // Check if incoming data has any line items
    const incomingSections = Array.isArray((existingData as { data: Record<string, unknown> }).data?.sections)
      ? ((existingData as { data: Record<string, unknown> }).data.sections as Array<{ lineItems?: unknown[] }>)
      : [];
    const incomingHasLineItems = incomingSections.some(s => (s.lineItems || []).length > 0);

    // Guard: skip re-init if already loaded for this key, UNLESS the server now has
    // line items that we missed on the first load (e.g. server just synthesised them from job data).
    if (initEditRef.current === key && (editHasLineItemsRef.current || !incomingHasLineItems)) return;
    initEditRef.current = key;
    if (incomingHasLineItems) editHasLineItemsRef.current = true;

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
        sectionType?: SectionType;
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
          costPrice: item.costPrice ? parseFloat(item.costPrice as string) : undefined,
          markupPct: item.markupPct ? parseFloat(item.markupPct as string) : undefined,
        }));
        return {
          id: s.id || `block-${idx}`,
          type: inferBlockType({ description: s.description || "", photos, lineItems }),
          title: s.title || "",
          description: s.description || "",
          photos,
          lineItems,
          sortOrder: s.sortOrder ?? idx,
          sectionType: s.sectionType || "fixed",
        };
      });

      // Auto-import job line items if any Line Items block is empty and the job has items
      const jobLineItems: IncomingLineItemRaw[] = Array.isArray((job as { lineItems?: IncomingLineItemRaw[] } | null)?.lineItems)
        ? ((job as { lineItems: IncomingLineItemRaw[] }).lineItems)
        : [];
      if (jobLineItems.length > 0 && !editHasLineItemsRef.current) {
        const filled = loadedBlocks.map((b) => {
          const normTitle = b.title.toLowerCase();
          const isLineItemsBlock =
            b.type === "lineItems" ||
            normTitle.includes("line item") ||
            normTitle === "items" ||
            normTitle === "pricing" ||
            normTitle === "services" ||
            normTitle === "quote";
          if (isLineItemsBlock && b.lineItems.length === 0) {
            const imported: LineItem[] = jobLineItems.map((item, idx) => {
              const qty = parseFloat(String(item.quantity ?? 1)) || 1;
              const rawTotal = parseFloat(String(
                (item as { totalPrice?: string | number }).totalPrice ??
                (item as { total?: string | number }).total ??
                item.price ?? 0
              )) || 0;
              const rawUnit = parseFloat(String(item.unitPrice ?? item.price ?? 0)) || 0;
              const unitPrice = rawUnit || (rawTotal > 0 ? rawTotal / qty : 0);
              const total = rawTotal || (qty * unitPrice);
              return {
                id: item.id || `import-${idx}`,
                description: item.description || item.name || "",
                quantity: qty,
                unitPrice,
                totalPrice: total || qty * unitPrice,
                unit: item.unit || "each",
                category: item.category || item.itemCode || "",
                isOptional: item.isOptional || false,
                selected: true,
                pricingType: item.pricingType || "normal",
                choices: item.choices || [],
                priceIncludesTax: item.priceIncludesTax || false,
                costPrice: parseFloat(String(item.costPrice ?? 0)) || unitPrice,
                markupPct: parseFloat(String(item.markupPct ?? 0)) || 0,
              };
            });
            return { ...b, lineItems: imported };
          }
          return b;
        });
        setBlocks(filled);
      } else {
        setBlocks(loadedBlocks);
      }
    }
  }, [existingData, job, mode, isOpen, proposalId]);

  // Initialize from job data (create mode) — includes lineItems prefill from parent
  useEffect(() => {
    if (!isOpen || mode !== "create") return;
    if (initCreateRef.current) return;
    // Wait for at least job data or confirm no job
    if (jobId && !job) return;
    initCreateRef.current = true;

    setProposalTitle((job as { title?: string } | null)?.title || "Treemarkables Quote");

    const includeDesc = (job as { includeDescriptionInQuotesProposals?: boolean } | null)?.includeDescriptionInQuotesProposals !== false;
    const desc = includeDesc ? (jobDescription || (job as { description?: string } | null)?.description || "") : "";

    const builtBlocks: WysiwygBlock[] = [];

    // Block 1: description
    builtBlocks.push({
      id: "block-desc",
      type: "description",
      title: (job as { serviceType?: string } | null)?.serviceType || "Job Description",
      description: desc,
      photos: [],
      lineItems: [],
      sortOrder: 0,
    });

    // Block 2: prefill line items — first from parent prop, then from job JSONB as fallback
    const propItems = Array.isArray(incomingLineItems) && (incomingLineItems as unknown[]).length > 0
      ? incomingLineItems as IncomingLineItemRaw[]
      : null;
    const jobJsonbItems = Array.isArray((job as { lineItems?: IncomingLineItemRaw[] } | null)?.lineItems)
      ? (job as { lineItems: IncomingLineItemRaw[] }).lineItems
      : null;
    const rawItems = propItems ?? jobJsonbItems;
    if (rawItems && rawItems.length > 0) {
      const items: LineItem[] = rawItems.map((item, idx) => {
        const qty = parseFloat(String(item.quantity ?? 1)) || 1;
        const rawTotal = parseFloat(String(
          (item as { totalPrice?: string | number }).totalPrice ??
          (item as { total?: string | number }).total ?? 0
        )) || 0;
        const rawUnit = parseFloat(String(item.unitPrice ?? item.price ?? 0)) || 0;
        const unitPrice = rawUnit || (rawTotal > 0 ? rawTotal / qty : 0);
        const totalPrice = (qty * unitPrice) || rawTotal;
        const costPrice = parseFloat(String(item.costPrice ?? 0)) || unitPrice;
        return {
          id: item.id || `prefill-${idx}`,
          description: item.description || item.name || "",
          quantity: qty,
          unitPrice,
          totalPrice,
          unit: item.unit || "each",
          category: item.category || item.itemCode || "",
          isOptional: item.isOptional || false,
          selected: true,
          pricingType: item.pricingType || "normal",
          choices: item.choices || [],
          priceIncludesTax: item.priceIncludesTax || false,
          costPrice,
          markupPct: parseFloat(String(item.markupPct ?? 0)) || 0,
        };
      });
      builtBlocks.push({
        id: "block-lineitems",
        type: "lineItems",
        title: "Line Items",
        description: "",
        photos: [],
        lineItems: items,
        sortOrder: 1,
      });
    }

    setBlocks((cur) => {
      const hasContent = cur.some((b) => b.lineItems.length > 0 || b.photos.length > 0 || b.description);
      return hasContent ? cur : builtBlocks;
    });
  }, [job, isOpen, mode, jobDescription, incomingLineItems, jobId]);

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
      if (afterIndex !== undefined && afterIndex >= 0) next.splice(afterIndex + 1, 0, newBlock);
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

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  const handleDrop = useCallback((toId: string) => {
    if (!draggingId || draggingId === toId) return;
    setBlocks((prev) => {
      const fromIdx = prev.findIndex((b) => b.id === draggingId);
      const toIdx = prev.findIndex((b) => b.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next.map((b, i) => ({ ...b, sortOrder: i }));
    });
    setDraggingId(null);
    setDragOverId(null);
  }, [draggingId]);

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totals = calcTotals(blocks);
  const subtotalWithDraft = totals.subtotal + draftTotalExtra;
  const discountValue = discountType === "percentage" ? (subtotalWithDraft * discountAmount) / 100 : discountAmount;
  const subtotalAfterDiscount = Math.max(0, subtotalWithDraft - discountValue);
  const gst = subtotalAfterDiscount * (taxRate / 100);
  const grandTotal = subtotalAfterDiscount + gst;

  // ── Save / Auto-save ───────────────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    const actualCustomerId = (customer as { id?: string } | null)?.id || customerId;
    const actualJobId = (job as { id?: string } | null)?.id || jobId;
    return {
      customerId: actualCustomerId,
      jobId: actualJobId,
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
        sectionType: b.sectionType ?? "fixed",
      })),
    };
  }, [blocks, proposalTitle, customer, customerId, job, jobId, subtotalAfterDiscount, gst, grandTotal, taxRate, discountValue, discountType, validUntil]);

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
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    mutationFn: async (d: { to: string; message: string; jobId?: string; customerId?: string; proposalId?: string }) => {
      const res = await apiRequest("POST", "/api/communications/sms", d);
      return await res.json();
    },
    onSuccess: () => { setShowSmsDialog(false); setSmsForm({ to: "", message: "" }); },
    onError: (err: Error) => toast({ title: "SMS Failed", description: err.message || "Failed to send SMS", variant: "destructive" }),
  });

  // Ensure job is saved before saving proposal
  const ensureJobSaved = useCallback(async (): Promise<string | null> => {
    if (onRequestJobSave && !jobId) {
      try {
        const savedJobId = await onRequestJobSave();
        return savedJobId;
      } catch {
        toast({ title: "Job Save Failed", description: "Could not save the job before sending.", variant: "destructive" });
        return null;
      }
    }
    return jobId || null;
  }, [onRequestJobSave, jobId, toast]);

  const ensureDraftSaved = useCallback(async (): Promise<string | null> => {
    if (draftId) return draftId;
    const resolvedJobId = await ensureJobSaved();
    if (onRequestJobSave && !resolvedJobId) return null;
    setAutoSaveStatus("saving");
    try {
      const payload = buildPayload();
      const res = await saveDraftMutation.mutateAsync({ ...payload, jobId: resolvedJobId || payload.jobId });
      const id = res?.data?.id || res?.id;
      if (id) {
        setDraftId(id);
        return id;
      }
    } catch {
      toast({ title: "Save Failed", description: "Could not save proposal.", variant: "destructive" });
    }
    return null;
  }, [draftId, ensureJobSaved, buildPayload, saveDraftMutation, onRequestJobSave, toast]);

  const initEmailForm = useCallback(() => {
    const email = customEmail || (job as { jobContactEmail?: string } | null)?.jobContactEmail || (customer as { email?: string } | null)?.email || "";
    setEmailForm({ to: email, cc: "", subject: "Treemarkables Quote", message: "Thank you for your inquiry, we are pleased to provide you with the following proposal." });
  }, [customEmail, job, customer]);

  const initSmsForm = useCallback(() => {
    const phone = (customer as { phone?: string } | null)?.phone || (job as { jobContactMobile?: string } | null)?.jobContactMobile || (job as { jobContactPhone?: string } | null)?.jobContactPhone || "";
    const name = (customer as { name?: string } | null)?.name || "Valued Customer";
    const first = name.split(" ")[0];
    const link = draftId ? `https://app.treemarkables.co.nz/proposal/${draftId}` : "";
    setSmsForm({
      to: phone,
      message: link
        ? `Hi ${first}, your proposal is ready! Total: ${fmtNZD(grandTotal)}. View: ${link}\nJules\nTreemarkables`
        : `Hi ${first}, your proposal is ready! Total: ${fmtNZD(grandTotal)}.\nJules\nTreemarkables`,
    });
  }, [customer, job, draftId, grandTotal]);

  const handleSendEmail = async () => {
    if (!emailForm.to.trim() || !emailForm.subject.trim()) {
      toast({ title: "Missing Information", description: "Please enter recipient email and subject.", variant: "destructive" });
      return;
    }
    const effectiveDraftId = await ensureDraftSaved();
    if (!effectiveDraftId) return;
    await sendEmailMutation.mutateAsync({ proposalId: effectiveDraftId, to: emailForm.to, subject: emailForm.subject, message: emailForm.message, cc: emailForm.cc });
  };

  const handleSendSms = async () => {
    if (!smsForm.to.trim() || !smsForm.message.trim()) {
      toast({ title: "Missing Information", description: "Please enter phone number and message.", variant: "destructive" });
      return;
    }
    // Ensure draft is persisted before sending (same pattern as email) so proposalId/link is valid
    const effectiveDraftId = await ensureDraftSaved();
    const resolvedCustomerId = (customer as { id?: string } | null)?.id || customerId;
    await sendSmsMutation.mutateAsync({
      to: smsForm.to,
      message: smsForm.message,
      jobId,
      customerId: resolvedCustomerId,
      proposalId: effectiveDraftId || undefined,
    });
  };

  const handleClose = async () => {
    if (autoSaveStatus === "unsaved") {
      setAutoSaveStatus("saving");
      try { await saveDraftMutation.mutateAsync(buildPayload()); } catch { /* close anyway */ }
    }
    onClose();
  };

  // ── VIP check ──────────────────────────────────────────────────────────────

  const vip = customer as { isVipMember?: boolean; name?: string; vipDiscountPercent?: string } | null;
  const isVip = vip?.isVipMember;

  // ── Company/header data ────────────────────────────────────────────────────

  const companyName = (template?.companyName as string) || "Treemarkables";
  const companyAddress = (template?.companyAddress as string) || "";
  const companyPhone = (template?.companyPhone as string) || "";
  const companyEmail = (template?.companyEmail as string) || "";
  const gstNumber = (template?.gstNumber as string) || "";
  const logoUrl = (template?.logoUrl as string) || LOGO_URL;

  // Logo sizing — stored on the proposal template, editable inline
  const [logoSize, setLogoSize] = useState<number>((template?.logoSize as number) ?? 80);
  const liveLogoSizeRef = useRef(logoSize);
  liveLogoSizeRef.current = logoSize;
  const [headerHeight, setHeaderHeight] = useState<number>(() => {
    const saved = localStorage.getItem("proposalHeaderHeight");
    return saved ? parseInt(saved, 10) : 120;
  });
  const [logoPopoverOpen, setLogoPopoverOpen] = useState(false);
  useEffect(() => {
    if (template?.logoSize != null) setLogoSize(template.logoSize as number);
  }, [template?.logoSize]);
  const saveLogoSizeMutation = useMutation({
    mutationFn: (size: number) => {
      const tplId = (template as { id?: string } | null)?.id;
      if (!tplId) return Promise.resolve();
      return apiRequest("PUT", `/api/templates/${tplId}`, { logoSize: size });
    },
  });

  const proposalDate = new Date();
  const proposalNum = draftId ? `#${draftId.slice(-6).toUpperCase()}` : "#—";

  const customerName = (customer as { name?: string } | null)?.name || (job as { clientName?: string } | null)?.clientName || "";
  const customerCompany = (customer as { company?: string } | null)?.company || "";
  const customerAddress = [
    (job as { address?: string } | null)?.address || (customer as { address?: string } | null)?.address,
    (job as { city?: string } | null)?.city || (customer as { city?: string } | null)?.city,
    (job as { region?: string } | null)?.region || (customer as { region?: string } | null)?.region,
  ].filter(Boolean).join(", ");

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-full h-screen sm:h-[95vh] sm:max-w-5xl overflow-hidden flex flex-col p-0 gap-0">
          {/* ── Toolbar ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b bg-white" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
            {previewMode ? (
              /* Preview mode toolbar */
              <>
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Edit
                </button>
                <span className="text-sm font-medium text-gray-500">Customer Preview</span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              /* Edit mode toolbar */
              <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
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
              {draftId && (
                <button
                  type="button"
                  onClick={async () => {
                    // Save for persistence, but always use the client-side blocks for display
                    // (server round-trip can return stale/empty data due to sectionId timing)
                    try { await saveDraftMutation.mutateAsync(buildPayload()); } catch { /* save errors don't block preview */ }
                    setPreviewServerData(null); // Always use blocks.map() fallback
                    setPreviewSelectedChoices({});
                    setPreviewSelectedOptional({});
                    setPreviewMode(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                  title="Preview customer view"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                        <Select value={discountType} onValueChange={(v) => setDiscountType(v as "fixed" | "percentage")}>
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">$ Fixed</SelectItem>
                            <SelectItem value="percentage">% Percent</SelectItem>
                          </SelectContent>
                        </Select>
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
              </>
            )}
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

          {/* ── Preview Mode ── */}
          {previewMode && template && (
            <div className="flex-1 overflow-y-auto bg-gray-100 px-2 py-4 sm:px-6 sm:py-6">
              <ProposalTemplate
                template={template as DocumentTemplate}
                proposal={({
                  id: draftId || "",
                  customerId: (customer as { id?: string } | null)?.id || customerId || "",
                  jobId: (job as { id?: string } | null)?.id || jobId || null,
                  title: proposalTitle,
                  subtotal: subtotalAfterDiscount.toString(),
                  gstAmount: gst.toString(),
                  totalAmount: grandTotal.toString(),
                  taxRate: taxRate.toString(),
                  discountAmount: discountAmount.toString(),
                  discountType,
                  validUntil: validUntil || null,
                  expiryDate: validUntil || null,
                  status: "draft",
                  deliveryMethod: "email",
                  createdBy: "system",
                  proposalNumber: draftId ? draftId.slice(-6).toUpperCase() : "",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  sentAt: null,
                  viewedAt: null,
                  acceptedAt: null,
                  declinedAt: null,
                  acceptedByName: null,
                  acceptedBySignature: null,
                  notes: null,
                  internalNotes: null,
                  presentationMethod: null,
                }) as Proposal}
                customer={customer as Customer | undefined}
                job={job}
                sections={previewServerData?.sections ?? blocks.map((b) => ({
                  id: b.id,
                  title: b.title,
                  description: b.description,
                  photos: b.photos,
                  lineItems: b.lineItems,
                  sortOrder: b.sortOrder,
                  sectionType: b.sectionType ?? "fixed",
                }))}
                showActions={false}
                allowChoiceSelection={true}
                selectedChoices={previewSelectedChoices}
                onChoiceSelect={(lineItemId, choiceId) =>
                  setPreviewSelectedChoices((prev) => ({ ...prev, [lineItemId]: choiceId }))
                }
                selectedOptionalItems={previewSelectedOptional}
                onOptionalToggle={(lineItemId, selected) =>
                  setPreviewSelectedOptional((prev) => ({ ...prev, [lineItemId]: selected }))
                }
              />
            </div>
          )}

          {/* ── Document Canvas ── */}
          {!previewMode && (
          <div className="flex-1 overflow-y-auto bg-gray-100 px-2 py-4 sm:px-6 sm:py-6">
            <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-sm">

              {/* Document Header — height controlled by headerHeight state only */}
              <div className="flex items-center justify-between px-6 sm:px-10 border-b border-gray-200" style={{ height: headerHeight, flexShrink: 0 }}>
                {/* Logo container — resize by dragging the corner handle */}
                <div className="flex items-center h-full py-3" style={{ flexShrink: 0 }}>
                  <div className="relative group/logo">
                    {/* Logo image */}
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      style={{ height: Math.min(logoSize, headerHeight - 8), maxWidth: 600, display: "block" }}
                      className="w-auto object-contain select-none"
                      draggable={false}
                    />

                    {/* Drag-to-resize corner handle */}
                    <div
                      title="Drag to resize logo"
                      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize rounded-tl-md bg-blue-500 flex items-center justify-center opacity-0 group-hover/logo:opacity-80 hover:opacity-100! transition-opacity z-10 shadow"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startSize = liveLogoSizeRef.current;
                        const maxSize = headerHeight - 8;
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        const handleMove = (ev: PointerEvent) => {
                          const dx = ev.clientX - startX;
                          const dy = startY - ev.clientY;
                          const delta = Math.round((dx + dy) / 2);
                          const newSize = Math.max(24, Math.min(maxSize, startSize + delta));
                          setLogoSize(newSize);
                        };
                        const handleUp = () => {
                          saveLogoSizeMutation.mutate(liveLogoSizeRef.current);
                          window.removeEventListener("pointermove", handleMove);
                          window.removeEventListener("pointerup", handleUp);
                        };
                        window.addEventListener("pointermove", handleMove);
                        window.addEventListener("pointerup", handleUp);
                      }}
                    >
                      <svg viewBox="0 0 10 10" className="w-3 h-3 text-white" fill="currentColor">
                        <path d="M0 10 L10 0 L10 10 Z" />
                      </svg>
                    </div>

                    {/* Header height control — small icon trigger */}
                    <Popover open={logoPopoverOpen} onOpenChange={setLogoPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          title="Adjust header height"
                          className="absolute top-0 right-0 w-5 h-5 rounded-bl-md bg-gray-400 flex items-center justify-center opacity-0 group-hover/logo:opacity-70 hover:opacity-100! transition-opacity z-10 shadow focus:outline-none"
                        >
                          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                          </svg>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-3" align="start">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Header height: {headerHeight}px</p>
                        <Slider
                          min={60}
                          max={800}
                          step={8}
                          value={[headerHeight]}
                          onValueChange={([v]) => setHeaderHeight(v)}
                          onValueCommit={([v]) => localStorage.setItem("proposalHeaderHeight", String(v))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>Short</span><span>Tall</span>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
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
                <input
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  className="text-2xl sm:text-3xl font-bold text-orange-600 w-full border-0 border-b-2 border-transparent focus:border-orange-400 focus:outline-none bg-transparent"
                  placeholder="Proposal Title"
                />
              </div>

              {/* Block list */}
              <div className="px-6 sm:px-10 py-2">
                <AddBlockButton onAdd={(type) => addBlock(type, -1)} />

                {blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className={`mb-1 transition-opacity ${draggingId === block.id ? "opacity-40" : ""}`}
                  >
                    <div className={`border-t ${dragOverId === block.id ? "border-blue-300 bg-blue-50/30" : "border-gray-100"}`}>
                      <BlockHeader
                        block={block}
                        onTitleChange={(t) => updateBlock(block.id, { title: t })}
                        onRemove={() => removeBlock(block.id)}
                        onDragStart={() => setDraggingId(block.id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverId(block.id); }}
                        onDrop={(e) => { e.preventDefault(); handleDrop(block.id); }}
                        isDragOver={dragOverId === block.id}
                        onSectionTypeChange={(t) => updateBlock(block.id, { sectionType: t })}
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
                          onDraftTotalChange={setDraftTotalExtra}
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
          )}
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

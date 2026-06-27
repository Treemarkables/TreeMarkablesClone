import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Upload,
  FileText,
  Receipt,
  Trash2,
  Pencil,
  Plus,
  Loader2,
  ExternalLink,
  ArrowRightLeft,
  Check,
  Mail,
  Copy,
} from "lucide-react";

interface SupplierInvoiceManagerProps {
  jobId: string;
}

const COST_CATEGORIES = [
  { value: "materials", label: "Materials" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "equipment", label: "Equipment / hire" },
  { value: "disposal", label: "Disposal" },
  { value: "other", label: "Other" },
];

interface EditableLineItem {
  description: string;
  quantity: string;
  unitCost: string;
  totalCost: string;
  rebill: boolean;
  markupPercent: string;
}

interface FormState {
  id?: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  costCategory: string;
  subtotal: string;
  gst: string;
  total: string;
  rebill: boolean;
  markupPercent: string;
  notes: string;
  lineItems: EditableLineItem[];
  // Stored document reference (set after extraction, preserved through edits)
  documentUrl?: string | null;
  thumbnailUrl?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  rawExtraction?: any;
}

const emptyForm = (): FormState => ({
  supplierName: "",
  invoiceNumber: "",
  invoiceDate: "",
  dueDate: "",
  costCategory: "materials",
  subtotal: "",
  gst: "",
  total: "",
  rebill: false,
  markupPercent: "",
  notes: "",
  lineItems: [],
  documentUrl: null,
  thumbnailUrl: null,
  originalFilename: null,
  mimeType: null,
  fileSize: null,
  rawExtraction: null,
});

const fmt = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n)
    ? n.toLocaleString("en-NZ", { style: "currency", currency: "NZD" })
    : "$0.00";
};

const toIsoDate = (v: any): string => {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export function SupplierInvoiceManager({ jobId }: SupplierInvoiceManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [extracting, setExtracting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Per-job forwarding address. The jobId encodes both the job and (via the job
  // row) the tenant, so a bill emailed/CC'd here lands on this job automatically.
  const forwardingAddress = `bills-${jobId}@jobs.treemarkables.co.nz`;
  const copyForwardingAddress = async () => {
    try {
      await navigator.clipboard.writeText(forwardingAddress);
      setCopiedAddress(true);
      window.setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const { data: listResp, isLoading } = useQuery({
    queryKey: ["/api/jobs", jobId, "supplier-invoices"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/supplier-invoices`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load supplier invoices");
      return res.json();
    },
    enabled: !!jobId,
  });
  const invoices: any[] = (listResp as any)?.data || [];

  const { data: namesResp } = useQuery({
    queryKey: ["/api/supplier-invoices/supplier-names"],
    queryFn: async () => {
      const res = await fetch(`/api/supplier-invoices/supplier-names`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load supplier names");
      return res.json();
    },
  });
  const supplierNames: string[] = (namesResp as any)?.data || [];

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/jobs", jobId, "supplier-invoices"],
    });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    queryClient.invalidateQueries({
      queryKey: ["/api/supplier-invoices/supplier-names"],
    });
    // Supplier costs feed the back-costing rollup; refresh it so margins
    // update the moment a bill is added, edited, deleted, or rebilled.
    queryClient.invalidateQueries({
      queryKey: ["/api/jobs", jobId, "back-costing"],
    });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setExtracting(true);
    // Open the dialog immediately in create mode with a spinner so it feels instant.
    setMode("create");
    setForm(emptyForm());
    setDialogOpen(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/jobs/${jobId}/supplier-invoices/extract`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Extraction failed");
      }
      const { data } = await res.json();
      const ex = data?.extracted || {};
      const doc = data?.document || {};
      const lineItems: EditableLineItem[] = Array.isArray(ex.lineItems)
        ? ex.lineItems.map((li: any) => ({
            description: String(li.description ?? ""),
            quantity: li.quantity != null ? String(li.quantity) : "",
            unitCost: li.unitCost != null ? String(li.unitCost) : "",
            totalCost: li.totalCost != null ? String(li.totalCost) : "",
            rebill: false,
            markupPercent: "",
          }))
        : [];
      setForm({
        ...emptyForm(),
        supplierName: ex.supplierName ?? "",
        invoiceNumber: ex.invoiceNumber ?? "",
        invoiceDate: toIsoDate(ex.invoiceDate),
        dueDate: toIsoDate(ex.dueDate),
        costCategory: COST_CATEGORIES.some((c) => c.value === ex.costCategory)
          ? ex.costCategory
          : "materials",
        subtotal: ex.subtotal != null ? String(ex.subtotal) : "",
        gst: ex.gst != null ? String(ex.gst) : "",
        total: ex.total != null ? String(ex.total) : "",
        lineItems,
        documentUrl: doc.url ?? null,
        thumbnailUrl: doc.thumbnailUrl ?? null,
        originalFilename: doc.originalFilename ?? null,
        mimeType: doc.mimeType ?? null,
        fileSize: doc.fileSize ?? null,
        rawExtraction: ex,
      });
    } catch (e: any) {
      setDialogOpen(false);
      toast({
        title: "Could not read that invoice",
        description: e?.message || "Try a clearer photo, or enter it manually.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const openManual = () => {
    setMode("create");
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (inv: any) => {
    setMode("edit");
    setForm({
      id: inv.id,
      supplierName: inv.supplierName ?? "",
      invoiceNumber: inv.invoiceNumber ?? "",
      invoiceDate: toIsoDate(inv.invoiceDate),
      dueDate: toIsoDate(inv.dueDate),
      costCategory: inv.costCategory ?? "materials",
      subtotal: inv.subtotal != null ? String(inv.subtotal) : "",
      gst: inv.gst != null ? String(inv.gst) : "",
      total: inv.total != null ? String(inv.total) : "",
      rebill: !!inv.rebill,
      markupPercent: inv.markupPercent != null ? String(inv.markupPercent) : "",
      notes: inv.notes ?? "",
      lineItems: (Array.isArray(inv.lineItems) ? inv.lineItems : []).map(
        (li: any) => ({
          description: String(li.description ?? ""),
          quantity: li.quantity != null ? String(li.quantity) : "",
          unitCost: li.unitCost != null ? String(li.unitCost) : "",
          totalCost: li.totalCost != null ? String(li.totalCost) : "",
          rebill: !!li.rebill,
          markupPercent: li.markupPercent != null ? String(li.markupPercent) : "",
        }),
      ),
      documentUrl: inv.documentUrl,
      thumbnailUrl: inv.thumbnailUrl,
      originalFilename: inv.originalFilename,
      mimeType: inv.mimeType,
      fileSize: inv.fileSize,
      rawExtraction: inv.rawExtraction,
    });
    setDialogOpen(true);
  };

  const buildPayload = () => ({
    // A human save (manual entry or reviewing an emailed bill) always confirms it
    // — only the forward-to-inbox webhook leaves bills as pending_review.
    status: "confirmed",
    supplierName: form.supplierName.trim(),
    invoiceNumber: form.invoiceNumber || null,
    invoiceDate: form.invoiceDate || null,
    dueDate: form.dueDate || null,
    costCategory: form.costCategory,
    subtotal: form.subtotal || null,
    gst: form.gst || null,
    total: form.total || "0",
    rebill: form.rebill,
    markupPercent: form.markupPercent || "0",
    notes: form.notes || null,
    documentUrl: form.documentUrl,
    thumbnailUrl: form.thumbnailUrl,
    originalFilename: form.originalFilename,
    mimeType: form.mimeType,
    fileSize: form.fileSize,
    rawExtraction: form.rawExtraction,
    lineItems: form.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity === "" ? null : Number(li.quantity),
      unitCost: li.unitCost === "" ? null : Number(li.unitCost),
      totalCost: li.totalCost === "" ? 0 : Number(li.totalCost),
      rebill: li.rebill,
      markupPercent: li.markupPercent === "" ? null : Number(li.markupPercent),
    })),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.supplierName.trim()) {
        throw new Error("Supplier name is required");
      }
      if (mode === "edit" && form.id) {
        return apiRequest("PATCH", `/api/supplier-invoices/${form.id}`, buildPayload());
      }
      return apiRequest("POST", `/api/jobs/${jobId}/supplier-invoices`, buildPayload());
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
    },
    onError: (e: any) => {
      toast({
        title: "Could not save invoice",
        description: e?.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/supplier-invoices/${id}`),
    onSuccess: () => {
      invalidate();
      setDeletingId(null);
    },
    onError: (e: any) => {
      toast({ title: "Could not delete", description: e?.message, variant: "destructive" });
      setDeletingId(null);
    },
  });

  const rebillMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("POST", `/api/supplier-invoices/${id}/rebill`, {}),
    onSuccess: () => invalidate(),
    onError: (e: any) => {
      toast({
        title: "Could not add to customer charges",
        description: e?.message,
        variant: "destructive",
      });
    },
  });

  // Accept an emailed (pending_review) bill as-is, so it starts counting in back
  // costing without opening the full review dialog.
  const confirmMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("PATCH", `/api/supplier-invoices/${id}`, { status: "confirmed" }),
    onSuccess: () => invalidate(),
    onError: (e: any) => {
      toast({ title: "Could not confirm", description: e?.message, variant: "destructive" });
    },
  });

  const totalCost = invoices.reduce(
    (sum, inv) => sum + (parseFloat(inv.total) || 0),
    0,
  );

  const updateLine = (i: number, patch: Partial<EditableLineItem>) => {
    setForm((f) => {
      const lineItems = [...f.lineItems];
      lineItems[i] = { ...lineItems[i], ...patch };
      return { ...f, lineItems };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-blue-600" />
        <h4 className="font-medium text-gray-800">Supplier Invoices</h4>
        {invoices.length > 0 && (
          <span className="text-xs text-gray-500">
            {invoices.length} • {fmt(totalCost)} total
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Snap a photo or attach a PDF of a supplier bill — it's read automatically.
        Costs feed your job profit; flag lines to rebill the customer with markup.
      </p>

      {/* Forward-to-inbox: email or auto-CC bills straight onto this job. */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <Mail className="h-4 w-4 text-blue-600" />
          Or email bills straight to this job
        </div>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs" title={forwardingAddress}>
            {forwardingAddress}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs shrink-0"
            onClick={copyForwardingAddress}
            data-testid="button-copy-forwarding-address"
          >
            {copiedAddress ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copiedAddress ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Forward a supplier's emailed invoice here, or ask the supplier to CC it.
          It's read automatically and appears above for you to confirm.
        </p>
      </div>

      {/* Capture buttons */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          data-testid="input-supplier-invoice-camera"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          data-testid="input-supplier-invoice-file"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          data-testid="button-supplier-invoice-photo"
        >
          <Camera className="h-4 w-4 mr-1" />
          Photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-supplier-invoice-upload"
        >
          <Upload className="h-4 w-4 mr-1" />
          Photo or PDF
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={openManual}
          data-testid="button-supplier-invoice-manual"
        >
          <Plus className="h-4 w-4 mr-1" />
          Enter manually
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-sm text-gray-400 border border-dashed rounded-lg p-4 text-center">
          No supplier invoices yet.
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const isPdf =
              inv.mimeType === "application/pdf" ||
              String(inv.originalFilename || "").toLowerCase().endsWith(".pdf");
            const catLabel =
              COST_CATEGORIES.find((c) => c.value === inv.costCategory)?.label ||
              inv.costCategory;
            const isPending = inv.status === "pending_review";
            return (
              <div
                key={inv.id}
                className={`flex items-center gap-3 border rounded-lg p-3 bg-card ${
                  isPending ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : ""
                }`}
                data-testid={`supplier-invoice-${inv.id}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    inv.documentUrl && window.open(inv.documentUrl, "_blank")
                  }
                  className="shrink-0 h-12 w-12 rounded-md overflow-hidden bg-muted flex items-center justify-center"
                  title={inv.documentUrl ? "View document" : "No document"}
                >
                  {inv.documentUrl && !isPdf ? (
                    <img
                      src={inv.thumbnailUrl || inv.documentUrl}
                      alt="invoice"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {inv.supplierName}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {catLabel}
                    </Badge>
                    {isPending && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-900">
                        Review — emailed
                      </Badge>
                    )}
                    {inv.rebilledAt && (
                      <Badge className="text-[10px] bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-0.5" /> Rebilled
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {inv.invoiceNumber ? `#${inv.invoiceNumber} • ` : ""}
                    {inv.invoiceDate ? toIsoDate(inv.invoiceDate) + " • " : ""}
                    {fmt(inv.total)}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isPending && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate(inv.id)}
                      title="Accept this emailed bill and count it in back costing"
                      data-testid={`button-confirm-${inv.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                  )}
                  {!isPending && !inv.rebilledAt && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={rebillMutation.isPending}
                      onClick={() => rebillMutation.mutate(inv.id)}
                      title="Add to customer charges (with markup)"
                      data-testid={`button-rebill-${inv.id}`}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Rebill
                    </Button>
                  )}
                  {inv.documentUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(inv.documentUrl, "_blank")}
                      title="View document"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(inv)}
                    data-testid={`button-edit-${inv.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    disabled={deleteMutation.isPending}
                    onClick={() => setDeletingId(inv.id)}
                    data-testid={`button-delete-${inv.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit" ? "Edit supplier invoice" : "Confirm supplier invoice"}
            </DialogTitle>
          </DialogHeader>

          {extracting ? (
            <div className="py-10 flex flex-col items-center gap-3 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-sm">Reading the invoice…</span>
            </div>
          ) : (
            <div className="space-y-4">
              {form.documentUrl && (
                <button
                  type="button"
                  onClick={() => window.open(form.documentUrl!, "_blank")}
                  className="text-xs text-blue-600 inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View uploaded document
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Supplier</Label>
                  <Input
                    list="supplier-name-options"
                    value={form.supplierName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplierName: e.target.value }))
                    }
                    placeholder="e.g. PlaceMakers, Corys Electrical"
                    data-testid="input-supplier-name"
                  />
                  <datalist id="supplier-name-options">
                    {supplierNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label className="text-xs">Invoice #</Label>
                  <Input
                    value={form.invoiceNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, invoiceNumber: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={form.costCategory}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, costCategory: v }))
                    }
                  >
                    <SelectTrigger data-testid="select-cost-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Invoice date</Label>
                  <Input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, invoiceDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Due date</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Line items</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        lineItems: [
                          ...f.lineItems,
                          {
                            description: "",
                            quantity: "",
                            unitCost: "",
                            totalCost: "",
                            rebill: false,
                            markupPercent: "",
                          },
                        ],
                      }))
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add line
                  </Button>
                </div>
                {form.lineItems.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No line items — the total below is used.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.lineItems.map((li, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-12 gap-2 items-center"
                      >
                        <Input
                          className="col-span-5 h-8 text-sm"
                          placeholder="Description"
                          value={li.description}
                          onChange={(e) =>
                            updateLine(i, { description: e.target.value })
                          }
                        />
                        <Input
                          className="col-span-2 h-8 text-sm"
                          placeholder="Qty"
                          inputMode="decimal"
                          value={li.quantity}
                          onChange={(e) =>
                            updateLine(i, { quantity: e.target.value })
                          }
                        />
                        <Input
                          className="col-span-3 h-8 text-sm"
                          placeholder="Line cost"
                          inputMode="decimal"
                          value={li.totalCost}
                          onChange={(e) =>
                            updateLine(i, { totalCost: e.target.value })
                          }
                        />
                        <label className="col-span-1 flex justify-center" title="Rebill to customer">
                          <Checkbox
                            checked={li.rebill}
                            onCheckedChange={(c) =>
                              updateLine(i, { rebill: !!c })
                            }
                          />
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1 h-8 w-8 text-red-600"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              lineItems: f.lineItems.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400">
                      Tick a line to rebill it to the customer.
                    </p>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Subtotal (ex-GST)</Label>
                  <Input
                    inputMode="decimal"
                    value={form.subtotal}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, subtotal: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">GST</Label>
                  <Input
                    inputMode="decimal"
                    value={form.gst}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gst: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Total (inc-GST)</Label>
                  <Input
                    inputMode="decimal"
                    value={form.total}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, total: e.target.value }))
                    }
                    data-testid="input-supplier-total"
                  />
                </div>
              </div>

              {/* Rebill controls */}
              <div className="flex flex-wrap items-center gap-3 border rounded-lg p-3 bg-muted/30">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.rebill}
                    onCheckedChange={(c) =>
                      setForm((f) => ({ ...f, rebill: !!c }))
                    }
                    data-testid="checkbox-rebill-all"
                  />
                  Rebill whole invoice to customer
                </label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Markup %</Label>
                  <Input
                    className="h-8 w-20 text-sm"
                    inputMode="decimal"
                    value={form.markupPercent}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, markupPercent: e.target.value }))
                    }
                    placeholder="0"
                    data-testid="input-markup"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="resize-none text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={extracting || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              data-testid="button-save-supplier-invoice"
            >
              {saveMutation.isPending ? "Saving…" : "Save invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this supplier invoice?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This removes the record from the job. This can't be undone.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

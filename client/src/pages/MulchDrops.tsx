import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Phone,
  MapPin,
  FileText,
  Camera,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  ImageIcon,
  GripVertical,
} from "lucide-react";
import { SiFacebook } from "react-icons/si";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MulchDrop } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────
type Status = "pending" | "delivered" | "cancelled";

// ─── Schemas ─────────────────────────────────────────────────────────────────
const dropFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  dropNotes: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "delivered", "cancelled"]).default("pending"),
  source: z.enum(["manual", "facebook"]).default("manual"),
});
type DropForm = z.infer<typeof dropFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  Status,
  { label: string; icon: typeof Clock; class: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    class:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    class:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

const NEXT_STATUS: Record<Status, Status> = {
  pending: "delivered",
  delivered: "cancelled",
  cancelled: "pending",
};

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${cfg.class}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Drop Card ────────────────────────────────────────────────────────────────
function DropCard({
  drop,
  onEdit,
  onDelete,
  onStatusToggle,
  onPhotoUpload,
  onPhotoDelete,
}: {
  drop: MulchDrop;
  onEdit: (drop: MulchDrop) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, next: Status) => void;
  onPhotoUpload: (id: string, file: File) => void;
  onPhotoDelete: (id: string, url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: drop.id });

  const status = (drop.status ?? "pending") as Status;
  const photos = drop.photos ?? [];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0 flex items-start gap-2">
            <button
              {...attributes}
              {...listeners}
              type="button"
              aria-label="Drag to reorder"
              className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground mt-0.5 -ml-1"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-base">{drop.name}</span>
              {drop.source === "facebook" && (
                <Badge className="gap-1 bg-blue-600 text-white text-xs no-default-active-elevate">
                  <SiFacebook className="h-3 w-3" />
                  Facebook
                </Badge>
              )}
            </div>
            {drop.phone && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                <Phone className="h-3 w-3 shrink-0" />
                <a href={`tel:${drop.phone}`} className="hover:underline">
                  {drop.phone}
                </a>
              </div>
            )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2"
              onClick={() => onStatusToggle(drop.id, NEXT_STATUS[status])}
            >
              <StatusBadge status={status} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {drop.address && (
          <div className="flex items-start gap-1.5 text-sm">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
            <span className="text-foreground">{drop.address}</span>
          </div>
        )}

        {drop.dropNotes && (
          <div className="flex items-start gap-1.5 text-sm">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground">{drop.dropNotes}</span>
          </div>
        )}

        {/* Photo row (max 3 preview) */}
        {photos.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {photos.slice(0, 3).map((url, i) => (
              <div
                key={i}
                className="relative h-16 w-16 rounded-md overflow-hidden border group"
              >
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => onPhotoDelete(drop.id, url)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {photos.length > 3 && (
              <button
                onClick={() => setExpanded(true)}
                className="h-16 w-16 rounded-md border flex items-center justify-center text-xs text-muted-foreground bg-muted/40"
              >
                +{photos.length - 3}
              </button>
            )}
          </div>
        )}

        {/* Expanded photos */}
        {expanded && photos.length > 3 && (
          <div className="flex gap-1.5 flex-wrap">
            {photos.map((url, i) => (
              <div
                key={i}
                className="relative h-20 w-20 rounded-md overflow-hidden border group"
              >
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => onPhotoDelete(drop.id, url)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {drop.notes && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5">
            {drop.notes}
          </p>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPhotoUpload(drop.id, file);
                e.target.value = "";
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              title="Add photo"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onEdit(drop)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => onDelete(drop.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {photos.length > 3 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              className="text-xs gap-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  All photos ({photos.length})
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MulchDrops() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editDrop, setEditDrop] = useState<MulchDrop | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fbOpen, setFbOpen] = useState(false);
  const [fbText, setFbText] = useState("");
  const [fbLoading, setFbLoading] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // ─── Data ───────────────────────────────────────────────────────────────────
  const { data: dropsRes, isLoading } = useQuery<{
    success: boolean;
    data: MulchDrop[];
  }>({
    queryKey: ["/api/mulch-drops"],
  });
  const drops = dropsRes?.data ?? [];
  const filtered =
    statusFilter === "all"
      ? drops
      : drops.filter((d) => d.status === statusFilter);

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: DropForm) =>
      apiRequest("POST", "/api/mulch-drops", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mulch-drops"] });
      setAddOpen(false);
    },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DropForm> }) =>
      apiRequest("PATCH", `/api/mulch-drops/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mulch-drops"] });
      setEditDrop(null);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/mulch-drops/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mulch-drops"] });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`/api/mulch-drops/${id}/photos`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/mulch-drops"] }),
    onError: () =>
      toast({ title: "Photo upload failed", variant: "destructive" }),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: ({ id, photoUrl }: { id: string; photoUrl: string }) =>
      apiRequest("DELETE", `/api/mulch-drops/${id}/photos`, { photoUrl }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/mulch-drops"] }),
    onError: () =>
      toast({ title: "Failed to remove photo", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiRequest("POST", "/api/mulch-drops/reorder", { orderedIds }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/mulch-drops"] }),
    onError: () => {
      toast({ title: "Failed to save new order", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/mulch-drops"] });
    },
  });

  // ─── Drag-and-drop ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex((d) => d.id === active.id);
    const newIndex = filtered.findIndex((d) => d.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(filtered, oldIndex, newIndex);
    const orderedIds = reordered.map((d) => d.id);

    // Optimistic update so the card doesn't snap back while the request flies.
    queryClient.setQueryData<{ success: boolean; data: MulchDrop[] }>(
      ["/api/mulch-drops"],
      (prev) => {
        if (!prev) return prev;
        const visibleSet = new Set(orderedIds);
        let nextIdx = 0;
        const next = prev.data.map((d) => {
          if (!visibleSet.has(d.id)) return d;
          return prev.data.find((x) => x.id === orderedIds[nextIdx++])!;
        });
        return { ...prev, data: next };
      },
    );
    reorderMutation.mutate(orderedIds);
  };

  // ─── Status toggle ──────────────────────────────────────────────────────────
  const handleStatusToggle = (id: string, next: Status) => {
    updateMutation.mutate({ id, data: { status: next } });
  };

  // ─── Screenshot AI extraction ────────────────────────────────────────────────
  const handleScreenshotExtract = async (file: File) => {
    setScreenshotLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/ai/extract-screenshot", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const result = await res.json();
      if (!result.success) throw new Error();
      const { name, phone, address, notes } = result.data ?? {};
      addForm.reset({
        name: name ?? "",
        phone: phone ?? "",
        address: address ?? "",
        dropNotes: "",
        notes: notes ?? "",
        status: "pending",
        source: "facebook",
      });
      setAddOpen(true);
    } catch {
      toast({
        title: "Could not read screenshot — please fill in manually",
        variant: "destructive",
      });
      addForm.reset({
        name: "",
        phone: "",
        address: "",
        dropNotes: "",
        notes: "",
        status: "pending",
        source: "manual",
      });
      setAddOpen(true);
    } finally {
      setScreenshotLoading(false);
    }
  };

  // ─── Facebook AI extraction ─────────────────────────────────────────────────
  const handleFbExtract = async () => {
    if (!fbText.trim()) return;
    setFbLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/extract-facebook-message", {
        messageText: fbText,
      });
      const result = await res.json();
      if (!result.success) throw new Error();
      const { firstName, lastName, phone, address, description } =
        result.data ?? {};
      const name = [firstName, lastName].filter(Boolean).join(" ") || "";
      addForm.reset({
        name,
        phone: phone ?? "",
        address: address ?? "",
        dropNotes: description ?? "",
        notes: fbText.slice(0, 300),
        status: "pending",
        source: "facebook",
      });
      setFbOpen(false);
      setFbText("");
      setAddOpen(true);
    } catch {
      toast({
        title: "Could not extract details — please fill in manually",
        variant: "destructive",
      });
    } finally {
      setFbLoading(false);
    }
  };

  // ─── Add form ────────────────────────────────────────────────────────────────
  const addForm = useForm<DropForm>({
    resolver: zodResolver(dropFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      dropNotes: "",
      notes: "",
      status: "pending",
      source: "manual",
    },
  });

  const handleAddSubmit = (data: DropForm) => createMutation.mutate(data);

  // ─── Edit form ────────────────────────────────────────────────────────────────
  const editForm = useForm<DropForm>({
    resolver: zodResolver(dropFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      dropNotes: "",
      notes: "",
      status: "pending",
      source: "manual",
    },
  });

  const openEdit = (drop: MulchDrop) => {
    setEditDrop(drop);
    editForm.reset({
      name: drop.name,
      phone: drop.phone,
      address: drop.address,
      dropNotes: drop.dropNotes ?? "",
      notes: drop.notes ?? "",
      status: (drop.status ?? "pending") as Status,
      source: (drop.source ?? "manual") as "manual" | "facebook",
    });
  };

  const handleEditSubmit = (data: DropForm) => {
    if (!editDrop) return;
    updateMutation.mutate({ id: editDrop.id, data });
  };

  // ─── Counts ──────────────────────────────────────────────────────────────────
  const counts = {
    all: drops.length,
    pending: drops.filter((d) => d.status === "pending").length,
    delivered: drops.filter((d) => d.status === "delivered").length,
    cancelled: drops.filter((d) => d.status === "cancelled").length,
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Mulch Drops</h1>
          <p className="text-xs text-muted-foreground">
            {drops.length} total orders
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            ref={screenshotInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScreenshotExtract(file);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => screenshotInputRef.current?.click()}
            disabled={screenshotLoading}
          >
            {screenshotLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            From Screenshot
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-blue-600 border-blue-200"
            onClick={() => setFbOpen(true)}
          >
            <SiFacebook className="h-3.5 w-3.5" />
            From Facebook
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              addForm.reset({
                name: "",
                phone: "",
                address: "",
                dropNotes: "",
                notes: "",
                status: "pending",
                source: "manual",
              });
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Drop
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-0 border-b bg-background overflow-x-auto shrink-0">
        {(["all", "pending", "delivered", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              statusFilter === s
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1.5 text-xs tabular-nums">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <p className="text-sm">No mulch drops yet</p>
            <p className="text-xs mt-1">Tap "Add Drop" to create one</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filtered.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="p-3 space-y-3">
                {filtered.map((drop) => (
                  <DropCard
                    key={drop.id}
                    drop={drop}
                    onEdit={openEdit}
                    onDelete={(id) => setDeleteId(id)}
                    onStatusToggle={handleStatusToggle}
                    onPhotoUpload={(id, file) =>
                      uploadPhotoMutation.mutate({ id, file })
                    }
                    onPhotoDelete={(id, photoUrl) =>
                      deletePhotoMutation.mutate({ id, photoUrl })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Mulch Drop</DialogTitle>
          </DialogHeader>
          <Form {...addForm}>
            <form
              onSubmit={addForm.handleSubmit(handleAddSubmit)}
              className="space-y-3"
            >
              <FormField
                control={addForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Phone{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="021 000 0000" type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Delivery Address{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Example St, Auckland"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="dropNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drop Location Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="E.g. leave at the back gate, beside the fence..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any extra notes..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog
        open={!!editDrop}
        onOpenChange={(o) => {
          if (!o) setEditDrop(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Mulch Drop</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-3"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Phone{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Delivery Address{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="dropNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drop Location Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDrop(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mulch Drop?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Facebook Paste Dialog ── */}
      <Dialog open={fbOpen} onOpenChange={setFbOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiFacebook className="h-5 w-5 text-blue-600" />
              Create Drop from Facebook Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste the Facebook message conversation below. AI will extract the
              customer's details to pre-fill the form.
            </p>
            <Textarea
              value={fbText}
              onChange={(e) => setFbText(e.target.value)}
              placeholder="Paste the Facebook conversation here..."
              rows={8}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFbOpen(false);
                setFbText("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFbExtract}
              disabled={!fbText.trim() || fbLoading}
              className="gap-1.5"
            >
              {fbLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SiFacebook className="h-4 w-4" />
              )}
              Extract Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

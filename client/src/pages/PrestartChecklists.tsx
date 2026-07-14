import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Eye, ClipboardList, Loader2, Lock, Pencil, Copy, Settings2 } from "lucide-react";
import { format } from "date-fns";
import type { PrestartChecklistTemplate, PrestartChecklist } from "@shared/schema";
import SignaturePad from "@/components/SignaturePad";

// jsonb shapes are loosely typed in the schema; describe them locally and
// read templates/checklists through intersection types instead of casting.
interface ChecklistItem {
  id: string;
  label: string;
}
type ResultStatus = "pass" | "fail" | "na";
interface ChecklistResult {
  itemId: string;
  label: string;
  status: ResultStatus;
  note?: string;
}

type TemplateWithItems = PrestartChecklistTemplate & { items: ChecklistItem[] };
type ChecklistWithResults = PrestartChecklist & { results: ChecklistResult[] };

// Friendly names for the built-in equipment types; custom types added through
// the template manager fall through to a prettified version of the raw value.
const EQUIPMENT_LABELS: Record<string, string> = {
  chainsaw: "Chainsaw",
  chipper: "Chipper",
  stump_grinder: "Stump grinder",
  ewp: "EWP / MEWP",
  rigging: "Rigging",
  vehicle: "Vehicle",
};

function equipmentLabel(type: string): string {
  const known = EQUIPMENT_LABELS[type];
  if (known) return known;
  const words = type.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const STATUS_OPTIONS: { value: ResultStatus; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
];

export default function PrestartChecklists() {
  const { toast } = useToast();

  const [filterType, setFilterType] = useState<string>("all");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  // All active checklist templates (built-in + this business's custom ones).
  const { data: templatesData } = useQuery<{
    success: boolean;
    data: TemplateWithItems[];
  }>({
    queryKey: ["/api/prestart-templates"],
  });
  const allTemplates = templatesData?.data ?? [];

  // ---- List query ----
  const listUrl =
    filterType === "all"
      ? "/api/prestart-checklists"
      : `/api/prestart-checklists?equipmentType=${filterType}`;

  const { data: listData, isLoading: listLoading } = useQuery<{
    success: boolean;
    data: ChecklistWithResults[];
  }>({
    queryKey: [listUrl],
  });

  const checklists = listData?.data ?? [];

  // ---- New-check form state ----
  const [formType, setFormType] = useState<string>("");
  const [equipmentName, setEquipmentName] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [faultsNoted, setFaultsNoted] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  const [results, setResults] = useState<ChecklistResult[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // Choosing a template drives everything: equipment type comes from the
  // template row, and its items scaffold the results.
  function applyTemplate(templateId: string) {
    const tpl = allTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setActiveTemplateId(tpl.id);
    setFormType(tpl.equipmentType);
    setResults(
      (tpl.items ?? []).map((item) => ({
        itemId: item.id,
        label: item.label,
        status: "pass" as ResultStatus,
        note: "",
      })),
    );
  }

  // Distinct equipment types across templates + recorded checks (covers types
  // whose template was later removed).
  const equipmentTypes = useMemo(() => {
    const types = new Set<string>();
    for (const t of allTemplates) types.add(t.equipmentType);
    for (const c of checklists) types.add(c.equipmentType);
    return Array.from(types).sort();
  }, [allTemplates, checklists]);

  const passed = results.length > 0 && results.every((r) => r.status !== "fail");

  function resetForm() {
    setFormType("");
    setEquipmentName("");
    setOperatorName("");
    setFaultsNoted("");
    setSignatureDataUrl("");
    setResults([]);
    setActiveTemplateId(null);
  }

  function updateResult(itemId: string, patch: Partial<ChecklistResult>) {
    setResults((prev) =>
      prev.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)),
    );
  }

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        templateId: activeTemplateId ?? undefined,
        equipmentType: formType,
        equipmentName: equipmentName || undefined,
        operatorName: operatorName || undefined,
        results,
        passed,
        faultsNoted: faultsNoted || undefined,
        signatureDataUrl: signatureDataUrl || undefined,
        conductedAt: new Date().toISOString(),
      };
      const res = await apiRequest("POST", "/api/prestart-checklists", body);
      return (await res.json()) as { success: boolean; data: PrestartChecklist };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestart-checklists"] });
      setIsNewOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not save pre-start check",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/prestart-checklists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prestart-checklists"] });
      setViewId(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not delete pre-start check",
        description: error.message,
      });
    },
  });

  // ---- Detail query ----
  const { data: detailData } = useQuery<{
    success: boolean;
    data: ChecklistWithResults;
  }>({
    queryKey: [`/api/prestart-checklists/${viewId}`],
    enabled: viewId !== null,
  });
  const detail = detailData?.data;

  function handleSubmit() {
    if (!formType) {
      toast({
        variant: "destructive",
        title: "Checklist required",
        description: "Choose a checklist before saving.",
      });
      return;
    }
    if (results.length === 0) {
      toast({
        variant: "destructive",
        title: "No checklist items",
        description: "The chosen checklist has no items — add some in Templates.",
      });
      return;
    }
    createMutation.mutate();
  }

  function statusBadge(status: ResultStatus) {
    if (status === "fail") {
      return <Badge variant="destructive">Fail</Badge>;
    }
    if (status === "na") {
      return <Badge variant="secondary">N/A</Badge>;
    }
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600">Pass</Badge>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Pre-start Checklists</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setManageOpen(true)}
            data-testid="button-manage-prestart-templates"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Templates
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsNewOpen(true);
            }}
            data-testid="button-new-prestart"
          >
            <Plus className="mr-2 h-4 w-4" />
            New pre-start check
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Equipment</Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-56" data-testid="select-filter-equipment">
            <SelectValue placeholder="All equipment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All equipment</SelectItem>
            {equipmentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {equipmentLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {listLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading checks…
        </div>
      ) : checklists.length === 0 ? (
        <Card className="bg-card border border-border rounded-lg">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8" />
            <p>No pre-start checks recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {checklists.map((c) => (
            <Card
              key={c.id}
              className="bg-card border border-border rounded-lg"
              data-testid={`row-prestart-${c.id}`}
            >
              <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.checkNumber}</span>
                    <Badge variant="outline">
                      {equipmentLabel(c.equipmentType)}
                    </Badge>
                    {c.passed ? (
                      <Badge className="bg-green-600 text-white hover:bg-green-600">
                        Pass
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Faults noted</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {c.equipmentName ? `${c.equipmentName} · ` : ""}
                    {c.conductedAt
                      ? format(new Date(c.conductedAt), "d MMM yyyy")
                      : ""}
                    {c.operatorName ? ` · ${c.operatorName}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewId(c.id)}
                    data-testid={`button-view-${c.id}`}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${c.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New check dialog */}
      <Dialog
        open={isNewOpen}
        onOpenChange={(open) => {
          setIsNewOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New pre-start check</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Checklist</Label>
              <Select
                value={activeTemplateId ?? ""}
                onValueChange={applyTemplate}
              >
                <SelectTrigger data-testid="select-new-equipment">
                  <SelectValue placeholder="Choose a checklist" />
                </SelectTrigger>
                <SelectContent>
                  {allTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formType && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Equipment name</Label>
                    <Input
                      value={equipmentName}
                      onChange={(e) => setEquipmentName(e.target.value)}
                      placeholder="e.g. MS400 #2"
                      data-testid="input-equipment-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Operator name</Label>
                    <Input
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      placeholder="Operator"
                      data-testid="input-operator-name"
                    />
                  </div>
                </div>

                {results.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    This checklist has no items yet — add some in Templates.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Checklist items</Label>
                      {passed ? (
                        <Badge className="bg-green-600 text-white hover:bg-green-600">
                          Pass
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Faults noted</Badge>
                      )}
                    </div>
                    {results.map((r) => (
                      <Card
                        key={r.itemId}
                        className="bg-card border border-border rounded-lg"
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <span className="text-sm font-medium">{r.label}</span>
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((opt) => (
                                <Button
                                  key={opt.value}
                                  type="button"
                                  size="sm"
                                  variant={
                                    r.status === opt.value ? "default" : "outline"
                                  }
                                  onClick={() =>
                                    updateResult(r.itemId, { status: opt.value })
                                  }
                                  data-testid={`status-${r.itemId}-${opt.value}`}
                                >
                                  {opt.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <Input
                            value={r.note ?? ""}
                            onChange={(e) =>
                              updateResult(r.itemId, { note: e.target.value })
                            }
                            placeholder="Note (optional)"
                            data-testid={`note-${r.itemId}`}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Faults noted</Label>
                  <Textarea
                    value={faultsNoted}
                    onChange={(e) => setFaultsNoted(e.target.value)}
                    placeholder="Describe any faults found during the check"
                    data-testid="textarea-faults"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Operator signature</Label>
                  {signatureDataUrl ? (
                    <div className="space-y-2">
                      <img
                        src={signatureDataUrl}
                        alt="Signature"
                        className="border border-border rounded-md bg-white max-h-40"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSignatureDataUrl("")}
                        data-testid="button-clear-saved-signature"
                      >
                        Re-sign
                      </Button>
                    </div>
                  ) : (
                    <SignaturePad onSave={(data) => setSignatureDataUrl(data)} />
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsNewOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-save-prestart"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={viewId !== null} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail
                ? `${detail.checkNumber} · ${equipmentLabel(detail.equipmentType)}`
                : "Pre-start check"}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {detail.equipmentName && <span>{detail.equipmentName}</span>}
                {detail.conductedAt && (
                  <span>
                    {format(new Date(detail.conductedAt), "d MMM yyyy")}
                  </span>
                )}
                {detail.operatorName && <span>{detail.operatorName}</span>}
                {detail.passed ? (
                  <Badge className="bg-green-600 text-white hover:bg-green-600">
                    Pass
                  </Badge>
                ) : (
                  <Badge variant="destructive">Faults noted</Badge>
                )}
              </div>

              <Card className="bg-card border border-border rounded-lg">
                <CardHeader>
                  <CardTitle className="text-base">Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(detail.results ?? []).map((r) => (
                    <div
                      key={r.itemId}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border pb-2 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="text-sm font-medium">{r.label}</div>
                        {r.note && (
                          <div className="text-xs text-muted-foreground">
                            {r.note}
                          </div>
                        )}
                      </div>
                      {statusBadge(r.status)}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {detail.faultsNoted && (
                <div className="space-y-1">
                  <Label>Faults noted</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {detail.faultsNoted}
                  </p>
                </div>
              )}

              {detail.signatureDataUrl && (
                <div className="space-y-1">
                  <Label>Signature</Label>
                  <img
                    src={detail.signatureDataUrl}
                    alt="Signature"
                    className="border border-border rounded-md bg-white max-h-40"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {detail && (
              <Button
                variant="outline"
                onClick={() => deleteMutation.mutate(detail.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-detail-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrestartTemplateManagerDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        templates={allTemplates}
        onError={(title, description) =>
          toast({ variant: "destructive", title, description })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template manager: built-in checklists are read-only (duplicate to
// customize); custom ones — any equipment type — are fully editable.
// ---------------------------------------------------------------------------
interface PrestartTemplateDraft {
  name: string;
  equipmentType: string;
  itemsText: string;
}

// Custom types are stored as snake_case slugs so filtering by equipmentType
// groups consistently (e.g. "Scissor lift" -> scissor_lift).
function toEquipmentSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function PrestartTemplateManagerDialog({
  open,
  onClose,
  templates,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateWithItems[];
  onError: (title: string, description: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<PrestartTemplateDraft>({
    name: "",
    equipmentType: "",
    itemsText: "",
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/prestart-templates"] });

  const fail = (title: string) => (error: unknown) =>
    onError(title, error instanceof Error ? error.message : "Please try again.");

  const draftBody = () => ({
    name: draft.name.trim(),
    equipmentType: toEquipmentSlug(draft.equipmentType),
    items: draft.itemsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((label, i) => ({ id: `item-${i + 1}`, label })),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = draftBody();
      const res =
        editingId === "new"
          ? await apiRequest("POST", "/api/prestart-templates", body)
          : await apiRequest("PUT", `/api/prestart-templates/${editingId}`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: fail("Could not save template"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (tpl: TemplateWithItems) => {
      const res = await apiRequest("POST", "/api/prestart-templates", {
        name: `${tpl.name} (copy)`,
        equipmentType: tpl.equipmentType,
        items: tpl.items ?? [],
      });
      return res.json();
    },
    onSuccess: invalidate,
    onError: fail("Could not duplicate template"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/prestart-templates/${id}`);
      return res.json();
    },
    onSuccess: invalidate,
    onError: fail("Could not remove template"),
  });

  const beginEdit = (tpl: TemplateWithItems) => {
    setDraft({
      name: tpl.name,
      equipmentType: tpl.equipmentType,
      itemsText: (tpl.items ?? []).map((i) => i.label).join("\n"),
    });
    setEditingId(tpl.id);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setEditingId(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {editingId ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {editingId === "new" ? "New checklist template" : "Edit checklist template"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Template name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Excavator daily pre-start"
                    data-testid="input-prestart-template-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Equipment type</Label>
                  <Input
                    value={draft.equipmentType}
                    onChange={(e) => setDraft({ ...draft, equipmentType: e.target.value })}
                    placeholder="e.g. excavator"
                    data-testid="input-prestart-template-type"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Checklist items (one per line)</Label>
                <Textarea
                  value={draft.itemsText}
                  onChange={(e) => setDraft({ ...draft, itemsText: e.target.value })}
                  rows={8}
                  data-testid="input-prestart-template-items"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingId(null)}
                data-testid="button-prestart-template-cancel"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !draft.name.trim() ||
                  !draft.equipmentType.trim() ||
                  saveMutation.isPending
                }
                onClick={() => saveMutation.mutate()}
                data-testid="button-prestart-template-save"
              >
                Save template
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Checklist templates</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Built-in checklists are read-only — duplicate one to customize it, or add a
              checklist for any equipment your business runs.
            </p>
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3"
                  data-testid={`row-prestart-template-${tpl.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{tpl.name}</span>
                      {tpl.isBuiltIn && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Built-in
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {equipmentLabel(tpl.equipmentType)} · {(tpl.items ?? []).length} items
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => duplicateMutation.mutate(tpl)}
                      disabled={duplicateMutation.isPending}
                      aria-label={`Duplicate ${tpl.name}`}
                      data-testid={`button-prestart-template-duplicate-${tpl.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!tpl.isBuiltIn && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => beginEdit(tpl)}
                          aria-label={`Edit ${tpl.name}`}
                          data-testid={`button-prestart-template-edit-${tpl.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeMutation.mutate(tpl.id)}
                          disabled={removeMutation.isPending}
                          aria-label={`Remove ${tpl.name}`}
                          data-testid={`button-prestart-template-remove-${tpl.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <p className="text-sm text-muted-foreground">No templates yet.</p>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setDraft({ name: "", equipmentType: "", itemsText: "" });
                  setEditingId("new");
                }}
                data-testid="button-prestart-template-new"
              >
                <Plus className="mr-2 h-4 w-4" />
                New template
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

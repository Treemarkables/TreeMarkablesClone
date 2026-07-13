import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, FileText, ChevronUp, ChevronDown, Pencil, Copy, Lock, Settings2 } from "lucide-react";
import { format } from "date-fns";
import type {
  SwmsTemplate,
  SwmsDocument,
  SwmsStep,
  SwmsSignature,
} from "@shared/schema";
import SignaturePad from "@/components/SignaturePad";

interface StepDraft {
  stepNumber: number;
  taskStep: string;
  hazards: string[];
  controls: string[];
  riskRating: number;
  responsiblePerson?: string;
}

// Shape of the jsonb `steps` array stored on a template (typed unknown by Drizzle).
interface TemplateStep {
  stepNumber: number;
  taskStep: string;
  hazards: string[];
  controls: string[];
  riskRating: number;
}

type SwmsDetail = SwmsDocument & {
  steps: SwmsStep[];
  signatures: SwmsSignature[];
};

const STATUS_OPTIONS: Array<SwmsDocument["status"]> = ["draft", "active", "archived"];

function statusVariant(status: string): "secondary" | "default" | "outline" {
  if (status === "active") return "default";
  if (status === "archived") return "outline";
  return "secondary";
}

function statusClasses(status: string): string {
  if (status === "active") return "bg-green-600 text-white hover:bg-green-600";
  if (status === "archived") return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
  return "";
}

// Map a multiline textarea string to a trimmed, non-empty string array.
function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function arrayToLines(value: string[] | null | undefined): string {
  return (value ?? []).join("\n");
}

// Narrow the unknown jsonb steps into typed TemplateStep records without casting through `any`.
function readTemplateSteps(raw: unknown): TemplateStep[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateStep[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    out.push({
      stepNumber: typeof rec.stepNumber === "number" ? rec.stepNumber : out.length + 1,
      taskStep: typeof rec.taskStep === "string" ? rec.taskStep : "",
      hazards: Array.isArray(rec.hazards) ? rec.hazards.filter((h): h is string => typeof h === "string") : [],
      controls: Array.isArray(rec.controls) ? rec.controls.filter((c): c is string => typeof c === "string") : [],
      riskRating: typeof rec.riskRating === "number" ? rec.riskRating : 1,
    });
  }
  return out;
}

function emptyStep(stepNumber: number): StepDraft {
  return { stepNumber, taskStep: "", hazards: [], controls: [], riskRating: 1 };
}

interface BuilderState {
  title: string;
  location: string;
  activityDescription: string;
  ppeText: string;
  highRiskText: string;
  steps: StepDraft[];
}

function emptyBuilder(): BuilderState {
  return {
    title: "",
    location: "",
    activityDescription: "",
    ppeText: "",
    highRiskText: "",
    steps: [emptyStep(1)],
  };
}

// ---------------------------------------------------------------------------
// Steps editor (shared by create + edit)
// ---------------------------------------------------------------------------
function StepsEditor({
  steps,
  onChange,
}: {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
}) {
  const renumber = (list: StepDraft[]): StepDraft[] =>
    list.map((s, i) => ({ ...s, stepNumber: i + 1 }));

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    onChange(renumber(steps.map((s, i) => (i === index ? { ...s, ...patch } : s))));
  };

  const addStep = () => {
    onChange(renumber([...steps, emptyStep(steps.length + 1)]));
  };

  const removeStep = (index: number) => {
    onChange(renumber(steps.filter((_, i) => i !== index)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    onChange(renumber(next));
  };

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div
          key={index}
          className="bg-card border border-border rounded-lg p-3 space-y-3"
          data-testid={`step-row-${index}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Step {step.stepNumber}</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move step up"
                data-testid={`button-step-up-${index}`}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => move(index, 1)}
                disabled={index === steps.length - 1}
                aria-label="Move step down"
                data-testid={`button-step-down-${index}`}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeStep(index)}
                disabled={steps.length === 1}
                aria-label="Remove step"
                data-testid={`button-step-remove-${index}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Task step</Label>
            <Input
              value={step.taskStep}
              onChange={(e) => updateStep(index, { taskStep: e.target.value })}
              placeholder="Describe this step"
              data-testid={`input-step-task-${index}`}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Hazards (one per line)</Label>
              <Textarea
                value={arrayToLines(step.hazards)}
                onChange={(e) => updateStep(index, { hazards: linesToArray(e.target.value) })}
                rows={3}
                placeholder={"Falling limbs\nStruck-by"}
                data-testid={`input-step-hazards-${index}`}
              />
            </div>
            <div className="space-y-1">
              <Label>Controls (one per line)</Label>
              <Textarea
                value={arrayToLines(step.controls)}
                onChange={(e) => updateStep(index, { controls: linesToArray(e.target.value) })}
                rows={3}
                placeholder={"Establish drop zone\nUse rigging"}
                data-testid={`input-step-controls-${index}`}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Risk rating</Label>
              <Select
                value={String(step.riskRating)}
                onValueChange={(v) => updateStep(index, { riskRating: Number(v) })}
              >
                <SelectTrigger data-testid={`select-step-risk-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsible person</Label>
              <Input
                value={step.responsiblePerson ?? ""}
                onChange={(e) => updateStep(index, { responsiblePerson: e.target.value })}
                placeholder="Optional"
                data-testid={`input-step-responsible-${index}`}
              />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addStep} data-testid="button-add-step">
        <Plus className="mr-2 h-4 w-4" />
        Add step
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder form fields (shared shape for the body)
// ---------------------------------------------------------------------------
function BuilderFields({
  state,
  setState,
}: {
  state: BuilderState;
  setState: (next: BuilderState) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Title</Label>
          <Input
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            placeholder="e.g. Sectional dismantle — oak removal"
            data-testid="input-title"
          />
        </div>
        <div className="space-y-1">
          <Label>Location</Label>
          <Input
            value={state.location}
            onChange={(e) => setState({ ...state, location: e.target.value })}
            placeholder="Site address"
            data-testid="input-location"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Activity description</Label>
        <Textarea
          value={state.activityDescription}
          onChange={(e) => setState({ ...state, activityDescription: e.target.value })}
          rows={2}
          data-testid="input-activity"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>PPE required (one per line)</Label>
          <Textarea
            value={state.ppeText}
            onChange={(e) => setState({ ...state, ppeText: e.target.value })}
            rows={4}
            placeholder={"Helmet\nChainsaw trousers\nEye protection"}
            data-testid="input-ppe"
          />
        </div>
        <div className="space-y-1">
          <Label>High-risk work (one per line)</Label>
          <Textarea
            value={state.highRiskText}
            onChange={(e) => setState({ ...state, highRiskText: e.target.value })}
            rows={4}
            placeholder={"Work at height\nChainsaw use\nNear powerlines"}
            data-testid="input-highrisk"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-base">Steps</Label>
        <StepsEditor steps={state.steps} onChange={(steps) => setState({ ...state, steps })} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SWMSBuilder() {
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [chooseOpen, setChooseOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [builder, setBuilder] = useState<BuilderState>(emptyBuilder());
  const [viewId, setViewId] = useState<string | null>(null);

  const listUrl = statusFilter === "all" ? "/api/swms" : `/api/swms?status=${statusFilter}`;

  const { data: listResp } = useQuery<{ success: boolean; data: SwmsDocument[] }>({
    queryKey: [listUrl],
  });
  const documents = listResp?.data ?? [];

  const { data: templatesResp } = useQuery<{ success: boolean; data: SwmsTemplate[] }>({
    queryKey: ["/api/swms-templates"],
  });
  const templates = templatesResp?.data ?? [];

  const { data: detailResp } = useQuery<{ success: boolean; data: SwmsDetail }>({
    queryKey: [`/api/swms/${viewId}`],
    enabled: !!viewId,
  });
  const detail = detailResp?.data;

  const failToast = (title: string) => (error: unknown) =>
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : "Please try again.",
    });

  const buildBody = (status: SwmsDocument["status"]) => ({
    title: builder.title,
    activityDescription: builder.activityDescription || undefined,
    location: builder.location || undefined,
    ppeRequired: linesToArray(builder.ppeText),
    highRiskWork: linesToArray(builder.highRiskText),
    status,
    steps: builder.steps,
  });

  const createMutation = useMutation({
    mutationFn: async (status: SwmsDocument["status"]) => {
      const res = await apiRequest("POST", "/api/swms", buildBody(status));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swms"] });
      setCreateOpen(false);
      setBuilder(emptyBuilder());
    },
    onError: failToast("Could not create SWMS"),
  });

  const startBlank = () => {
    setBuilder(emptyBuilder());
    setChooseOpen(false);
    setCreateOpen(true);
  };

  const startFromTemplate = (templateId: string) => {
    const tpl = templates.find((t) => String(t.id) === templateId);
    if (!tpl) return;
    const tplSteps = readTemplateSteps(tpl.steps);
    setBuilder({
      title: tpl.name,
      location: "",
      activityDescription: tpl.activityDescription ?? "",
      ppeText: arrayToLines(tpl.defaultPpe),
      highRiskText: "",
      steps:
        tplSteps.length > 0
          ? tplSteps.map((s, i) => ({
              stepNumber: i + 1,
              taskStep: s.taskStep,
              hazards: s.hazards,
              controls: s.controls,
              riskRating: s.riskRating,
            }))
          : [emptyStep(1)],
    });
    setChooseOpen(false);
    setCreateOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Safe Work Method Statements</h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setManageOpen(true)}
            data-testid="button-manage-templates"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Templates
          </Button>
          <Button onClick={() => setChooseOpen(true)} data-testid="button-new-swms">
            <Plus className="mr-2 h-4 w-4" />
            New SWMS
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card className="bg-card border border-border rounded-lg">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-8 w-8" />
            No SWMS documents yet. Create one from a template or from scratch.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className="bg-card border border-border rounded-lg cursor-pointer"
              onClick={() => setViewId(doc.id)}
              data-testid={`card-swms-${doc.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {doc.swmsNumber}
                      </span>
                      <Badge variant={statusVariant(doc.status)} className={statusClasses(doc.status)}>
                        {doc.status}
                      </Badge>
                    </div>
                    <h2 className="font-semibold truncate">{doc.title}</h2>
                    {doc.activityDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {doc.activityDescription}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Choose start mode */}
      <Dialog open={chooseOpen} onOpenChange={setChooseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new SWMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Start from a template</Label>
              <Select onValueChange={startFromTemplate}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                      {t.category ? ` — ${t.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-center text-sm text-muted-foreground">or</div>
            <Button variant="outline" className="w-full" onClick={startBlank} data-testid="button-start-blank">
              Start blank
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create builder */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New SWMS</DialogTitle>
          </DialogHeader>
          <BuilderFields state={builder} setState={setBuilder} />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={!builder.title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate("draft")}
              data-testid="button-save-draft"
            >
              Save as draft
            </Button>
            <Button
              disabled={!builder.title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate("active")}
              data-testid="button-save-active"
            >
              Save as active
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / edit */}
      <SwmsDetailDialog
        detail={detail}
        open={!!viewId}
        onClose={() => setViewId(null)}
        onError={failToast}
      />

      {/* Template manager */}
      <TemplateManagerDialog
        templates={templates}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onError={failToast}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template manager: built-ins are read-only (duplicate to customize),
// custom templates are fully editable including their steps.
// ---------------------------------------------------------------------------
interface TemplateDraft {
  name: string;
  category: string;
  activityDescription: string;
  ppeText: string;
  steps: StepDraft[];
}

function emptyTemplateDraft(): TemplateDraft {
  return { name: "", category: "", activityDescription: "", ppeText: "", steps: [emptyStep(1)] };
}

function templateToDraft(tpl: SwmsTemplate): TemplateDraft {
  const steps = readTemplateSteps(tpl.steps);
  return {
    name: tpl.name,
    category: tpl.category ?? "",
    activityDescription: tpl.activityDescription ?? "",
    ppeText: arrayToLines(tpl.defaultPpe),
    steps: steps.length > 0 ? steps : [emptyStep(1)],
  };
}

function draftToBody(draft: TemplateDraft) {
  return {
    name: draft.name.trim(),
    category: draft.category.trim() || undefined,
    activityDescription: draft.activityDescription.trim() || undefined,
    defaultPpe: linesToArray(draft.ppeText),
    steps: draft.steps.map((s, i) => ({
      stepNumber: i + 1,
      taskStep: s.taskStep,
      hazards: s.hazards,
      controls: s.controls,
      riskRating: s.riskRating,
    })),
  };
}

function TemplateManagerDialog({
  templates,
  open,
  onClose,
  onError,
}: {
  templates: SwmsTemplate[];
  open: boolean;
  onClose: () => void;
  onError: (title: string) => (error: unknown) => void;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyTemplateDraft());

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/swms-templates"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = draftToBody(draft);
      const res =
        editingId === "new"
          ? await apiRequest("POST", "/api/swms-templates", body)
          : await apiRequest("PUT", `/api/swms-templates/${editingId}`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: onError("Could not save template"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/swms-templates/${id}/duplicate`);
      return res.json();
    },
    onSuccess: invalidate,
    onError: onError("Could not duplicate template"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/swms-templates/${id}`);
      return res.json();
    },
    onSuccess: invalidate,
    onError: onError("Could not remove template"),
  });

  const beginEdit = (tpl: SwmsTemplate) => {
    setDraft(templateToDraft(tpl));
    setEditingId(tpl.id);
  };

  const beginNew = () => {
    setDraft(emptyTemplateDraft());
    setEditingId("new");
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setEditingId(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {editingId ? (
          <>
            <DialogHeader>
              <DialogTitle>{editingId === "new" ? "New SWMS template" : "Edit template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Template name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Roof work"
                    data-testid="input-template-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Input
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    placeholder="Optional grouping"
                    data-testid="input-template-category"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Activity description</Label>
                <Textarea
                  value={draft.activityDescription}
                  onChange={(e) => setDraft({ ...draft, activityDescription: e.target.value })}
                  rows={2}
                  data-testid="input-template-activity"
                />
              </div>
              <div className="space-y-1">
                <Label>Default PPE (one per line)</Label>
                <Textarea
                  value={draft.ppeText}
                  onChange={(e) => setDraft({ ...draft, ppeText: e.target.value })}
                  rows={4}
                  data-testid="input-template-ppe"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Steps</Label>
                <StepsEditor
                  steps={draft.steps}
                  onChange={(steps) => setDraft({ ...draft, steps })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)} data-testid="button-template-cancel">
                Cancel
              </Button>
              <Button
                disabled={!draft.name.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                data-testid="button-template-save"
              >
                Save template
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>SWMS templates</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Built-in templates are read-only — duplicate one to customize it for your business.
            </p>
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3"
                  data-testid={`row-template-${tpl.id}`}
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
                    {tpl.category && (
                      <p className="text-xs text-muted-foreground">{tpl.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => duplicateMutation.mutate(tpl.id)}
                      disabled={duplicateMutation.isPending}
                      aria-label={`Duplicate ${tpl.name}`}
                      data-testid={`button-template-duplicate-${tpl.id}`}
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
                          data-testid={`button-template-edit-${tpl.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeMutation.mutate(tpl.id)}
                          disabled={removeMutation.isPending}
                          aria-label={`Remove ${tpl.name}`}
                          data-testid={`button-template-remove-${tpl.id}`}
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
              <Button onClick={beginNew} data-testid="button-template-new">
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

// ---------------------------------------------------------------------------
// Detail / edit / sign-off dialog
// ---------------------------------------------------------------------------
function SwmsDetailDialog({
  detail,
  open,
  onClose,
  onError,
}: {
  detail: SwmsDetail | undefined;
  open: boolean;
  onClose: () => void;
  onError: (title: string) => (error: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<BuilderState>(emptyBuilder());
  const [workerName, setWorkerName] = useState("");

  const id = detail?.id;

  const beginEdit = () => {
    if (!detail) return;
    setEditState({
      title: detail.title,
      location: detail.location ?? "",
      activityDescription: detail.activityDescription ?? "",
      ppeText: arrayToLines(detail.ppeRequired),
      highRiskText: arrayToLines(detail.highRiskWork),
      steps:
        detail.steps.length > 0
          ? detail.steps
              .slice()
              .sort((a, b) => a.stepNumber - b.stepNumber)
              .map((s, i) => ({
                stepNumber: i + 1,
                taskStep: s.taskStep,
                hazards: s.hazards ?? [],
                controls: s.controls ?? [],
                riskRating: s.riskRating ?? 1,
                responsiblePerson: s.responsiblePerson ?? undefined,
              }))
          : [emptyStep(1)],
    });
    setEditing(true);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/swms"] });
    if (id) queryClient.invalidateQueries({ queryKey: [`/api/swms/${id}`] });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Missing SWMS id");
      const res = await apiRequest("PUT", `/api/swms/${id}`, {
        title: editState.title,
        location: editState.location || undefined,
        activityDescription: editState.activityDescription || undefined,
        ppeRequired: linesToArray(editState.ppeText),
        highRiskWork: linesToArray(editState.highRiskText),
        steps: editState.steps,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
    onError: onError("Could not update SWMS"),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: SwmsDocument["status"]) => {
      if (!id) throw new Error("Missing SWMS id");
      const res = await apiRequest("PUT", `/api/swms/${id}`, { status });
      return res.json();
    },
    onSuccess: invalidate,
    onError: onError("Could not update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("Missing SWMS id");
      const res = await apiRequest("DELETE", `/api/swms/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: onError("Could not delete SWMS"),
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("Missing SWMS");
      const res = await apiRequest("POST", "/api/swms-templates", {
        name: detail.title,
        activityDescription: detail.activityDescription || undefined,
        defaultPpe: detail.ppeRequired ?? [],
        steps: (detail.steps ?? [])
          .slice()
          .sort((a, b) => a.stepNumber - b.stepNumber)
          .map((s, i) => ({
            stepNumber: i + 1,
            taskStep: s.taskStep,
            hazards: s.hazards ?? [],
            controls: s.controls ?? [],
            riskRating: s.riskRating ?? 1,
          })),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swms-templates"] });
    },
    onError: onError("Could not save as template"),
  });

  const signMutation = useMutation({
    mutationFn: async (signatureDataUrl: string) => {
      if (!id) throw new Error("Missing SWMS id");
      if (!workerName.trim()) throw new Error("Enter a worker name before signing.");
      const res = await apiRequest("POST", `/api/swms/${id}/signatures`, {
        workerName: workerName.trim(),
        signatureDataUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setWorkerName("");
    },
    onError: onError("Could not add signature"),
  });

  const handleClose = (next: boolean) => {
    if (!next) {
      setEditing(false);
      setWorkerName("");
      saveAsTemplateMutation.reset();
      onClose();
    }
  };

  const sortedSteps = (detail?.steps ?? []).slice().sort((a, b) => a.stepNumber - b.stepNumber);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!detail ? (
          <div className="p-6 text-center text-muted-foreground">Loading…</div>
        ) : editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit {detail.swmsNumber}</DialogTitle>
            </DialogHeader>
            <BuilderFields state={editState} setState={setEditState} />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button
                disabled={!editState.title.trim() || updateMutation.isPending}
                onClick={() => updateMutation.mutate()}
                data-testid="button-save-edit"
              >
                Save changes
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{detail.swmsNumber}</span>
                <span>{detail.title}</span>
                <Badge variant={statusVariant(detail.status)} className={statusClasses(detail.status)}>
                  {detail.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {detail.location && (
                <p className="text-sm">
                  <span className="font-medium">Location:</span> {detail.location}
                </p>
              )}
              {detail.activityDescription && (
                <p className="text-sm">
                  <span className="font-medium">Activity:</span> {detail.activityDescription}
                </p>
              )}

              {(detail.ppeRequired?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">PPE required</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.ppeRequired?.map((p, i) => (
                      <Badge key={i} variant="secondary">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(detail.highRiskWork?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">High-risk work</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.highRiskWork?.map((h, i) => (
                      <Badge key={i} variant="outline">
                        {h}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Method steps</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-border rounded-lg">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="p-2 w-10">#</th>
                        <th className="p-2">Task</th>
                        <th className="p-2">Hazards</th>
                        <th className="p-2">Controls</th>
                        <th className="p-2 w-14">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSteps.map((s) => (
                        <tr key={s.id} className="border-t border-border align-top">
                          <td className="p-2">{s.stepNumber}</td>
                          <td className="p-2">{s.taskStep}</td>
                          <td className="p-2">
                            <ul className="list-disc pl-4">
                              {(s.hazards ?? []).map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="p-2">
                            <ul className="list-disc pl-4">
                              {(s.controls ?? []).map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="p-2">{s.riskRating ?? "-"}</td>
                        </tr>
                      ))}
                      {sortedSteps.length === 0 && (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={5}>
                            No steps recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sign-off */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Worker sign-off</p>
                {detail.signatures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No signatures yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.signatures.map((sig) => (
                      <li
                        key={sig.id}
                        className="bg-card border border-border rounded-lg p-2 flex items-center gap-3"
                      >
                        <img
                          src={sig.signatureDataUrl}
                          alt={`Signature of ${sig.workerName}`}
                          className="h-10 w-24 object-contain bg-white rounded"
                        />
                        <div className="text-sm">
                          <div className="font-medium">{sig.workerName}</div>
                          <div className="text-muted-foreground text-xs">
                            {sig.signedAt ? format(new Date(sig.signedAt), "d MMM yyyy, h:mm a") : ""}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="space-y-2 bg-card border border-border rounded-lg p-3">
                  <Label>Add signature</Label>
                  <Input
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    placeholder="Worker name"
                    data-testid="input-worker-name"
                  />
                  <SignaturePad
                    onSave={(dataUrl) => signMutation.mutate(dataUrl)}
                    disabled={!workerName.trim() || signMutation.isPending}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={beginEdit} data-testid="button-edit">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                disabled={saveAsTemplateMutation.isPending || saveAsTemplateMutation.isSuccess}
                onClick={() => saveAsTemplateMutation.mutate()}
                data-testid="button-save-as-template"
              >
                <Copy className="mr-2 h-4 w-4" />
                {saveAsTemplateMutation.isSuccess ? "Saved as template" : "Save as template"}
              </Button>
              {detail.status !== "active" && (
                <Button
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("active")}
                  data-testid="button-activate"
                >
                  Mark active
                </Button>
              )}
              {detail.status !== "archived" && (
                <Button
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("archived")}
                  data-testid="button-archive"
                >
                  Archive
                </Button>
              )}
              {detail.status === "draft" && (
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                  data-testid="button-delete"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete draft
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

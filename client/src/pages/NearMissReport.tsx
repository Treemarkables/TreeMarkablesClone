import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  AlertTriangle, ChevronRight, ChevronLeft, Save, Send, Trash2, Plus, X,
  MapPin, Camera, Mic, CheckCircle2, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NearMissReport, NearMissWitness, NearMissAction } from "@shared/schema";

// ── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "struck_by", label: "Struck By" },
  { value: "fall_from_height", label: "Fall from Height" },
  { value: "electrical", label: "Electrical" },
  { value: "cut_laceration", label: "Cut / Laceration" },
  { value: "vehicle", label: "Vehicle" },
  { value: "public_safety", label: "Public Safety" },
  { value: "drop_zone_breach", label: "Drop Zone Breach" },
  { value: "equipment_failure", label: "Equipment Failure" },
  { value: "manual_handling", label: "Manual Handling" },
  { value: "other", label: "Other" },
];

const SEVERITIES = [
  { value: "low", label: "Low", colour: "bg-green-100 text-green-800 border-green-200" },
  { value: "medium", label: "Medium", colour: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "high", label: "High", colour: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "critical", label: "Critical", colour: "bg-red-100 text-red-800 border-red-200" },
];

const CONTRIBUTING_FACTORS = [
  { value: "communication", label: "Communication" },
  { value: "fatigue", label: "Fatigue" },
  { value: "weather", label: "Weather" },
  { value: "planning", label: "Planning" },
  { value: "training", label: "Training" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

const CONTROL_TYPES = [
  { value: "elimination", label: "Elimination" },
  { value: "substitution", label: "Substitution" },
  { value: "engineering", label: "Engineering" },
  { value: "admin", label: "Administrative" },
  { value: "ppe", label: "PPE" },
];

const STEPS = ["Incident Details", "Controls & Factors", "Actions", "Witness & Sign"];

// ── Form schema ──────────────────────────────────────────────────────────────

const step1Schema = z.object({
  incidentDatetime: z.string().min(1, "Date & time required"),
  locationAddress: z.string().optional(),
  category: z.string().min(1, "Category required"),
  potentialSeverity: z.string().min(1, "Severity required"),
  description: z.string().min(10, "Please describe the incident (min 10 chars)"),
});

const step2Schema = z.object({
  immediateActionTaken: z.string().optional(),
  proposedControl: z.string().optional(),
  equipmentInvolved: z.array(z.string()).optional(),
  contributingFactors: z.array(z.string()).optional(),
  toolboxTalkFlag: z.boolean().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

// ── Action row component ─────────────────────────────────────────────────────

interface ActionRow {
  id?: string;
  title: string;
  controlType: string;
  status: string;
  dueDate: string;
  isNew?: boolean;
}

// ── Signature canvas ─────────────────────────────────────────────────────────

function SignatureCanvas({ onCapture }: { onCapture: (svg: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const pathsRef = useRef<string[]>([]);
  const currentPathRef = useRef<string>("");

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, rect: DOMRect) => {
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = getPos(e, rect);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    currentPathRef.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
    setIsDrawing(true);
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = getPos(e, rect);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
    currentPathRef.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const onUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPathRef.current) {
      pathsRef.current.push(currentPathRef.current);
      currentPathRef.current = "";
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    pathsRef.current = [];
  };

  const capture = useCallback(() => {
    const w = canvasRef.current?.width ?? 400;
    const h = canvasRef.current?.height ?? 150;
    const pathElements = pathsRef.current
      .map(d => `<path d="${d}" stroke="#111" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${pathElements}</svg>`;
    onCapture(svg);
  }, [onCapture]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full border rounded-md bg-white touch-none cursor-crosshair"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>Clear</Button>
        <Button type="button" size="sm" onClick={capture} className="bg-amber-500 text-white hover:bg-amber-600">
          Capture Signature
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ReportDetail extends NearMissReport {
  witnesses: NearMissWitness[];
  actions: NearMissAction[];
}

export default function NearMissReportPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const editId = params?.id;

  const [step, setStep] = useState(0);
  const [reportId, setReportId] = useState<string | null>(editId ?? null);
  const [isDraft, setIsDraft] = useState(true);

  // Actions state
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [newAction, setNewAction] = useState<ActionRow>({ title: "", controlType: "", status: "open", dueDate: "" });

  // Witness state
  const [witnesses, setWitnesses] = useState<Array<{ id?: string; witnessName: string; witnessUserId?: string; status: string; signatureSvg?: string }>>([]);
  const [capturedSigs, setCapturedSigs] = useState<Record<number, string>>({});

  // Reporter / person-involved sign-off
  const [reporterSigSvg, setReporterSigSvg] = useState<string | null>(null);
  const [reporterSignedAt, setReporterSignedAt] = useState<string | null>(null);
  const [reporterSigDraft, setReporterSigDraft] = useState<string | null>(null);

  // Equipment involved free-text
  const [equipmentInput, setEquipmentInput] = useState("");
  const [equipmentList, setEquipmentList] = useState<string[]>([]);

  // Step 1 form
  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      incidentDatetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      locationAddress: "",
      category: "",
      potentialSeverity: "",
      description: "",
    },
  });

  // Step 2 form
  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      immediateActionTaken: "",
      proposedControl: "",
      equipmentInvolved: [],
      contributingFactors: [],
      toolboxTalkFlag: true,
    },
  });

  // Load existing report if editing
  const { data: existingData } = useQuery<{ success: boolean; data: ReportDetail }>({
    queryKey: ["/api/near-miss-reports", editId],
    enabled: !!editId,
  });

  useEffect(() => {
    if (!existingData?.data) return;
    const r = existingData.data;
    step1Form.reset({
      incidentDatetime: r.incidentDatetime ? format(new Date(r.incidentDatetime), "yyyy-MM-dd'T'HH:mm") : "",
      locationAddress: r.locationAddress ?? "",
      category: r.category,
      potentialSeverity: r.potentialSeverity,
      description: r.description,
    });
    step2Form.reset({
      immediateActionTaken: r.immediateActionTaken ?? "",
      proposedControl: r.proposedControl ?? "",
      equipmentInvolved: r.equipmentInvolved ?? [],
      contributingFactors: r.contributingFactors ?? [],
      toolboxTalkFlag: r.toolboxTalkFlag ?? true,
    });
    setEquipmentList(r.equipmentInvolved ?? []);
    setActions(
      (r.actions ?? []).map(a => ({
        id: a.id,
        title: a.title,
        controlType: a.controlType ?? "",
        status: a.status,
        dueDate: a.dueDate ? format(new Date(a.dueDate), "yyyy-MM-dd") : "",
      }))
    );
    setWitnesses(
      (r.witnesses ?? []).map(w => ({
        id: w.id,
        witnessName: w.witnessName ?? "",
        witnessUserId: w.witnessUserId ?? undefined,
        status: w.status,
        signatureSvg: w.signatureSvg ?? undefined,
      }))
    );
    setReporterSigSvg(r.reporterSignatureSvg ?? null);
    setReporterSignedAt(r.reporterSignedAt ? new Date(r.reporterSignedAt).toISOString() : null);
    setIsDraft(r.status === "draft");
    setReportId(r.id);
  }, [existingData]);

  // Create/update report
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (reportId) {
        return apiRequest("PUT", `/api/near-miss-reports/${reportId}`, data);
      }
      return apiRequest("POST", "/api/near-miss-reports", data);
    },
    onSuccess: async (res: Response) => {
      const json = await res.json();
      if (json.data?.id) setReportId(json.data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/near-miss-reports"] });
    },
  });

  // Submit report
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) throw new Error("Save the report first");
      return apiRequest("POST", `/api/near-miss-reports/${reportId}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/near-miss-reports"] });
      navigate("/near-miss-history");
    },
  });

  // Add action
  const addActionMutation = useMutation({
    mutationFn: async (action: ActionRow) => {
      if (!reportId) throw new Error("Save the report first");
      return apiRequest("POST", `/api/near-miss-reports/${reportId}/actions`, {
        title: action.title,
        controlType: action.controlType || null,
        status: action.status,
        dueDate: action.dueDate ? new Date(action.dueDate).toISOString() : null,
      });
    },
    onSuccess: async (res: Response) => {
      const json = await res.json();
      if (json.data) {
        setActions(prev => [...prev, { ...newAction, id: json.data.id }]);
        setNewAction({ title: "", controlType: "", status: "open", dueDate: "" });
      }
    },
  });

  // Sign witness
  const signWitnessMutation = useMutation({
    mutationFn: async ({ witnessId, svg }: { witnessId: string; svg: string }) =>
      apiRequest("POST", `/api/near-miss-witnesses/${witnessId}/sign`, { signatureSvg: svg }),
    onSuccess: async (_res, { witnessId }) => {
      setWitnesses(prev => prev.map(w => w.id === witnessId ? { ...w, status: "signed" } : w));
    },
  });

  // Add witness
  const addWitnessMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!reportId) throw new Error("Save the report first");
      return apiRequest("POST", `/api/near-miss-reports/${reportId}/witnesses`, {
        witnessName: name,
        status: "pending",
      });
    },
    onSuccess: async (res: Response) => {
      const json = await res.json();
      if (json.data) {
        setWitnesses(prev => [...prev, { id: json.data.id, witnessName: json.data.witnessName ?? "", status: "pending" }]);
      }
    },
  });

  const buildPayload = () => {
    const s1 = step1Form.getValues();
    const s2 = step2Form.getValues();
    return {
      reporterUserId: currentUser?.id ?? "",
      incidentDatetime: new Date(s1.incidentDatetime).toISOString(),
      locationAddress: s1.locationAddress || null,
      category: s1.category,
      potentialSeverity: s1.potentialSeverity,
      description: s1.description,
      immediateActionTaken: s2.immediateActionTaken || null,
      proposedControl: s2.proposedControl || null,
      equipmentInvolved: equipmentList,
      contributingFactors: s2.contributingFactors ?? [],
      toolboxTalkFlag: s2.toolboxTalkFlag ?? true,
      reporterSignatureSvg: reporterSigSvg,
      reporterSignedAt: reporterSignedAt,
    };
  };

  const handleSaveDraft = async () => {
    const valid1 = await step1Form.trigger();
    if (!valid1) { setStep(0); return; }
    try {
      await saveMutation.mutateAsync(buildPayload());
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleNext = async () => {
    if (step === 0) {
      const valid = await step1Form.trigger();
      if (!valid) return;
      await saveMutation.mutateAsync(buildPayload());
    }
    if (step === 1) {
      await saveMutation.mutateAsync(buildPayload());
    }
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => Math.max(0, s - 1));

  const addEquipment = () => {
    const trimmed = equipmentInput.trim();
    if (trimmed && !equipmentList.includes(trimmed)) {
      setEquipmentList(prev => [...prev, trimmed]);
      setEquipmentInput("");
    }
  };

  const severityConfig = SEVERITIES.find(s => s.value === step1Form.watch("potentialSeverity"));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600 shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">
            {editId ? "Edit Near Miss Report" : "New Near Miss Report"}
          </h1>
          {reportId && <p className="text-sm text-muted-foreground">Draft — not yet submitted</p>}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <button
              type="button"
              aria-label={`Step ${i + 1}: ${label}`}
              onClick={() => { if (i < step || reportId) setStep(i); }}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium border transition-colors ${
                i === step
                  ? "bg-amber-500 text-white border-amber-500"
                  : i < step
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span className={`text-xs truncate ${i === step ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Incident Details ── */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Incident Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date & Time *</Label>
              <Input
                type="datetime-local"
                {...step1Form.register("incidentDatetime")}
              />
              {step1Form.formState.errors.incidentDatetime && (
                <p className="text-xs text-destructive">{step1Form.formState.errors.incidentDatetime.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Site address or description" {...step1Form.register("locationAddress")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                value={step1Form.watch("category")}
                onValueChange={v => step1Form.setValue("category", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {step1Form.formState.errors.category && (
                <p className="text-xs text-destructive">{step1Form.formState.errors.category.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Potential Severity *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SEVERITIES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => step1Form.setValue("potentialSeverity", s.value, { shouldValidate: true })}
                    className={`py-2 px-3 rounded-md border text-sm font-medium transition-all ${
                      step1Form.watch("potentialSeverity") === s.value
                        ? s.colour + " ring-2 ring-offset-1 ring-current"
                        : "border-border text-muted-foreground hover-elevate"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {step1Form.formState.errors.potentialSeverity && (
                <p className="text-xs text-destructive">{step1Form.formState.errors.potentialSeverity.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                rows={4}
                placeholder="Describe exactly what happened, where you were, and what could have gone wrong..."
                {...step1Form.register("description")}
              />
              {step1Form.formState.errors.description && (
                <p className="text-xs text-destructive">{step1Form.formState.errors.description.message}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Controls & Factors ── */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Controls & Contributing Factors</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Immediate Action Taken</Label>
              <Textarea rows={3} placeholder="What was done immediately after the near miss?" {...step2Form.register("immediateActionTaken")} />
            </div>

            <div className="space-y-1.5">
              <Label>Proposed Control Measure</Label>
              <Textarea rows={3} placeholder="What should be done to prevent recurrence?" {...step2Form.register("proposedControl")} />
            </div>

            <div className="space-y-1.5">
              <Label>Equipment / Plant Involved</Label>
              <div className="flex gap-2">
                <Input
                  value={equipmentInput}
                  onChange={e => setEquipmentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEquipment(); } }}
                  placeholder="e.g. chainsaw, chipper, truck…"
                />
                <Button type="button" variant="outline" size="icon" onClick={addEquipment} aria-label="Add equipment">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {equipmentList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {equipmentList.map(eq => (
                    <Badge key={eq} variant="secondary" className="gap-1">
                      {eq}
                      <button type="button" onClick={() => setEquipmentList(prev => prev.filter(e => e !== eq))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Contributing Factors</Label>
              <div className="grid grid-cols-2 gap-2">
                {CONTRIBUTING_FACTORS.map(f => {
                  const current = step2Form.watch("contributingFactors") ?? [];
                  const checked = current.includes(f.value);
                  return (
                    <label key={f.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={chk => {
                          const next = chk
                            ? [...current, f.value]
                            : current.filter(v => v !== f.value);
                          step2Form.setValue("contributingFactors", next);
                        }}
                      />
                      <span className="text-sm">{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={step2Form.watch("toolboxTalkFlag") ?? true}
                onCheckedChange={chk => step2Form.setValue("toolboxTalkFlag", !!chk)}
              />
              <span className="text-sm">Flag for toolbox talk discussion</span>
            </label>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Actions ── */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Corrective Actions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {actions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No actions added yet — add at least one corrective action.</p>
            )}
            {actions.map((a, i) => (
              <div key={a.id ?? i} className="flex items-start gap-3 p-3 rounded-md border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {a.controlType && <Badge variant="outline" className="text-xs">{a.controlType}</Badge>}
                    <Badge variant="outline" className="text-xs">{a.status}</Badge>
                    {a.dueDate && <span className="text-xs text-muted-foreground">Due {a.dueDate}</span>}
                  </div>
                </div>
              </div>
            ))}

            <div className="border rounded-md p-3 space-y-3">
              <p className="text-sm font-medium">Add Action</p>
              <div className="space-y-2">
                <Input
                  placeholder="Action title *"
                  value={newAction.title}
                  onChange={e => setNewAction(prev => ({ ...prev, title: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={newAction.controlType}
                    onValueChange={v => setNewAction(prev => ({ ...prev, controlType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Control type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTROL_TYPES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={newAction.dueDate}
                    onChange={e => setNewAction(prev => ({ ...prev, dueDate: e.target.value }))}
                    placeholder="Due date"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!newAction.title.trim()) return;
                  if (!reportId) {
                    toast({ title: "Save the draft first", variant: "destructive" });
                    return;
                  }
                  addActionMutation.mutate(newAction);
                }}
                disabled={addActionMutation.isPending || !newAction.title.trim()}
              >
                {addActionMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Add Action
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Witness & Sign ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Summary card */}
          <Card>
            <CardHeader><CardTitle className="text-base">Report Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <div><span className="text-muted-foreground">Date: </span>{step1Form.getValues("incidentDatetime").replace("T", " ")}</div>
                <div><span className="text-muted-foreground">Category: </span>{CATEGORIES.find(c => c.value === step1Form.getValues("category"))?.label ?? "—"}</div>
                {severityConfig && (
                  <div>
                    <span className="text-muted-foreground">Severity: </span>
                    <Badge className={severityConfig.colour}>{severityConfig.label}</Badge>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground line-clamp-2">{step1Form.getValues("description")}</p>
              <div className="flex gap-4 pt-1">
                <span>{actions.length} action{actions.length !== 1 ? "s" : ""}</span>
                <span>{witnesses.length} witness{witnesses.length !== 1 ? "es" : ""}</span>
              </div>
            </CardContent>
          </Card>

          {/* Reporter / person involved sign-off */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reporter Sign-Off</CardTitle>
              <p className="text-xs text-muted-foreground">
                {currentUser ? `${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim() || "Person involved" : "Person involved"} — sign to confirm this report is accurate.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {reporterSigSvg ? (
                <div className="space-y-2">
                  {/* Stored SVG round-trips through the API — sanitize on render
                      (svg profile keeps the drawing, strips script/event handlers)
                      or a poisoned signature runs in whoever opens the report. */}
                  <div
                    className="border rounded-md bg-white p-2 max-w-sm"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(reporterSigSvg, {
                        USE_PROFILES: { svg: true, svgFilters: true },
                      }),
                    }}
                  />
                  {reporterSignedAt && (
                    <p className="text-xs text-muted-foreground">
                      Signed {format(new Date(reporterSignedAt), "d MMM yyyy 'at' h:mma")}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReporterSigSvg(null);
                      setReporterSignedAt(null);
                      setReporterSigDraft(null);
                    }}
                  >
                    Re-sign
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <SignatureCanvas onCapture={svg => setReporterSigDraft(svg)} />
                  {reporterSigDraft && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        const signedSvg = reporterSigDraft;
                        const signedAt = new Date().toISOString();
                        setReporterSigSvg(signedSvg);
                        setReporterSignedAt(signedAt);
                        setReporterSigDraft(null);
                        if (reportId) {
                          try {
                            await saveMutation.mutateAsync({
                              ...buildPayload(),
                              reporterSignatureSvg: signedSvg,
                              reporterSignedAt: signedAt,
                            });
                          } catch {
                            toast({ title: "Could not save signature", variant: "destructive" });
                          }
                        }
                      }}
                      className="bg-amber-500 text-white hover:bg-amber-600"
                    >
                      Confirm Signature
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Witnesses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Witness (optional)</CardTitle>
              <p className="text-xs text-muted-foreground">If someone else saw the near miss, add them and have them sign.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {witnesses.map((w, i) => (
                <div key={w.id ?? i} className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{w.witnessName || "Unnamed witness"}</p>
                    <Badge variant={w.status === "signed" ? "default" : "outline"} className="text-xs">
                      {w.status}
                    </Badge>
                  </div>
                  {w.status === "pending" && w.id && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Witness signature:</p>
                      <SignatureCanvas
                        onCapture={svg => {
                          setCapturedSigs(prev => ({ ...prev, [i]: svg }));
                        }}
                      />
                      {capturedSigs[i] && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => signWitnessMutation.mutate({ witnessId: w.id!, svg: capturedSigs[i] })}
                          disabled={signWitnessMutation.isPending}
                        >
                          Confirm Signature
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Input
                  placeholder="Witness name"
                  id="witness-name-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.getElementById("witness-name-input") as HTMLInputElement;
                    const name = input?.value?.trim();
                    if (!name) return;
                    if (!reportId) {
                      toast({ title: "Save the draft first", variant: "destructive" });
                      return;
                    }
                    addWitnessMutation.mutate(name);
                    input.value = "";
                  }}
                  disabled={addWitnessMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Witness
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Navigation bar ── */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save Draft
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={saveMutation.isPending}
            className="bg-amber-500 text-white hover:bg-amber-600 ml-auto"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !reportId}
            className="bg-amber-500 text-white hover:bg-amber-600 ml-auto"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Submit Report
          </Button>
        )}
      </div>
    </div>
  );
}

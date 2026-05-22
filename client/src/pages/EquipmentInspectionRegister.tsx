import { useState, useEffect } from "react";
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
import { Plus, Trash2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import type { SafetyAsset, AssetInspection } from "@shared/schema";

type AssetCategory =
  | "harness"
  | "rope"
  | "connector"
  | "helmet"
  | "chainsaw"
  | "chipper"
  | "stump_grinder"
  | "ewp"
  | "rigging"
  | "vehicle"
  | "first_aid_kit"
  | "other";

type AssetStatus = SafetyAsset["status"];
type InspectionResult = AssetInspection["result"];

const CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: "harness", label: "Harness" },
  { value: "rope", label: "Rope" },
  { value: "connector", label: "Connector" },
  { value: "helmet", label: "Helmet" },
  { value: "chainsaw", label: "Chainsaw" },
  { value: "chipper", label: "Chipper" },
  { value: "stump_grinder", label: "Stump grinder" },
  { value: "ewp", label: "EWP / MEWP" },
  { value: "rigging", label: "Rigging" },
  { value: "vehicle", label: "Vehicle" },
  { value: "first_aid_kit", label: "First aid kit" },
  { value: "other", label: "Other" },
];

const STATUSES: { value: AssetStatus; label: string }[] = [
  { value: "in_service", label: "In service" },
  { value: "monitor", label: "Monitor" },
  { value: "removed", label: "Removed" },
];

const FREQUENCY_PRESETS: Partial<Record<AssetCategory, number>> = {
  rope: 7,
  harness: 180,
  connector: 180,
  ewp: 365,
};
const DEFAULT_FREQUENCY = 180;

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function todayInputValue(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUSES.find((s) => s.value === status)?.label ?? status;
  if (status === "in_service") {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600">
        {label}
      </Badge>
    );
  }
  if (status === "monitor") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500">
        {label}
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-500 text-white hover:bg-zinc-500">{label}</Badge>
  );
}

function ResultBadge({ result }: { result: string }) {
  if (result === "pass") {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600">Pass</Badge>
    );
  }
  if (result === "monitor") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500">
        Monitor
      </Badge>
    );
  }
  return <Badge className="bg-red-600 text-white hover:bg-red-600">Fail</Badge>;
}

type DueState = "overdue" | "due_soon" | "ok" | "none";

type DateLike = string | Date | null | undefined;

function dueState(nextInspectionDue: DateLike): DueState {
  if (!nextInspectionDue) return "none";
  const days = differenceInCalendarDays(new Date(nextInspectionDue), new Date());
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "ok";
}

function DueCell({ nextInspectionDue }: { nextInspectionDue: DateLike }) {
  const state = dueState(nextInspectionDue);
  if (state === "none") {
    return <span className="text-muted-foreground">—</span>;
  }
  const dateLabel = format(new Date(nextInspectionDue as string | Date), "d MMM yyyy");
  if (state === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        {dateLabel}
        <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">
          Overdue
        </span>
      </span>
    );
  }
  if (state === "due_soon") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-600">
        {dateLabel}
        <span className="ml-1 rounded bg-amber-500 px-1.5 py-0.5 text-xs text-white">
          Due soon
        </span>
      </span>
    );
  }
  return <span>{dateLabel}</span>;
}

function formatDateOrDash(value: DateLike): string {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy");
}

export default function EquipmentInspectionRegister() {
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dueSoonOnly, setDueSoonOnly] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Build the list URL with embedded params.
  const listParams = new URLSearchParams();
  if (statusFilter !== "all") listParams.set("status", statusFilter);
  if (categoryFilter !== "all") listParams.set("category", categoryFilter);
  if (dueSoonOnly) listParams.set("dueSoon", "true");
  const listQs = listParams.toString();
  const listUrl = listQs ? `/api/safety-assets?${listQs}` : "/api/safety-assets";

  const { data: listData, isLoading } = useQuery<{
    success: boolean;
    data: SafetyAsset[];
  }>({
    queryKey: [listUrl],
  });

  const assets = listData?.data ?? [];

  // ---- Add asset form state ----
  const [form, setForm] = useState({
    name: "",
    category: "harness" as AssetCategory,
    assetTag: "",
    serialNumber: "",
    manufacturer: "",
    inServiceDate: "",
    inspectionFrequencyDays: String(FREQUENCY_PRESETS.harness ?? DEFAULT_FREQUENCY),
    notes: "",
  });

  const resetForm = () => {
    setForm({
      name: "",
      category: "harness",
      assetTag: "",
      serialNumber: "",
      manufacturer: "",
      inServiceDate: "",
      inspectionFrequencyDays: String(
        FREQUENCY_PRESETS.harness ?? DEFAULT_FREQUENCY,
      ),
      notes: "",
    });
  };

  const onCategoryChange = (value: string) => {
    const cat = value as AssetCategory;
    const preset = FREQUENCY_PRESETS[cat] ?? DEFAULT_FREQUENCY;
    setForm((f) => ({
      ...f,
      category: cat,
      inspectionFrequencyDays: String(preset),
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const freq = parseInt(form.inspectionFrequencyDays, 10);
      const body: {
        assetTag?: string;
        name: string;
        category: string;
        serialNumber?: string;
        manufacturer?: string;
        inServiceDate?: string;
        inspectionFrequencyDays: number;
        notes?: string;
      } = {
        name: form.name.trim(),
        category: form.category,
        inspectionFrequencyDays: Number.isFinite(freq) ? freq : DEFAULT_FREQUENCY,
      };
      if (form.assetTag.trim()) body.assetTag = form.assetTag.trim();
      if (form.serialNumber.trim()) body.serialNumber = form.serialNumber.trim();
      if (form.manufacturer.trim()) body.manufacturer = form.manufacturer.trim();
      if (form.inServiceDate)
        body.inServiceDate = new Date(form.inServiceDate).toISOString();
      if (form.notes.trim()) body.notes = form.notes.trim();
      const res = await apiRequest("POST", "/api/safety-assets", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety-assets"] });
      setAddOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: "Failed to add asset",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/safety-assets/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety-assets"] });
      setDetailId(null);
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: "Failed to delete asset",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    },
  });

  const handleSubmitAdd = () => {
    if (!form.name.trim()) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Enter a name for the asset.",
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Equipment Inspection Register</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add asset
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        PPE &amp; equipment inspection register — track safety assets and their
        inspection due dates.
      </p>

      {/* Filters */}
      <Card className="bg-card border border-border rounded-lg">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
          <div className="flex flex-col gap-1">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="sm:invisible sm:hidden md:block">&nbsp;</Label>
            <Button
              variant={dueSoonOnly ? "default" : "outline"}
              onClick={() => setDueSoonOnly((v) => !v)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Due soon / overdue only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Register table */}
      <Card className="bg-card border border-border rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg">Register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : assets.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No assets found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Serial</th>
                    <th className="px-4 py-2 font-medium">Last inspected</th>
                    <th className="px-4 py-2 font-medium">Next due</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr
                      key={a.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => setDetailId(a.id)}
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium">{a.name}</div>
                        {a.assetTag ? (
                          <div className="text-xs text-muted-foreground">
                            {a.assetTag}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">{categoryLabel(a.category)}</td>
                      <td className="px-4 py-2">{a.serialNumber || "—"}</td>
                      <td className="px-4 py-2">
                        {formatDateOrDash(a.lastInspectedAt)}
                      </td>
                      <td className="px-4 py-2">
                        <DueCell nextInspectionDue={a.nextInspectionDue} />
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add asset dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Climbing harness #2"
              />
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={onCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="assetTag">Asset tag</Label>
                <Input
                  id="assetTag"
                  value={form.assetTag}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assetTag: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="serialNumber">Serial number</Label>
                <Input
                  id="serialNumber"
                  value={form.serialNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, serialNumber: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={form.manufacturer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, manufacturer: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inServiceDate">In-service date</Label>
                <Input
                  id="inServiceDate"
                  type="date"
                  value={form.inServiceDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, inServiceDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="frequency">Inspection frequency (days)</Label>
              <Input
                id="frequency"
                type="number"
                min={1}
                value={form.inspectionFrequencyDays}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    inspectionFrequencyDays: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Prefilled from the category preset — override as needed.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAdd}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving…" : "Add asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {detailId ? (
        <AssetDetailDialog
          assetId={detailId}
          onClose={() => setDetailId(null)}
          onDelete={(id) => deleteMutation.mutate(id)}
          deleting={deleteMutation.isPending}
        />
      ) : null}
    </div>
  );
}

interface AssetDetail extends SafetyAsset {
  inspections: AssetInspection[];
}

function AssetDetailDialog({
  assetId,
  onClose,
  onDelete,
  deleting,
}: {
  assetId: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const { toast } = useToast();
  const detailUrl = `/api/safety-assets/${assetId}`;

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: AssetDetail;
  }>({
    queryKey: [detailUrl],
  });

  const asset = data?.data;

  const [result, setResult] = useState<InspectionResult>("pass");
  const [inspectorName, setInspectorName] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [inspectedAt, setInspectedAt] = useState<string>(todayInputValue());
  const [lastNextDue, setLastNextDue] = useState<DateLike>(null);

  // Reset the form when switching assets.
  useEffect(() => {
    setResult("pass");
    setInspectorName("");
    setInspectionNotes("");
    setInspectedAt(todayInputValue());
    setLastNextDue(null);
  }, [assetId]);

  const inspectMutation = useMutation({
    mutationFn: async () => {
      const body: {
        inspectorName?: string;
        result: InspectionResult;
        notes?: string;
        inspectedAt?: string;
      } = { result };
      if (inspectorName.trim()) body.inspectorName = inspectorName.trim();
      if (inspectionNotes.trim()) body.notes = inspectionNotes.trim();
      if (inspectedAt)
        body.inspectedAt = new Date(inspectedAt).toISOString();
      const res = await apiRequest(
        "POST",
        `/api/safety-assets/${assetId}/inspections`,
        body,
      );
      return res.json() as Promise<{
        success: boolean;
        data: AssetInspection;
      }>;
    },
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety-assets"] });
      queryClient.invalidateQueries({ queryKey: [detailUrl] });
      setLastNextDue(resp?.data?.nextInspectionDue ?? null);
      setInspectorName("");
      setInspectionNotes("");
      setInspectedAt(todayInputValue());
      setResult("pass");
    },
    onError: (err: unknown) => {
      toast({
        variant: "destructive",
        title: "Failed to record inspection",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{asset ? asset.name : "Asset"}</DialogTitle>
        </DialogHeader>

        {isLoading || !asset ? (
          <div className="py-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5">
            {/* Asset details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Category" value={categoryLabel(asset.category)} />
              <Detail label="Status">
                <StatusBadge status={asset.status} />
              </Detail>
              <Detail label="Asset tag" value={asset.assetTag || "—"} />
              <Detail label="Serial number" value={asset.serialNumber || "—"} />
              <Detail label="Manufacturer" value={asset.manufacturer || "—"} />
              <Detail
                label="In service"
                value={formatDateOrDash(asset.inServiceDate)}
              />
              <Detail
                label="Frequency"
                value={`${asset.inspectionFrequencyDays} days`}
              />
              <Detail
                label="Last inspected"
                value={formatDateOrDash(asset.lastInspectedAt)}
              />
              <Detail label="Next due">
                <DueCell nextInspectionDue={asset.nextInspectionDue} />
              </Detail>
            </div>
            {asset.notes ? (
              <div className="text-sm">
                <div className="text-muted-foreground">Notes</div>
                <div className="whitespace-pre-wrap">{asset.notes}</div>
              </div>
            ) : null}

            {/* Record inspection */}
            <Card className="bg-card border border-border rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4" />
                  Record inspection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Result</Label>
                    <Select
                      value={result}
                      onValueChange={(v) => setResult(v as InspectionResult)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pass">Pass</SelectItem>
                        <SelectItem value="monitor">Monitor</SelectItem>
                        <SelectItem value="fail">Fail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inspectedAt">Inspected date</Label>
                    <Input
                      id="inspectedAt"
                      type="date"
                      value={inspectedAt}
                      onChange={(e) => setInspectedAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="inspectorName">Inspector name</Label>
                  <Input
                    id="inspectorName"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="inspectionNotes">Notes</Label>
                  <Textarea
                    id="inspectionNotes"
                    value={inspectionNotes}
                    onChange={(e) => setInspectionNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <Button
                  onClick={() => inspectMutation.mutate()}
                  disabled={inspectMutation.isPending}
                >
                  {inspectMutation.isPending
                    ? "Recording…"
                    : "Record inspection"}
                </Button>
                {lastNextDue ? (
                  <p className="text-sm text-muted-foreground">
                    Recorded. Next inspection due{" "}
                    <span className="font-medium text-foreground">
                      {format(new Date(lastNextDue), "d MMM yyyy")}
                    </span>
                    .
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {/* Inspection history */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Inspection history</h3>
              {asset.inspections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No inspections recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {asset.inspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {formatDateOrDash(insp.inspectedAt)}
                        </span>
                        <ResultBadge result={insp.result} />
                      </div>
                      {insp.inspectorName ? (
                        <div className="text-muted-foreground">
                          Inspector: {insp.inspectorName}
                        </div>
                      ) : null}
                      {insp.notes ? (
                        <div className="mt-1 whitespace-pre-wrap">
                          {insp.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => onDelete(assetId)}
            disabled={deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting…" : "Delete asset"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div>{children ?? value}</div>
    </div>
  );
}

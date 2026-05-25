import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

interface BackCostingPanelProps {
  jobId: string;
  onOpenTimeEntries?: () => void;
}

type CostField =
  | "actualLaborCosts"
  | "actualMaterialsCosts"
  | "equipmentCosts"
  | "subcontractorCosts"
  | "permitCosts"
  | "travelCosts"
  | "disposalCosts"
  | "miscExpenses";

type CompletionField =
  | "laborCostsComplete"
  | "materialsCostsComplete"
  | "equipmentCostsComplete"
  | "subcontractorCostsComplete"
  | "otherExpensesComplete";

interface BackCostingResponse {
  success: boolean;
  data: {
    job: { id: string; jobNumber: string | null; status: string; customerName: string | null };
    revenue: {
      amount: number;
      invoiceTotal: number | null;
      quoteTotal: number;
      source: "invoice" | "quote" | "none";
      invoiceId: string | null;
      xeroStatus: string | null;
    };
    labor: {
      totalHours: number;
      totalCost: number;
      calculatedCost: number;
      hasOverride: boolean;
      entryCount: number;
    };
    costs: Record<CostField | "total", number>;
    completion: {
      labor: boolean;
      materials: boolean;
      equipment: boolean;
      subcontractor: boolean;
      other: boolean;
      allComplete: boolean;
      invoiceBlocked: boolean;
    };
    margin: { grossProfit: number; grossMarginPercent: number | null };
  };
}

const fmt = (n: number) =>
  `$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COST_ROWS: Array<{
  field: CostField;
  label: string;
  completionField: CompletionField;
  groupLabel: string;
}> = [
  { field: "actualLaborCosts", label: "Labor", completionField: "laborCostsComplete", groupLabel: "Labor" },
  { field: "actualMaterialsCosts", label: "Materials", completionField: "materialsCostsComplete", groupLabel: "Materials" },
  { field: "equipmentCosts", label: "Equipment", completionField: "equipmentCostsComplete", groupLabel: "Equipment" },
  { field: "subcontractorCosts", label: "Subcontractor", completionField: "subcontractorCostsComplete", groupLabel: "Subcontractor" },
  { field: "permitCosts", label: "Permits", completionField: "otherExpensesComplete", groupLabel: "Other (permits / travel / disposal / misc)" },
  { field: "travelCosts", label: "Travel", completionField: "otherExpensesComplete", groupLabel: "Other (permits / travel / disposal / misc)" },
  { field: "disposalCosts", label: "Disposal", completionField: "otherExpensesComplete", groupLabel: "Other (permits / travel / disposal / misc)" },
  { field: "miscExpenses", label: "Misc", completionField: "otherExpensesComplete", groupLabel: "Other (permits / travel / disposal / misc)" },
];

const COMPLETION_ROWS: Array<{
  field: CompletionField;
  key: keyof BackCostingResponse["data"]["completion"];
  label: string;
}> = [
  { field: "laborCostsComplete", key: "labor", label: "Labor finalised" },
  { field: "materialsCostsComplete", key: "materials", label: "Materials finalised" },
  { field: "equipmentCostsComplete", key: "equipment", label: "Equipment finalised" },
  { field: "subcontractorCostsComplete", key: "subcontractor", label: "Subcontractor finalised" },
  { field: "otherExpensesComplete", key: "other", label: "Other costs finalised (permits / travel / disposal / misc)" },
];

export function BackCostingPanel({ jobId, onOpenTimeEntries }: BackCostingPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = ["/api/jobs", jobId, "back-costing"];

  const { data, isLoading, error } = useQuery<BackCostingResponse>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/back-costing`);
      return res.json();
    },
    enabled: !!jobId,
  });

  const rollup = data?.data;

  const [editingField, setEditingField] = useState<CostField | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");

  useEffect(() => {
    setEditingField(null);
  }, [jobId]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] }),
    ]);

  const costMutation = useMutation({
    mutationFn: async (payload: Partial<Record<CostField, number>>) => {
      const res = await apiRequest("PUT", `/api/jobs/${jobId}/expenses`, payload);
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  const completionMutation = useMutation({
    mutationFn: async (payload: Partial<Record<CompletionField, boolean>>) => {
      const res = await apiRequest(
        "PUT",
        `/api/jobs/${jobId}/expense-completion`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  const startEdit = (field: CostField, current: number) => {
    setEditingField(field);
    setDraftValue(current ? current.toFixed(2) : "");
  };

  const commitEdit = (field: CostField) => {
    const parsed = parseFloat(draftValue);
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    costMutation.mutate({ [field]: next } as Partial<Record<CostField, number>>);
    setEditingField(null);
  };

  const grossMarginDisplay = useMemo(() => {
    if (!rollup) return "—";
    if (rollup.margin.grossMarginPercent === null) return "—";
    return `${rollup.margin.grossMarginPercent.toFixed(1)}%`;
  }, [rollup]);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading back costing…</div>
    );
  }

  if (error || !rollup) {
    return (
      <div className="p-6 text-sm text-destructive">
        Could not load back costing.
      </div>
    );
  }

  const { revenue, labor, costs, completion, margin } = rollup;

  return (
    <div className="space-y-4 p-2 md:p-4" data-testid="back-costing-panel">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Revenue</CardTitle>
            <Badge variant={revenue.source === "invoice" ? "default" : "secondary"}>
              {revenue.source === "invoice"
                ? "Invoiced"
                : revenue.source === "quote"
                  ? "Expected (quote)"
                  : "No revenue yet"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{fmt(revenue.amount)}</div>
          {revenue.source === "quote" && revenue.amount > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              From quote total — no invoice raised yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Labor
          </CardTitle>
          {onOpenTimeEntries && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenTimeEntries}
              data-testid="back-costing-view-time-entries"
            >
              View time entries
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {labor.entryCount === 0 ? (
            <div className="text-sm text-muted-foreground">No time logged yet.</div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-semibold">{fmt(labor.totalCost)}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {labor.totalHours.toFixed(2)} hrs across {labor.entryCount}{" "}
                    {labor.entryCount === 1 ? "entry" : "entries"}
                  </span>
                </div>
              </div>
              {labor.hasOverride && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Manual override — calculated from time entries would be{" "}
                  {fmt(labor.calculatedCost)}.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cost breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {COST_ROWS.map((row) => {
              const value = costs[row.field];
              const isEditing = editingField === row.field;
              return (
                <div
                  key={row.field}
                  className="flex items-center justify-between px-4 py-3"
                  data-testid={`back-costing-row-${row.field}`}
                >
                  <div className="text-sm">{row.label}</div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(row.field);
                            if (e.key === "Escape") setEditingField(null);
                          }}
                          className="w-28 text-right"
                          autoFocus
                          data-testid={`back-costing-input-${row.field}`}
                        />
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => commitEdit(row.field)}
                          disabled={costMutation.isPending}
                          data-testid={`back-costing-save-${row.field}`}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingField(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="font-mono text-sm tabular-nums">
                          {fmt(value)}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(row.field, value)}
                          data-testid={`back-costing-edit-${row.field}`}
                          aria-label={`Edit ${row.label}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <div className="text-sm font-medium">Total cost</div>
              <div className="font-mono text-sm font-semibold tabular-nums">
                {fmt(costs.total)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Margin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Gross profit</div>
              <div className="text-2xl font-semibold">{fmt(margin.grossProfit)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Gross margin</div>
              <div
                className={`text-2xl font-semibold ${
                  margin.grossMarginPercent !== null && margin.grossMarginPercent < 25
                    ? "text-destructive"
                    : ""
                }`}
              >
                {grossMarginDisplay}
              </div>
            </div>
          </div>
          {revenue.source === "none" && (
            <div className="mt-3 text-xs text-muted-foreground">
              No revenue recorded — margin will compute once the job is quoted or invoiced.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {completion.allComplete ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            Completion checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {COMPLETION_ROWS.map((row) => {
            const checked = !!completion[row.key];
            return (
              <label
                key={row.field}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    completionMutation.mutate({
                      [row.field]: next === true,
                    } as Partial<Record<CompletionField, boolean>>);
                  }}
                  disabled={completionMutation.isPending}
                  data-testid={`back-costing-complete-${row.field}`}
                />
                <span className="text-sm">{row.label}</span>
              </label>
            );
          })}
          {completion.invoiceBlocked && !completion.allComplete && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Customer invoicing is blocked until every category is finalised.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

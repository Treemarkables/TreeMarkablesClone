import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ChevronLeft, Loader2, Check } from "lucide-react";

interface Capability {
  key: string;
  module: string;
  label: string;
  kind: "view" | "action";
  requires: string | null;
}
interface MatrixModule {
  module: string;
  capabilities: Capability[];
}
interface LimitDimension {
  key: string;
  label: string;
  unit: string;
}
interface Tier {
  key: string;
  name: string;
  priceNzd: string;
  features: string[];
  limits: Record<string, number | null>;
}
interface Matrix {
  modules: MatrixModule[];
  limitDimensions: LimitDimension[];
  tiers: Tier[];
}

// Stable signature of a tier's features + limits, for dirty-tracking.
const sig = (keys: Set<string>, limits: Record<string, number | null>) => {
  const f = Array.from(keys).sort().join(",");
  const l = Object.keys(limits).sort().map((k) => `${k}=${limits[k] === null ? "∞" : limits[k]}`).join(",");
  return `${f}|${l}`;
};

export default function TierMatrix() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: res, isLoading, isError, error } = useQuery<{ success: boolean; data: Matrix }>({
    queryKey: ["/api/admin/tier-matrix"],
    retry: false,
  });
  const matrix = res?.data;

  // selections[planKey] = Set of capability keys; limitVals[planKey][dim] = cap (null = unlimited).
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [limitVals, setLimitVals] = useState<Record<string, Record<string, number | null>>>({});
  const baseline = useRef<Record<string, string>>({}); // planKey -> sig at load

  useEffect(() => {
    if (!matrix) return;
    const nextSel: Record<string, Set<string>> = {};
    const nextLim: Record<string, Record<string, number | null>> = {};
    const base: Record<string, string> = {};
    for (const t of matrix.tiers) {
      const set = new Set(t.features ?? []);
      const limits = t.limits ?? {};
      nextSel[t.key] = set;
      nextLim[t.key] = { ...limits };
      base[t.key] = sig(set, limits);
    }
    setSelections(nextSel);
    setLimitVals(nextLim);
    baseline.current = base;
  }, [matrix]);

  const dirtyTiers = useMemo(() => {
    return Object.keys(selections).filter((k) => sig(selections[k], limitVals[k] ?? {}) !== baseline.current[k]);
  }, [selections, limitVals]);

  const toggle = (planKey: string, capKey: string, on: boolean) => {
    setSelections((prev) => {
      const set = new Set(prev[planKey]);
      if (on) set.add(capKey);
      else set.delete(capKey);
      return { ...prev, [planKey]: set };
    });
  };

  const setLimit = (planKey: string, dim: string, raw: string) => {
    // Blank = unlimited (null); otherwise a non-negative integer.
    const trimmed = raw.trim();
    let val: number | null;
    if (trimmed === "") val = null;
    else {
      const n = parseInt(trimmed, 10);
      if (!Number.isFinite(n) || n < 0) return; // ignore invalid keystrokes
      val = n;
    }
    setLimitVals((prev) => ({ ...prev, [planKey]: { ...prev[planKey], [dim]: val } }));
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const planKey of dirtyTiers) {
        const r = await apiRequest("PUT", `/api/admin/tier-matrix/${planKey}`, {
          features: Array.from(selections[planKey]),
          limits: limitVals[planKey] ?? {},
        });
        const j = await r.json();
        if (!j.success) throw new Error(j.message || `Couldn't save ${planKey}.`);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-matrix"] }),
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't save tiers", description: e.message }),
  });

  return (
    <div className="pt-20 px-4 md:px-8 max-w-6xl mx-auto pb-24">
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground mb-4">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to settings
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Tier feature matrix</h1>
          <p className="text-muted-foreground">
            Tick which features each plan includes. Add-on rows are the metered extras —
            tick one to bundle it into a tier for free.
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={!dirtyTiers.length || save.isPending}>
          {save.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
          ) : dirtyTiers.length ? (
            `Save ${dirtyTiers.length} change${dirtyTiers.length > 1 ? "s" : ""}`
          ) : (
            <><Check className="h-4 w-4 mr-2" /> All saved</>
          )}
        </Button>
      </div>

      {isError ? (
        <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Couldn’t load the tier matrix.</p>
          <p className="text-muted-foreground mt-1">{(error as Error)?.message || "Unknown error"}</p>
          <p className="text-muted-foreground mt-2">
            If this says “Platform operator only”, you’re not logged in as the Treemarkables operator account.
          </p>
        </div>
      ) : isLoading || !matrix ? (
        <div className="flex items-center text-muted-foreground mt-8">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
        </div>
      ) : (
        <>
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-16 z-10 bg-background">
              <tr className="border-b border-border">
                <th className="text-left font-medium p-3 min-w-[260px]">Feature</th>
                {matrix.tiers.map((t) => (
                  <th key={t.key} className="p-3 text-center font-medium min-w-[120px]">
                    <div>{t.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      ${Number(t.priceNzd).toFixed(0)}/mo · {selections[t.key]?.size ?? 0} on
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.modules.map((mod) => (
                <Fragment key={mod.module}>
                  <tr className="bg-muted/50 border-b border-border">
                    <td colSpan={matrix.tiers.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {mod.module}
                    </td>
                  </tr>
                  {mod.capabilities.map((cap) => {
                    const isAddon = cap.requires?.startsWith("addon:");
                    return (
                      <tr key={cap.key} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="p-3">
                          <span className="flex items-center gap-2">
                            {cap.label}
                            {isAddon && <Badge variant="secondary" className="text-[10px]">add-on</Badge>}
                            {cap.kind === "view" && <span className="text-[10px] text-muted-foreground">(view)</span>}
                          </span>
                        </td>
                        {matrix.tiers.map((t) => (
                          <td key={t.key} className="p-3 text-center">
                            <Checkbox
                              checked={selections[t.key]?.has(cap.key) ?? false}
                              onCheckedChange={(v) => toggle(t.key, cap.key, v === true)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-1">Usage limits</h2>
          <p className="text-muted-foreground text-sm mb-3">
            How much of each shared feature a tier gets. Leave a cell <span className="font-medium">blank for unlimited</span>; enter <span className="font-medium">0</span> for none.
          </p>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-background">
                <tr className="border-b border-border">
                  <th className="text-left font-medium p-3 min-w-[260px]">Dimension</th>
                  {matrix.tiers.map((t) => (
                    <th key={t.key} className="p-3 text-center font-medium min-w-[120px]">{t.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(matrix.limitDimensions ?? []).map((dim) => (
                  <tr key={dim.key} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="p-3">{dim.label}</td>
                    {matrix.tiers.map((t) => {
                      const v = limitVals[t.key]?.[dim.key];
                      return (
                        <td key={t.key} className="p-2 text-center">
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="h-8 w-24 mx-auto text-center"
                            placeholder="Unlimited"
                            value={v === null || v === undefined ? "" : String(v)}
                            onChange={(e) => setLimit(t.key, dim.key, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

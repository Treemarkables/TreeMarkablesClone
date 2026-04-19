import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Users, DollarSign, Building2, Target, Info, ChevronRight, Minus } from "lucide-react";

const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-NZ");

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000) return "$" + Math.round(n / 1000) + "K";
  return "$" + Math.round(n);
};

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix = "$",
  suffix = "",
  tooltip,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : `${prefix}${Math.round(value).toLocaleString("en-NZ")}${suffix}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium truncate">{label}</span>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-sm font-semibold text-foreground shrink-0">{display}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

function StepperInput({
  label,
  value,
  min,
  max,
  onChange,
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover-elevate active-elevate-2 text-muted-foreground"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-8 text-center text-sm font-semibold">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover-elevate active-elevate-2 text-muted-foreground"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function calc(inputs: {
  billableStaff: number;
  avgBillableWage: number;
  nonBillableStaff: number;
  avgNonBillableWage: number;
  oncostPct: number;
  adminCost: number;
  ownerWage: number;
  revenuePerStaff: number;
  materialsPct: number;
  baseOverhead: number;
  yardCost: number;
  targetNetProfit: number;
  overheadScalePct: number;
}) {
  const {
    billableStaff, avgBillableWage, nonBillableStaff, avgNonBillableWage,
    oncostPct, adminCost, ownerWage, revenuePerStaff, materialsPct,
    baseOverhead, yardCost, targetNetProfit, overheadScalePct,
  } = inputs;

  const revenue = billableStaff * revenuePerStaff;
  const billableWages = billableStaff * avgBillableWage * (1 + oncostPct / 100);
  const nonBillableWages = nonBillableStaff * avgNonBillableWage * (1 + oncostPct / 100);
  const totalWages = billableWages + nonBillableWages + adminCost + ownerWage;
  const materials = revenue * (materialsPct / 100);
  const totalOverhead = baseOverhead + yardCost;
  const totalCosts = totalWages + materials + totalOverhead;
  const netProfit = revenue - totalCosts;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const breakEven = totalCosts;
  const gapToTarget = targetNetProfit - netProfit;

  // What-if rows: +0 through +5 extra billable staff
  const whatIf = Array.from({ length: 7 }, (_, i) => {
    const extraStaff = i;
    const extraRevenue = extraStaff * revenuePerStaff;
    const extraWages = extraStaff * avgBillableWage * (1 + oncostPct / 100);
    const extraMaterials = extraStaff * revenuePerStaff * (materialsPct / 100);
    const extraOverhead = baseOverhead * (overheadScalePct / 100) * extraStaff;
    const extraCost = extraWages + extraMaterials + extraOverhead;
    const incrementalProfit = extraRevenue - extraCost;
    const cumulativeProfit = netProfit + incrementalProfit;
    const totalRevenue = revenue + extraRevenue;
    const totalStaff = billableStaff + extraStaff;
    return { extraStaff, extraRevenue, extraCost, incrementalProfit, cumulativeProfit, totalRevenue, totalStaff };
  });

  return {
    revenue, billableWages, nonBillableWages, totalWages,
    materials, totalOverhead, totalCosts, netProfit,
    profitMargin, breakEven, gapToTarget, whatIf,
  };
}

export default function ProfitabilityCalculator() {
  // --- State ---
  const [billableStaff, setBillableStaff] = useState(5);
  const [avgBillableWage, setAvgBillableWage] = useState(67200);
  const [nonBillableStaff, setNonBillableStaff] = useState(1);
  const [avgNonBillableWage, setAvgNonBillableWage] = useState(60000);
  const [oncostPct, setOncostPct] = useState(17);
  const [adminCost, setAdminCost] = useState(65000);
  const [ownerWage, setOwnerWage] = useState(100000);
  const [revenuePerStaff, setRevenuePerStaff] = useState(140000);
  const [materialsPct, setMaterialsPct] = useState(20);
  const [baseOverhead, setBaseOverhead] = useState(304000);
  const [yardCost, setYardCost] = useState(25000);
  const [targetNetProfit, setTargetNetProfit] = useState(150000);
  const [overheadScalePct, setOverheadScalePct] = useState(15);

  const result = useMemo(() => calc({
    billableStaff, avgBillableWage, nonBillableStaff, avgNonBillableWage,
    oncostPct, adminCost, ownerWage, revenuePerStaff, materialsPct,
    baseOverhead, yardCost, targetNetProfit, overheadScalePct,
  }), [
    billableStaff, avgBillableWage, nonBillableStaff, avgNonBillableWage,
    oncostPct, adminCost, ownerWage, revenuePerStaff, materialsPct,
    baseOverhead, yardCost, targetNetProfit, overheadScalePct,
  ]);

  const profitStatus =
    result.netProfit >= targetNetProfit ? "green"
    : result.netProfit >= 0 ? "amber"
    : "red";

  const statusColors = {
    green: "border-green-500 bg-green-50 dark:bg-green-950/30",
    amber: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    red: "border-red-500 bg-red-50 dark:bg-red-950/30",
  };

  const profitColor = {
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
    red: "text-red-700 dark:text-red-400",
  };

  // Stacked bar segments as % of revenue (or cost)
  const barBase = Math.max(result.revenue, result.totalCosts);
  const wagesPct = barBase > 0 ? (result.totalWages / barBase) * 100 : 0;
  const matPct = barBase > 0 ? (result.materials / barBase) * 100 : 0;
  const overheadPct = barBase > 0 ? (result.totalOverhead / barBase) * 100 : 0;
  const profitBarPct = barBase > 0 ? Math.max(0, result.netProfit / barBase) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profitability Calculator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-loaded with Treemarkables' current numbers. Adjust any slider to model different scenarios — all figures ex-GST, in NZD.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: Inputs */}
          <div className="lg:col-span-2 space-y-4">

            {/* Revenue */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-5">
                <SliderInput
                  label="Revenue per crew / year"
                  value={revenuePerStaff}
                  min={60000} max={300000} step={5000}
                  onChange={setRevenuePerStaff}
                  tooltip="How much billable revenue each crew member generates annually. Currently $700K ÷ 5 crew = $140K each."
                />
                <SliderInput
                  label="Materials & subcontractors"
                  value={materialsPct}
                  min={0} max={60} step={1}
                  onChange={setMaterialsPct}
                  prefix="" suffix="%"
                  format={(v) => `${v}% of revenue`}
                  tooltip="Percentage of revenue spent on materials, plant hire, and subcontractors. Scales automatically as revenue grows."
                />
              </CardContent>
            </Card>

            {/* Staffing */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Staffing & Wages
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-5">
                <StepperInput
                  label="Billable crew"
                  value={billableStaff}
                  min={1} max={20}
                  onChange={setBillableStaff}
                  tooltip="Staff who directly generate revenue on the tools."
                />
                <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Current wage breakdown: 3 × $62,000 + 2 × $75,000 = $336,000 total
                  <br />Average: {fmt(avgBillableWage)} per person
                </div>
                <SliderInput
                  label="Avg billable crew wage"
                  value={avgBillableWage}
                  min={40000} max={120000} step={1000}
                  onChange={setAvgBillableWage}
                  tooltip="Average annual base wage per billable crew member before oncosts."
                />
                <StepperInput
                  label="Non-billable staff"
                  value={nonBillableStaff}
                  min={0} max={10}
                  onChange={setNonBillableStaff}
                  tooltip="Supervisors, labourers, or others who don't directly bill."
                />
                <SliderInput
                  label="Avg non-billable wage"
                  value={avgNonBillableWage}
                  min={40000} max={120000} step={1000}
                  onChange={setAvgNonBillableWage}
                />
                <SliderInput
                  label="Oncosts (KiwiSaver, ACC, leave)"
                  value={oncostPct}
                  min={0} max={35} step={1}
                  onChange={setOncostPct}
                  prefix="" suffix="%"
                  format={(v) => `${v}% added to wages`}
                  tooltip="NZ statutory oncosts: KiwiSaver employer 3%, ACC ~2%, annual leave 8%, sick leave ~4% = ~17% total."
                />
                <SliderInput
                  label="Extra admin (annual cost)"
                  value={adminCost}
                  min={0} max={150000} step={1000}
                  onChange={setAdminCost}
                  tooltip="Full-time admin salary. Entered as a flat cost — oncosts applied separately if needed."
                />
                <SliderInput
                  label="Your wage"
                  value={ownerWage}
                  min={0} max={300000} step={5000}
                  onChange={setOwnerWage}
                  tooltip="Owner/director salary drawn from the business. Net profit is calculated after this."
                />
              </CardContent>
            </Card>

            {/* Overheads */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Fixed Overheads
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-5">
                <SliderInput
                  label="Base overhead"
                  value={baseOverhead}
                  min={50000} max={800000} step={5000}
                  onChange={setBaseOverhead}
                  tooltip="Fixed costs excluding wages: vehicles, insurance, fuel, equipment maintenance, current yard, accountant, etc. Derived as $700K − $336K crew wages − $60K non-billable = $304K."
                />
                <SliderInput
                  label="Extra yard / facilities"
                  value={yardCost}
                  min={0} max={200000} step={1000}
                  onChange={setYardCost}
                  tooltip="Additional rent or lease cost for the bigger yard you're planning."
                />
                <SliderInput
                  label="Overhead growth per extra crew"
                  value={overheadScalePct}
                  min={0} max={50} step={1}
                  onChange={setOverheadScalePct}
                  prefix="" suffix="%"
                  format={(v) => `${v}% of base overhead`}
                  tooltip="What % of base overhead is added for each extra crew member. At 15%, each extra person adds $304K × 15% = ~$46K in overhead (tools, PPE, vehicle share). Set lower if your fixed costs are mostly shared."
                />
              </CardContent>
            </Card>

            {/* Goals */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Your Goal
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-5">
                <SliderInput
                  label="Target net business profit"
                  value={targetNetProfit}
                  min={0} max={1000000} step={10000}
                  onChange={setTargetNetProfit}
                  tooltip="Net profit left in the business after all costs including your wage. Your combined goal: $100K wage + $150K profit = $250K total."
                />
                <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Total earnings goal: {fmt(ownerWage + targetNetProfit)} (your wage + business profit)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-3 space-y-4">

            {/* Summary card */}
            <Card className={`border-2 ${statusColors[profitStatus]}`}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net Profit</div>
                    <div className={`text-4xl font-bold ${profitColor[profitStatus]}`}>
                      {fmt(result.netProfit)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {result.profitMargin.toFixed(1)}% margin
                    </div>
                  </div>
                  <div className="text-right">
                    {result.netProfit >= targetNetProfit ? (
                      <Badge className="bg-green-500 text-white">Target reached</Badge>
                    ) : result.netProfit >= 0 ? (
                      <Badge className="bg-amber-500 text-white">Below target</Badge>
                    ) : (
                      <Badge variant="destructive">Loss-making</Badge>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.netProfit < targetNetProfit
                        ? `${fmt(result.gapToTarget)} short of goal`
                        : `${fmt(-result.gapToTarget)} above goal`}
                    </div>
                  </div>
                </div>

                {/* Stacked bar */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Revenue breakdown</div>
                  <div className="flex h-5 rounded-md overflow-hidden w-full gap-px">
                    <div className="bg-blue-500" style={{ width: `${wagesPct}%` }} title={`Wages: ${fmt(result.totalWages)}`} />
                    <div className="bg-orange-400" style={{ width: `${matPct}%` }} title={`Materials: ${fmt(result.materials)}`} />
                    <div className="bg-slate-400" style={{ width: `${overheadPct}%` }} title={`Overhead: ${fmt(result.totalOverhead)}`} />
                    {profitBarPct > 0 && (
                      <div className="bg-green-500" style={{ width: `${profitBarPct}%` }} title={`Profit: ${fmt(result.netProfit)}`} />
                    )}
                    {result.netProfit < 0 && (
                      <div className="bg-red-400 ml-auto" style={{ width: `${Math.min(Math.abs(result.netProfit / barBase) * 100, 100)}%` }} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500 mr-1" />Wages</span>
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400 mr-1" />Materials</span>
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-400 mr-1" />Overhead</span>
                    <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 mr-1" />Profit</span>
                  </div>
                </div>

                {/* Breakdown grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t border-border/50">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Revenue</div>
                    <div className="text-base font-semibold">{fmt(result.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total Costs</div>
                    <div className="text-base font-semibold">{fmt(result.totalCosts)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Wages (all staff)</div>
                    <div className="text-sm font-medium">{fmt(result.totalWages)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Materials / subs</div>
                    <div className="text-sm font-medium">{fmt(result.materials)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Fixed Overhead</div>
                    <div className="text-sm font-medium">{fmt(result.totalOverhead)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Break-even Revenue</div>
                    <div className="text-sm font-medium">{fmt(result.breakEven)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Your Wage</div>
                    <div className="text-sm font-medium">{fmt(ownerWage)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total Owner Earnings</div>
                    <div className="text-sm font-semibold">{fmt(ownerWage + Math.max(0, result.netProfit))}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What-if table */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  What if I add more crew?
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shows the cumulative impact of adding billable crew to your current setup.
                  Overhead grows at {overheadScalePct}% of base per extra person.
                </p>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Crew</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Total Rev</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Extra Cost</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">+Contribution</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.whatIf.map((row, i) => {
                        const isTarget = row.cumulativeProfit >= targetNetProfit && (i === 0 || result.whatIf[i - 1].cumulativeProfit < targetNetProfit);
                        const alreadyMet = i > 0 && result.whatIf[0].cumulativeProfit >= targetNetProfit;
                        const meetsTarget = row.cumulativeProfit >= targetNetProfit;

                        return (
                          <tr
                            key={i}
                            className={`border-b border-border/60 last:border-0 ${isTarget ? "bg-green-50 dark:bg-green-950/30" : meetsTarget ? "bg-green-50/50 dark:bg-green-950/20" : ""}`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{row.totalStaff}</span>
                                {i === 0 ? (
                                  <Badge variant="secondary" className="text-xs">current</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">+{row.extraStaff}</span>
                                )}
                                {isTarget && (
                                  <Badge className="bg-green-500 text-white text-xs">goal</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtK(row.totalRevenue)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                              {i === 0 ? "—" : fmtK(row.extraCost)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {i === 0 ? "—" : (
                                <span className={row.incrementalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600"}>
                                  {row.incrementalProfit >= 0 ? "+" : ""}{fmtK(row.incrementalProfit)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                              <span className={row.cumulativeProfit >= 0 ? meetsTarget ? "text-green-700 dark:text-green-400" : "" : "text-red-600 dark:text-red-400"}>
                                {fmtK(row.cumulativeProfit)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border/60">
                  Extra cost per crew = wage + oncosts + {materialsPct}% materials + {overheadScalePct}% of base overhead ({fmtK(baseOverhead * overheadScalePct / 100)} per person).
                  Revenue per extra crew member: {fmtK(revenuePerStaff)}.
                </div>
              </CardContent>
            </Card>

            {/* Economy of scale note */}
            <Card>
              <CardContent className="p-4">
                <div className="text-sm font-semibold mb-2">Understanding the numbers</div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Revenue per crew member:</strong> {fmt(revenuePerStaff)}/yr.
                    Each extra crew should generate at least {fmt(avgBillableWage * (1 + oncostPct / 100) + revenuePerStaff * (materialsPct / 100))} just to cover their own wages and materials.
                  </p>
                  <p>
                    <strong className="text-foreground">Net contribution per extra crew:</strong>{" "}
                    {fmt(revenuePerStaff * (1 - materialsPct / 100) - avgBillableWage * (1 + oncostPct / 100) - baseOverhead * overheadScalePct / 100)} per year — this is the incremental profit each additional crew member adds after covering their costs.
                  </p>
                  <p>
                    <strong className="text-foreground">Economies of scale:</strong> Your base overhead of {fmt(baseOverhead)} doesn't grow linearly.
                    At {overheadScalePct}% per extra person, adding crew is efficient — shared vehicles, yard, and admin absorb more volume without proportional cost increases.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

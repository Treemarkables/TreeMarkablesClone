import { useState } from "react";

const fmt = (n: number) =>
  n < 0
    ? `-$${Math.abs(Math.round(n)).toLocaleString()}`
    : `$${Math.round(n).toLocaleString()}`;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const parseNum = (s: string) => parseFloat(s.replace(/[^0-9.\-]/g, ""));

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}

const Slider = ({ label, value, min, max, step, onChange, format }: SliderProps) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: "1.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <span style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888" }}>{label}</span>
        <span style={{ fontSize: "1rem", fontFamily: "'DM Mono', monospace", color: "#39FF14", fontWeight: 600 }}>
          {format(value)}
        </span>
      </div>
      <div style={{ position: "relative", height: "44px", display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: "6px", background: "#1a1a1a", borderRadius: "3px", pointerEvents: "none" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, #1a6600, #39FF14)",
            borderRadius: "3px",
          }} />
        </div>
        <div style={{
          position: "absolute",
          left: `calc(${pct}% - 8px)`,
          width: "16px", height: "16px",
          background: "#39FF14", borderRadius: "50%",
          boxShadow: "0 0 10px #39FF14aa",
          pointerEvents: "none",
          zIndex: 1,
        }} />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute",
            left: 0, top: 0,
            width: "100%", height: "100%",
            opacity: 0,
            cursor: "pointer",
            margin: 0,
            zIndex: 2,
            WebkitAppearance: "none",
            touchAction: "none",
          }}
        />
      </div>
    </div>
  );
};

type SolveFor = "hourlyRate" | "billableStaff" | "efficiency" | "workingDays";

const SOLVE_OPTIONS: { key: SolveFor; label: string }[] = [
  { key: "hourlyRate", label: "Hourly Rate" },
  { key: "billableStaff", label: "Billable Staff" },
  { key: "efficiency", label: "Efficiency" },
  { key: "workingDays", label: "Working Days" },
];

const SOLVE_BOUNDS: Record<SolveFor, { min: number; max: number }> = {
  hourlyRate: { min: 40, max: 400 },
  billableStaff: { min: 1, max: 30 },
  efficiency: { min: 10, max: 100 },
  workingDays: { min: 100, max: 320 },
};

type MetricKey = "revenue" | "dailyRevenue" | "perStaffYear" | "perPersonDay" | "grossProfit" | "netProfit";

// Which inputs each metric depends on — if the chosen solve-for isn't in the formula, we can't edit that metric.
const METRIC_DEPS: Record<MetricKey, Record<SolveFor, boolean>> = {
  revenue:       { hourlyRate: true, billableStaff: true,  efficiency: true, workingDays: true  },
  dailyRevenue:  { hourlyRate: true, billableStaff: true,  efficiency: true, workingDays: false },
  perStaffYear:  { hourlyRate: true, billableStaff: false, efficiency: true, workingDays: true  },
  perPersonDay:  { hourlyRate: true, billableStaff: false, efficiency: true, workingDays: false },
  grossProfit:   { hourlyRate: true, billableStaff: true,  efficiency: true, workingDays: true  },
  netProfit:     { hourlyRate: true, billableStaff: true,  efficiency: true, workingDays: true  },
};

interface EditableCardProps {
  label: string;
  value: number;
  formatted: string;
  sub?: string;
  highlight?: boolean;
  canEdit: boolean;
  disabledHint?: string;
  onCommit: (v: number) => void;
}

const EditableCard = ({ label, value, formatted, sub, highlight, canEdit, disabledHint, onCommit }: EditableCardProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => {
    if (!canEdit) return;
    setDraft(String(Math.round(value)));
    setEditing(true);
  };

  const commit = () => {
    const n = parseNum(draft);
    if (!Number.isNaN(n)) onCommit(n);
    setEditing(false);
  };

  return (
    <div
      onClick={start}
      title={canEdit ? "Tap to edit — other metrics will recalculate" : disabledHint}
      style={{
        background: highlight ? "linear-gradient(135deg, #0d2200, #0a1a00)" : "#0d0d0d",
        border: `1px solid ${highlight ? "#39FF14" : "#222"}`,
        borderRadius: "8px", padding: "1.2rem 1.4rem",
        boxShadow: highlight ? "0 0 20px #39FF1422" : "none",
        flex: "1 1 140px",
        cursor: canEdit ? "pointer" : "not-allowed",
        opacity: canEdit ? 1 : 0.55,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: highlight ? "#39FF14aa" : "#555" }}>{label}</div>
        {canEdit && !editing && (
          <div style={{ fontSize: "0.62rem", color: highlight ? "#39FF1466" : "#333", letterSpacing: "0.08em" }}>EDIT</div>
        )}
      </div>
      {editing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            background: "#000",
            border: `1px solid ${highlight ? "#39FF14" : "#333"}`,
            borderRadius: "4px",
            color: highlight ? "#39FF14" : "#ccc",
            fontFamily: "'DM Mono', monospace",
            fontSize: highlight ? "1.3rem" : "1.1rem",
            fontWeight: 700,
            padding: "0.3rem 0.5rem",
            outline: "none",
          }}
        />
      ) : (
        <div style={{ fontSize: highlight ? "1.6rem" : "1.3rem", fontFamily: "'DM Mono', monospace", color: highlight ? "#39FF14" : "#ccc", fontWeight: 700, lineHeight: 1 }}>{formatted}</div>
      )}
      {sub && <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "0.3rem" }}>{sub}</div>}
    </div>
  );
};

export default function ProfitabilityCalculator() {
  const [hourlyRate, setHourlyRate] = useState(125);
  const [billableStaff, setBillableStaff] = useState(6);
  const [efficiency, setEfficiency] = useState(85);
  const [workingDays, setWorkingDays] = useState(215);
  const [opCosts, setOpCosts] = useState(750000);
  const [ownerSalary, setOwnerSalary] = useState(100000);
  const [targetNet, setTargetNet] = useState(300000);
  const [solveFor, setSolveFor] = useState<SolveFor>("hourlyRate");

  const hoursPerPersonPerDay = 8 * (efficiency / 100);
  const totalBillableHours = hoursPerPersonPerDay * billableStaff * workingDays;
  const revenue = totalBillableHours * hourlyRate;
  const grossProfit = revenue - opCosts;
  const netProfit = grossProfit - ownerSalary;
  const dailyRevenue = revenue / workingDays;
  const revenuePerPerson = revenue / billableStaff;
  const perPersonDay = dailyRevenue / billableStaff;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const gap = netProfit - targetNet;

  const applyMetricEdit = (metric: MetricKey, targetValue: number) => {
    // Step 1: convert the edited metric back to "required annual revenue"
    let needed: number;
    switch (metric) {
      case "revenue":       needed = targetValue; break;
      case "dailyRevenue":  needed = targetValue * workingDays; break;
      case "perStaffYear":  needed = targetValue * billableStaff; break;
      case "perPersonDay":  needed = targetValue * billableStaff * workingDays; break;
      case "grossProfit":   needed = targetValue + opCosts; break;
      case "netProfit":     needed = targetValue + opCosts + ownerSalary; break;
    }
    if (!Number.isFinite(needed) || needed < 0) return;

    // Step 2: solve revenue = 8*(eff/100)*staff*days*rate for the chosen input
    const H = 8 * (efficiency / 100);
    let next: number;
    switch (solveFor) {
      case "hourlyRate":    next = needed / (H * billableStaff * workingDays); break;
      case "billableStaff": next = needed / (H * workingDays * hourlyRate); break;
      case "efficiency":    next = (needed / (8 * billableStaff * workingDays * hourlyRate)) * 100; break;
      case "workingDays":   next = needed / (H * billableStaff * hourlyRate); break;
    }
    if (!Number.isFinite(next)) return;

    const { min, max } = SOLVE_BOUNDS[solveFor];
    const clamped = clamp(next, min, max);
    const rounded = solveFor === "billableStaff" || solveFor === "workingDays" || solveFor === "efficiency"
      ? Math.round(clamped)
      : Math.round(clamped * 100) / 100;

    if (solveFor === "hourlyRate") setHourlyRate(rounded);
    if (solveFor === "billableStaff") setBillableStaff(rounded);
    if (solveFor === "efficiency") setEfficiency(rounded);
    if (solveFor === "workingDays") setWorkingDays(rounded);
  };

  const solveForLabel = SOLVE_OPTIONS.find((o) => o.key === solveFor)!.label;
  const disabledHint = `"${solveForLabel}" doesn't change this metric — pick a different variable to solve for.`;

  return (
    <div style={{
      background: "#080808",
      minHeight: "100vh",
      padding: "1.5rem 1rem",
      fontFamily: "'DM Sans', sans-serif",
      color: "#fff",
      backgroundImage: "radial-gradient(ellipse at 20% 20%, #0d2200 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, #001a00 0%, transparent 50%)",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 1px; height: 1px; }
        input[type=range]::-moz-range-thumb { width: 1px; height: 1px; border: none; background: transparent; }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <div style={{ maxWidth: "600px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.3rem" }}>
            <div style={{ width: "10px", height: "10px", background: "#39FF14", borderRadius: "50%", boxShadow: "0 0 8px #39FF14", flexShrink: 0 }} />
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#39FF14" }}>Treemarkables Ltd</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 5vw, 1.6rem)", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>
            Profit Calculator
          </h1>
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#555" }}>FY2026 — tap any metric to edit, or drag the sliders</p>
        </div>

        {/* Target Banner — editable target */}
        <TargetBanner targetNet={targetNet} setTargetNet={setTargetNet} gap={gap} />

        {/* Solve-for selector */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1rem 1.2rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "0.6rem" }}>
            When I edit a metric, solve for
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {SOLVE_OPTIONS.map((opt) => {
              const active = solveFor === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSolveFor(opt.key)}
                  style={{
                    flex: "1 1 120px",
                    padding: "0.55rem 0.8rem",
                    background: active ? "linear-gradient(135deg, #0d2200, #0a1a00)" : "#111",
                    border: `1px solid ${active ? "#39FF14" : "#222"}`,
                    borderRadius: "6px",
                    color: active ? "#39FF14" : "#888",
                    fontSize: "0.8rem",
                    fontWeight: active ? 600 : 500,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    textAlign: "center",
                    fontFamily: "inherit",
                    boxShadow: active ? "0 0 12px #39FF1422" : "none",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1.2rem 1.2rem 0.2rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "0.8rem" }}>Variables</div>
          <Slider label="Hourly Rate" value={hourlyRate} min={80} max={250} step={5} onChange={setHourlyRate} format={(v) => `$${v}/hr`} />
          <Slider label="Billable Staff" value={billableStaff} min={1} max={12} step={1} onChange={setBillableStaff} format={(v) => `${v} people`} />
          <Slider label="Efficiency" value={efficiency} min={50} max={100} step={1} onChange={setEfficiency} format={(v) => `${v}%`} />
          <Slider label="Working Days / Year" value={workingDays} min={150} max={260} step={1} onChange={setWorkingDays} format={(v) => `${v} days`} />
          <Slider label="Operating Costs" value={opCosts} min={400000} max={1200000} step={5000} onChange={setOpCosts} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Slider label="Your Salary" value={ownerSalary} min={0} max={300000} step={5000} onChange={setOwnerSalary} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
        </div>

        {/* Output Cards — all editable */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "0.7rem" }}>
          <EditableCard
            label="Annual Revenue"
            value={revenue}
            formatted={fmt(revenue)}
            sub={`${fmt(dailyRevenue)}/day`}
            canEdit={METRIC_DEPS.revenue[solveFor]}
            disabledHint={disabledHint}
            onCommit={(v) => applyMetricEdit("revenue", v)}
          />
          <EditableCard
            label="Per Staff / Year"
            value={revenuePerPerson}
            formatted={fmt(revenuePerPerson)}
            sub={`${billableStaff} staff`}
            canEdit={METRIC_DEPS.perStaffYear[solveFor]}
            disabledHint={disabledHint}
            onCommit={(v) => applyMetricEdit("perStaffYear", v)}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "0.7rem" }}>
          <EditableCard
            label="Daily Target (Team)"
            value={dailyRevenue}
            formatted={fmt(dailyRevenue)}
            sub="across all billable staff"
            canEdit={METRIC_DEPS.dailyRevenue[solveFor]}
            disabledHint={disabledHint}
            onCommit={(v) => applyMetricEdit("dailyRevenue", v)}
          />
          <EditableCard
            label="Per Person / Day"
            value={perPersonDay}
            formatted={fmt(perPersonDay)}
            sub={`at ${hoursPerPersonPerDay.toFixed(1)} billable hrs`}
            canEdit={METRIC_DEPS.perPersonDay[solveFor]}
            disabledHint={disabledHint}
            onCommit={(v) => applyMetricEdit("perPersonDay", v)}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "1.5rem" }}>
          <EditableCard
            label="Gross Profit"
            value={grossProfit}
            formatted={fmt(grossProfit)}
            sub="before your salary"
            canEdit={METRIC_DEPS.grossProfit[solveFor]}
            disabledHint={disabledHint}
            onCommit={(v) => applyMetricEdit("grossProfit", v)}
          />
          <EditableCard
            label="Net Profit"
            value={netProfit}
            formatted={fmt(netProfit)}
            sub={`${margin.toFixed(1)}% margin`}
            highlight
            canEdit={METRIC_DEPS.netProfit[solveFor]}
            disabledHint={disabledHint}
            onCommit={(v) => applyMetricEdit("netProfit", v)}
          />
        </div>

        {/* Breakdown */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1.2rem 1.2rem" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "1rem" }}>Breakdown</div>
          {([
            ["Billable hrs/person/day", `${hoursPerPersonPerDay.toFixed(1)} hrs`],
            ["Total billable hrs/year", `${Math.round(totalBillableHours).toLocaleString()} hrs`],
            ["Revenue", fmt(revenue)],
            ["Operating Costs", `− ${fmt(opCosts)}`],
            ["Gross Profit", fmt(grossProfit)],
            ["Your Salary", `− ${fmt(ownerSalary)}`],
            ["Net Profit", fmt(netProfit)],
          ] as [string, string][]).map(([label, val], i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "0.5rem 0",
              borderTop: i === 6 ? "1px solid #222" : "none",
              borderBottom: "1px solid #111",
              gap: "1rem",
            }}>
              <span style={{ fontSize: "0.82rem", color: "#555" }}>{label}</span>
              <span style={{ fontSize: "0.88rem", fontFamily: "'DM Mono', monospace", color: i === 6 ? "#39FF14" : "#aaa", fontWeight: i === 6 ? 700 : 400, whiteSpace: "nowrap" }}>{val}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

interface TargetBannerProps {
  targetNet: number;
  setTargetNet: (v: number) => void;
  gap: number;
}

function TargetBanner({ targetNet, setTargetNet, gap }: TargetBannerProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => {
    setDraft(String(Math.round(targetNet)));
    setEditing(true);
  };

  const commit = () => {
    const n = parseNum(draft);
    if (!Number.isNaN(n) && n >= 0) setTargetNet(Math.round(n));
    setEditing(false);
  };

  return (
    <div
      onClick={() => { if (!editing) start(); }}
      style={{
        background: gap >= 0 ? "linear-gradient(90deg, #0d2200, #0a1800)" : "#120000",
        border: `1px solid ${gap >= 0 ? "#39FF14" : "#ff3333"}`,
        borderRadius: "8px", padding: "0.9rem 1.2rem",
        marginBottom: "1.5rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "0.5rem",
        cursor: editing ? "default" : "pointer",
      }}
    >
      <span style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        Target:
        {editing ? (
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#000",
              border: "1px solid #333",
              borderRadius: "4px",
              color: "#ccc",
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.9rem",
              fontWeight: 600,
              padding: "0.15rem 0.4rem",
              width: "110px",
              outline: "none",
              textTransform: "none",
              letterSpacing: "normal",
            }}
          />
        ) : (
          <span style={{ color: "#ccc", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(targetNet)}</span>
        )}
        <span style={{ color: "#444" }}>net profit</span>
      </span>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.95rem", fontWeight: 700, color: gap >= 0 ? "#39FF14" : "#ff4444" }}>
        {gap >= 0 ? `+${fmt(gap)} above` : `${fmt(Math.abs(gap))} below`}
      </span>
    </div>
  );
}

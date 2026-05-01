import { useState } from "react";

const fmt = (n: number) =>
  n < 0
    ? `-$${Math.abs(Math.round(n)).toLocaleString()}`
    : `$${Math.round(n).toLocaleString()}`;

const fmt2 = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

interface StatCardProps {
  label: string;
  formatted: string;
  sub?: string;
  highlight?: boolean;
}

const StatCard = ({ label, formatted, sub, highlight }: StatCardProps) => (
  <div
    style={{
      background: highlight ? "linear-gradient(135deg, #0d2200, #0a1a00)" : "#0d0d0d",
      border: `1px solid ${highlight ? "#39FF14" : "#222"}`,
      borderRadius: "8px", padding: "1.2rem 1.4rem",
      boxShadow: highlight ? "0 0 20px #39FF1422" : "none",
      flex: "1 1 140px",
    }}
  >
    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: highlight ? "#39FF14aa" : "#555", marginBottom: "0.4rem" }}>{label}</div>
    <div style={{ fontSize: highlight ? "1.6rem" : "1.3rem", fontFamily: "'DM Mono', monospace", color: highlight ? "#39FF14" : "#ccc", fontWeight: 700, lineHeight: 1 }}>{formatted}</div>
    {sub && <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "0.3rem" }}>{sub}</div>}
  </div>
);

// Non-salary variable cost per person (NZD):
// ACC 2021 + KiwiSaver 2310 + Chainsaw 3935 + R&M 5594 + Waste 1682 +
// Training 1387 + Tools 159 + General (50%) 417 + H&S (50%) 699 + Staff Exp 50
const VARIABLE_PER_PERSON_EX_SALARY = 18254;
const BASE_WORKING_DAYS = 260;
const VEHICLE_COST_THRESHOLD_STAFF = 8;
const ADDITIONAL_VEHICLE_COST_ESTIMATE = 54000;

export default function ProfitabilityCalculator() {
  const [billableStaff, setBillableStaff] = useState(6);
  const [salary, setSalary] = useState(67000);
  const [ownerWage, setOwnerWage] = useState(90000);
  const [fixedCosts, setFixedCosts] = useState(234000);
  const [targetMargin, setTargetMargin] = useState(20);
  const [publicHolidays, setPublicHolidays] = useState(11);
  const [annualLeave, setAnnualLeave] = useState(20);
  const [sickDays, setSickDays] = useState(3);
  const [billableHoursPerDay, setBillableHoursPerDay] = useState(6.5);

  const workingDaysPerPerson = BASE_WORKING_DAYS - publicHolidays - annualLeave - sickDays;
  const totalBillableHours = billableStaff * workingDaysPerPerson * billableHoursPerDay;

  const variablePerPerson = salary + VARIABLE_PER_PERSON_EX_SALARY;
  const totalVariable = variablePerPerson * billableStaff;
  const totalCosts = fixedCosts + totalVariable + ownerWage;

  const marginFrac = targetMargin / 100;
  const targetRevenue = marginFrac < 1 ? totalCosts / (1 - marginFrac) : 0;
  const profit = targetRevenue - totalCosts;
  const revenuePerPersonDay = billableStaff > 0 && workingDaysPerPerson > 0
    ? targetRevenue / (billableStaff * workingDaysPerPerson)
    : 0;
  const dailyTeamKpi = revenuePerPersonDay * billableStaff;
  const hourlyRateNeeded = totalBillableHours > 0 ? targetRevenue / totalBillableHours : 0;

  const showVehicleWarning = billableStaff >= VEHICLE_COST_THRESHOLD_STAFF;

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
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#39FF14" }}>Treemarkables Ltd — NZD</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 5vw, 1.6rem)", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>
            Profit Calculator
          </h1>
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#555" }}>
            Set staffing, costs and target margin — revenue &amp; hourly rate are calculated live.
          </p>
        </div>

        {/* Sliders — team & economics */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1.2rem 1.2rem 0.2rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "0.8rem" }}>Team &amp; Economics</div>
          <Slider label="Billable Staff" value={billableStaff} min={5} max={10} step={1} onChange={setBillableStaff} format={(v) => `${v} people`} />
          <Slider label="Average Salary / Person" value={salary} min={55000} max={90000} step={1000} onChange={setSalary} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Slider label="Owner's Wage (excl. staff)" value={ownerWage} min={0} max={200000} step={5000} onChange={setOwnerWage} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Slider label="Fixed Base Costs" value={fixedCosts} min={150000} max={350000} step={1000} onChange={setFixedCosts} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Slider label="Target Profit Margin" value={targetMargin} min={0} max={40} step={1} onChange={setTargetMargin} format={(v) => `${v}%`} />
        </div>

        {/* Sliders — working days */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1.2rem 1.2rem 0.2rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "0.8rem" }}>
            Working Days (base {BASE_WORKING_DAYS} / yr)
          </div>
          <Slider label="Public Holidays" value={publicHolidays} min={10} max={13} step={1} onChange={setPublicHolidays} format={(v) => `${v} days`} />
          <Slider label="Annual Leave" value={annualLeave} min={20} max={25} step={1} onChange={setAnnualLeave} format={(v) => `${v} days`} />
          <Slider label="Sick Days" value={sickDays} min={0} max={5} step={1} onChange={setSickDays} format={(v) => `${v} days`} />
          <Slider label="Billable Hours / Day" value={billableHoursPerDay} min={5} max={8} step={0.5} onChange={setBillableHoursPerDay} format={(v) => `${v.toFixed(1)} hrs`} />
        </div>

        {/* Vehicle warning */}
        {showVehicleWarning && (
          <div style={{
            background: "linear-gradient(90deg, #2a1800, #1a0f00)",
            border: "1px solid #ff9500",
            borderRadius: "8px",
            padding: "0.9rem 1.2rem",
            marginBottom: "1.5rem",
            boxShadow: "0 0 16px #ff950022",
          }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff9500", marginBottom: "0.3rem", fontWeight: 600 }}>
              Trigger Point — extra vehicle likely
            </div>
            <div style={{ fontSize: "0.85rem", color: "#ddd", lineHeight: 1.5 }}>
              At {billableStaff}+ billable staff, fuel &amp; motor vehicle costs (currently ~{fmt(54000)}) will likely increase — budget another ~{fmt(ADDITIONAL_VEHICLE_COST_ESTIMATE)} for an additional vehicle.
            </div>
          </div>
        )}

        {/* Output cards */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "0.7rem" }}>
          <StatCard
            label="Working Days / Person"
            formatted={`${workingDaysPerPerson} days`}
            sub={`${BASE_WORKING_DAYS} − ${publicHolidays + annualLeave + sickDays} off`}
          />
          <StatCard
            label="Total Billable Hours"
            formatted={`${Math.round(totalBillableHours).toLocaleString()} hrs`}
            sub={`${Math.round(totalBillableHours / billableStaff).toLocaleString()} hrs / person`}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "0.7rem" }}>
          <StatCard
            label="Total Costs"
            formatted={fmt(totalCosts)}
            sub={`${fmt(fixedCosts)} fixed + ${fmt(totalVariable)} variable + ${fmt(ownerWage)} owner`}
          />
          <StatCard
            label="Target Revenue"
            formatted={fmt(targetRevenue)}
            sub={`to hit ${targetMargin}% margin`}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "0.7rem" }}>
          <StatCard
            label="Revenue / Person / Day"
            formatted={fmt(revenuePerPersonDay)}
            sub={`${billableStaff} staff × ${workingDaysPerPerson} days`}
          />
          <StatCard
            label="Hourly Rate Needed"
            formatted={fmt2(hourlyRateNeeded)}
            sub={`per billable hour`}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "0.7rem" }}>
          <StatCard
            label="Daily Team KPI"
            formatted={fmt(dailyTeamKpi)}
            sub={`${fmt(revenuePerPersonDay)} × ${billableStaff} staff`}
            highlight
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "1.5rem" }}>
          <StatCard
            label="Profit"
            formatted={fmt(profit)}
            sub={`${targetMargin}% of target revenue`}
            highlight
          />
        </div>

        {/* Breakdown */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1.2rem 1.2rem" }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "1rem" }}>Breakdown</div>
          {([
            ["Working days / person", `${workingDaysPerPerson} days`],
            ["Billable hours / person / year", `${Math.round(workingDaysPerPerson * billableHoursPerDay).toLocaleString()} hrs`],
            ["Total billable hours", `${Math.round(totalBillableHours).toLocaleString()} hrs`],
            ["Fixed base costs", fmt(fixedCosts)],
            [`Salary × ${billableStaff}`, fmt(salary * billableStaff)],
            [`Other variable × ${billableStaff}`, fmt(VARIABLE_PER_PERSON_EX_SALARY * billableStaff)],
            ["Owner's wage", fmt(ownerWage)],
            ["Total costs", fmt(totalCosts)],
            ["Target revenue", fmt(targetRevenue)],
            ["Daily team KPI", fmt(dailyTeamKpi)],
            ["Profit", fmt(profit)],
            ["Hourly rate needed", fmt2(hourlyRateNeeded)],
          ] as [string, string][]).map(([label, val], i, arr) => {
            const isTotal = label === "Total costs" || label === "Profit";
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                padding: "0.5rem 0",
                borderTop: isTotal ? "1px solid #222" : "none",
                borderBottom: i === arr.length - 1 ? "none" : "1px solid #111",
                gap: "1rem",
              }}>
                <span style={{ fontSize: "0.82rem", color: "#555" }}>{label}</span>
                <span style={{ fontSize: "0.88rem", fontFamily: "'DM Mono', monospace", color: label === "Profit" ? "#39FF14" : "#aaa", fontWeight: isTotal ? 700 : 400, whiteSpace: "nowrap" }}>{val}</span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

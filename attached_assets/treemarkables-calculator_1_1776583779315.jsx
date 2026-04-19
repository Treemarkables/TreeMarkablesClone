import { useState } from "react";

const fmt = (n) =>
  n < 0
    ? `-$${Math.abs(Math.round(n)).toLocaleString()}`
    : `$${Math.round(n).toLocaleString()}`;

const Slider = ({ label, value, min, max, step, onChange, format }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: "1.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888" }}>{label}</span>
        <span style={{ fontSize: "1rem", fontFamily: "'DM Mono', monospace", color: "#39FF14", fontWeight: 600 }}>
          {format(value)}
        </span>
      </div>
      <div style={{ position: "relative", height: "6px", background: "#1a1a1a", borderRadius: "3px" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #1a6600, #39FF14)", borderRadius: "3px", transition: "width 0.1s" }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute", top: "50%", left: 0, transform: "translateY(-50%)",
            width: "100%", opacity: 0, cursor: "pointer", height: "24px", margin: 0,
          }}
        />
        <div style={{
          position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%, -50%)",
          width: "16px", height: "16px", background: "#39FF14", borderRadius: "50%",
          boxShadow: "0 0 10px #39FF14aa", pointerEvents: "none", transition: "left 0.1s"
        }} />
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, sub, highlight }) => (
  <div style={{
    background: highlight ? "linear-gradient(135deg, #0d2200, #0a1a00)" : "#0d0d0d",
    border: `1px solid ${highlight ? "#39FF14" : "#222"}`,
    borderRadius: "8px", padding: "1.2rem 1.4rem",
    boxShadow: highlight ? "0 0 20px #39FF1422" : "none",
    flex: 1, minWidth: "140px"
  }}>
    <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: highlight ? "#39FF14aa" : "#555", marginBottom: "0.4rem" }}>{label}</div>
    <div style={{ fontSize: highlight ? "1.6rem" : "1.3rem", fontFamily: "'DM Mono', monospace", color: highlight ? "#39FF14" : "#ccc", fontWeight: 700, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "0.3rem" }}>{sub}</div>}
  </div>
);

export default function Calculator() {
  const [hourlyRate, setHourlyRate] = useState(125);
  const [billableStaff, setBillableStaff] = useState(6);
  const [efficiency, setEfficiency] = useState(85);
  const [workingDays, setWorkingDays] = useState(215);
  const [opCosts, setOpCosts] = useState(750000);
  const [ownerSalary, setOwnerSalary] = useState(100000);

  const hoursPerPersonPerDay = 8 * (efficiency / 100);
  const totalBillableHours = hoursPerPersonPerDay * billableStaff * workingDays;
  const revenue = totalBillableHours * hourlyRate;
  const grossProfit = revenue - opCosts;
  const netProfit = grossProfit - ownerSalary;
  const dailyRevenue = revenue / workingDays;
  const revenuePerPerson = revenue / billableStaff;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const targetNet = 300000;
  const gap = netProfit - targetNet;

  return (
    <div style={{
      background: "#080808", minHeight: "100vh", padding: "2rem 1.5rem",
      fontFamily: "'DM Sans', sans-serif", color: "#fff",
      backgroundImage: "radial-gradient(ellipse at 20% 20%, #0d2200 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, #001a00 0%, transparent 50%)"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.3rem" }}>
          <div style={{ width: "10px", height: "10px", background: "#39FF14", borderRadius: "50%", boxShadow: "0 0 8px #39FF14" }} />
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#39FF14" }}>Treemarkables Ltd</span>
        </div>
        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>
          Profit Calculator
        </h1>
        <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#555" }}>FY2026 — adjust variables to model scenarios</p>
      </div>

      {/* Target Banner */}
      <div style={{
        background: gap >= 0 ? "linear-gradient(90deg, #0d2200, #0a1800)" : "#120000",
        border: `1px solid ${gap >= 0 ? "#39FF14" : "#ff3333"}`,
        borderRadius: "8px", padding: "0.9rem 1.2rem",
        marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#666" }}>
          Target: $300k net profit
        </span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.95rem", fontWeight: 700, color: gap >= 0 ? "#39FF14" : "#ff4444" }}>
          {gap >= 0 ? `+${fmt(gap)} above target` : `${fmt(Math.abs(gap))} below target`}
        </span>
      </div>

      {/* Sliders */}
      <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "1.2rem" }}>Variables</div>
        <Slider label="Hourly Rate" value={hourlyRate} min={80} max={250} step={5} onChange={setHourlyRate} format={(v) => `$${v}/hr`} />
        <Slider label="Billable Staff" value={billableStaff} min={1} max={12} step={1} onChange={setBillableStaff} format={(v) => `${v} people`} />
        <Slider label="Efficiency" value={efficiency} min={50} max={100} step={1} onChange={setEfficiency} format={(v) => `${v}%`} />
        <Slider label="Working Days / Year" value={workingDays} min={150} max={260} step={1} onChange={setWorkingDays} format={(v) => `${v} days`} />
        <Slider label="Operating Costs" value={opCosts} min={400000} max={1200000} step={5000} onChange={setOpCosts} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Slider label="Your Salary" value={ownerSalary} min={0} max={300000} step={5000} onChange={setOwnerSalary} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
      </div>

      {/* Output Cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "1.5rem" }}>
        <MetricCard label="Annual Revenue" value={fmt(revenue)} sub={`${fmt(dailyRevenue)}/day`} />
        <MetricCard label="Per Staff / Year" value={fmt(revenuePerPerson)} sub={`${billableStaff} staff`} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "1.5rem" }}>
        <MetricCard label="Daily Target (Team)" value={fmt(dailyRevenue)} sub="across all billable staff" />
        <MetricCard label="Daily Target (Per Person)" value={fmt(dailyRevenue / billableStaff)} sub={`at ${hoursPerPersonPerDay.toFixed(1)} billable hrs`} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginBottom: "1.5rem" }}>
        <MetricCard label="Gross Profit" value={fmt(grossProfit)} sub="before your salary" />
        <MetricCard label="Net Profit" value={fmt(netProfit)} sub={`${margin.toFixed(1)}% margin`} highlight />
      </div>

      {/* Breakdown */}
      <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "10px", padding: "1.2rem 1.4rem" }}>
        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#444", marginBottom: "1rem" }}>Breakdown</div>
        {[
          ["Billable hrs/person/day", `${hoursPerPersonPerDay.toFixed(1)} hrs`],
          ["Total billable hrs/year", `${Math.round(totalBillableHours).toLocaleString()} hrs`],
          ["Revenue", fmt(revenue)],
          ["Operating Costs", `- ${fmt(opCosts)}`],
          ["Gross Profit", fmt(grossProfit)],
          ["Your Salary", `- ${fmt(ownerSalary)}`],
          ["Net Profit", fmt(netProfit)],
        ].map(([label, val], i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between",
            padding: "0.5rem 0",
            borderTop: i === 6 ? "1px solid #222" : "none",
            borderBottom: "1px solid #111"
          }}>
            <span style={{ fontSize: "0.82rem", color: "#555" }}>{label}</span>
            <span style={{ fontSize: "0.88rem", fontFamily: "'DM Mono', monospace", color: i === 6 ? "#39FF14" : "#aaa", fontWeight: i === 6 ? 700 : 400 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Fragment } from "react";
import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: "jobs" | "quote" | "crew" | "safety" | "crm" | "help";
  tier: "All plans" | "Crew & up" | "Business";
};

const features: Feature[] = [
  {
    eyebrow: "Jobs & Dispatch",
    title: "From quote on a driveway to invoice in the bank — in one app.",
    body: "Walk the site, build the quote, schedule the crew, dispatch the work, and close out — all without leaving the job. The whole lifecycle is one connected workflow.",
    bullets: [
      "On-site quote builder with photos, materials and labour lines",
      "Live job board across crews, with drag-to-reschedule",
      "Crew dispatch with route, contact, safety and brief attached",
      "Time tracking on the job, not after-hours guessing",
    ],
    visual: "jobs",
    tier: "All plans",
  },
  {
    eyebrow: "Quotes, proposals & invoicing",
    title: "Quotes that win. Proposals that close. Invoices that send themselves.",
    body: "Build a quick quote or a detailed multi-item proposal, send it branded, and let the customer accept, sign and pay online. When the job's done, the invoice is already drafted from the quote, the materials used and the time logged.",
    bullets: [
      "Quote templates with margin, GST and acceptance built in",
      "Multi-item proposals with optional add-ons — accepted & paid online",
      "Customer portal for accept / pay / sign",
      "Auto-drafted invoices from completed jobs",
      "Quote & proposal follow-ups so nothing goes cold",
    ],
    visual: "quote",
    tier: "All plans",
  },
  {
    eyebrow: "Customers & CRM",
    title: "Every conversation, quote and job in one timeline.",
    body: "Calls, emails, SMS, site visits, photos, quotes, invoices, payments — every touchpoint with a customer in one place. New person picks up a job and is up to speed in 30 seconds.",
    bullets: [
      "Inbox + SMS + calls captured against the customer",
      "Pipeline view for opportunities and follow-ups",
      "Property history — what we did and when",
    ],
    visual: "crm",
    tier: "Crew & up",
  },
  {
    eyebrow: "Staff & Permissions",
    title: "One platform for the whole crew — without giving everyone the keys.",
    body: "Unlimited users on every paid plan. Granular per-role and per-staff permissions so the office sees one thing, the foreman sees another, and the casual sees only what they need.",
    bullets: [
      "Roles and per-staff overrides",
      "Schedule + leave + availability in one calendar",
      "Pay rates and time tracking",
      "Competency register — who's qualified for what",
    ],
    visual: "crew",
    tier: "Crew & up",
  },
  {
    eyebrow: "Safety",
    title: "Audit-ready safety, built into the flow of work.",
    body: "JHAs, SWMS, prestart checklists, toolbox talks, equipment inductions, vehicle inspections, near-miss and notifiable event reporting. Tied to the jobs, vehicles and people they belong to.",
    bullets: [
      "JHA + SWMS builders with template libraries",
      "Daily prestart + vehicle inspection on mobile",
      "Equipment inductions with sign-off and renewal alerts",
      "Toolbox talks and notifiable event registers",
    ],
    visual: "safety",
    tier: "Crew & up",
  },
  {
    eyebrow: "Help & Training",
    title: "Every staff member knows how to use it on day one.",
    body: "Built-in SOPs and how-to videos cover every workflow. New hires get up to speed without a week of shadowing.",
    bullets: [
      "Sequenced onboarding for new subscribers",
      "How-to videos for every core workflow",
      "Searchable SOP library tied to your processes",
      "Owner-editable so it stays current with your business",
    ],
    visual: "help",
    tier: "All plans",
  },
];

// Shorter detail cards — the rest of the toolkit, each with its plan tag.
const detailFeatures: { title: string; body: string; tier: Feature["tier"] }[] = [
  {
    title: "Supplier invoice importing",
    body: "Snap a photo or drop in a PDF of a supplier bill — Inflow reads the line items and lands the costs straight on the right job. No manual entry.",
    tier: "Crew & up",
  },
  {
    title: "Asset & equipment management",
    body: "Register plant, vehicles and tools with maintenance schedules, inductions, vehicle inspections and check-in / check-out.",
    tier: "Crew & up",
  },
  {
    title: "Job costing & back-costing",
    body: "Compare quoted vs actual labour, materials and supplier costs on every job — so you know exactly what made money.",
    tier: "Crew & up",
  },
  {
    title: "Scheduling & dispatch",
    body: "Calendar and staff scheduling on every plan; a drag-to-reschedule dispatch board across crews from Crew up.",
    tier: "All plans",
  },
  {
    title: "Photos & media",
    body: "Annotated site photos, before / after and voice captions, with public timeline links to share progress with customers.",
    tier: "All plans",
  },
  {
    title: "Document builder",
    body: "Generate branded documents and templates — SWMS, certificates, handover packs — straight from job data.",
    tier: "Crew & up",
  },
  {
    title: "AI assist",
    body: "Smart dispatch, speech-to-quote, and lead capture from photos and messages — bundled on every paid plan.",
    tier: "Crew & up",
  },
  {
    title: "Workflow automation",
    body: "Trigger-based rules that move jobs, send comms and assign work without anyone lifting a finger.",
    tier: "Business",
  },
];

// Consolidated plan comparison — feature groups mapped to the three tiers.
const planCols = ["Freemium", "Crew", "Business"] as const;
type Cell = boolean | string;
const comparison: { group: string; rows: { label: string; values: [Cell, Cell, Cell] }[] }[] = [
  {
    group: "Core — every plan",
    rows: [
      { label: "Active jobs / month", values: ["15", "150", "Unlimited"] },
      { label: "Users", values: ["3", "Unlimited", "Unlimited"] },
      { label: "Jobs, scheduling & dispatch", values: [true, true, true] },
      { label: "Quoting, proposals & invoicing", values: [true, true, true] },
      { label: "Customers & customer portal", values: [true, true, true] },
      { label: "Photos / job", values: ["10", "Unlimited", "Unlimited"] },
      { label: "Mobile app & help hub", values: [true, true, true] },
    ],
  },
  {
    group: "Crew & up",
    rows: [
      { label: "Safety & compliance suite", values: [false, true, true] },
      { label: "Equipment & fleet management", values: [false, true, true] },
      { label: "Roles, permissions & time tracking", values: [false, true, true] },
      { label: "Communications, inbox & templates", values: [false, true, true] },
      { label: "AI assist — dispatch & speech-to-quote", values: [false, true, true] },
      { label: "Advanced analytics & job costing", values: [false, true, true] },
      { label: "SMS / month included", values: ["—", "200", "800"] },
      { label: "Document builder", values: [false, true, true] },
      { label: "Xero, Google Calendar, Gmail & Mailchimp", values: [false, true, true] },
    ],
  },
  {
    group: "Business",
    rows: [
      { label: "Workflow automation", values: [false, false, true] },
      { label: "Priority onboarding & support", values: [false, false, true] },
    ],
  },
  {
    group: "Add-ons (any paid plan)",
    rows: [
      { label: "Call recording — $55/mo + usage", values: ["—", "Add-on", "Add-on"] },
      { label: "Extra SMS top-up", values: ["—", "Add-on", "Add-on"] },
    ],
  },
];

export default function Features() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 md:pb-12">
        <div className="max-w-3xl mx-auto text-center">
          <span className="eyebrow">Features</span>
          <h1 className="heading-display text-5xl md:text-6xl mt-5">
            Every workflow a trades business runs on. In one place.
          </h1>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed max-w-prose mx-auto">
            Inflow replaces the patchwork most trades businesses run on — a job book, a quoting tool, an invoicing tool, a CRM, a safety binder, three group chats and a spreadsheet.
          </p>
        </div>
      </Section>

      {/* Feature blocks */}
      <div className="border-t border-ink-100">
        {features.map((f) => (
          <FeatureBlock key={f.title} feature={f} />
        ))}
      </div>

      {/* More in the box — detail cards */}
      <section className="border-t border-ink-100">
        <Container className="py-20 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow">More in the box</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              Everything else you run on.
            </h2>
            <p className="mt-5 text-ink-500 leading-relaxed">
              From supplier bills to back-costing — the rest of the toolkit, and which plan each lands on.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {detailFeatures.map((d) => (
              <div key={d.title} className="rounded-2xl border border-ink-100 bg-paper p-6 text-center">
                <div className="flex justify-center">
                  <TierTag tier={d.tier} />
                </div>
                <h3 className="heading-section text-lg mt-4">{d.title}</h3>
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Plan comparison */}
      <section className="bg-ink-50 border-t border-ink-100">
        <Container className="py-20 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow">Compare plans</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              What's in each plan.
            </h2>
            <p className="mt-5 text-ink-500 leading-relaxed">
              Every plan runs the core of your business. Crew adds the suite a working team needs; Business adds the tools to grow it. Pay by jobs per month, not per seat.
            </p>
          </div>
          <ComparisonTable />
          <div className="mt-8 text-center">
            <LinkButton href="/pricing" variant="primary" size="md">
              See pricing
            </LinkButton>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="bg-ink-900 text-paper">
        <Container className="py-20 md:py-24 text-center">
          <h2 className="heading-display text-4xl md:text-5xl max-w-3xl mx-auto">
            See it in your business.
          </h2>
          <p className="mt-6 text-ink-300 max-w-prose mx-auto">
            We'll walk you through a personalised setup based on the work you do.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <LinkButton href="/contact" variant="secondary" size="lg">
              Request access
            </LinkButton>
            <LinkButton href="/pricing" variant="ghost" size="lg" className="text-paper border border-ink-700 hover:bg-ink-800">
              See pricing
            </LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}

function TierTag({ tier }: { tier: Feature["tier"] }) {
  const styles: Record<Feature["tier"], string> = {
    "All plans": "bg-ink-100 text-ink-600",
    "Crew & up": "bg-lime text-ink-900",
    Business: "bg-ink-900 text-paper",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-snug ${styles[tier]}`}>
      {tier === "Business" ? "Business" : tier === "Crew & up" ? "Crew & up" : "All plans"}
    </span>
  );
}

function ComparisonTable() {
  return (
    <div className="mt-10 rounded-2xl border border-ink-100 bg-paper overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-ink-100">
            <th className="text-left font-medium text-ink-500 p-4 min-w-[260px]">Feature</th>
            {planCols.map((c) => (
              <th
                key={c}
                className={`p-4 text-center font-semibold min-w-[110px] ${c === "Crew" ? "text-ink-900 bg-lime/10" : "text-ink-900"}`}
              >
                {c}
                {c === "Crew" && (
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-deep">Popular</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.map((sec) => (
            <Fragment key={sec.group}>
              <tr className="bg-ink-50/60 border-b border-ink-100">
                <td colSpan={4} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                  {sec.group}
                </td>
              </tr>
              {sec.rows.map((row) => (
                <tr key={row.label} className="border-b border-ink-100/70 last:border-b-0">
                  <td className="p-4 text-ink-700">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`p-4 text-center ${planCols[i] === "Crew" ? "bg-lime/5" : ""}`}>
                      {typeof v === "boolean" ? (
                        v ? <CheckMark /> : <span className="text-ink-300">—</span>
                      ) : (
                        <span className="text-ink-700 font-medium tabular-nums">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckMark() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-paper">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function FeatureBlock({ feature }: { feature: Feature }) {
  return (
    <section className="border-b border-ink-100 last:border-b-0">
      <Container className="py-20 md:py-28">
        <div className="flex flex-col items-center text-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <span className="eyebrow">{feature.eyebrow}</span>
              <TierTag tier={feature.tier} />
            </div>
            <h2 className="heading-section text-3xl md:text-4xl mt-4">{feature.title}</h2>
            <p className="mt-5 text-ink-500 leading-relaxed">{feature.body}</p>
            <ul className="mt-7 space-y-3 inline-block text-left">
              {feature.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-lime-deep shrink-0" />
                  <span className="text-ink-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-12 w-full max-w-xl">
            <FeatureVisual kind={feature.visual} />
          </div>
        </div>
      </Container>
    </section>
  );
}

function FeatureVisual({ kind }: { kind: Feature["visual"] }) {
  switch (kind) {
    case "jobs":
      return <JobsVisual />;
    case "quote":
      return <QuoteVisual />;
    case "crew":
      return <CrewVisual />;
    case "safety":
      return <SafetyVisual />;
    case "crm":
      return <CrmVisual />;
    case "help":
      return <HelpVisual />;
  }
}

function CardFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 bg-gradient-to-br from-lime/15 to-transparent rounded-2xl blur-xl" />
      <div className="rounded-2xl bg-paper border border-ink-100 shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{label}</span>
          <div className="flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-200" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-200" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-200" />
          </div>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function JobsVisual() {
  const cols = ["Today", "Tomorrow", "Friday"];
  const jobs = [
    [{ t: "Switchboard upgrade", c: "Crew A", pill: "bg-lime" }, { t: "Blocked drain callout", c: "Crew B", pill: "bg-ink-100" }],
    [{ t: "Storm damage repair", c: "Crew A", pill: "bg-ink-100" }, { t: "Bathroom re-fit", c: "Crew C", pill: "bg-ink-100" }, { t: "Hedge & tree trim", c: "Crew B", pill: "bg-ink-100" }],
    [{ t: "Retaining wall repair", c: "Crew A", pill: "bg-ink-100" }],
  ];
  return (
    <CardFrame label="Schedule">
      <div className="grid grid-cols-3 gap-3">
        {cols.map((col, i) => (
          <div key={col}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400 mb-2">{col}</div>
            <div className="space-y-2">
              {jobs[i].map((j, k) => (
                <div key={k} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${j.pill}`} />
                    <span className="text-xs text-ink-500">{j.c}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{j.t}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

function QuoteVisual() {
  const lines = [
    { l: "Switchboard upgrade — 12 circuits", q: "1", p: "$1,840" },
    { l: "Rewire garage sub-board", q: "1", p: "$420" },
    { l: "Certificate of Compliance", q: "1", p: "$580" },
  ];
  return (
    <CardFrame label="Quote · #Q-2046">
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.l} className="grid grid-cols-[1fr_60px_80px] gap-3 py-2 border-b border-ink-100 last:border-b-0 text-sm">
            <span className="text-ink-700">{line.l}</span>
            <span className="text-ink-500">{line.q}</span>
            <span className="text-right font-medium tabular-nums">{line.p}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-ink-200 flex items-center justify-between">
        <span className="text-xs text-ink-500">Total incl. GST</span>
        <span className="text-lg font-semibold tabular-nums">$3,266.00</span>
      </div>
      <div className="mt-4 flex gap-2">
        <span className="flex-1 text-center h-9 leading-9 rounded-full bg-ink-900 text-paper text-xs font-medium">
          Send to customer
        </span>
        <span className="flex-1 text-center h-9 leading-9 rounded-full border border-ink-200 text-xs font-medium">
          Save draft
        </span>
      </div>
    </CardFrame>
  );
}

function CrewVisual() {
  const people = [
    { n: "Sam", r: "Foreman", a: "On site" },
    { n: "Jess", r: "Operator", a: "On site" },
    { n: "Mark", r: "Carpenter", a: "Leave" },
    { n: "Pri", r: "Apprentice", a: "Training" },
  ];
  return (
    <CardFrame label="Crew · This week">
      <div className="space-y-2.5">
        {people.map((p) => (
          <div key={p.n} className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-50">
            <div className="h-9 w-9 rounded-full bg-ink-100 flex items-center justify-center text-sm font-medium">
              {p.n[0]}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{p.n}</div>
              <div className="text-xs text-ink-500">{p.r}</div>
            </div>
            <span className={`text-[11px] px-2 py-1 rounded-full ${p.a === "On site" ? "bg-lime text-ink-900" : "bg-ink-100 text-ink-700"}`}>
              {p.a}
            </span>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

function SafetyVisual() {
  const items = [
    { t: "Prestart — Truck 02", s: "Complete", ok: true },
    { t: "JHA — Roof edge work", s: "Signed off", ok: true },
    { t: "Toolbox talk — Manual handling", s: "Due Friday", ok: false },
    { t: "Equipment induction — Scissor lift", s: "Renew 14 days", ok: false },
  ];
  return (
    <CardFrame label="Safety · Today">
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.t} className="flex items-center justify-between p-3 rounded-lg border border-ink-100">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${i.ok ? "bg-lime-deep" : "bg-ink-300"}`} />
              <span className="text-sm">{i.t}</span>
            </div>
            <span className={`text-xs ${i.ok ? "text-ink-500" : "text-ink-700 font-medium"}`}>
              {i.s}
            </span>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

function CrmVisual() {
  const events = [
    { t: "Quote accepted", s: "$3,266 · Q-2046", w: "2h ago" },
    { t: "Inbound call", s: "Booked site visit", w: "Yesterday" },
    { t: "Email", s: "Re: storm damage", w: "2 days" },
    { t: "Site visit", s: "Photos uploaded ×6", w: "5 days" },
  ];
  return (
    <CardFrame label="Harper · Ormond Rd">
      <div className="space-y-3 border-l-2 border-ink-100 pl-5 ml-2">
        {events.map((e, i) => (
          <div key={i} className="relative">
            <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-ink-900 border-2 border-paper" />
            <div className="text-sm font-medium">{e.t}</div>
            <div className="text-xs text-ink-500 mt-0.5">{e.s} · <span className="text-ink-400">{e.w}</span></div>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

function HelpVisual() {
  const items = [
    { i: "1.", t: "Welcome to Inflow", k: "Video · 2 min" },
    { i: "2.", t: "Set up your business details", k: "Article + video" },
    { i: "3.", t: "Upload your logo & brand", k: "Article" },
    { i: "4.", t: "Default pricing & GST", k: "Article" },
  ];
  return (
    <CardFrame label="Help · Getting started">
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.t} className="flex items-center gap-3 p-3 rounded-lg hover:bg-ink-50">
            <span className="text-xs font-medium text-ink-400 w-5">{i.i}</span>
            <div className="flex-1">
              <div className="text-sm font-medium">{i.t}</div>
              <div className="text-xs text-ink-500">{i.k}</div>
            </div>
            <span className="text-ink-400">→</span>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}

import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: "jobs" | "quote" | "crew" | "safety" | "crm" | "help";
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
  },
  {
    eyebrow: "Quotes & Invoicing",
    title: "Quotes that win. Invoices that send themselves.",
    body: "Branded quotes go out fast and look right. When the job's done, the invoice is already drafted from the quote, materials used and time logged.",
    bullets: [
      "Quote templates with margin, GST and acceptance built in",
      "Customer portal for accept / pay / sign",
      "Auto-drafted invoices from completed jobs",
      "Quote follow-ups so nothing goes cold",
    ],
    visual: "quote",
  },
  {
    eyebrow: "Customers & CRM",
    title: "Every conversation, quote and job in one timeline.",
    body: "Calls, emails, SMS, site visits, photos, quotes, invoices, payments — every touchpoint with a customer in one place. New person picks up a job and is up to speed in 30 seconds.",
    bullets: [
      "Inbox + SMS + calls captured against the customer",
      "Pipeline view for opportunities and follow-ups",
      "Automated review and reputation requests",
      "Property history — what we did and when",
    ],
    visual: "crm",
  },
  {
    eyebrow: "Staff & Permissions",
    title: "One platform for the whole crew — without giving everyone the keys.",
    body: "Unlimited users on every paid plan. Granular per-role and per-staff permissions so the office sees one thing, the foreman sees another, and the casual sees only what they need.",
    bullets: [
      "Roles and per-staff overrides",
      "Schedule + leave + availability in one calendar",
      "Pay rates, time tracking and timesheet exports",
      "Competency register — who's qualified for what",
    ],
    visual: "crew",
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
  },
];

export default function Features() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 md:pb-12">
        <div className="max-w-3xl">
          <span className="eyebrow">Features</span>
          <h1 className="heading-display text-5xl md:text-6xl mt-5">
            Every workflow a trades business runs on. In one place.
          </h1>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed max-w-prose">
            Inflow replaces the patchwork most trades businesses run on — a job book, a quoting tool, an invoicing tool, a CRM, a safety binder, three group chats and a spreadsheet.
          </p>
        </div>
      </Section>

      {/* Alternating feature blocks */}
      <div className="border-t border-ink-100">
        {features.map((f, i) => (
          <FeatureBlock key={f.title} feature={f} flipped={i % 2 === 1} />
        ))}
      </div>

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

function FeatureBlock({ feature, flipped }: { feature: Feature; flipped: boolean }) {
  return (
    <section className="border-b border-ink-100 last:border-b-0">
      <Container className="py-20 md:py-28">
        <div
          className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
            flipped ? "lg:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div>
            <span className="eyebrow">{feature.eyebrow}</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-4">{feature.title}</h2>
            <p className="mt-5 text-ink-500 leading-relaxed">{feature.body}</p>
            <ul className="mt-7 space-y-3">
              {feature.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-lime-deep shrink-0" />
                  <span className="text-ink-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <FeatureVisual kind={feature.visual} />
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
    [{ t: "Macrocarpa removal", c: "Crew A", pill: "bg-lime" }, { t: "Hedge trim", c: "Crew B", pill: "bg-ink-100" }],
    [{ t: "Storm clean-up", c: "Crew A", pill: "bg-ink-100" }, { t: "Stump grind ×3", c: "Crew C", pill: "bg-ink-100" }, { t: "Pruning", c: "Crew B", pill: "bg-ink-100" }],
    [{ t: "Mulch delivery", c: "Crew A", pill: "bg-ink-100" }],
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
    { l: "Tree removal — macrocarpa, 14m", q: "1", p: "$1,840" },
    { l: "Chip & cart away", q: "1", p: "$420" },
    { l: "Traffic management", q: "1 day", p: "$580" },
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
    { n: "Mark", r: "Climber", a: "Leave" },
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
    { t: "JHA — Macrocarpa removal", s: "Signed off", ok: true },
    { t: "Toolbox talk — Manual handling", s: "Due Friday", ok: false },
    { t: "Equipment induction — Chipper", s: "Renew 14 days", ok: false },
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
    <CardFrame label="Te Whata · Wainui Rd">
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

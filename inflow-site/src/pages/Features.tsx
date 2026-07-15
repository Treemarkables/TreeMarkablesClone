import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";

type Tier = "All plans" | "Crew & up" | "Business" | "Add-on";

type FeatureCard = {
  title: string;
  body: string;
  tier: Tier;
};

type Category = {
  id: string;
  name: string;
  blurb: string;
  features: FeatureCard[];
};

// Every feature below is shipped in the app today — descriptions are grounded
// in what the product actually does, not roadmap.
const categories: Category[] = [
  {
    id: "jobs",
    name: "Jobs & scheduling",
    blurb: "The day-to-day core: every job in one card, on a schedule the whole team can see.",
    features: [
      {
        title: "Job cards",
        body: "Everything about a job in one card — quote, schedule, photos, diary, checklists and billing — with desktop and mobile layouts built for the field.",
        tier: "All plans",
      },
      {
        title: "Calendar & scheduling",
        body: "Book jobs and site visits on a shared team calendar, so everyone sees what's on and when.",
        tier: "All plans",
      },
      {
        title: "Dispatch board",
        body: "A drag-and-drop board to assign work across crews and reschedule on the fly.",
        tier: "Crew & up",
      },
      {
        title: "Staff schedule",
        body: "A multi-week grid of who's on which job, day by day, with per-job staff assignments.",
        tier: "Crew & up",
      },
      {
        title: "Custom job lanes",
        body: "Organise jobs into your own pipeline buckets, with automation rules that fire when a job enters a lane or sits too long.",
        tier: "All plans",
      },
      {
        title: "Today dashboard",
        body: "A daily command centre: today's jobs, fleet compliance and what needs attention — one screen to start the day.",
        tier: "All plans",
      },
      {
        title: "Job diary",
        body: "A timestamped diary on every job — notes, updates and photos from whoever's on site.",
        tier: "All plans",
      },
      {
        title: "Time tracking",
        body: "Start a timer on the job; recorded time rolls up into timesheets and lands against the job for costing.",
        tier: "Crew & up",
      },
      {
        title: "Tasks board",
        body: "A kanban board for office work and follow-ups that aren't jobs, so they don't live in someone's head.",
        tier: "All plans",
      },
      {
        title: "Job templates",
        body: "Preset your repeat job types so common work is set up in seconds.",
        tier: "Crew & up",
      },
      {
        title: "Google Calendar sync",
        body: "Two-way sync — your jobs push to Google Calendar, and existing Google events block out busy time so you're never double-booked.",
        tier: "Crew & up",
      },
    ],
  },
  {
    id: "quoting",
    name: "Quoting & proposals",
    blurb: "Win the work: quotes and proposals customers accept, sign and pay online.",
    features: [
      {
        title: "Quote builder",
        body: "Build and send branded quotes with materials, labour and GST — customers view and accept them online.",
        tier: "All plans",
      },
      {
        title: "Proposal builder",
        body: "Multi-section proposals with line-item options the customer can pick from, accepted and signed online.",
        tier: "All plans",
      },
      {
        title: "Deposits on acceptance",
        body: "Ask for a deposit when a customer accepts a proposal — collected by card through your connected Stripe account.",
        tier: "All plans",
      },
      {
        title: "Speech-to-quote",
        body: "Talk through the job on site — Inflow transcribes what you said and drafts the quote for you.",
        tier: "Crew & up",
      },
      {
        title: "Screenshot to quote",
        body: "Paste a screenshot of a text or message thread — AI reads it, fills in the customer and job details, and you quote from there.",
        tier: "Crew & up",
      },
      {
        title: "Quote follow-ups",
        body: "A follow-up queue with AI-drafted chasers, so sent quotes don't quietly go cold.",
        tier: "Crew & up",
      },
      {
        title: "Materials & services catalog",
        body: "Your priced materials and services in one catalog, reused across every quote and invoice.",
        tier: "Crew & up",
      },
    ],
  },
  {
    id: "money",
    name: "Invoicing & money",
    blurb: "Get paid: invoices from job data, payments in, costs matched against the quote.",
    features: [
      {
        title: "Invoicing",
        body: "Sectioned invoices built from the job's quote, time and materials — sent with an online viewer.",
        tier: "All plans",
      },
      {
        title: "Card & bank payments",
        body: "Take card payments online through your connected Stripe account — and your bank details render on every invoice for direct transfer.",
        tier: "All plans",
      },
      {
        title: "Xero sync",
        body: "Push invoices through to Xero so the books stay right without double entry.",
        tier: "Crew & up",
      },
      {
        title: "Supplier invoice import",
        body: "Snap a photo or drop in a PDF of a supplier bill — the line items are read automatically and costed to the right job.",
        tier: "Crew & up",
      },
      {
        title: "Job costing & back-costing",
        body: "Compare quoted vs actual labour, materials and supplier costs on every job, so you know what actually made money.",
        tier: "Crew & up",
      },
      {
        title: "Reconciliation",
        body: "Match payments against invoices in one view, so nothing slips through unpaid.",
        tier: "Crew & up",
      },
    ],
  },
  {
    id: "customers",
    name: "Customers & CRM",
    blurb: "One record per customer — every contact, property, quote and job against it.",
    features: [
      {
        title: "Customer records",
        body: "Customers with multiple contacts, communication preferences and the full history of quotes, jobs and properties.",
        tier: "All plans",
      },
      {
        title: "Leads & pipeline",
        body: "Capture and track leads from first contact through to booked job.",
        tier: "All plans",
      },
      {
        title: "AI lead capture",
        body: "Inbound emails and messages are parsed automatically into contact details and a job request — no re-typing.",
        tier: "Crew & up",
      },
      {
        title: "Import & migration",
        body: "Bring your customer list in by CSV, with a built-in ServiceM8 import for customers, jobs and quotes — and we help with the rest during onboarding.",
        tier: "All plans",
      },
    ],
  },
  {
    id: "comms",
    name: "Communication",
    blurb: "Email and SMS from the app, threaded per customer, with the routine ones automated.",
    features: [
      {
        title: "Unified inbox",
        body: "Email and SMS conversations threaded per customer in one inbox, so any team member can pick up the thread.",
        tier: "Crew & up",
      },
      {
        title: "Two-way SMS",
        body: "Send and receive texts from your business number, with a monthly SMS bundle included on paid plans.",
        tier: "Crew & up",
      },
      {
        title: "Message templates",
        body: "Reusable SMS and email templates for the messages you send every day.",
        tier: "Crew & up",
      },
      {
        title: "Booking reminders",
        body: "Automatic reminders to customers ahead of booked work, so fewer no-shows.",
        tier: "Crew & up",
      },
      {
        title: "“On my way” texts",
        body: "One tap texts the customer you're en route with an ETA — and logs it to the job.",
        tier: "Crew & up",
      },
      {
        title: "Inquiry auto-reply",
        body: "New inquiries get an instant acknowledgement while the lead lands in your pipeline.",
        tier: "Crew & up",
      },
      {
        title: "Gmail & Mailchimp",
        body: "Email replies flow into the inbox through your Gmail, and your customer list syncs to Mailchimp audiences for campaigns.",
        tier: "Crew & up",
      },
    ],
  },
  {
    id: "calls",
    name: "Phone & voice",
    blurb: "Your business line, in the app — with an AI backstop for the calls you can't take.",
    features: [
      {
        title: "Business phone & call recording",
        body: "Take business calls on the iOS app or in your browser — calls are recorded and linked to the customer and job.",
        tier: "Add-on",
      },
      {
        title: "AI receptionist",
        body: "When you can't pick up, an AI voice agent answers, triages the job and captures the lead — with your greeting and rules.",
        tier: "Add-on",
      },
    ],
  },
  {
    id: "photos",
    name: "Photos, video & site",
    blurb: "Proof of work: capture it on site, find it later, share it with the customer.",
    features: [
      {
        title: "Photo capture & annotation",
        body: "Capture site photos and draw straight on them — arrows, circles, notes — from any phone.",
        tier: "All plans",
      },
      {
        title: "Before & after generator",
        body: "Paired before / after capture, with a branded composite generated automatically — ready to share on social.",
        tier: "All plans",
      },
      {
        title: "Voice photo captions",
        body: "Speak the caption as you shoot — it's transcribed onto the photo in the job diary.",
        tier: "Crew & up",
      },
      {
        title: "Public photo timeline",
        body: "A shareable link where your customer watches job progress photo by photo, without logging in.",
        tier: "Crew & up",
      },
      {
        title: "Photo report PDF",
        body: "One tap compiles a job's photos into a branded, timestamped PDF report you can send on.",
        tier: "All plans",
      },
      {
        title: "Job site map",
        body: "A satellite map on the job card with placeable markers — pin the trees, hazards or work areas on the property, or mark up your own uploaded site plan for council work.",
        tier: "All plans",
      },
      {
        title: "Job videos",
        body: "Upload walkthrough videos against the job, transcribed automatically so they're searchable.",
        tier: "Crew & up",
      },
      {
        title: "Media library",
        body: "Search every photo and video across all your jobs in one library, with a map view.",
        tier: "All plans",
      },
    ],
  },
  {
    id: "documents",
    name: "Documents",
    blurb: "Branded paperwork generated from job data, signed on the spot.",
    features: [
      {
        title: "Document builder",
        body: "Build branded document templates — certificates, handover packs, custom forms — and generate them straight from job data.",
        tier: "Crew & up",
      },
      {
        title: "Signature capture",
        body: "Capture signatures on proposals and documents, on a phone or tablet, on the spot.",
        tier: "All plans",
      },
    ],
  },
  {
    id: "safety",
    name: "Safety & compliance",
    blurb: "Audit-ready safety records, tied to the jobs, vehicles and people they belong to.",
    features: [
      {
        title: "SWMS builder",
        body: "Safe Work Method Statements built from templates, with steps and sign-on signatures.",
        tier: "Crew & up",
      },
      {
        title: "JHA assessments",
        body: "Job hazard analysis with hazard and control libraries, completed and signed on site.",
        tier: "Crew & up",
      },
      {
        title: "Toolbox talks",
        body: "Run and record toolbox talks with attendee tracking, so there's a register when you need one.",
        tier: "Crew & up",
      },
      {
        title: "Pre-start checklists",
        body: "Configurable daily pre-start checks completed on mobile before work begins.",
        tier: "Crew & up",
      },
      {
        title: "Incident reporting",
        body: "Near-miss reports with photos, witnesses and corrective actions, plus a notifiable events register.",
        tier: "Crew & up",
      },
      {
        title: "Training & competency register",
        body: "Track who's qualified for what, with competency types per employee.",
        tier: "Crew & up",
      },
    ],
  },
  {
    id: "equipment",
    name: "Equipment & fleet",
    blurb: "Every machine, vehicle and tool accounted for — maintained, inspected, inducted.",
    features: [
      {
        title: "Equipment register & maintenance",
        body: "Register plant and tools with maintenance schedules and service history.",
        tier: "Crew & up",
      },
      {
        title: "Check-in / check-out",
        body: "Know who has what — equipment checked out to people and back in again.",
        tier: "Crew & up",
      },
      {
        title: "Vehicle inspections & compliance",
        body: "Vehicle inspection checklists with history, plus rego, CoF and service reminders before they lapse.",
        tier: "Crew & up",
      },
      {
        title: "Equipment inductions",
        body: "Induction templates with sign-off, so only inducted staff run the gear.",
        tier: "Crew & up",
      },
      {
        title: "Inventory",
        body: "Track stock levels and movements with an inventory transaction history.",
        tier: "Crew & up",
      },
    ],
  },
  {
    id: "team",
    name: "Team & permissions",
    blurb: "The whole crew on one platform — each person seeing exactly what they should.",
    features: [
      {
        title: "Staff management",
        body: "Add your team with their details, pay rates and availability — up to 3 users free, unlimited on paid plans.",
        tier: "All plans",
      },
      {
        title: "Roles & permissions",
        body: "Role-based access with per-person overrides — the office sees one thing, the apprentice another.",
        tier: "Crew & up",
      },
      {
        title: "Staff inductions",
        body: "Structured induction flows for new starters, tracked to completion.",
        tier: "Crew & up",
      },
    ],
  },
  {
    id: "insights",
    name: "Insights & automation",
    blurb: "See how the business is really doing — and put the routine on rails.",
    features: [
      {
        title: "Dashboards & metrics",
        body: "Business dashboards covering jobs, revenue and performance at a glance.",
        tier: "Crew & up",
      },
      {
        title: "Advanced analytics",
        body: "Deeper performance and financial analytics for multi-crew operations.",
        tier: "Business",
      },
      {
        title: "Workflow automation",
        body: "Trigger-based rules that move jobs, send comms and assign work without anyone lifting a finger.",
        tier: "Business",
      },
    ],
  },
  {
    id: "platform",
    name: "Platform",
    blurb: "Everywhere your team is — phone, browser, and the help to learn it all.",
    features: [
      {
        title: "Mobile app",
        body: "A native iOS app plus an installable web app on any phone — the field runs Inflow from a pocket.",
        tier: "All plans",
      },
      {
        title: "Push notifications",
        body: "Job, message and assignment notifications to the right person's phone, with per-user preferences.",
        tier: "All plans",
      },
      {
        title: "Global search",
        body: "One search across jobs, customers, quotes and more.",
        tier: "All plans",
      },
      {
        title: "Help centre & how-to videos",
        body: "Built-in SOPs and how-to videos for every core workflow, so new staff get up to speed on day one.",
        tier: "All plans",
      },
      {
        title: "AI assistant",
        body: "An in-app assistant you can ask questions about your business data and how to get things done.",
        tier: "Crew & up",
      },
      {
        title: "Weather",
        body: "A weather view built in, for planning outdoor work around the forecast.",
        tier: "All plans",
      },
    ],
  },
];

// Plan inclusions — matched to entitlements, not aspirations.
const plans: {
  name: string;
  tagline: string;
  meta: string[];
  leadIn?: string;
  includes: string[];
  highlight?: boolean;
}[] = [
  {
    name: "Freemium",
    tagline: "Solo operators and small teams getting started.",
    meta: ["Up to 15 jobs / month", "Up to 3 users"],
    includes: [
      "Jobs, calendar & scheduling",
      "Quotes, proposals & invoicing",
      "Customers & leads",
      "Photos (10 per job), site map & job diary",
      "Tasks board & custom job lanes",
      "Mobile app, help hub & data import",
    ],
  },
  {
    name: "Crew",
    tagline: "Growing crews running a real book of work.",
    meta: ["Up to 150 jobs / month", "Unlimited users & photos"],
    leadIn: "Everything in Freemium, plus:",
    includes: [
      "Dispatch board & staff schedule",
      "Safety & compliance suite",
      "Equipment, fleet & inventory",
      "Roles, permissions & time tracking",
      "Inbox, SMS bundle & message templates",
      "AI assist — speech-to-quote, follow-ups & lead capture",
      "Job costing, dashboards & document builder",
      "Xero, Google Calendar, Gmail & Mailchimp",
    ],
    highlight: true,
  },
  {
    name: "Business",
    tagline: "Multi-crew operations running at scale.",
    meta: ["Unlimited jobs", "Bigger SMS bundle"],
    leadIn: "Everything in Crew, plus:",
    includes: [
      "Workflow automation",
      "Advanced analytics",
      "Priority onboarding & support",
    ],
  },
];

const addOns: { title: string; body: string }[] = [
  {
    title: "Business phone & call recording",
    body: "Take and record business calls in the app, linked to customers and jobs.",
  },
  {
    title: "AI receptionist",
    body: "An AI voice agent answers and triages inbound calls when you can't.",
  },
  {
    title: "Extra SMS",
    body: "Top up beyond your plan's monthly SMS bundle.",
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
            Everything in Inflow.
          </h1>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed max-w-prose mx-auto">
            The full feature set — what each tool does and which plan it lands on. Built for NZ trades businesses: jobs, quoting, invoicing, safety, fleet and the crew, in one app.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            <TierTag tier="All plans" />
            <TierTag tier="Crew & up" />
            <TierTag tier="Business" />
            <TierTag tier="Add-on" />
          </div>
        </div>
      </Section>

      {/* Feature grid, grouped by category */}
      <div className="border-t border-ink-100">
        {categories.map((cat) => (
          <section key={cat.id} className="border-b border-ink-100 last:border-b-0">
            <Container className="py-14 md:py-16">
              <div className="max-w-2xl">
                <h2 className="heading-section text-2xl md:text-3xl">{cat.name}</h2>
                <p className="mt-2 text-ink-500 leading-relaxed">{cat.blurb}</p>
              </div>
              <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cat.features.map((f) => (
                  <div key={f.title} className="rounded-2xl border border-ink-100 bg-paper p-6 flex flex-col">
                    <div>
                      <TierTag tier={f.tier} />
                    </div>
                    <h3 className="heading-section text-lg mt-4">{f.title}</h3>
                    <p className="mt-2 text-sm text-ink-500 leading-relaxed">{f.body}</p>
                  </div>
                ))}
              </div>
            </Container>
          </section>
        ))}
      </div>

      {/* What's in each plan — directly after the grid */}
      <section className="bg-ink-50 border-t border-ink-100">
        <Container className="py-20 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow">Plans</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              What's in each plan.
            </h2>
            <p className="mt-5 text-ink-500 leading-relaxed">
              Every plan runs the core of your business. Crew adds the suite a working team needs; Business adds the tools to grow it. Pay by jobs per month, not per seat.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-5 items-start">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border bg-paper p-7 ${
                  p.highlight ? "border-ink-900 shadow-lift relative" : "border-ink-100"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-7 px-2.5 py-1 rounded-full bg-lime text-ink-900 text-[11px] font-semibold tracking-snug">
                    Most popular
                  </span>
                )}
                <h3 className="heading-section text-xl">{p.name}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{p.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.meta.map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-full bg-ink-100 text-ink-600 text-[11px] font-semibold tracking-snug">
                      {m}
                    </span>
                  ))}
                </div>
                {p.leadIn && (
                  <p className="mt-5 text-[13px] font-semibold text-ink-700">{p.leadIn}</p>
                )}
                <ul className={`${p.leadIn ? "mt-3" : "mt-5"} space-y-2.5`}>
                  {p.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <CheckMark />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="mt-10 rounded-2xl border border-ink-100 bg-paper p-7">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="heading-section text-lg">Add-ons</h3>
              <span className="text-sm text-ink-500">Available on any paid plan.</span>
            </div>
            <div className="mt-5 grid sm:grid-cols-3 gap-5">
              {addOns.map((a) => (
                <div key={a.title}>
                  <div className="text-sm font-semibold text-ink-900">{a.title}</div>
                  <p className="mt-1 text-sm text-ink-500 leading-relaxed">{a.body}</p>
                </div>
              ))}
            </div>
          </div>

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

function TierTag({ tier }: { tier: Tier }) {
  const styles: Record<Tier, string> = {
    "All plans": "bg-ink-100 text-ink-600",
    "Crew & up": "bg-lime text-ink-900",
    Business: "bg-ink-900 text-paper",
    "Add-on": "bg-paper text-ink-700 border border-ink-200",
  };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-snug ${styles[tier]}`}>
      {tier}
    </span>
  );
}

function CheckMark() {
  return (
    <span className="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink-900 text-paper shrink-0">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

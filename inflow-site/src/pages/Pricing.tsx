import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";

type Tier = {
  name: string;
  blurb: string;
  jobsPerMonth: string;
  price: string;
  priceNote?: string;
  cta: string;
  href: string;
  highlight?: boolean;
  features: string[];
};

// CTAs route to the request-access flow while onboarding is concierge (self-serve
// signup + the Inflow app domain come later). One internal page, no brand leak.
const tiers: Tier[] = [
  {
    name: "Freemium",
    blurb: "Solo operators and small teams getting started — free, forever.",
    jobsPerMonth: "Up to 15 jobs / month",
    price: "$0",
    priceNote: "Free forever · up to 3 users",
    cta: "Start for free",
    href: "/contact",
    features: [
      "Up to 3 users",
      "Jobs, scheduling & dispatch",
      "Quoting, proposals & invoicing",
      "Customers & customer portal",
      "Photos — 10 per job",
      "Mobile app & help hub",
    ],
  },
  {
    name: "Crew",
    blurb: "Growing crews running a real book of work.",
    jobsPerMonth: "Up to 150 jobs / month",
    price: "$89",
    priceNote: "+ GST · billed monthly",
    cta: "Start with Crew",
    href: "/contact",
    highlight: true,
    features: [
      "Everything in Freemium, plus:",
      "Unlimited users & photos",
      "Safety & compliance suite",
      "Equipment & fleet management",
      "Roles, permissions & time tracking",
      "Communications, inbox & templates",
      "AI assist — dispatch & speech-to-quote",
      "200 SMS / month included",
      "Xero, Google Calendar & Gmail",
    ],
  },
  {
    name: "Business",
    blurb: "Multi-crew operations running at scale.",
    jobsPerMonth: "Unlimited jobs",
    price: "$189",
    priceNote: "+ GST · billed monthly",
    cta: "Start with Business",
    href: "/contact",
    features: [
      "Everything in Crew, plus:",
      "Marketing & reputation suite",
      "Advanced analytics & job costing",
      "Workflow automation",
      "800 SMS / month included",
      "Mailchimp & Facebook integrations",
      "Priority onboarding & support",
    ],
  },
];

const addOns = [
  { name: "Call recording", desc: "Record and log inbound and outbound calls against the right job, with searchable history. $55 / month + usage." },
  { name: "Extra SMS", desc: "Top up beyond your plan's monthly allowance for booking reminders and customer texts." },
];

const faqs = [
  {
    q: "Is there really a free plan?",
    a: "Yes — Freemium is free forever. Up to 3 users, 15 jobs a month, and the core tools to run your day. No card required. Move up to Crew when you outgrow it.",
  },
  {
    q: "Is it really unlimited users?",
    a: "On every paid plan, yes. Bring your whole crew on — office, foremen, casuals — at no per-seat cost. You pay by jobs per month, not by people. (The free Freemium plan includes up to 3 users.)",
  },
  {
    q: "What if I go over my job limit?",
    a: "We'll let you know before you hit it and help you move up a plan. Your existing jobs stay readable — you're never cut off or locked out mid-month.",
  },
  {
    q: "Do you charge for SMS?",
    a: "The Crew and Business plans include a monthly SMS allowance — 200 and 800 texts respectively. Need more? Extra SMS is a simple add-on. The free plan doesn't include SMS.",
  },
  {
    q: "How does onboarding work?",
    a: "Right now we hand-onboard every business personally. Tell us about yours and we'll set up your account with you — and if you're moving from another tool, we'll help bring across your customers and get your team going.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Month-to-month, no lock-in contracts. Export your data whenever you need to.",
  },
];

export default function Pricing() {
  return (
    <>
      <Section className="pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <span className="eyebrow">Pricing</span>
          <h1 className="heading-display text-5xl md:text-6xl mt-5">
            Start free.
            <br />
            <span className="text-ink-500">Unlimited users on every paid plan.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed max-w-prose mx-auto">
            Pay by the volume of work, not by how many people are doing it. NZD, plus GST. Monthly. No lock-in.
          </p>
        </div>
      </Section>

      <Section className="pt-4 pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl p-7 flex flex-col text-left ${
                t.highlight
                  ? "bg-ink-900 text-paper border border-ink-900 shadow-lift"
                  : "bg-paper border border-ink-100"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-lime text-ink-900 text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Most popular
                </span>
              )}

              <div>
                <h3 className={`text-2xl font-semibold tracking-snug ${t.highlight ? "" : "text-ink-900"}`}>
                  {t.name}
                </h3>
                <p className={`mt-2 text-sm ${t.highlight ? "text-ink-300" : "text-ink-500"}`}>
                  {t.blurb}
                </p>
              </div>

              <div className="mt-7">
                <div className="flex items-baseline gap-1">
                  <span className={`text-5xl font-semibold tracking-crunch ${t.highlight ? "" : "text-ink-900"}`}>
                    {t.price}
                  </span>
                  <span className={`text-sm ${t.highlight ? "text-ink-300" : "text-ink-500"}`}>/ mo</span>
                </div>
                <p className={`mt-2 text-xs ${t.highlight ? "text-ink-300" : "text-ink-500"}`}>
                  {t.jobsPerMonth} · NZD
                </p>
                {t.priceNote && (
                  <p className={`mt-1 text-xs ${t.highlight ? "text-ink-300" : "text-ink-500"}`}>
                    {t.priceNote}
                  </p>
                )}
              </div>

              <ul className="mt-7 space-y-3 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check highlight={t.highlight} />
                    <span className={t.highlight ? "text-ink-200" : "text-ink-700"}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <LinkButton
                  href={t.href}
                  variant={t.highlight ? "secondary" : "primary"}
                  size="md"
                  className="w-full"
                >
                  {t.cta}
                </LinkButton>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-ink-500 text-center max-w-2xl mx-auto">
          Prices in NZD and exclude GST. Indicative while we lock in plans with early customers — confirmed when we onboard you.
        </p>
      </Section>

      {/* Add-ons */}
      <section className="bg-ink-50">
        <Container className="py-20">
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow">Add-ons</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              Bolt on what you need, skip what you don't.
            </h2>
          </div>
          <div className="mt-10 grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {addOns.map((a) => (
              <div key={a.name} className="rounded-xl bg-paper border border-ink-100 p-6 text-center">
                <h3 className="font-semibold tracking-snug">{a.name}</h3>
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <Section>
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              Pricing questions, answered.
            </h2>
            <p className="mt-5 text-ink-500 leading-relaxed">
              Something not covered here? Drop us a line at{" "}
              <a className="underline decoration-lime-deep" href="mailto:hello@inflowapp.co.nz">
                hello@inflowapp.co.nz
              </a>
              .
            </p>
          </div>

          <div className="mt-10 text-left divide-y divide-ink-100 border-y border-ink-100">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                  <span className="font-medium text-ink-900">{f.q}</span>
                  <span className="text-ink-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-ink-500 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

function Check({ highlight }: { highlight?: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${
        highlight ? "bg-lime text-ink-900" : "bg-ink-100 text-ink-700"
      }`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

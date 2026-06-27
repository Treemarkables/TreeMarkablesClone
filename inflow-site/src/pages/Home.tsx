import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";
import Mockup from "@/components/Mockup";

const featureHighlights = [
  {
    eyebrow: "Jobs",
    title: "Quote, schedule, dispatch — one flow.",
    body: "Walk a site, build a quote on the spot, lock the schedule, and dispatch the crew. No re-keying between tools.",
  },
  {
    eyebrow: "Invoicing",
    title: "Invoices that draft themselves.",
    body: "Finish a job and the invoice is already populated from your quote, materials and labour. One tap to send.",
  },
  {
    eyebrow: "Safety",
    title: "JHAs, SWMS and toolbox talks — built in.",
    body: "Daily prestarts, hazard assessments, near-miss reporting, equipment inductions. Audit-ready, not after-thought.",
  },
];

const metrics = [
  { value: "1", label: "app instead of five" },
  { value: "30+", label: "field workflows covered" },
  { value: "100%", label: "built for trades, in NZ" },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-10 md:pt-16 pb-24 md:pb-32">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-ink-100/60 to-transparent -z-10" />
        <Container>
          <div className="flex flex-col items-center text-center">
            <div className="max-w-3xl">
              <span className="eyebrow">New Zealand built · for trades</span>
              <h1 className="heading-display text-5xl sm:text-6xl md:text-7xl mt-5">
                Run your trade
                <br />
                from <span className="relative inline-block">
                  <span className="relative z-10">one place.</span>
                  <span className="absolute inset-x-0 bottom-1 h-3 bg-lime/70 -z-0" />
                </span>
              </h1>
              <p className="mt-6 text-lg text-ink-500 max-w-prose mx-auto leading-relaxed">
                Inflow is the operating system for trades and field-service businesses. Jobs, quotes, invoices, customers, staff, safety — all in one place, built for the field.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <LinkButton href="/contact" variant="primary" size="lg">
                  Request access
                </LinkButton>
                <LinkButton href="/features" variant="ghost" size="lg" className="border border-ink-200">
                  See what's inside
                </LinkButton>
              </div>
              <p className="mt-6 text-sm text-ink-500">
                Currently onboarding a small group of NZ trades businesses. Tell us about yours.
              </p>
            </div>

            <div className="mt-14 w-full max-w-3xl">
              <Mockup />
            </div>
          </div>
        </Container>
      </section>

      {/* Metrics strip */}
      <section className="border-y border-ink-100 bg-paper">
        <Container className="py-10 md:py-14">
          <div className="grid grid-cols-3 gap-6 md:gap-10">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="heading-section text-3xl md:text-5xl">{m.value}</div>
                <div className="mt-2 text-sm text-ink-500">{m.label}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Feature highlights */}
      <Section>
        <div className="max-w-2xl mx-auto text-center">
          <span className="eyebrow">What's inside</span>
          <h2 className="heading-section text-4xl md:text-5xl mt-4">
            Built for the way trades businesses actually work.
          </h2>
          <p className="mt-5 text-ink-500 text-lg leading-relaxed">
            Not a generic CRM with a "field service module" bolted on. Every workflow is shaped by 18 years of running a real trades business.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {featureHighlights.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-ink-100 bg-paper p-7 hover:shadow-soft transition-shadow text-center"
            >
              <span className="eyebrow">{f.eyebrow}</span>
              <h3 className="heading-section text-xl mt-3">{f.title}</h3>
              <p className="mt-3 text-ink-500 leading-relaxed text-[15px]">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <LinkButton href="/features" variant="ghost" className="border border-ink-200">
            Explore all features
            <span aria-hidden>→</span>
          </LinkButton>
        </div>
      </Section>

      {/* Pricing teaser */}
      <section className="bg-ink-50">
        <Container className="py-20 md:py-28">
          <div className="flex flex-col items-center">
            <div className="max-w-2xl text-center">
              <span className="eyebrow">Pricing</span>
              <h2 className="heading-section text-4xl md:text-5xl mt-4">
                Start free. Scale when you grow.
              </h2>
              <p className="mt-5 text-ink-500 text-lg leading-relaxed mx-auto max-w-prose">
                Begin with 30 days free, then pay by jobs per month — never per seat. On paid plans, bring your whole crew on without watching the meter.
              </p>
              <div className="mt-7">
                <LinkButton href="/pricing" variant="primary" size="lg">
                  See pricing
                </LinkButton>
              </div>
            </div>

            <div className="mt-12 w-full max-w-4xl grid sm:grid-cols-3 gap-4 text-center">
              {[
                { name: "Freemium", line: "Small teams — 30 days free", price: "$0", meta: "15 jobs / mo · 3 users" },
                { name: "Crew", line: "Growing teams", price: "$89", highlight: true, meta: "150 jobs / mo · unlimited users" },
                { name: "Business", line: "Multi-crew ops", price: "$150", meta: "Unlimited jobs · unlimited users" },
              ].map((t) => (
                <div
                  key={t.name}
                  className={`rounded-2xl p-6 border ${
                    t.highlight
                      ? "bg-ink-900 text-paper border-ink-900"
                      : "bg-paper border-ink-100"
                  }`}
                >
                  <div className={`text-xs uppercase tracking-[0.18em] ${t.highlight ? "text-lime" : "text-ink-400"}`}>
                    {t.name}
                  </div>
                  <div className={`mt-2 text-sm ${t.highlight ? "text-ink-300" : "text-ink-500"}`}>
                    {t.line}
                  </div>
                  <div className={`mt-6 text-2xl font-semibold ${t.highlight ? "" : "text-ink-700"}`}>
                    {t.price}
                  </div>
                  <div className={`text-xs mt-1 ${t.highlight ? "text-ink-300" : "text-ink-500"}`}>
                    {t.price === "$0" ? "free for 30 days" : "/ mo + GST, NZD"}
                  </div>
                  <div className={`text-xs mt-3 pt-3 border-t ${t.highlight ? "border-ink-700 text-ink-300" : "border-ink-100 text-ink-500"}`}>
                    {t.meta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* CTA band */}
      <section className="bg-ink-900 text-paper">
        <Container className="py-20 md:py-24 text-center">
          <h2 className="heading-display text-4xl md:text-6xl max-w-3xl mx-auto">
            Stop running your business out of six different apps.
          </h2>
          <p className="mt-6 text-ink-300 text-lg max-w-prose mx-auto">
            We're letting a small group of NZ trades businesses in early. Tell us about yours and we'll get you set up.
          </p>
          <div className="mt-8 flex justify-center">
            <LinkButton href="/contact" variant="secondary" size="lg">
              Request access
            </LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}

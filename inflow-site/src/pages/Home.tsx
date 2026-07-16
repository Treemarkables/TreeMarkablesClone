import { useState, useEffect } from "react";
import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";

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
  {
    eyebrow: "AI",
    title: "AI that handles the busywork.",
    body: "Speak or paste a message and get a draft quote. AI-drafted quote follow-ups. An in-app assistant for your business data — with an AI phone receptionist coming soon.",
  },
];

// Real screenshots from the app — shown right up front so visitors see the
// product, not a mockup.
const galleryShots: { src: string; label: string }[] = [
  { src: "/screenshots/dashboards-metrics.png", label: "Business dashboards" },
  { src: "/screenshots/dispatch-board.png", label: "Dispatch board" },
  { src: "/screenshots/call-recording.png", label: "Call history & recording" },
  { src: "/screenshots/job-videos.jpg", label: "Job walkthrough videos" },
  { src: "/screenshots/jha.png", label: "Safety — job hazard analysis" },
  { src: "/screenshots/vehicle-inspections.png", label: "Vehicle & plant inspections" },
  { src: "/screenshots/advanced-analytics.png", label: "Lead-source analytics" },
  { src: "/screenshots/calendar-scheduling.png", label: "Scheduling calendar" },
];

const metrics = [
  { value: "1", label: "app instead of five" },
  { value: "20", label: "years in the trades" },
  { value: "100%", label: "built for trades, in NZ" },
];

export default function Home() {
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

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

            <div className="mt-14 w-full max-w-4xl relative">
              <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-lime/25 to-transparent rounded-3xl blur-2xl" />
              <div className="rounded-2xl border border-ink-200 bg-paper shadow-lift overflow-hidden">
                <div className="h-9 border-b border-ink-100 bg-ink-50 flex items-center gap-1.5 px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
                </div>
                <img
                  src="/screenshots/dashboards-metrics.png"
                  alt="Inflow business dashboard — revenue, jobs, quote win rate and margins at a glance"
                  className="w-full h-auto block"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Founder note — who it's for */}
      <Section className="pt-4 md:pt-8 pb-2 md:pb-4">
        <div className="max-w-2xl mx-auto text-center">
          <span className="eyebrow">From one trade to another</span>
          <h2 className="heading-section text-3xl md:text-4xl mt-4">
            Built on a real job book, not a whiteboard.
          </h2>
          <p className="mt-5 text-ink-500 text-lg leading-relaxed">
            Everything you're about to see, I use every day to run and grow my own tree-care business. I built Inflow around the way trades actually work — so whether you're a plumber, sparky, drainlayer or builder, or anywhere in the home-service game, it should feel like it was made for you. Because it was.
          </p>
        </div>
      </Section>

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

      {/* Screenshot showcase */}
      <Section className="pt-16 md:pt-24">
        <div className="max-w-2xl mx-auto text-center">
          <span className="eyebrow">See it in action</span>
          <h2 className="heading-section text-4xl md:text-5xl mt-4">
            The real app, not a mockup.
          </h2>
          <p className="mt-5 text-ink-500 text-lg leading-relaxed">
            Actual screens from Inflow — the dashboard, the dispatch board, safety, calls and more.
          </p>
        </div>

        <div className="mt-14 [column-gap:1.25rem] columns-1 sm:columns-2 lg:columns-3">
          {galleryShots.map((s) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setLightbox(s)}
              className="group mb-5 block w-full break-inside-avoid text-left rounded-2xl border border-ink-100 bg-paper shadow-soft overflow-hidden transition hover:shadow-lift hover:border-ink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-deep focus-visible:ring-offset-2"
            >
              <span className="relative block">
                <img src={s.src} alt={s.label} className="w-full h-auto block" loading="lazy" />
                <span className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-900/70 text-paper opacity-0 group-hover:opacity-100 transition">
                  <ExpandIcon />
                </span>
              </span>
              <span className="flex items-center justify-between px-4 py-3 text-sm font-medium text-ink-600 border-t border-ink-100">
                {s.label}
                <span className="text-ink-400 group-hover:text-ink-700 transition-colors">Expand →</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-10 text-center">
          <LinkButton href="/features" variant="ghost" className="border border-ink-200">
            Explore all features
            <span aria-hidden>→</span>
          </LinkButton>
        </div>
      </Section>

      {/* Feature highlights */}
      <Section>
        <div className="max-w-2xl mx-auto text-center">
          <span className="eyebrow">What's inside</span>
          <h2 className="heading-section text-4xl md:text-5xl mt-4">
            Built for the way trades businesses actually work.
          </h2>
          <p className="mt-5 text-ink-500 text-lg leading-relaxed">
            Not a generic CRM with a "field service module" bolted on. Every workflow is shaped by twenty years in the trades — ten of them running a real trades business.
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
            Stop running your business out of five different apps.
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

      {/* Screenshot lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.label}
        >
          <div
            className="absolute inset-0 bg-ink-900/75 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          />
          <div className="relative w-full max-w-5xl">
            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="text-paper text-sm font-medium">{lightbox.label}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-paper/10 text-paper hover:bg-paper/20 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <img
              src={lightbox.src}
              alt={lightbox.label}
              className="w-full h-auto max-h-[82vh] object-contain rounded-xl border border-ink-700 shadow-lift bg-paper"
            />
          </div>
        </div>
      )}
    </>
  );
}

function ExpandIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

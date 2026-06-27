import { Section, Container } from "@/components/Container";
import { LinkButton } from "@/components/Button";

export default function About() {
  return (
    <>
      {/* Hero */}
      <Section className="pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <span className="eyebrow">About</span>
          <h1 className="heading-display text-5xl md:text-6xl mt-5">
            We didn't set out to build software. We set out to fix our own business.
          </h1>
        </div>
      </Section>

      {/* Story */}
      <section className="border-t border-ink-100">
        <Container className="py-20 md:py-24">
          <div className="max-w-2xl mx-auto">
            <div className="text-center">
              <span className="eyebrow">Origin</span>
              <h2 className="heading-section text-3xl md:text-4xl mt-3">
                Built in a trades business, for trades businesses.
              </h2>
            </div>
            <div className="mt-8 space-y-6 text-[17px] leading-[1.75] text-ink-700 text-left">
              <p>
                Inflow started inside <a className="underline decoration-lime-deep" href="https://app.treemarkables.co.nz">Treemarkables</a>, a tree-services business based in Gisborne, New Zealand. Eighteen years of running real jobs, hiring real crews, chasing real invoices and trying to keep real customers happy.
              </p>
              <p>
                For most of it, we ran the business out of five different apps and a notebook in the truck. None of them spoke to each other. Job sheets that never made it back to the office. Quotes that got lost between SMS and email. Safety paperwork that everyone signed and no-one read.
              </p>
              <p>
                We built Inflow because we couldn't find software that worked the way trades actually work — quote on a driveway, dispatch from the ute, finish a job and have the invoice already drafted by the time the chip's down.
              </p>
              <p>
                It runs our own business today. We're opening it up to a small group of other NZ trades businesses, one at a time, so we can make sure each one is set up right.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Principles */}
      <section className="bg-ink-50 border-y border-ink-100">
        <Container className="py-20 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow">How we build</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              The principles we hold the line on.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              {
                t: "Field first.",
                b: "If it doesn't work one-handed on a phone in a truck, it doesn't ship. The office desktop view comes second.",
              },
              {
                t: "No per-seat tax.",
                b: "Your casuals shouldn't cost you to onboard. Every paid plan is unlimited users — so the whole crew is in.",
              },
              {
                t: "Real work, not lock-in.",
                b: "Your data is yours, exportable any time. We earn the renewal by being useful, not by trapping you.",
              },
            ].map((p) => (
              <div key={p.t} className="rounded-2xl bg-paper border border-ink-100 p-7 text-center">
                <h3 className="text-xl font-semibold tracking-snug">{p.t}</h3>
                <p className="mt-3 text-ink-500 leading-relaxed text-[15px]">{p.b}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Location + CTA */}
      <Section>
        <div className="flex flex-col items-center text-center">
          <div className="max-w-2xl">
            <span className="eyebrow">Where we are</span>
            <h2 className="heading-section text-3xl md:text-4xl mt-3">
              Gisborne, New Zealand.
            </h2>
            <p className="mt-5 text-ink-500 leading-relaxed max-w-prose mx-auto">
              Built on the East Coast. Designed for NZ trades — GST, NZD, Pacific/Auckland time, real local context — but the platform works wherever you work.
            </p>
            <div className="mt-8">
              <LinkButton href="/contact" variant="primary" size="lg">
                Get in touch
              </LinkButton>
            </div>
          </div>
          <div className="mt-12 w-full max-w-xl aspect-[5/4] rounded-2xl bg-ink-900 text-paper p-10 flex flex-col justify-end text-left">
            <div className="text-lime text-xs uppercase tracking-[0.18em]">
              From the workshop
            </div>
            <p className="mt-3 text-2xl tracking-snug leading-tight">
              "If you've ever quoted a job at 6pm and invoiced it at 11pm because the day got away on you — Inflow is for you."
            </p>
            <p className="mt-4 text-sm text-ink-300">— The team</p>
          </div>
        </div>
      </Section>
    </>
  );
}

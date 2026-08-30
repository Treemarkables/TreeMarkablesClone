import type { ReactNode } from "react";
import { LinkButton } from "@/components/Button";
import { Container, Section } from "@/components/Container";
import Photo from "@/components/Photo";
import { BRAND } from "@/lib/brand";
import { GREEN_FEES, MEMBERSHIP_TIERS, PRICING_CONFIRMED } from "@/lib/course";
import { PHOTOS } from "@/lib/photos";

function PlaceholderPrice({ price, per }: { price: string | null; per?: string }) {
  if (price) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl text-club-950">{price}</span>
        {per && <span className="text-sm text-ink/50">{per}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="font-display text-3xl text-club-300" aria-hidden="true">
        $ —
      </span>
      <span className="inline-flex items-center rounded-full border border-gold px-3 py-1 text-xs font-semibold text-gold-deep">
        Confirm with the club
      </span>
    </div>
  );
}

export default function Membership() {
  return (
    <>
      <Section className="pb-10 md:pb-12">
        <p className="kicker">Membership & green fees</p>
        <h1 className="heading-display mt-4 max-w-3xl text-4xl md:text-6xl text-club-950">
          Join Gisborne's friendliest club.
        </h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink/75">
          Whether you play four rounds a week or four a year, there's a
          membership that fits, and casual visitors are always welcome to pay a
          green fee and play.
        </p>
        {!PRICING_CONFIRMED && (
          <div className="mt-8 max-w-2xl rounded-xl border border-gold/50 bg-gold/10 px-5 py-4 text-sm leading-relaxed text-ink/80">
            Prices on this page are being confirmed with the club. For current
            membership rates and green fees, phone{" "}
            <a href={BRAND.phoneHref} className="font-semibold text-club-900 underline underline-offset-2">
              {BRAND.phone}
            </a>{" "}
            or call into the clubhouse.
          </div>
        )}
      </Section>

      <Section className="pt-0">
        <div className="grid gap-6 md:grid-cols-2">
          {MEMBERSHIP_TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex flex-col justify-between rounded-2xl border border-club-200 bg-cream-warm p-7 shadow-soft"
            >
              <div>
                <h2 className="font-display text-2xl text-club-950">{tier.name}</h2>
                <p className="mt-3 leading-relaxed text-ink/70">{tier.blurb}</p>
              </div>
              <div className="mt-7">
                <PlaceholderPrice price={tier.price} per={tier.per} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <section className="bg-club-950 text-cream">
        <Container className="py-16 md:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <span className="rule-gold" aria-hidden="true" />
              <h2 className="heading-section mt-5 text-3xl md:text-4xl">Green fees</h2>
              <p className="mt-4 max-w-prose leading-relaxed text-cream/70">
                No membership needed. Members of other clubs get the affiliated
                rate; everyone else just pays at the clubhouse and plays.
              </p>
            </div>
            <div className="divide-y divide-cream/10 rounded-2xl border border-cream/15">
              {GREEN_FEES.map((row) => (
                <div key={row.label} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{row.label}</div>
                    <div className="text-sm text-cream/55">{row.detail}</div>
                  </div>
                  {row.price ? (
                    <div className="font-display text-2xl">{row.price}</div>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-gold/70 px-3 py-1 text-xs font-semibold text-gold-bright">
                      Ask at the clubhouse
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="heading-section text-3xl md:text-4xl text-club-950">
              What your sub gets you.
            </h2>
            <ul className="mt-7 max-w-prose space-y-4 text-ink/75">
              <Benefit>Unlimited golf on a course that stays open all year</Benefit>
              <Benefit>An official NZ Golf handicap and weekly club competitions</Benefit>
              <Benefit>Clubhouse privileges, including the simulator on wet days</Benefit>
              <Benefit>A club small enough to know your name by week two</Benefit>
            </ul>
            <div className="mt-9 rounded-2xl bg-club-100 p-6">
              <h3 className="font-display text-xl text-club-950">How to join</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                No forms on this website, on purpose. Ring the clubhouse or call
                in ({BRAND.hours.toLowerCase()}), have a yarn, and we'll sort
                the rest over a cuppa.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <LinkButton href={BRAND.phoneHref} external variant="primary" size="md">
                  Call {BRAND.phone}
                </LinkButton>
                <LinkButton href={`mailto:${BRAND.email}`} external variant="ghost" size="md" className="border border-club-200">
                  Email the club
                </LinkButton>
              </div>
            </div>
          </div>
          <Photo src={PHOTOS.pair.src} alt={PHOTOS.pair.alt} className="aspect-[4/5]" />
        </div>
      </Section>
    </>
  );
}

function Benefit({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 leading-relaxed">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

import { BRAND } from "@/lib/brand";
import { LinkButton } from "./Button";
import { Container } from "./Container";

// Contact is deliberately a band, not a page: phone and email are the whole
// story, so they travel with every page instead of hiding behind a nav item.
export default function ContactBand() {
  return (
    <section className="bg-club-900 text-cream">
      <Container className="py-16 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="heading-section text-3xl md:text-4xl">
              Come out for a round.
            </h2>
            <p className="mt-4 max-w-prose text-cream/70 leading-relaxed">
              No booking system, no fuss. Give the clubhouse a ring, flick us an
              email, or just turn up with your clubs. Someone will point you at
              the first tee.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <LinkButton href={BRAND.phoneHref} external variant="secondary" size="lg">
                Call {BRAND.phone}
              </LinkButton>
              <LinkButton
                href={`mailto:${BRAND.email}`}
                external
                variant="outline"
                size="lg"
              >
                {BRAND.email}
              </LinkButton>
            </div>
          </div>
          <dl className="space-y-5 text-sm md:justify-self-end">
            <div>
              <dt className="text-cream/50 uppercase tracking-[0.16em] text-xs font-semibold">
                Find us
              </dt>
              <dd className="mt-1 text-cream/90">{BRAND.address}</dd>
              <dd className="text-cream/60">Beside Gisborne Airport, five minutes from town</dd>
            </div>
            <div>
              <dt className="text-cream/50 uppercase tracking-[0.16em] text-xs font-semibold">
                Clubhouse
              </dt>
              <dd className="mt-1 text-cream/90">{BRAND.hours}</dd>
              <dd className="text-cream/60">Course open daylight hours, all year</dd>
            </div>
          </dl>
        </div>
      </Container>
    </section>
  );
}

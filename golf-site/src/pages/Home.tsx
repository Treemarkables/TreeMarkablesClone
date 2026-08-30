import { Link } from "wouter";
import { LinkButton } from "@/components/Button";
import { Container, Section } from "@/components/Container";
import Photo from "@/components/Photo";
import { COURSE } from "@/lib/course";
import { PHOTOS } from "@/lib/photos";

export default function Home() {
  return (
    <>
      {/* Hero: full-bleed photo, green wash, one idea. */}
      <section className="relative -mt-16 md:-mt-20 min-h-[88svh] flex items-end">
        <img
          src={PHOTOS.heroFairway.src}
          alt={PHOTOS.heroFairway.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-club-950/90 via-club-950/40 to-club-950/30" />
        <Container className="relative pb-16 pt-40 md:pb-24 text-cream">
          <p className="kicker text-gold-bright">Elgin, Gisborne · Est. on the flat</p>
          <h1 className="heading-display mt-4 max-w-3xl text-5xl md:text-7xl">
            Eighteen holes.
            <br />
            All year round.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/85">
            Gisborne Park is the city's tree-lined parkland course: flat,
            walkable and five minutes from town. Turn up, tee off, and stay for
            one at the clubhouse after.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <LinkButton href="/membership" variant="secondary" size="lg">
              Membership & green fees
            </LinkButton>
            <LinkButton href="/course" variant="outline" size="lg">
              Explore the course
            </LinkButton>
          </div>
        </Container>
      </section>

      {/* Course facts, engraved-plaque style strip. */}
      <section className="border-b border-club-200/70 bg-cream-warm">
        <Container className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-4 md:py-12">
          <Fact value={String(COURSE.holes)} label="holes" />
          <Fact value={String(COURSE.par)} label="par, white tees" />
          <Fact value={COURSE.yards.toLocaleString()} label="yards" />
          <Fact value="365" label="days a year" />
        </Container>
      </section>

      {/* The course, told as one asymmetric spread rather than a card grid. */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="rule-gold" aria-hidden="true" />
            <h2 className="heading-section mt-5 text-3xl md:text-5xl text-club-950">
              Mature trees, honest golf.
            </h2>
            <p className="mt-6 max-w-prose leading-relaxed text-ink/75">
              One of only two full eighteen-hole courses in Gisborne, the Park
              rewards straight hitting: stray left or right and the trees will
              have a word. The ground is flat and quick to walk, the greens are
              kept true, and the layout punches well above its weight.
            </p>
            <p className="mt-4 max-w-prose leading-relaxed text-ink/75">
              Being beside the airport means big sky, sea air and the odd plane
              to watch between shots. It also means we drain well, so winter
              golf here is actual golf, not bog snorkelling.
            </p>
            <div className="mt-8">
              <LinkButton href="/course" variant="primary" size="md">
                See the scorecard
              </LinkButton>
            </div>
          </div>
          <div className="grid grid-cols-[1.4fr_1fr] gap-4">
            <Photo
              src={PHOTOS.greenFlag.src}
              alt={PHOTOS.greenFlag.alt}
              className="aspect-[4/5]"
            />
            <div className="grid gap-4">
              <Photo src={PHOTOS.walkers.src} alt={PHOTOS.walkers.alt} className="aspect-square" />
              <Photo src={PHOTOS.redFlag.src} alt={PHOTOS.redFlag.alt} className="aspect-square" />
            </div>
          </div>
        </div>
      </Section>

      {/* Clubhouse band. */}
      <section className="bg-club-950 text-cream">
        <Container className="grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="rule-gold" aria-hidden="true" />
            <h2 className="heading-section mt-5 text-3xl md:text-4xl">
              The nineteenth hole is open.
            </h2>
            <p className="mt-5 max-w-prose leading-relaxed text-cream/70">
              The clubhouse runs 8am to 4pm, with a golf simulator for rainy
              days, the footy on the telly, and
              the kind of club where someone will shout you your first raffle
              ticket. Come for the golf, stay for the company.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-cream/80">
              <li className="flex gap-3"><Tick /> Golf simulator in the clubhouse</li>
              <li className="flex gap-3"><Tick /> Casual visitors and green-fee players welcome</li>
              <li className="flex gap-3"><Tick /> Club competitions and social golf every week</li>
            </ul>
          </div>
          {/* Photo slot: replace with the club's own clubhouse shot. Stock
              interiors would misrepresent the venue, so this stays a frame. */}
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border-2 border-dashed border-cream/25 text-center">
            <div className="px-8">
              <p className="font-display text-xl text-cream/70">Clubhouse photo goes here</p>
              <p className="mt-2 text-sm text-cream/45">
                Waiting on a real shot of the bar, the simulator or the honours
                board. No stock stand-ins for home turf.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Events teaser. */}
      <Section>
        <Link
          href="/events"
          className="group grid items-center gap-8 rounded-3xl border border-club-200 bg-cream-warm p-8 transition-shadow hover:shadow-lift md:grid-cols-[1fr_1.2fr] md:p-12"
        >
          <Photo
            src={PHOTOS.twilight.src}
            alt={PHOTOS.twilight.alt}
            className="aspect-[16/10] md:order-2"
          />
          <div>
            <p className="kicker">Events & functions</p>
            <h2 className="heading-section mt-3 text-2xl md:text-4xl text-club-950">
              Twilight golf, tournaments, and a venue with a view of the 18th.
            </h2>
            <p className="mt-4 max-w-prose text-ink/70 leading-relaxed">
              Weekly club days, open tournaments and a clubhouse you can book
              for your own do.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-club-900 group-hover:gap-3 transition-all">
              What's on <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      </Section>
    </>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="font-display text-4xl md:text-5xl text-club-900 tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">{label}</div>
    </div>
  );
}

function Tick() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

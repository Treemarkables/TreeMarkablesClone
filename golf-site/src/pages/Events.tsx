import { LinkButton } from "@/components/Button";
import { Container, Section } from "@/components/Container";
import Photo from "@/components/Photo";
import { BRAND } from "@/lib/brand";
import { PHOTOS } from "@/lib/photos";

const CLUB_GOLF = [
  {
    name: "Club days",
    when: "Every week",
    blurb:
      "Men's, women's and midweek divisions with a rolling calendar of stroke play, stableford and match play. Visitors with a handicap can usually jump in; ask at the clubhouse.",
  },
  {
    name: "Twilight golf",
    when: "Summer evenings",
    blurb:
      "Nine holes after work while the light lasts, then a barbecue and a quiet one on the deck. The most relaxed golf of the week, and the busiest.",
  },
  {
    name: "Open tournaments",
    when: "Through the season",
    blurb:
      "Our opens draw players from across Tairāwhiti and beyond. Watch this page, or ring the club to get on the start list for the next one.",
  },
];

export default function Events() {
  return (
    <>
      <section className="relative -mt-16 md:-mt-20 flex min-h-[56svh] items-end">
        <img
          src={PHOTOS.drive.src}
          alt={PHOTOS.drive.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-fairway-950/90 via-fairway-950/40 to-fairway-950/25" />
        <Container className="relative pb-14 pt-40 text-cream">
          <p className="kicker text-gold-bright">Events & functions</p>
          <h1 className="heading-display mt-4 max-w-3xl text-4xl md:text-6xl">
            There's always something on at the Park.
          </h1>
        </Container>
      </section>

      <Section>
        <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
          {CLUB_GOLF.map((e) => (
            <div key={e.name} className="border-t-2 border-fairway-900 pt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-deep">
                {e.when}
              </div>
              <h2 className="mt-2 font-display text-2xl text-fairway-950">{e.name}</h2>
              <p className="mt-3 leading-relaxed text-bark/75">{e.blurb}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="bg-cream-warm border-y border-fairway-200/70">
        <Container className="grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1fr_1.1fr]">
          <Photo
            src={PHOTOS.walkers.src}
            alt={PHOTOS.walkers.alt}
            className="aspect-[4/3] lg:order-2"
          />
          <div>
            <span className="rule-gold" aria-hidden="true" />
            <h2 className="heading-section mt-5 text-3xl md:text-4xl text-fairway-950">
              Hire the clubhouse.
            </h2>
            <div className="mt-6 max-w-prose space-y-4 leading-relaxed text-bark/75">
              <p>
                Birthdays, prizegivings, wakes, work dos: the clubhouse looks
                out over the course, has a licensed bar, and holds a decent
                crowd without feeling empty with a small one.
              </p>
              <p>
                Add golf if you like. A team ambrose for the office is a great
                leveller, and the simulator keeps the non-golfers entertained
                whatever the weather is doing.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href={BRAND.phoneHref} external variant="primary" size="md">
                Ring us about a date
              </LinkButton>
              <LinkButton href={`mailto:${BRAND.email}`} external variant="ghost" size="md" className="border border-fairway-200">
                {BRAND.email}
              </LinkButton>
            </div>
          </div>
        </Container>
      </section>

      <Section>
        <div className="grid items-center gap-10 rounded-3xl bg-fairway-900 p-8 text-cream md:grid-cols-[1.2fr_1fr] md:p-12">
          <div>
            <h2 className="heading-section text-2xl md:text-4xl">
              Rain on the forecast? The simulator isn't fussed.
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-cream/70">
              The clubhouse simulator lets you play a full round on courses from
              around the world, work on your swing, or settle an argument about
              who really has the longer drive. Ask at the bar to book it.
            </p>
          </div>
          <SimulatorGlyph />
        </div>
      </Section>
    </>
  );
}

function SimulatorGlyph() {
  return (
    <svg viewBox="0 0 320 200" className="mx-auto w-full max-w-xs" role="img" aria-label="Drawing of a golf simulator screen with a ball's flight arc">
      <rect x="20" y="16" width="280" height="150" rx="10" fill="#0B2117" stroke="#C9A227" strokeOpacity="0.5" strokeWidth="2" />
      <path d="M40 150 C110 60 210 44 284 58" stroke="#FAF6EB" strokeWidth="2" strokeDasharray="1 8" strokeLinecap="round" fill="none" />
      <path d="M40 152 C120 130 220 122 284 126" stroke="#3D7D5F" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.8" />
      <circle cx="284" cy="58" r="5" fill="#FAF6EB" />
      <line x1="120" y1="182" x2="200" y2="182" stroke="#C9A227" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

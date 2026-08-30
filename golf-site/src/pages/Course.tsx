import { LinkButton } from "@/components/Button";
import { Container, Section } from "@/components/Container";
import Scorecard from "@/components/Scorecard";
import HoleDiagram from "@/components/illustrations/HoleDiagram";
import { BRAND } from "@/lib/brand";
import { COURSE, FRONT_NINE, BACK_NINE } from "@/lib/course";
import { PHOTOS } from "@/lib/photos";

const SIGNATURES = [
  {
    hole: "10th",
    par: "Par 4 · 378 yds · Index 1",
    note: "The card's toughest. A long, tree-pinched par 4 straight after the turn, before you've finished your cup of tea.",
  },
  {
    hole: "1st",
    par: "Par 5 · 456 yds · Index 2",
    note: "No gentle warm-up here. A reachable-in-theory par 5 that sets the tone: hit it straight or make friends with the trees.",
  },
  {
    hole: "14th",
    par: "Par 3 · 112 yds · Index 17",
    note: "The shortest hole on the course and everyone's birdie hope. More cards ruined by overconfidence than by distance.",
  },
];

export default function Course() {
  return (
    <>
      <section className="relative -mt-16 md:-mt-20 flex min-h-[62svh] items-end">
        <img
          src={PHOTOS.openField.src}
          alt={PHOTOS.openField.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-club-950/90 via-club-950/35 to-club-950/25" />
        <Container className="relative pb-14 pt-40 text-cream">
          <p className="kicker text-gold-bright">The course</p>
          <h1 className="heading-display mt-4 max-w-3xl text-4xl md:text-6xl">
            A parkland course that plays all year.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream/85">
            {COURSE.holes} holes, par {COURSE.par},{" "}
            {COURSE.yards.toLocaleString()} yards off the white tees. Flat under
            foot, trees down both sides, greens kept true.
          </p>
        </Container>
      </section>

      <Section>
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="rule-gold" aria-hidden="true" />
            <h2 className="heading-section mt-5 text-3xl md:text-4xl text-club-950">
              Straight hitters prosper.
            </h2>
            <div className="mt-6 max-w-prose space-y-4 leading-relaxed text-ink/75">
              <p>
                The Park is honest golf. There are no blind tricks and no
                mountain-goat climbs, just mature trees lining nearly every
                fairway, ready to punish anything wild off the tee. Keep it on
                the short grass and the course gives you every chance; spray it
                and you'll be punching out sideways all day.
              </p>
              <p>
                Both nines play to par 36 and there's a good spread of holes:
                three par 5s on the front to get the round moving, four one-shot
                holes across the card, and a back nine that opens with the
                hardest hole on the course.
              </p>
              <p>
                Because the land is flat and drains well, the course stays open
                and walkable through winter. Plenty of members walk eighteen
                holes into their eighties, which tells you most of what you need
                to know.
              </p>
            </div>
          </div>
          <HoleDiagram className="w-full max-w-md justify-self-center lg:justify-self-end" />
        </div>
      </Section>

      <section className="bg-cream-warm border-y border-club-200/70">
        <Container className="py-16 md:py-24">
          <span className="rule-gold" aria-hidden="true" />
          <h2 className="heading-section mt-5 text-3xl md:text-4xl text-club-950">
            The card.
          </h2>
          <p className="mt-3 max-w-prose text-ink/70">
            Out in {COURSE.out.yards.toLocaleString()}, home in{" "}
            {COURSE.in.yards.toLocaleString()}.
          </p>
          <div className="mt-8">
            <Scorecard />
          </div>
        </Container>
      </section>

      <Section>
        <h2 className="heading-section text-3xl md:text-4xl text-club-950">
          Holes worth a story.
        </h2>
        <div className="mt-10 grid gap-x-10 gap-y-12 md:grid-cols-3">
          {SIGNATURES.map((s) => (
            <div key={s.hole}>
              <div className="font-display text-5xl text-club-300">{s.hole}</div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-deep">
                {s.par}
              </div>
              <p className="mt-3 leading-relaxed text-ink/75">{s.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-wrap items-center gap-4 rounded-2xl bg-club-100 px-6 py-5">
          <p className="text-sm text-club-900">
            {FRONT_NINE.length + BACK_NINE.length} holes of it waiting on{" "}
            {BRAND.address.split(",")[0]}. Green fees at the clubhouse, no
            booking needed.
          </p>
          <LinkButton href="/membership" variant="primary" size="md" className="ml-auto">
            Green fees & membership
          </LinkButton>
        </div>
      </Section>
    </>
  );
}

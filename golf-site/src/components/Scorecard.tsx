import { FRONT_NINE, BACK_NINE, COURSE, type Hole } from "@/lib/course";

function ParBadge({ par }: { par: number }) {
  if (par === 4) {
    return <span className="tabular-nums">{par}</span>;
  }
  // Par 3s and 5s get the brass treatment so the card scans at a glance.
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-gold-deep font-semibold tabular-nums">
      {par}
    </span>
  );
}

function Nine({
  title,
  holes,
  totalLabel,
  totalPar,
  totalYards,
}: {
  title: string;
  holes: Hole[];
  totalLabel: string;
  totalPar: number;
  totalYards: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-club-200 bg-cream shadow-soft">
      <table className="w-full text-sm">
        <caption className="bg-club-900 px-4 py-3 text-left font-display text-base text-cream">
          {title}
        </caption>
        <thead>
          <tr className="border-b border-club-200 text-xs uppercase tracking-[0.12em] text-club-600">
            <th scope="col" className="px-4 py-2.5 text-left font-semibold">Hole</th>
            <th scope="col" className="px-4 py-2.5 text-center font-semibold">Par</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">Yards</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">Index</th>
          </tr>
        </thead>
        <tbody>
          {holes.map((h) => (
            <tr key={h.hole} className="border-b border-club-100 last:border-0">
              <td className="px-4 py-2.5 font-semibold text-club-950 tabular-nums">{h.hole}</td>
              <td className="px-4 py-2.5 text-center text-ink/80"><ParBadge par={h.par} /></td>
              <td className="px-4 py-2.5 text-right text-ink/80 tabular-nums">{h.yards}</td>
              <td className="px-4 py-2.5 text-right text-ink/50 tabular-nums">{h.si}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-club-100/70 font-semibold text-club-950">
            <td className="px-4 py-3">{totalLabel}</td>
            <td className="px-4 py-3 text-center tabular-nums">{totalPar}</td>
            <td className="px-4 py-3 text-right tabular-nums">{totalYards.toLocaleString()}</td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function Scorecard() {
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Nine
          title="Front nine"
          holes={FRONT_NINE}
          totalLabel="Out"
          totalPar={COURSE.out.par}
          totalYards={COURSE.out.yards}
        />
        <Nine
          title="Back nine"
          holes={BACK_NINE}
          totalLabel="In"
          totalPar={COURSE.in.par}
          totalYards={COURSE.in.yards}
        />
      </div>
      <p className="mt-5 text-sm text-ink/60">
        White tees. Course total par {COURSE.par}, {COURSE.yards.toLocaleString()} yards.
        Hardest hole on the card is the 10th, index 1. The friendly ones are the
        short par 3s at 5 and 14.
      </p>
    </div>
  );
}

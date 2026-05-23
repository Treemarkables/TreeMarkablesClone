import { Star } from "lucide-react";

interface Review {
  name: string;
  when: string;
  text: string;
}

// 3 verified Google reviews (from Treemarkables Google Business Profile).
// Ordered most-recent first.
const REVIEWS: Review[] = [
  {
    name: "Sue Stone",
    when: "2 months ago",
    text: "Very professional service, friendly and efficient. Left the garden clean and tidy. Definitely worth it, would not hesitate to use again.",
  },
  {
    name: "Richard Childs",
    when: "3 months ago",
    text: "We are extremely happy with the work done by Treemarkables. Their attention to detail was outstanding, they were punctual, and their pricing was very fair compared to competitors. The team is friendly, professional, and clearly very knowledgeable. We'd happily recommend them to anyone for any job, big or small.",
  },
  {
    name: "Gilbert Go",
    when: "6 months ago",
    text: "Awesome job from the Treemarkable team! Super easy to talk to, great communication, and no mucking around. They did exactly what we talked about — no surprises, just solid, reliable work. Fast, tidy, and friendly service.",
  },
];

function GoogleG({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Google">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function RedesignReviews() {
  return (
    <section id="reviews" className="bg-paper py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-12">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Reviews</div>
          <h2 className="font-display font-bold text-ink leading-[1.1] tracking-tight" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
            What <span className="bg-neon text-ink px-2.5 rounded-lg">Gisborne homeowners</span> say
          </h2>
          <div className="mt-5 inline-flex items-center gap-2.5 bg-white border border-ink/10 rounded-full px-4 py-2 shadow-sm">
            <GoogleG />
            <span className="text-ink font-bold text-sm">5.0</span>
            <span className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-[#1aa12a] text-[#1aa12a]" />
              ))}
            </span>
            <span className="text-mute text-sm">55 Google reviews</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-white border border-ink/10 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#1aa12a] text-[#1aa12a]" />
                  ))}
                </div>
                <GoogleG />
              </div>
              <p className="text-ink/80 leading-relaxed mb-5 flex-1">"{r.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-ink/10">
                <div className="h-9 w-9 rounded-full bg-forest/10 text-forest flex items-center justify-center font-bold text-sm">
                  {r.name[0]}
                </div>
                <div>
                  <div className="text-ink font-semibold text-sm">{r.name}</div>
                  <div className="text-mute text-xs">{r.when} · Google review</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

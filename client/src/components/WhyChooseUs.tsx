import { Target, MessageSquare, ClipboardList, Star, ShieldCheck, Clock, Award, MapPin } from "lucide-react";

const whyCards = [
  {
    icon: Target,
    title: "Precision Execution",
    description: "Zero guesswork. We plan thoroughly and deliver safely.",
    showStars: true,
  },
  {
    icon: MessageSquare,
    title: "Clear Communication",
    description: "You're in the loop with timing updates, so you always know what's going on.",
    showStars: false,
  },
  {
    icon: ClipboardList,
    title: "Job Done Right",
    description: "Straightforward quotes. Complicated jobs handled properly — no mess left behind.",
    showStars: false,
  },
];

const trustBadges = [
  { icon: Award, label: "5+ Years Experience" },
  { icon: ShieldCheck, label: "Fully Insured" },
  { icon: MapPin, label: "Local Gisborne Crew" },
  { icon: Clock, label: "Fast Response" },
];

const GREEN = "#39FF14";

export default function WhyChooseUs() {
  return (
    <>
      {/* ── Top: Why Treemarkables ── */}
      <section
        className="relative py-16 md:py-20"
        style={{ background: "linear-gradient(135deg, #0a1a0a 0%, #0f2a0f 50%, #0a1a0a 100%)" }}
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #39FF14 0%, transparent 60%)" }}
        />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="flex justify-center mb-6">
            <span
              className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full"
              style={{ color: GREEN, border: `1px solid ${GREEN}`, letterSpacing: "0.15em" }}
            >
              #1 Choice for Tree Care in Gisborne
            </span>
          </div>

          <h2
            className="text-center font-extrabold leading-tight tracking-tight text-white mb-4"
            style={{ fontSize: "clamp(28px, 5vw, 56px)", fontFamily: "'TT Norms Pro', sans-serif" }}
          >
            Why Treemarkables Gets Called First —{" "}
            <span style={{ color: GREEN }}>And Called Back Again</span>
          </h2>

          <p className="text-center text-white/70 max-w-2xl mx-auto mb-12" style={{ fontSize: "clamp(15px, 1.6vw, 18px)" }}>
            Trusted by homeowners who want{" "}
            <strong className="text-white">tree jobs done once, done right</strong> — without the runaround.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {whyCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-6 flex flex-col gap-4"
                  data-testid={`card-feature-${index}`}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#e8fce8", border: "1px solid #39FF14" }}
                  >
                    <Icon className="h-6 w-6" style={{ color: "#1a7a1a" }} data-testid={`icon-feature-${index}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900" data-testid={`title-feature-${index}`}>
                    {card.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed flex-1" data-testid={`description-feature-${index}`}>
                    {card.description}
                  </p>
                  {card.showStars && (
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">90+ Five-Star Reviews</span>
                    </div>
                  )}
                  {!card.showStars && (
                    <div className="mt-auto pt-2 border-t border-gray-100">
                      <div className="h-1 w-12 rounded-full" style={{ background: GREEN }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Bottom: Split photo / text ── */}
      <section id="process" className="bg-white">
        <div className="flex flex-col lg:flex-row min-h-[520px]">

          {/* Left — photo */}
          <div className="relative lg:w-[45%] min-h-[320px] lg:min-h-0">
            <img
              src="/team-photo.jpg"
              alt="Treemarkables arborist team at work in Gisborne"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* Google rating badge */}
            <div className="absolute bottom-5 left-5 flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-lg">
              {/* Google G */}
              <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" aria-label="Google">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-none mb-1">Google Rating</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-gray-900">4.9</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">Based on 90+ reviews</p>
              </div>
            </div>
          </div>

          {/* Right — text */}
          <div className="lg:w-[55%] flex items-center px-8 py-14 lg:px-16 lg:py-20">
            <div className="max-w-lg">
              <h2
                className="font-extrabold text-gray-900 leading-tight mb-6"
                style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontFamily: "'TT Norms Pro', sans-serif" }}
              >
                Treemarkables Tree Services<br className="hidden sm:block" /> In Gisborne, NZ
              </h2>

              <p className="text-gray-600 leading-relaxed mb-4" style={{ fontSize: "clamp(15px, 1.5vw, 17px)" }}>
                When you need tree removal and maintenance in Gisborne, there's one team locals call first —
                Treemarkables. With over five years of hands-on experience and a crew of qualified arborists,
                we deliver safe, efficient tree work with no runaround and no hidden costs.
              </p>

              <p className="text-gray-600 leading-relaxed mb-10" style={{ fontSize: "clamp(15px, 1.5vw, 17px)" }}>
                From storm-damage response and hazardous removals to pruning, stump grinding and hedge
                trimming — we handle it all, leaving your property clean and safe every time.
              </p>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-3">
                {trustBadges.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

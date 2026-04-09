import { Target, MessageSquare, ClipboardList, ScanSearch, ReceiptText, Axe, Sparkles, Check, Star } from "lucide-react";

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

const steps = [
  { number: 1, icon: ScanSearch, title: "On-Site Assessment", description: "We come to you and walk the site — checking access, overhead hazards, ground conditions, and what gear is needed. No guessing from photos.", color: "#2563eb", bg: "#eff6ff" },
  { number: 2, icon: ReceiptText, title: "Clear Plan & Quote", description: "You get a straight, itemised quote before anything starts. We explain exactly what's included, the timeline, and any site-specific considerations.", color: "#d97706", bg: "#fffbeb" },
  { number: 3, icon: Axe, title: "Controlled Removal", description: "Our qualified crew uses the right equipment for the job — from hand tools to elevated work platforms — ensuring safe, precise removal every time.", color: "#dc2626", bg: "#fef2f2" },
  { number: 4, icon: Sparkles, title: "Thorough Clean-Up", description: "All timber, branches and green waste are cleared from your property. We rake, blow down and leave the area clean — ready for you to use straight away.", color: "#0891b2", bg: "#ecfeff" },
];

const trustBadges = ["18+ Years Experience", "Fully Insured", "Local Gisborne Crew", "Fast Response"];

export default function WhyChooseUs() {
  return (
    <>
      {/* ── Top: Why Treemarkables ── */}
      <section
        className="relative py-16 md:py-20"
        style={{ background: "linear-gradient(135deg, #0a1a0a 0%, #0f2a0f 50%, #0a1a0a 100%)" }}
      >
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #39FF14 0%, transparent 60%)" }}
        />

        <div className="relative max-w-6xl mx-auto px-6">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span
              className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full"
              style={{ color: "#39FF14", border: "1px solid #39FF14", letterSpacing: "0.15em" }}
            >
              #1 Choice for Tree Care in Gisborne
            </span>
          </div>

          {/* Heading */}
          <h2
            className="text-center font-extrabold leading-tight tracking-tight text-white mb-4"
            style={{ fontSize: "clamp(28px, 5vw, 56px)", fontFamily: "'TT Norms Pro', sans-serif" }}
          >
            Why Treemarkables Gets Called First —{" "}
            <span style={{ color: "#39FF14" }}>And Called Back Again</span>
          </h2>

          {/* Subheading */}
          <p className="text-center text-white/70 max-w-2xl mx-auto mb-12" style={{ fontSize: "clamp(15px, 1.6vw, 18px)" }}>
            Trusted by homeowners who want{" "}
            <strong className="text-white">tree jobs done once, done right</strong> — without the runaround.
          </p>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {whyCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-4 flex flex-col gap-2"
                  data-testid={`card-feature-${index}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#e8fce8", border: "1px solid #39FF14" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: "#1a7a1a" }} data-testid={`icon-feature-${index}`} />
                  </div>
                  <h3
                    className="text-lg font-bold text-gray-900"
                    data-testid={`title-feature-${index}`}
                  >
                    {card.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed flex-1 text-sm" data-testid={`description-feature-${index}`}>
                    {card.description}
                  </p>
                  {card.showStars && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">90+ Five-Star Reviews</span>
                    </div>
                  )}
                  {!card.showStars && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="h-1 w-10 rounded-full" style={{ background: "#39FF14" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Bottom: How We Do Every Job ── */}
      <section id="process" className="py-4 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          {/* Heading */}
          <div className="text-center mb-4">
            <h2
              className="font-extrabold text-foreground mb-2"
              style={{ fontSize: "clamp(26px, 4vw, 44px)", fontFamily: "'TT Norms Pro', sans-serif" }}
            >
              How We Do Every Job
            </h2>
            <p className="text-muted-foreground text-lg">
              Tight, efficient jobs ending with <strong>zero loose ends.</strong>
            </p>
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="bg-background rounded-xl p-5 shadow-sm border border-border/50"
                  data-testid={`card-process-${step.number - 1}`}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: step.bg }}
                  >
                    <Icon className="h-6 w-6" style={{ color: step.color }} data-testid={`icon-process-${step.number - 1}`} />
                  </div>
                  <p className="text-lg font-bold mb-1" style={{ color: "#39FF14" }}>
                    {step.number}
                  </p>
                  <h3 className="text-xl font-bold text-foreground mb-1.5" data-testid={`title-process-${step.number - 1}`}>
                    {step.title}
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed" data-testid={`description-process-${step.number - 1}`}>
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 pb-2">
            {trustBadges.map((badge) => (
              <div key={badge} className="flex items-center gap-2 text-base font-bold text-muted-foreground">
                <Check className="h-4 w-4 flex-shrink-0" style={{ color: "#39FF14" }} />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

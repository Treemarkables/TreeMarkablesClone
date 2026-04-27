import { ClipboardList, FileText, Truck, Leaf, ShieldCheck, Clock, Award, MapPin } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: ClipboardList,
    title: "On-Site Assessment",
    description: "We come to you, assess access, risk and scope — no surprises, no guesswork.",
  },
  {
    number: "02",
    icon: FileText,
    title: "Clear Plan & Quote",
    description: "Upfront pricing, plain English. You approve it before we lift a finger.",
  },
  {
    number: "03",
    icon: Truck,
    title: "Controlled Removal",
    description: "Skilled crew, right gear, precise cuts — your property stays protected.",
  },
  {
    number: "04",
    icon: Leaf,
    title: "Thorough Clean-Up",
    description: "We leave your property cleaner than we found it. Zero mess, zero stress.",
  },
];

const badges = [
  { icon: Award, label: "5+ Years Experience" },
  { icon: ShieldCheck, label: "Fully Insured" },
  { icon: MapPin, label: "Local Gisborne Crew" },
  { icon: Clock, label: "Fast Response" },
];

const GREEN = "#39FF14";

export function Redesign() {
  return (
    <section
      className="w-full py-20 px-6 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #071207 0%, #0d1f0d 55%, #071207 100%)" }}
    >
      {/* Glow blobs */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 15% 80%, rgba(57,255,20,0.06) 0%, transparent 70%),
                       radial-gradient(ellipse 50% 35% at 85% 20%, rgba(57,255,20,0.04) 0%, transparent 70%)`,
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Eyebrow */}
        <p
          className="text-center text-xs font-bold tracking-[0.22em] uppercase mb-4"
          style={{ color: GREEN }}
        >
          Our Process
        </p>

        {/* Heading */}
        <h2
          className="text-center font-extrabold text-white leading-tight mb-4"
          style={{ fontSize: "clamp(28px, 4.5vw, 52px)", fontFamily: "'TT Norms Pro', sans-serif" }}
        >
          How We Do Every Job
        </h2>
        <p className="text-center text-white/50 text-base mb-16 max-w-xl mx-auto">
          Tight, efficient jobs — ending with <span className="text-white/80 font-semibold">zero loose ends.</span>
        </p>

        {/* Steps */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px">
          {/* Connecting rule — desktop only */}
          <div
            className="hidden lg:block absolute top-[2.6rem] left-[calc(12.5%+1px)] right-[calc(12.5%+1px)] h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${GREEN}55, ${GREEN}55, transparent)` }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="relative flex flex-col items-start lg:items-center text-left lg:text-center px-6 py-8 gap-4"
              >
                {/* Number bubble */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-black text-base z-10 relative"
                    style={{
                      background: "rgba(57,255,20,0.12)",
                      border: `1.5px solid ${GREEN}`,
                      color: GREEN,
                      fontFamily: "'TT Norms Pro', sans-serif",
                      boxShadow: `0 0 18px rgba(57,255,20,0.25)`,
                    }}
                  >
                    {step.number}
                  </div>
                </div>

                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Icon className="w-5 h-5 text-white/60" />
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-white font-bold text-base mb-2 leading-snug">{step.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{step.description}</p>
                </div>

                {/* Vertical rule between steps on mobile */}
                {i < steps.length - 1 && (
                  <div
                    className="lg:hidden absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-8"
                    style={{ background: `linear-gradient(180deg, ${GREEN}40, transparent)` }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-12 h-px mx-auto max-w-md" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-4">
          {badges.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{
                background: "rgba(57,255,20,0.07)",
                border: "1px solid rgba(57,255,20,0.22)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { GraduationCap, Shield, FileCheck, Clock, Leaf, Star } from "lucide-react";

const features = [
  {
    number: "01",
    icon: GraduationCap,
    title: "Expertise",
    description: "Our skilled arborists are trained in the latest techniques for safe and effective tree removal.",
  },
  {
    number: "02",
    icon: Shield,
    title: "Safety First",
    description: "We prioritise safety in every aspect of our work, using state-of-the-art equipment and industry best practices.",
  },
  {
    number: "03",
    icon: FileCheck,
    title: "Fully Insured",
    description: "Licensed and insured, giving you complete peace of mind throughout every job.",
  },
  {
    number: "04",
    icon: Clock,
    title: "On Time",
    description: "We show up when we say we will and get the job done efficiently without cutting corners.",
  },
  {
    number: "05",
    icon: Leaf,
    title: "Clean & Tidy",
    description: "We leave your property spotless — all debris removed and the site cleaner than we found it.",
  },
  {
    number: "06",
    icon: Star,
    title: "Local & Trusted",
    description: "Gisborne's most trusted arborist team, backed by hundreds of happy local customers.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-[#0a0a0a] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6">

        {/* Heading */}
        <div className="mb-16 md:mb-20">
          <p
            className="text-[#39FF14] font-semibold uppercase tracking-widest mb-3"
            style={{ fontSize: '13px' }}
          >
            Why Treemarkables
          </p>
          <h2
            className="font-extrabold text-white leading-tight"
            style={{
              fontSize: 'clamp(36px, 5.5vw, 64px)',
              fontFamily: "'TT Norms Pro', sans-serif",
            }}
          >
            The team Gisborne<br />trusts with their trees.
          </h2>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-white/10">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-[#0a0a0a] p-8 md:p-10 group"
                data-testid={`card-feature-${index}`}
              >
                {/* Number + icon row */}
                <div className="flex items-center justify-between mb-6">
                  <span
                    className="font-extrabold text-[#39FF14] leading-none"
                    style={{ fontSize: 'clamp(40px, 4vw, 56px)', fontFamily: "'TT Norms Pro', sans-serif" }}
                  >
                    {feature.number}
                  </span>
                  <Icon
                    className="text-white/20"
                    style={{ width: '36px', height: '36px' }}
                    data-testid={`icon-feature-${index}`}
                  />
                </div>

                {/* Top divider — green */}
                <div className="w-8 h-[2px] bg-[#39FF14] mb-5" />

                <h3
                  className="text-white font-bold mb-3"
                  style={{ fontSize: 'clamp(18px, 1.8vw, 22px)' }}
                  data-testid={`title-feature-${index}`}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-white/55 leading-relaxed"
                  style={{ fontSize: '15px' }}
                  data-testid={`description-feature-${index}`}
                >
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

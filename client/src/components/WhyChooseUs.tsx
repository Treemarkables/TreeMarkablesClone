import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Shield, TreePine, ThumbsUp } from "lucide-react";

const features = [
  {
    icon: GraduationCap,
    title: "Expertise",
    description: "Our certified arborists are skilled in advanced tree removal techniques to ensure safe and effective service.",
  },
  {
    icon: Shield,
    title: "Safety First",
    description: "We prioritise safety at every step, using state-of-the-art equipment and strict safety protocols.",
  },
  {
    icon: TreePine,
    title: "Fully Insured",
    description: "We are fully licensed and insured, giving you complete peace of mind throughout the tree removal process.",
  },
];

export default function WhyChooseUs() {
  return (
    <>
      {/* Top: dark hero section with photo and stats */}
      <section style={{ backgroundColor: "#0f1f0f" }} className="relative overflow-hidden">
        <div className="relative flex flex-col md:flex-row" style={{ minHeight: "400px" }}>
          {/* LEFT: text + stats */}
          <div className="md:w-[58%] px-8 py-14 md:px-16 md:py-20 flex flex-col justify-center">
            <h2
              className="font-extrabold text-white leading-tight mb-4"
              style={{ fontSize: "clamp(2rem, 3.5vw, 2.75rem)" }}
            >
              Why Choose Treemarkables?
            </h2>
            <p className="text-gray-300 text-lg mb-10 max-w-md leading-relaxed">
              Trusted tree removal experts delivering quality service in Gisborne, Wairoa and the East Coast.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4">
              {/* Stat: Satisfied Clients */}
              <div
                className="rounded-lg px-6 py-5 flex flex-col items-start min-w-[160px]"
                style={{ backgroundColor: "#1a2e1a" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ThumbsUp className="w-5 h-5" style={{ color: "#39FF14" }} />
                  <span className="text-2xl font-extrabold text-white">1,000+</span>
                </div>
                <span className="text-gray-400 text-sm">Satisfied Clients</span>
              </div>

              {/* Stat: Years of Experience */}
              <div
                className="rounded-lg px-6 py-5 flex flex-col items-start min-w-[160px]"
                style={{ backgroundColor: "#1a2e1a" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-5 h-5" style={{ color: "#39FF14" }} />
                  <span className="text-2xl font-extrabold text-white">18+</span>
                </div>
                <span className="text-gray-400 text-sm">Years of Experience</span>
              </div>
            </div>
          </div>

          {/* RIGHT: arborist photo */}
          <div className="md:w-[42%] relative overflow-hidden" style={{ minHeight: "280px" }}>
            <img
              src="/arborist-drone.jpg"
              alt="Treemarkables arborist working safely at height"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>
        </div>
      </section>

      {/* Bottom: The Treemarkables Advantage cards */}
      <section className="py-14 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <h3 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
            The Treemarkables Advantage
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="text-center hover-elevate" data-testid={`card-feature-${index}`}>
                  <CardContent className="pt-8 pb-6">
                    <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <Icon className="h-8 w-8 text-primary" data-testid={`icon-feature-${index}`} />
                      </div>
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-3" data-testid={`title-feature-${index}`}>
                      {feature.title}
                    </h4>
                    <p className="text-muted-foreground leading-relaxed" data-testid={`description-feature-${index}`}>
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Shield, TreePine } from "lucide-react";

const features = [
  {
    icon: GraduationCap,
    title: "Expertise",
    description: "Our skilled arborists are trained in the latest techniques for safe and effective tree removal.",
  },
  {
    icon: Shield,
    title: "Safety First",
    description: "We prioritize safety in every aspect of our work, using state-of-the-art equipment and industry best practices.",
  },
  {
    icon: TreePine,
    title: "Insured",
    description: "Fully licensed and insured, giving you peace of mind throughout the tree removal process.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            So why choose Treemarkables?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We combine expertise, safety, and care to deliver exceptional tree removal services
          </p>
        </div>

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
                  <h3 className="text-xl font-semibold text-foreground mb-4" data-testid={`title-feature-${index}`}>
                    {feature.title}
                  </h3>
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
  );
}
import { Card, CardContent } from "@/components/ui/card";
import { Search, Settings, Leaf } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Assessment",
    description: "Our certified arborists will assess the tree's condition, considering factors like health, stability, and proximity to structures.",
  },
  {
    icon: Settings,
    title: "Customized Solutions",
    description: "Based on the assessment, we develop a customized plan for safe and efficient tree removal.",
  },
  {
    icon: Leaf,
    title: "Environmentally Conscious",
    description: "We are committed to environmental stewardship. Whenever possible, we recycle and repurpose removed trees.",
  },
];

export default function OurProcess() {
  return (
    <section id="process" className="py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Our Process
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A systematic approach to safe and effective tree removal
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={index} className="relative hover-elevate" data-testid={`card-process-${index}`}>
                <CardContent className="pt-8 pb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Icon className="h-6 w-6 text-primary" data-testid={`icon-process-${index}`} />
                        <h3 className="text-xl font-semibold text-foreground" data-testid={`title-process-${index}`}>
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-muted-foreground leading-relaxed" data-testid={`description-process-${index}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
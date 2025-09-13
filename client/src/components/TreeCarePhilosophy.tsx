import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Scissors, Heart, CheckCircle } from "lucide-react";

const reasons = [
  {
    icon: AlertTriangle,
    title: "Safety Hazards",
    description: "When trees pose immediate danger to people, property, or power lines due to disease, damage, or structural weakness.",
  },
  {
    icon: AlertTriangle,
    title: "Irreversible Disease",
    description: "Trees affected by severe disease that cannot be treated and may spread to healthy trees nearby.",
  },
  {
    icon: AlertTriangle,
    title: "Structural Damage",
    description: "Trees causing foundation damage, blocking essential infrastructure, or creating access issues that cannot be resolved through pruning.",
  },
];

export default function TreeCarePhilosophy() {
  return (
    <section className="py-16 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        {/* Main Philosophy */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Heart className="h-10 w-10 text-green-600 dark:text-green-400" data-testid="icon-philosophy-heart" />
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Our Tree Care Philosophy
          </h2>
          <div className="max-w-4xl mx-auto space-y-4 text-lg text-muted-foreground">
            <p>
              At Treemarkables, we believe every tree has value. Our first priority is always 
              <span className="font-semibold text-foreground"> tree preservation through expert pruning and care</span>.
            </p>
            <p>
              We only recommend tree removal when it's absolutely necessary for safety or when 
              there's no viable alternative to protect people and property.
            </p>
          </div>
        </div>

        {/* Preference for Pruning */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 mb-12">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                <Scissors className="h-6 w-6 text-green-600 dark:text-green-400" data-testid="icon-pruning" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Tree Pruning: Our Preferred Solution
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Professional pruning can solve most tree problems while preserving the tree's health and beauty. 
                We can address safety concerns, improve tree structure, remove diseased branches, and enhance 
                your property's appearance without removing the entire tree.
              </p>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-foreground">
                  Free assessment to explore pruning alternatives before considering removal
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* When Removal is Necessary */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground text-center mb-8">
            When Tree Removal Becomes Necessary
          </h3>
          <p className="text-center text-muted-foreground mb-8 max-w-3xl mx-auto">
            While we prefer to save trees whenever possible, there are situations where removal 
            is the only safe and responsible option:
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {reasons.map((reason, index) => {
              const Icon = reason.icon;
              return (
                <Card key={index} className="hover-elevate" data-testid={`card-removal-reason-${index}`}>
                  <CardContent className="pt-6 pb-6">
                    <div className="flex justify-center mb-4">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                        <Icon className="h-6 w-6 text-orange-600 dark:text-orange-400" data-testid={`icon-reason-${index}`} />
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-3 text-center" data-testid={`title-reason-${index}`}>
                      {reason.title}
                    </h4>
                    <p className="text-muted-foreground text-sm leading-relaxed text-center" data-testid={`description-reason-${index}`}>
                      {reason.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-muted/30 rounded-lg p-8">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Not Sure if Your Tree Needs to Be Removed?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Get a free consultation from our qualified arborists. We'll assess your tree's health 
            and explore all possible solutions before recommending removal.
          </p>
          <a 
            href="#contact" 
            className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-md hover-elevate active-elevate-2 font-medium"
            data-testid="button-consultation"
          >
            Get Free Tree Assessment
          </a>
        </div>
      </div>
    </section>
  );
}
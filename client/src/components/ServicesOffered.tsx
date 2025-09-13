import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Zap, Scissors, TreePine, Drill, Truck } from "lucide-react";

const services = [
  {
    icon: AlertTriangle,
    title: "Hazardous Tree Removal",
    description: "Identifying and removing trees that pose a danger to your property and its surroundings.",
  },
  {
    icon: Zap,
    title: "Emergency Tree Removal", 
    description: "We understand that tree emergencies can happen at any time. Our team is available 24/7 for prompt response and resolution.",
  },
  {
    icon: Scissors,
    title: "Tree Pruning",
    description: "Professional pruning services to maintain tree health, improve structure, and enhance the beauty of your landscape.",
  },
  {
    icon: TreePine,
    title: "Hedge Trimming",
    description: "Expert hedge trimming and shaping to keep your hedges looking neat, healthy, and perfectly maintained.",
  },
  {
    icon: Drill,
    title: "Stump Grinding",
    description: "Complete stump removal using professional grinding equipment to eliminate trip hazards and reclaim your space.",
  },
  {
    icon: Truck,
    title: "Mulch Deliveries",
    description: "Fresh, quality mulch delivered directly to your property to enhance your garden beds and landscaping projects.",
  },
];

export default function ServicesOffered() {
  const handleServiceClick = (serviceName: string) => {
    console.log(`${serviceName} service clicked`);
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="services" className="py-16 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How can we help you?
          </h2>
        </div>

        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Card 
                key={index} 
                className="hover-elevate cursor-pointer transition-all duration-200"
                onClick={() => handleServiceClick(service.title)}
                data-testid={`card-service-${index}`}
              >
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                      <Icon className="h-7 w-7 text-primary" data-testid={`icon-service-${index}`} />
                    </div>
                  </div>
                  <CardTitle className="text-xl" data-testid={`title-service-${index}`}>
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center leading-relaxed" data-testid={`description-service-${index}`}>
                    {service.description}
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
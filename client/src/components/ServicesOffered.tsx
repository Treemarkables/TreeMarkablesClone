import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

const services = [
  {
    title: "Hazardous Tree Removal",
    description: "Identifying and removing trees that pose a danger to your property and its surroundings.",
    image: "/hazardous-tree-removal.jpg",
    route: "/tree-removal",
    altText: "Arborist safely removing hazardous tree near house",
  },
  {
    title: "Emergency Tree Removal", 
    description: "We understand that tree emergencies can happen at any time. Our team is available 24/7 for prompt response and resolution.",
    image: "/emergency-tree-removal.jpg",
    route: "/tree-removal",
    altText: "Emergency tree removal after storm damage",
  },
  {
    title: "Tree Pruning",
    description: "Professional pruning services to maintain tree health, improve structure, and enhance the beauty of your landscape.",
    image: "/tree-pruning.jpg",
    route: "/tree-pruning",
    altText: "Professional pruning large tree branches",
  },
  {
    title: "Hedge Trimming",
    description: "Expert hedge trimming and shaping to keep your hedges looking neat, healthy, and perfectly maintained.",
    image: "/hedge-trimming.jpg",
    route: "/hedge-trimming",
    altText: "Neatly trimmed hedge border in residential garden",
  },
  {
    title: "Stump Grinding",
    description: "Complete stump removal using professional grinding equipment to eliminate trip hazards and reclaim your space.",
    image: "/stump-grinding.jpg",
    route: "/stump-grinding",
    altText: "Stump grinder removing tree stump from yard",
  },
  {
    title: "Mulch Deliveries",
    description: "Fresh, quality mulch delivered directly to your property to enhance your garden beds and landscaping projects.",
    image: "/team-photo-real.jpg",
    route: "#contact",
    altText: "Fresh mulch delivery for garden landscaping",
  },
];

export default function ServicesOffered() {
  return (
    <section id="services" className="py-16 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How can we help you?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
          {services.map((service, index) => {
            const ServiceCardWrapper = service.route.startsWith('#') 
              ? 'a' 
              : Link;
            
            const cardProps = service.route.startsWith('#')
              ? { 
                  href: service.route,
                  onClick: (e: React.MouseEvent) => {
                    e.preventDefault();
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              : { href: service.route };

            return (
              <ServiceCardWrapper 
                key={index}
                {...cardProps}
                className="block h-full no-underline"
                data-testid={`link-service-${index}`}
              >
                <Card className="hover-elevate h-full transition-all duration-200 overflow-hidden" data-testid={`card-service-${index}`}>
                  <div className="relative h-40 sm:h-44 md:h-48 overflow-hidden">
                    <img 
                      src={service.image} 
                      alt={service.altText}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      data-testid={`image-service-${index}`}
                    />
                    <div className="absolute inset-0 bg-black/20"></div>
                  </div>
                  <CardHeader className="text-center pb-4">
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
              </ServiceCardWrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}
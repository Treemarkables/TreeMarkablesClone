import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  {
    title: "Hazardous Tree Removal",
    description: "Identifying and removing trees that pose a danger to your property and its surroundings.",
    image: "/tree-removal-real.png",
  },
  {
    title: "Emergency Tree Removal", 
    description: "We understand that tree emergencies can happen at any time. Our team is available 24/7 for prompt response and resolution.",
    image: "/emergency-tree-removal.jpg",
  },
  {
    title: "Tree Pruning",
    description: "Professional pruning services to maintain tree health, improve structure, and enhance the beauty of your landscape.",
    image: "/team-photo-real.jpg",
  },
  {
    title: "Hedge Trimming",
    description: "Expert hedge trimming and shaping to keep your hedges looking neat, healthy, and perfectly maintained.",
    image: "/team-photo-real.jpg",
  },
  {
    title: "Stump Grinding",
    description: "Complete stump removal using professional grinding equipment to eliminate trip hazards and reclaim your space.",
    image: "/tree-removal-real.png",
  },
  {
    title: "Mulch Deliveries",
    description: "Fresh, quality mulch delivered directly to your property to enhance your garden beds and landscaping projects.",
    image: "/team-photo-real.jpg",
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
            return (
              <Card 
                key={index} 
                className="hover-elevate cursor-pointer transition-all duration-200 overflow-hidden"
                onClick={() => handleServiceClick(service.title)}
                data-testid={`card-service-${index}`}
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover"
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
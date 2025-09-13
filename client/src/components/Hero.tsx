import { Button } from "@/components/ui/button";
import { Shield, Award, Clock } from "lucide-react";

export default function Hero() {
  const handleGetQuote = () => {
    console.log('Get quote clicked from hero');
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLearnMore = () => {
    console.log('Learn more clicked');
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/team-photo.jpg" 
          alt="Treemarkables professional team" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            We're just a bunch of Gizzy guys and we climb trees
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
            Are you facing the challenge of dealing with a hazardous tree on your property? 
            Our qualified arborists specialize in safe and efficient tree removal services.
          </p>

          {/* Key Features */}
          <div className="flex flex-wrap gap-6 mb-8">
            <div className="flex items-center text-white/90">
              <Shield className="h-5 w-5 mr-2 text-primary" />
              <span className="text-sm font-medium">Insured</span>
            </div>
            <div className="flex items-center text-white/90">
              <Award className="h-5 w-5 mr-2 text-primary" />
              <span className="text-sm font-medium">Qualified Arborists</span>
            </div>
            <div className="flex items-center text-white/90">
              <Clock className="h-5 w-5 mr-2 text-primary" />
              <span className="text-sm font-medium">24/7 Emergency Service</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={handleGetQuote}
              data-testid="button-hero-get-quote"
            >
              Get Free Quote
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
              onClick={handleLearnMore}
              data-testid="button-hero-learn-more"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
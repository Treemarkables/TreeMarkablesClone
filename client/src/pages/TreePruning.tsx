import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield, Award, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TreePruning() {
  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-orange-500/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6" data-testid="text-hero-title">
              Professional Tree Pruning Services
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-hero-description">
              Expert tree pruning to maintain tree health, improve safety, and enhance 
              the beauty of your landscape with proper techniques.
            </p>
            <Button size="lg" onClick={handleGetQuote} data-testid="button-get-quote">
              Get Free Quote
            </Button>
          </div>
        </div>
      </section>

      {/* Service Details */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6" data-testid="text-service-title">
                Expert Tree Pruning Techniques
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Health & Growth</h3>
                    <p className="text-muted-foreground">Promote healthy growth and remove diseased branches</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Safety Pruning</h3>
                    <p className="text-muted-foreground">Remove hazardous branches near structures and walkways</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Aesthetic Shaping</h3>
                    <p className="text-muted-foreground">Enhance tree structure and landscape appeal</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold text-foreground mb-4">Pruning Types</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
                  <span className="text-foreground">Crown thinning and reduction</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
                  <span className="text-foreground">Deadwood removal</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
                  <span className="text-foreground">Structural pruning</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Shield className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Insured</h3>
              <p className="text-muted-foreground">Fully qualified with comprehensive coverage</p>
            </div>
            <div className="flex flex-col items-center">
              <Award className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Qualified Arborists</h3>
              <p className="text-muted-foreground">Professional expertise you can trust</p>
            </div>
            <div className="flex flex-col items-center">
              <Clock className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Seasonal Care</h3>
              <p className="text-muted-foreground">Proper timing for optimal tree health</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
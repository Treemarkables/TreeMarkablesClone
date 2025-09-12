import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield, Award, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HedgeTrimming() {
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
              Professional Hedge Trimming Services
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-hero-description">
              Expert hedge trimming and shaping services to maintain beautiful, 
              healthy hedges that enhance your property's curb appeal.
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
                Professional Hedge Care
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Shape & Form</h3>
                    <p className="text-muted-foreground">Precise trimming to maintain desired hedge shape</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Health Maintenance</h3>
                    <p className="text-muted-foreground">Regular trimming promotes healthy, dense growth</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Property Enhancement</h3>
                    <p className="text-muted-foreground">Well-maintained hedges increase property value</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold text-foreground mb-4">Service Includes</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
                  <span className="text-foreground">Professional trimming and shaping</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
                  <span className="text-foreground">Height and width reduction</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
                  <span className="text-foreground">Complete debris cleanup</span>
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
              <h3 className="text-xl font-semibold text-foreground mb-2">Licensed & Insured</h3>
              <p className="text-muted-foreground">Fully certified with comprehensive coverage</p>
            </div>
            <div className="flex flex-col items-center">
              <Award className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Expert Techniques</h3>
              <p className="text-muted-foreground">Proper timing and methods for healthy hedges</p>
            </div>
            <div className="flex flex-col items-center">
              <Clock className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Regular Maintenance</h3>
              <p className="text-muted-foreground">Scheduled trimming programs available</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
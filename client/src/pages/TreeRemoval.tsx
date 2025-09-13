import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield, Award, Clock, CheckCircle, Phone, Star, AlertTriangle, Scissors, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroBackground from "@assets/a2164f85-6e01-4409-8aa7-f52571a20b77_1757790837429.png";

export default function TreeRemoval() {
  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    window.location.href = 'tel:0272166882';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Emergency Alert Banner */}
      <div className="bg-red-600 text-white py-3 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <p className="font-semibold">
            ⚠️ High winds expected this week — Book your free safety assessment today!
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <section 
        className="relative py-24 bg-gradient-to-br from-primary/10 to-orange-500/10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8" data-testid="text-hero-title">
              Tree Removal Services
              <span className="text-primary block text-3xl md:text-4xl font-normal">Gisborne & Surrounding Areas</span>
            </h1>

            {/* Simple credentials */}
            <div className="flex flex-wrap justify-center items-center gap-6 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Fully Insured
              </span>
              <span className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Qualified Arborists
              </span>
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Emergency Available
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tree Care Philosophy */}
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
              <Card className="hover-elevate" data-testid="card-removal-reason-0">
                <CardContent className="pt-6 pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" data-testid="icon-reason-0" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-3 text-center" data-testid="title-reason-0">
                    Safety Hazards
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed text-center" data-testid="description-reason-0">
                    When trees pose immediate danger to people, property, or power lines due to disease, damage, or structural weakness.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-removal-reason-1">
                <CardContent className="pt-6 pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" data-testid="icon-reason-1" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-3 text-center" data-testid="title-reason-1">
                    Irreversible Disease
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed text-center" data-testid="description-reason-1">
                    Trees affected by severe disease that cannot be treated and may spread to healthy trees nearby.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-removal-reason-2">
                <CardContent className="pt-6 pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" data-testid="icon-reason-2" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-3 text-center" data-testid="title-reason-2">
                    Structural Damage
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed text-center" data-testid="description-reason-2">
                    Trees causing foundation damage, blocking essential infrastructure, or creating access issues that cannot be resolved through pruning.
                  </p>
                </CardContent>
              </Card>
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
            <Button 
              onClick={handleGetQuote}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-consultation"
            >
              Get Free Tree Assessment
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
                Why Gisborne Homeowners Choose Treemarkables
              </h2>
              <div className="space-y-5">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Same-Day Emergency Response</h3>
                    <p className="text-muted-foreground">Available 24/7 for storm damage and hazardous tree emergencies across Gisborne</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Fully Insured & WorkSafe Compliant</h3>
                    <p className="text-muted-foreground">Qualified NZ Arborists with comprehensive public liability insurance and safety certifications</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Powerline & Confined Access Specialists</h3>
                    <p className="text-muted-foreground">Expert handling of complex removals near power lines, buildings, and tight spaces</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">No-Mess Cleanup Guarantee</h3>
                    <p className="text-muted-foreground">Complete debris removal, stump grinding, and site restoration - your property left spotless</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Council Consent Assistance</h3>
                    <p className="text-muted-foreground">We handle all permits and council requirements for protected trees in Gisborne</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Locally Owned & Operated</h3>
                    <p className="text-muted-foreground">Your trusted Gisborne tree care specialists since 2020</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold text-foreground mb-6">Our 3-Step Guarantee Process</h3>
              <div className="space-y-5">
                <div className="flex items-start space-x-4">
                  <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">1</div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">FREE Safety Assessment</h4>
                    <p className="text-muted-foreground text-sm">Same-day site visit, risk evaluation, and transparent fixed quote with no hidden fees</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">2</div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Safe Professional Removal</h4>
                    <p className="text-muted-foreground text-sm">Certified arborists using advanced rigging techniques and professional equipment</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">3</div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Complete Site Restoration</h4>
                    <p className="text-muted-foreground text-sm">Total debris removal, stump grinding, and site cleanup - guaranteed spotless</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-center text-primary">
                  ⚡ Emergency Jobs Started Within 2 Hours • Same-Day Assessments Available
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              What Gisborne Homeowners Say About Us
            </h2>
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 text-yellow-500 fill-current" />
                ))}
              </div>
              <span className="text-xl font-bold text-foreground">4.9/5</span>
              <span className="text-muted-foreground">(120+ Google Reviews)</span>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 italic">
                "Excellent service! They removed a massive pine tree that was threatening our house. 
                Professional, quick, and left no mess behind."
              </p>
              <p className="font-semibold text-foreground">— Sarah M., Kaiti</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 italic">
                "Called them for an emergency after the storm. They came out the same day and 
                handled everything perfectly. Highly recommend!"
              </p>
              <p className="font-semibold text-foreground">— Mike T., Elgin</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 italic">
                "Great team! They trimmed our pohutukawa near the power lines safely. 
                Fair pricing and excellent cleanup."
              </p>
              <p className="font-semibold text-foreground">— Jenny L., Mangapapa</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Shield className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Fully Insured</h3>
              <p className="text-muted-foreground">$2M public liability coverage</p>
            </div>
            <div className="flex flex-col items-center">
              <Award className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">NZ Qualified Arborists</h3>
              <p className="text-muted-foreground">WorkSafe certified professionals</p>
            </div>
            <div className="flex flex-col items-center">
              <Clock className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">24/7 Emergency</h3>
              <p className="text-muted-foreground">Same-day response guaranteed</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-8">
            <div className="border-l-4 border-primary pl-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Do I need council consent to remove my tree?
              </h3>
              <p className="text-muted-foreground">
                For protected trees in Gisborne, yes. We handle all council applications and permits for you at no extra charge. 
                Our team knows the local regulations and will ensure full compliance.
              </p>
            </div>
            
            <div className="border-l-4 border-primary pl-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Are you insured for tree work near power lines?
              </h3>
              <p className="text-muted-foreground">
                Yes! We're fully certified for powerline work with $2M public liability insurance. 
                Our arborists are trained specialists in electrical hazard management and complex access situations.
              </p>
            </div>
            
            <div className="border-l-4 border-primary pl-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">
                How soon can you remove my dangerous tree?
              </h3>
              <p className="text-muted-foreground">
                Emergency hazardous tree removal within 2 hours. Non-urgent removals typically within 2-5 days. 
                We prioritize safety threats and offer same-day assessments across Gisborne.
              </p>
            </div>
            
            <div className="border-l-4 border-primary pl-6">
              <h3 className="text-xl font-semibold text-foreground mb-3">
                What's included in your tree removal cost?
              </h3>
              <p className="text-muted-foreground">
                Everything! Our fixed quotes include: tree felling, branch removal, stump grinding, complete site cleanup, 
                and debris disposal. No hidden fees, no surprises.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
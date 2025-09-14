import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Phone, Star, AlertTriangle, Scissors, Heart, TreePine, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import heroVideo from "@assets/copy_77E88CDC-C666-4B3C-B02C-5CE23818F128_1757799940776.mp4";

export default function TreeRemoval() {
  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    window.location.href = 'tel:0272166882';
  };

  // Local business structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://www.treemarkables.co.nz/#business",
    "name": "Treemarkables",
    "description": "Professional tree removal services in Gisborne, New Zealand. Certified arborists specializing in hazardous tree removal, emergency services, and precision cutting.",
    "url": "https://www.treemarkables.co.nz",
    "telephone": "+64272166882",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Gisborne",
      "addressRegion": "Gisborne Region",
      "addressCountry": "NZ"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -38.6623,
      "longitude": 178.0176
    },
    "areaServed": [
      "Gisborne",
      "Kaiti",
      "Te Hapara", 
      "Mangapapa",
      "Wainui Beach",
      "Makaraka",
      "Elgin"
    ],
    "serviceType": "Tree Removal Service",
    "priceRange": "$$",
    "openingHours": "Mo-Su 07:00-18:00"
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Tree Removal Gisborne – Safe & Efficient Service"
        description="Need a dangerous or unwanted tree removed? Our certified arborists provide safe tree removal for homes and farms in Gisborne and Wairoa. Contact us for competitive prices."
        keywords="tree removal Gisborne, safe tree removal, certified arborists Gisborne, dangerous tree removal, unwanted tree removal, Wairoa tree removal, competitive tree removal prices"
        ogTitle="Tree Removal Gisborne – Safe & Efficient Service"
        ogDescription="Need a dangerous or unwanted tree removed? Our certified arborists provide safe tree removal for homes and farms in Gisborne and Wairoa. Contact us for competitive prices."
        ogImage="https://www.treemarkables.co.nz/hazardous-tree-removal.jpg"
        canonicalUrl="https://www.treemarkables.co.nz/tree-removal"
        structuredData={structuredData}
      />
      <Header />
      {/* Hero Section */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Video Background */}
        <video 
          autoPlay 
          muted 
          loop 
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-80">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6" data-testid="text-hero-title">
              Gisborne's tree removal experts
            </h1>
          </div>
        </div>
      </section>

      {/* Emergency Alert Banner */}
      <div className="bg-red-600 text-white py-3 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <p className="font-semibold">
            ⚠️ High winds expected this week — Book your free safety assessment today!
          </p>
        </div>
      </div>

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
                  Professional <a href="/tree-pruning" className="text-primary hover:text-primary/80 underline">tree pruning</a> can solve most tree problems while preserving the tree's health and beauty. 
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
                    <h3 className="font-semibold text-foreground">No-Mess Cleanup Guarantee</h3>
                    <p className="text-muted-foreground">Complete debris removal, stump grinding, and site restoration - your property left spotless</p>
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

      {/* Service Areas Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Tree Removal Service Areas
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              We provide professional tree removal services throughout Gisborne and the wider East Coast region.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Gisborne Central</h4>
              <p className="text-sm text-muted-foreground">City center and surrounding suburbs</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Kaiti</h4>
              <p className="text-sm text-muted-foreground">Residential and coastal properties</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Te Hapara</h4>
              <p className="text-sm text-muted-foreground">Suburban homes and farms</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Mangapapa</h4>
              <p className="text-sm text-muted-foreground">Rural and lifestyle blocks</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wainui Beach</h4>
              <p className="text-sm text-muted-foreground">Coastal properties and beach homes</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Makaraka</h4>
              <p className="text-sm text-muted-foreground">Semi-rural properties</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Elgin</h4>
              <p className="text-sm text-muted-foreground">Rural farms and estates</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wairoa</h4>
              <p className="text-sm text-muted-foreground">Extended service area</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Services Section */}
      <section className="py-16 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Complete Tree Care Services
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              After tree removal, you might need our other specialized services to complete your project.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Scissors className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/stump-grinding" className="hover:text-primary transition-colors">
                    Stump Grinding
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Complete the job with professional stump removal, leaving your property clean and ready for landscaping.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/stump-grinding">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <TreePine className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/tree-pruning" className="hover:text-primary transition-colors">
                    Tree Pruning
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Keep your remaining trees healthy and safe with our expert pruning and maintenance services.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tree-pruning">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/hedge-trimming" className="hover:text-primary transition-colors">
                    Hedge Trimming
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Maintain your property's boundaries and aesthetics with professional hedge care and shaping.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/hedge-trimming">Learn More</Link>
                </Button>
              </CardContent>
            </Card>
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
                How soon can you remove my dangerous tree?
              </h3>
              <p className="text-muted-foreground">
                Emergency hazardous tree removal within 2 hours. Non-urgent removals typically within 2-5 days. 
                We prioritize safety threats and offer same-day assessments across Gisborne.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
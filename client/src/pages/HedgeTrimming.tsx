import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Star, Scissors, TreePine, Users, MapPin, Phone, AlertTriangle, Heart, Leaf, Calendar, Target, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import heroBackground from "@assets/tree_pruning_hero.jpg";

const reviews = [
  {
    id: "1",
    name: "Carol Anderson",
    location: "Mangapapa, Gisborne",
    rating: 5,
    comment: "Fantastic hedge trimming service! Our boundary hedge was getting out of control and they shaped it perfectly. The crew was professional, efficient, and cleaned up thoroughly. Very pleased with the results.",
    service: "Hedge Trimming"
  },
  {
    id: "2",
    name: "Brian Foster",
    location: "Elgin, Gisborne",
    rating: 5,
    comment: "Professional service from start to finish. They trimmed our large privet hedge beautifully - it's never looked better. Fair pricing and excellent workmanship. Highly recommend Treemarkables.",
    service: "Hedge Shaping"
  },
  {
    id: "3",
    name: "Susan Clarke",
    location: "Te Hapara, Gisborne",
    rating: 5,
    comment: "Outstanding attention to detail. Our ornamental hedges required careful shaping and they did a perfect job. The team was courteous and left our property immaculate.",
    service: "Ornamental Hedge Care"
  },
  {
    id: "4",
    name: "Mark Robinson",
    location: "Kaiti Heights, Gisborne",
    rating: 5,
    comment: "Reliable and professional hedge maintenance service. They've been trimming our hedges regularly for over a year now. Always on time, consistent quality, and competitive pricing.",
    service: "Regular Hedge Maintenance"
  }
];

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating ? 'fill-primary text-primary' : 'text-muted-foreground'
          }`}
        />
      ))}
    </div>
  );
};

export default function HedgeTrimming() {
  // Add Google tag event script for form submission tracking
  useEffect(() => {
    const script = document.createElement('script');
    script.innerHTML = `
      gtag('event', 'Formsubmission', {
        // <event_parameters>
      });
    `;
    document.head.appendChild(script);
    
    return () => {
      // Cleanup on unmount
      const scripts = document.head.querySelectorAll('script');
      scripts.forEach(s => {
        if (s.innerHTML.includes('Formsubmission')) {
          document.head.removeChild(s);
        }
      });
    };
  }, []);

  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    if ((window as any).gtag_report_conversion) {
      (window as any).gtag_report_conversion('tel:0272166882');
    }
    setTimeout(() => {
      window.location.href = 'tel:0272166882';
    }, 100);
  };

  // Local business structured data for Hedge Trimming SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://www.treemarkables.co.nz/hedge-trimming#business",
    "name": "Treemarkables Hedge Trimming Services",
    "description": "Professional hedge trimming and maintenance services in Gisborne, New Zealand. Expert shaping, pruning, and regular maintenance for residential and commercial hedges.",
    "url": "https://www.treemarkables.co.nz/hedge-trimming",
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
    "serviceType": "Hedge Trimming Service",
    "priceRange": "$$",
    "openingHours": "Mo-Su 07:00-18:00"
  };

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 lg:pt-24">
      <SEO 
        title="Hedge Trimming Gisborne – Keep Your Hedges Healthy, Dense & Beautiful"
        description="Keep your hedges neat year‑round. We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Request a quote."
        keywords="hedge trimming Gisborne, neat hedges, year-round hedge care, coastal hedge trimming, hedge shaping, hedge maintenance, surrounding areas hedge care"
        ogTitle="Hedge Trimming Gisborne – Neat & Healthy Hedges"
        ogDescription="Keep your hedges neat year‑round. We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Request a quote."
        ogImage="https://www.treemarkables.co.nz/hedge-trimming.jpg"
        canonicalUrl="https://www.treemarkables.co.nz/hedge-trimming"
        structuredData={structuredData}
      />
      <Header />
      {/* Hero Section */}
      <section 
        className="relative min-h-screen bg-gradient-to-br from-primary/10 to-green-600/10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              Hedge Trimming Gisborne
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Well-maintained hedges provide privacy, windbreaks and structure to your landscape, 
              but Gisborne's coastal winds and fast-growing plants mean they can quickly become unruly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleGetQuote} className="text-lg px-6" data-testid="button-get-quote">
                Talk to us today
              </Button>
              <Button size="lg" variant="outline" onClick={handleCallNow} className="text-lg px-6" data-testid="button-call-now">
                <Phone className="w-4 h-4 mr-2" />
                027-216-6882
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hedge Care Philosophy */}
      <section className="py-12 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Scissors className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Professional Hedge Care
            </h2>
            <div className="max-w-4xl mx-auto space-y-4 text-lg text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Regular hedge trimming isn't just about aesthetics—it encourages healthy growth, prevents disease and helps define spaces</span> within your garden. Our team at Treemarkables specialises in shaping hedges for residential and rural properties across Gisborne, Wairoa and the East Coast.
              </p>
              <p>
                From formal hedges that need precise shaping to natural windbreaks on coastal properties, 
                we understand how <Link href="/tree-pruning" className="text-primary hover:text-primary/80 underline">expert pruning techniques</Link> create healthier, more resilient hedges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* When to Trim Hedges */}
      <section className="py-12 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Why Regular Hedge Trimming Matters
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Professional hedge trimming provides multiple benefits for your property's 
              privacy, protection, and aesthetic appeal in Gisborne's coastal environment.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <TreePine className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Dense, Healthy Growth
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Trimming stimulates new shoots and results in thicker, more robust foliage. 
                  Especially important for privacy hedges or windbreaks on exposed coastal properties.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Prevent Disease & Pests
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Removing dead or diseased branches reduces infection risks and makes hedges less attractive to pests. 
                  Healthy hedges resist Gisborne's humid summers and coastal salt spray.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Enhanced Aesthetic Appeal
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Well-defined, neatly trimmed hedges elevate your garden's appearance and boost curb appeal. 
                  Makes your property more inviting and can increase its value.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Create Defined Spaces
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Professionally trimmed hedges act as natural barriers, guiding garden flow and separating zones. 
                  Ideal for large rural properties or formal landscapes.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                    <Heart className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Better Air & Light Flow
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Trimming allows light and air to reach surrounding plants, promoting overall garden health. 
                  Prevents overgrown hedges from blocking circulation.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Reduced Long-term Maintenance
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Consistent trimming keeps hedges manageable and avoids the need for drastic cutting later. 
                  Regular care prevents costly restoration work.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Our Approach to Hedge Trimming */}
      <section className="py-12 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Our Approach to Hedge Trimming
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              We follow a systematic, species-specific approach to ensure your hedges 
              receive the right care at the right time for optimal health and appearance.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Tailored Pruning Schedule
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  We assess the species and growth rate of your hedges to determine trimming frequency. 
                  Fast-growing pittosporums and griselinia may need trimming twice a year, while slower-growing evergreens need less frequent attention.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Target className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Privacy & Wind Protection
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Coastal properties benefit from dense hedges to buffer strong winds. 
                  We trim to maintain thickness and height while ensuring a natural look that provides maximum protection.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Wrench className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Complete Cleanup Service
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Our team leaves your property tidy. We remove all clippings and can mulch them for use in your garden if desired. 
                  No mess, no fuss – just beautifully maintained hedges.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* When to Trim */}
      <section className="py-12 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              When to Trim Your Hedges
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Proper timing is crucial for hedge health and ensures the best results from your trimming investment.
            </p>
          </div>
          
          <div className="bg-background rounded-lg p-8 shadow-sm">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Optimal Timing Schedule</h4>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Most hedges can be trimmed in late spring and again in early autumn to maintain shape without stressing the plant. 
                    This timing works perfectly with Gisborne's growing seasons and weather patterns.
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-foreground">Spring Trim:</span>
                        <p className="text-muted-foreground">September-November - Encourages dense new growth</p>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Autumn Trim:</span>
                        <p className="text-muted-foreground">March-May - Maintains shape before winter</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Heart className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Flowering Hedges - Special Care</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Flowering hedges should be trimmed after they bloom to avoid cutting off buds. 
                    This preserves next season's flowers while maintaining hedge health and structure.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Ready for Professional Hedge Care?
            </h3>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Whether your hedge needs a light tidy-up or a major reshape, Treemarkables has the tools and expertise 
              to keep it looking its best. Contact us today for a free quote on hedge trimming in Gisborne and surrounding regions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleGetQuote} className="text-lg px-6" data-testid="button-quote-hedge-care">
                Get Free Quote
              </Button>
              <Button size="lg" variant="outline" onClick={handleCallNow} className="text-lg px-6" data-testid="button-call-hedge-care">
                <Phone className="w-4 w-4 mr-2" />
                Call Today
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hedge Trimming Types */}
      <section className="py-12 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Types of Hedge Trimming We Provide
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Different hedge types require different approaches. Our experienced team 
              knows the right technique for every species and style.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                    <Scissors className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Formal Hedge Trimming
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Precise shaping for box hedges, privet, and other formal hedge varieties. 
                    Maintaining clean lines and perfect geometry.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-foreground">
                      Best time: Spring and autumn
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                    <TreePine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Informal Hedge Pruning
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Natural shaping for flowering hedges, native plants, and mixed hedge plantings. 
                    Preserving natural form while maintaining size.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-foreground">
                      Timing varies by species
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Hedge Restoration
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Reviving neglected hedges through careful reduction and reshaping. 
                    Gradually restoring density and form over multiple seasons.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium text-foreground">
                      Multi-season process
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Regular Maintenance
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Scheduled trimming programs to keep hedges in perfect condition year-round. 
                    Prevent overgrowth and maintain property value.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-foreground">
                      Flexible scheduling available
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="py-12 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-8">
            A warm welcome from the team
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            We love working with hedges and understand how important they are to your property's 
            appearance and privacy. Whether it's a quick tidy-up or major reshaping, 
            we approach every hedge with care and attention to detail.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our team knows Gisborne's growing conditions and can advise on the best timing 
            and techniques for your specific hedge varieties.
          </p>
        </div>
      </section>

      {/* Simple Credentials */}
      <section className="py-12 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Fully Insured</h3>
              <p className="text-muted-foreground">Complete coverage for your peace of mind</p>
            </div>
            <div>
              <Scissors className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Professional Tools</h3>
              <p className="text-muted-foreground">Sharp, clean tools for healthy cuts</p>
            </div>
            <div>
              <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Regular Programs</h3>
              <p className="text-muted-foreground">Scheduled maintenance available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Testimonials
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {reviews.slice(0, 4).map((review) => (
              <div key={review.id} className="bg-white p-6 rounded-lg shadow-sm" data-testid={`review-card-${review.id}`}>
                <p className="text-muted-foreground mb-4 italic leading-relaxed" data-testid={`review-comment-${review.id}`}>
                  {review.comment}
                </p>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid={`review-name-${review.id}`}>
                      {review.name}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid={`review-location-${review.id}`}>
                      {review.location}
                    </p>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button size="lg" onClick={handleGetQuote}>
              Talk to us today
            </Button>
          </div>
        </div>
      </section>

      {/* Service Areas Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Hedge Trimming Service Areas
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Professional hedge trimming for homes and coastal properties throughout Gisborne and surrounding areas.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Gisborne Central</h4>
              <p className="text-sm text-muted-foreground">Urban hedge maintenance</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Kaiti</h4>
              <p className="text-sm text-muted-foreground">Coastal hedge care</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Te Hapara</h4>
              <p className="text-sm text-muted-foreground">Residential hedge trimming</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Mangapapa</h4>
              <p className="text-sm text-muted-foreground">Rural property hedges</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wainui Beach</h4>
              <p className="text-sm text-muted-foreground">Coastal property hedges</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Makaraka</h4>
              <p className="text-sm text-muted-foreground">Semi-rural hedge care</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Elgin</h4>
              <p className="text-sm text-muted-foreground">Farm boundary hedges</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">East Coast</h4>
              <p className="text-sm text-muted-foreground">Extended coastal regions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Services Section */}
      <section className="py-16 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Complete Property Care Services
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Hedge trimming works perfectly with our other professional tree and landscape services.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
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
                  Complete your garden maintenance with professional tree pruning and health care services.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tree-pruning">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/tree-removal" className="hover:text-primary transition-colors">
                    Tree Removal
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  When hedges or trees become overgrown beyond trimming, professional removal may be required.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tree-removal">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

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
                  Remove old hedge stumps and roots for a clean finish when replanting or redesigning gardens.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/stump-grinding">Learn More</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}
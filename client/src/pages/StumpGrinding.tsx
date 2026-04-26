import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Star, Scissors, TreePine, Users, MapPin, Phone, AlertTriangle, Heart, Leaf, Settings, Search, Wrench, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
const heroBackground = "/stump-grinding-hero.jpg";

const reviews = [
  {
    id: "1",
    name: "James Mitchell",
    location: "Makaraka, Gisborne",
    rating: 5,
    comment: "Outstanding stump grinding service! They removed three large stumps from our property quickly and efficiently. The cleanup was thorough and the price was very reasonable. Highly recommend Treemarkables for any stump removal needs.",
    service: "Stump Grinding"
  },
  {
    id: "2",
    name: "Linda Thompson",
    location: "Te Hapara, Gisborne",
    rating: 5,
    comment: "Professional and reliable service. The team arrived on time, worked efficiently, and left our yard clean. We can finally use that corner of our garden for planting. Great job!",
    service: "Stump Removal"
  },
  {
    id: "3",
    name: "Peter Wilson",
    location: "Kaiti, Gisborne",
    rating: 5,
    comment: "Excellent workmanship and fair pricing. They ground down a massive pohutukawa stump that other companies said was too difficult. The Treemarkables team made it look easy.",
    service: "Large Stump Grinding"
  },
  {
    id: "4",
    name: "Michelle Brown",
    location: "Wainui, Gisborne",
    rating: 5,
    comment: "Very happy with the stump grinding service. Quick quote, professional work, and complete cleanup. Would definitely use Treemarkables again for any tree or stump work.",
    service: "Stump Grinding"
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

export default function StumpGrinding() {
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
    if ((window as any).gtag) {
      (window as any).gtag('event', 'phone_call_click', { event_category: 'Contact', event_label: 'Phone Number Click' });
    }
    if ((window as any).gtag_report_conversion) {
      (window as any).gtag_report_conversion('tel:0272166882');
    }
    setTimeout(() => {
      window.location.href = 'tel:0272166882';
    }, 100);
  };

  // Local business structured data for Stump Grinding SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://app.treemarkables.co.nz/stump-grinding#business",
    "name": "Treemarkables Stump Grinding Services",
    "description": "Professional stump grinding and removal services in Gisborne, New Zealand. Complete stump removal for residential and commercial properties with advanced grinding equipment.",
    "url": "https://app.treemarkables.co.nz/stump-grinding",
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
    "serviceType": "Stump Grinding Service",
    "priceRange": "$$",
    "openingHours": "Mo-Su 07:00-18:00"
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <SEO 
        title="Stump Grinding Gisborne – Complete Stump Removal"
        description="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        keywords="stump grinding Gisborne, fast stump removal, tidy stump grinding, Wairoa stump removal, rural stump grinding, powerful stump grinder, book stump removal"
        ogTitle="Stump Grinding Gisborne – Fast & Tidy Stump Removal"
        ogDescription="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        ogImage="https://app.treemarkables.co.nz/stump-grinding.jpg"
        canonicalUrl="https://app.treemarkables.co.nz/stump-grinding"
        structuredData={structuredData}
      />
      <Header />
      {/* Hero Section */}
      <section 
        className="relative min-h-screen bg-gradient-to-br from-primary/10 to-orange-500/10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-20">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              Stump Grinding Gisborne
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Remove unsightly stumps safely and efficiently. After a tree is cut down, the remaining stump can become an eyesore, hazard and pest haven.
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

      <section className="py-8 bg-background border-b">
        <div className="max-w-6xl mx-auto px-6">
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-foreground text-lg md:text-xl font-medium list-disc list-inside">
            <li>Tree removal</li>
            <li>Tree pruning</li>
            <li>Stump grinding</li>
            <li>Hedge trimming</li>
          </ul>
        </div>
      </section>

      {/* Stump Grinding Philosophy */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Settings className="h-10 w-10 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Complete Stump Removal
            </h2>
            <div className="max-w-4xl mx-auto space-y-4 text-lg text-muted-foreground">
              <p>
                After a tree is cut down, the remaining stump can become an eyesore, a hazard and a haven for pests. Leaving stumps in the ground can invite termites and ants, cause tripping accidents and lead to unwanted regrowth. <span className="font-semibold text-foreground">Stump grinding is the fastest and most effective way</span> to reclaim your space and protect your property.
              </p>
              <p>
                Treemarkables provides professional stump grinding services for homes, farms and commercial sites throughout Gisborne, Wairoa and the East Coast. Our powerful grinding equipment removes all traces of the old tree after <Link href="/tree-removal" className="text-primary hover:text-primary/80 underline">tree removal</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* When to Remove Stumps */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Why Stump Grinding Is Important
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Professional stump grinding provides multiple benefits for your property's 
              safety, appearance, and future landscaping potential.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Safety First
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Stumps in high-traffic areas are tripping hazards for children, visitors and pets. 
                  Removing them makes lawns and paddocks safer to use.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Pest Prevention
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Decaying stumps attract termites, ants and beetles. 
                  Grinding removes their habitat and reduces the risk of infestations.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <TreePine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Prevent Regrowth
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Grinding ensures the tree won't sprout new shoots from the remaining stump, 
                  saving you from dealing with unwanted saplings.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Aesthetic Enhancement
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Grinding eliminates the visual eyesore of stumps and 
                  improves the look of your landscape.
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
                  Landscaping Flexibility
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Once the stump is gone, you have more space for new plantings, 
                  garden beds or lawn expansion.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Our Stump Grinding Process */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Our Stump Grinding Process
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              We follow a systematic approach to ensure complete stump removal 
              while protecting your property and surrounding landscape.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Search className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-3">
                1. Assessment
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We evaluate the stump's size, species and location to determine the best approach. 
                Hardwoods like gum or oak may require more time to grind than softwoods like pine.
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Settings className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-3">
                2. Specialised Equipment
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Our modern stump grinders break down the stump below ground level, 
                allowing you to replant or lay lawn over the area. We can grind to a depth suited to your future landscaping plans.
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Trash2 className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-3">
                3. Debris Removal
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We can remove the wood chips or leave them for you to use as mulch. 
                The choice is yours.
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-3">
                4. Safety & Care
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Our team prioritises safety for your property and surrounding structures. 
                We follow strict protocols to protect underground utilities and nearby plants.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* When to Grind a Stump */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              When to Grind a Stump
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Timing matters when it comes to stump removal, especially in Gisborne's unique climate conditions.
            </p>
          </div>
          
          <div className="bg-background rounded-lg p-8 shadow-sm">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Best Practice Timing</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    It's best to grind stumps as soon as possible after <Link href="/tree-removal" className="text-primary hover:text-primary/80 underline">tree removal</Link>. 
                    Fresh stumps are easier to grind, and quick removal minimises pest and fungal risks.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Leaf className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Gisborne Climate Considerations</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    In Gisborne's damp climate, untreated stumps can rot quickly and become breeding grounds for fungi and insects. 
                    Our coastal conditions make prompt removal even more important for property health.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Don't Let Old Stumps Take Up Valuable Space
            </h3>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Contact Treemarkables for professional stump grinding services. We'll inspect your property 
              and provide a free, no-obligation quote to get your yard back to pristine condition.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleGetQuote} className="text-lg px-6" data-testid="button-quote-process">
                Get Free Quote
              </Button>
              <Button size="lg" variant="outline" onClick={handleCallNow} className="text-lg px-6" data-testid="button-call-process">
                <Phone className="w-4 h-4 mr-2" />
                Call Today
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-8">
            A warm welcome from the team
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            We understand that stump removal is often the final step in a bigger project. 
            Whether you're preparing for new landscaping, building, or just want a clean, 
            safe yard, we make the process simple and stress-free.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our powerful equipment can access tight spaces while our experienced team 
            ensures minimal disruption to your existing landscape and property.
          </p>
        </div>
      </section>

      {/* Simple Credentials */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Fully Insured</h3>
              <p className="text-muted-foreground">Complete coverage for your peace of mind</p>
            </div>
            <div>
              <Settings className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Professional Equipment</h3>
              <p className="text-muted-foreground">Powerful machinery for any size stump</p>
            </div>
            <div>
              <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Efficient Service</h3>
              <p className="text-muted-foreground">Quick removal with thorough cleanup</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
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
      <section className="py-8 md:py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Stump Grinding Service Areas
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Professional stump grinding throughout Gisborne and surrounding regions.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Gisborne Central</h4>
              <p className="text-sm text-muted-foreground">Urban stump removal</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Kaiti</h4>
              <p className="text-sm text-muted-foreground">Coastal property cleanup</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Te Hapara</h4>
              <p className="text-sm text-muted-foreground">Residential stump grinding</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Mangapapa</h4>
              <p className="text-sm text-muted-foreground">Rural property cleanup</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wainui Beach</h4>
              <p className="text-sm text-muted-foreground">Beach property services</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Makaraka</h4>
              <p className="text-sm text-muted-foreground">Semi-rural stump removal</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Elgin</h4>
              <p className="text-sm text-muted-foreground">Farm and estate cleanup</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wairoa</h4>
              <p className="text-sm text-muted-foreground">Extended service region</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Services Section */}
      <section className="py-8 md:py-16 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Complete Property Solutions
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Stump grinding often follows tree removal and may be combined with other landscaping services.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
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
                  Professional tree removal often requires follow-up stump grinding for complete property cleanup.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tree-removal">Learn More</Link>
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
                  Maintain your remaining trees with professional pruning and health care services.
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
                    <Scissors className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/hedge-trimming" className="hover:text-primary transition-colors">
                    Hedge Trimming
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Complete your landscape project with professional hedge care and boundary maintenance.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/hedge-trimming">Learn More</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <FAQSection />

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}
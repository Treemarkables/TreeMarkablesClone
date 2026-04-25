import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Star, Scissors, TreePine, Users, MapPin, Phone, AlertTriangle, Heart, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
const heroImage = "/tree-pruning.jpg";

interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  service: string;
}

const reviews: Review[] = [
  {
    id: "1",
    name: "Margaret Harrison",
    location: "Kaiti Heights, Gisborne",
    rating: 5,
    comment: "Treemarkables transformed our overgrown fruit trees into healthy, productive specimens. Their attention to detail and knowledge of local growing conditions is exceptional. The crew was punctual, professional, and cleaned up meticulously. Highly recommended for anyone seeking quality tree care in Gisborne.",
    service: "Fruit Tree Pruning"
  },
  {
    id: "2",
    name: "David Chen",
    location: "Te Hapara, Gisborne",
    rating: 5,
    comment: "Outstanding service from start to finish. The arborist provided detailed explanations of the pruning process and demonstrated extensive knowledge of native New Zealand species. The results exceeded our expectations, and our pohutukawa has never looked healthier.",
    service: "Native Tree Pruning"
  },
  {
    id: "3",
    name: "Sarah Thompson",
    location: "Wainui Beach, Gisborne",
    rating: 5,
    comment: "Professional, reliable, and expertly executed. Treemarkables pruned our coastal property trees with precision, considering both wind exposure and aesthetic appeal. Their understanding of Gisborne's unique climate conditions is evident in their work quality.",
    service: "Coastal Tree Pruning"
  },
  {
    id: "4",
    name: "Robert Williams",
    location: "Makaraka, Gisborne",
    rating: 5,
    comment: "Exceptional craftsmanship and attention to detail. The team demonstrated superior technical skills while maintaining the natural beauty of our mature oak trees. Their professional approach and comprehensive clean-up service sets them apart from competitors.",
    service: "Mature Tree Pruning"
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

export default function TreePruning() {
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

  // Local business structured data for Tree Pruning SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://app.treemarkables.co.nz/tree-pruning#business",
    "name": "Treemarkables Tree Pruning Services",
    "description": "Professional tree pruning and care services in Gisborne, New Zealand. Expert arborists specializing in structural pruning, crown thinning, deadwooding, and tree health maintenance.",
    "url": "https://app.treemarkables.co.nz/tree-pruning",
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
    "serviceType": "Tree Pruning Service",
    "priceRange": "$$",
    "openingHours": "Mo-Su 07:00-18:00"
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <SEO 
        title="Tree Pruning Gisborne – Qualified Arborists"
        description="Improve tree health and safety with our expert tree pruning services. Treemarkables offers crown reduction and shaping across Gisborne and the wider East Coast. Free assessments available."
        keywords="tree pruning Gisborne, professional arborists, tree health, crown reduction, tree shaping, East Coast tree pruning, free tree assessments, Gisborne tree care"
        ogTitle="Tree Pruning Gisborne – Professional Arborists"
        ogDescription="Improve tree health and safety with our expert tree pruning services. Treemarkables offers crown reduction and shaping across Gisborne and the wider East Coast. Free assessments available."
        ogImage="https://app.treemarkables.co.nz/tree-pruning.jpg"
        canonicalUrl="https://app.treemarkables.co.nz/tree-pruning"
        structuredData={structuredData}
      />
      <Header />
      {/* Hero Section */}
      <section className="relative min-h-screen">
        {/* Image Background */}
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-48">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6" data-testid="text-hero-title">
              Tree Pruning Gisborne
            </h1>
          </div>
        </div>
      </section>


      {/* Tree Care Philosophy */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Heart className="h-10 w-10 text-green-600 dark:text-green-400" />
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
                Professional pruning can solve most tree problems while preserving the tree's health and beauty. 
                We only recommend <a href="/tree-removal" className="text-primary hover:text-primary/80 underline">tree removal</a> when it's absolutely necessary for safety.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* When to Prune */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              When Your Trees Need Professional Care
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Recognizing the signs that your trees need attention can prevent problems 
              and keep your property safe and beautiful.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Safety Concerns
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Dead branches, storm damage, or branches hanging over houses, driveways, 
                  or power lines need immediate attention.
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
                  Health & Growth
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Diseased branches, poor structure, or overcrowded canopies that affect 
                  the tree's health and natural growth pattern.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Scissors className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3 text-center">
                  Shape & Beauty
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Improving tree structure, enhancing natural shape, or maintaining 
                  the aesthetic appeal of your landscape.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Tree Pruning Types */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Types of Tree Pruning We Specialize In
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Different situations call for different pruning techniques. Our qualified arborists 
              choose the right approach for your trees and Gisborne's coastal conditions.
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
                    Structural Pruning
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Early intervention on young trees to develop strong structure and prevent future problems. 
                    Essential for trees in coastal winds and near buildings.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-foreground">
                      Best time: Late winter to early spring
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
                    Crown Thinning
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Selective removal of branches to reduce wind resistance and allow light penetration. 
                    Perfect for coastal properties exposed to strong winds.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-foreground">
                      Reduces storm damage risk
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
                    Deadwooding
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Removal of dead, dying, or diseased branches to improve tree health and safety. 
                    Essential maintenance for all trees, especially after storms.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium text-foreground">
                      Can be done year-round
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    Crown Reduction
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Reducing tree height or spread while maintaining natural shape. Ideal for trees 
                    near power lines or buildings that have outgrown their space.
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-foreground">
                      Preserves tree while managing size
                    </span>
                  </div>
                </div>
              </div>
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
            We're passionate about trees and helping them thrive in Gisborne's unique coastal environment. 
            Whether it's a quick safety prune, detailed structural work, or complete tree removal when necessary, 
            we bring the same attention to detail and local knowledge to every job.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our team understands how salt winds, summer heat, and winter storms affect your trees. 
            We work with nature, not against it, to keep your trees healthy and your property safe.
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
              <Award className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Qualified Team</h3>
              <p className="text-muted-foreground">Certified arborists with local knowledge</p>
            </div>
            <div>
              <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Local Experts</h3>
              <p className="text-muted-foreground">Understanding Gisborne's unique conditions</p>
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
              Tree Pruning Service Areas
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Professional tree pruning services throughout Gisborne and the wider East Coast region.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Gisborne Central</h4>
              <p className="text-sm text-muted-foreground">Urban tree care and maintenance</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Kaiti</h4>
              <p className="text-sm text-muted-foreground">Coastal tree pruning specialists</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Te Hapara</h4>
              <p className="text-sm text-muted-foreground">Residential tree health care</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Mangapapa</h4>
              <p className="text-sm text-muted-foreground">Rural property tree care</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wainui Beach</h4>
              <p className="text-sm text-muted-foreground">Salt-resistant tree care</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Makaraka</h4>
              <p className="text-sm text-muted-foreground">Semi-rural tree maintenance</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Elgin</h4>
              <p className="text-sm text-muted-foreground">Farm and estate tree care</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">East Coast</h4>
              <p className="text-sm text-muted-foreground">Extended coastal regions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Services Section */}
      <section className="py-8 md:py-16 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Complete Tree Care Solutions
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Professional tree pruning is often combined with our other specialized services for comprehensive property care.
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
                  When pruning isn't enough, our certified arborists provide safe and efficient tree removal services.
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
                  Complete your tree care project with professional stump removal for a clean, finished look.
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
                    <Leaf className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/hedge-trimming" className="hover:text-primary transition-colors">
                    Hedge Trimming
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Maintain your property's boundaries and landscaping with expert hedge care and shaping services.
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
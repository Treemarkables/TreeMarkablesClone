import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Star, Scissors, TreePine, Users, MapPin, Phone, AlertTriangle, Heart, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroVideo from "@assets/copy_77E88CDC-C666-4B3C-B02C-5CE23818F128_1757799330629.mp4";

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
  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    window.location.href = 'tel:0272166882';
  };

  // Local business structured data for Tree Pruning SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://www.treemarkables.nz/tree-pruning#business",
    "name": "Treemarkables Tree Pruning Services",
    "description": "Professional tree pruning and care services in Gisborne, New Zealand. Expert arborists specializing in structural pruning, crown thinning, deadwooding, and tree health maintenance.",
    "url": "https://www.treemarkables.nz/tree-pruning",
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
    <div className="min-h-screen bg-background">
      <SEO 
        title="Tree Pruning Gisborne | Professional Arborist Services | Treemarkables NZ"
        description="Expert tree pruning services in Gisborne, NZ. Certified arborists offering structural pruning, crown thinning, deadwooding, and tree health care. Coastal conditions specialist. Call 027-216-6882."
        keywords="tree pruning Gisborne, professional arborist, tree trimming Gisborne, structural pruning, crown thinning, deadwooding, tree care Gisborne, certified arborist NZ, coastal tree pruning"
        ogTitle="Professional Tree Pruning Services in Gisborne, New Zealand"
        ogDescription="Keep your trees healthy and beautiful with expert pruning services. Specialized in Gisborne's coastal conditions. Free quotes from certified arborists."
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
                We only recommend tree removal when it's absolutely necessary for safety.
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

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}
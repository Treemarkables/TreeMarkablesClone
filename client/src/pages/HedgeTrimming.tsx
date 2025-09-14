import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Star, Scissors, TreePine, Users, MapPin, Phone, AlertTriangle, Heart, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroBackground from "@assets/IMG_5648_1757793148389.jpg";

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
  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    window.location.href = 'tel:0272166882';
  };

  // Local business structured data for Hedge Trimming SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://www.treemarkables.nz/hedge-trimming#business",
    "name": "Treemarkables Hedge Trimming Services",
    "description": "Professional hedge trimming and maintenance services in Gisborne, New Zealand. Expert shaping, pruning, and regular maintenance for residential and commercial hedges.",
    "url": "https://www.treemarkables.nz/hedge-trimming",
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
    <div className="min-h-screen bg-background">
      <SEO 
        title="Hedge Trimming Gisborne – Neat & Healthy Hedges"
        description="Keep your hedges neat year‑round. We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Request a quote."
        keywords="hedge trimming Gisborne, neat hedges, year-round hedge care, coastal hedge trimming, hedge shaping, hedge maintenance, surrounding areas hedge care"
        ogTitle="Hedge Trimming Gisborne – Neat & Healthy Hedges"
        ogDescription="Keep your hedges neat year‑round. We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Request a quote."
        structuredData={structuredData}
      />
      <Header />
      {/* Hero Section */}
      <section 
        className="relative min-h-screen bg-gradient-to-br from-primary/10 to-green-600/10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              Hedge Trimming Gisborne
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Professional hedge trimming in Gisborne. We keep your hedges healthy, 
              shaped, and looking their absolute best year-round.
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
      <section className="py-20 bg-background">
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
                At Treemarkables, we understand that hedges are the backbone of many Gisborne gardens. 
                <span className="font-semibold text-foreground"> Regular, expert trimming keeps them healthy and beautiful</span>. Like our <a href="/tree-pruning" className="text-primary hover:text-primary/80 underline">tree pruning services</a>, we focus on plant health and longevity.
              </p>
              <p>
                From formal hedges that need precise shaping to informal hedges requiring natural styling, 
                we tailor our approach to suit each hedge's variety and your property's needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* When to Trim Hedges */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              When Your Hedges Need Professional Trimming
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Regular maintenance keeps hedges healthy and attractive, but timing 
              and technique make all the difference.
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
                  Overgrown Hedges
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  When hedges grow beyond their intended size, blocking views, 
                  paths, or encroaching on neighboring properties.
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
                  Health & Density
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Regular trimming promotes dense, healthy growth and prevents 
                  hedges from becoming thin and straggly.
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
                  Shape & Style
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed text-center">
                  Maintaining formal shapes, restoring hedge lines, or creating 
                  new shapes to enhance your property's design.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Hedge Trimming Types */}
      <section className="py-20 bg-background">
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
      <section className="py-20 bg-muted/30">
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
      <section className="py-20 bg-background">
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